import AdmZip from "adm-zip";
import { parseStringPromise } from "xml2js";
import path from "node:path";

export type EpubMetadata = {
  title: string;
  authors: string[];
  genres: string[];
  language?: string;
};

export type EpubData = EpubMetadata & {
  coverBuffer?: Buffer;
  coverMime?: string;
};

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function textOf(node: unknown): string {
  if (typeof node === "string") return node.trim();
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (typeof obj._ === "string") return obj._.trim();
  }
  return "";
}

async function readOpf(zip: AdmZip): Promise<{ opf: Record<string, unknown>; opfDir: string }> {
  const containerEntry = zip.getEntry("META-INF/container.xml");
  if (!containerEntry) throw new Error("Missing META-INF/container.xml");
  const container = await parseStringPromise(containerEntry.getData().toString("utf8"));
  const rootfileFullPath: string =
    container?.container?.rootfiles?.[0]?.rootfile?.[0]?.$?.["full-path"];
  if (!rootfileFullPath) throw new Error("Could not locate OPF rootfile");
  const opfEntry = zip.getEntry(rootfileFullPath);
  if (!opfEntry) throw new Error(`Missing OPF at ${rootfileFullPath}`);
  const opf = await parseStringPromise(opfEntry.getData().toString("utf8"));
  return { opf, opfDir: path.posix.dirname(rootfileFullPath) };
}

function parseMetadata(opf: Record<string, unknown>): EpubMetadata {
  const pkg = (opf.package as Record<string, unknown>) ?? {};
  const metaArr = asArray(pkg.metadata as unknown)[0] as Record<string, unknown> | undefined;
  if (!metaArr) return { title: "", authors: [], genres: [] };

  const title = textOf(asArray(metaArr["dc:title"])[0]);
  const authors = asArray(metaArr["dc:creator"]).map(textOf).filter(Boolean);
  const genres = asArray(metaArr["dc:subject"]).map(textOf).filter(Boolean);
  const language = textOf(asArray(metaArr["dc:language"])[0]) || undefined;

  return { title, authors, genres, language };
}

function findCoverHref(opf: Record<string, unknown>): { href?: string; mime?: string } {
  const pkg = (opf.package as Record<string, unknown>) ?? {};
  const manifest = (asArray(pkg.manifest)[0] as Record<string, unknown>) ?? {};
  const items = asArray(manifest.item) as Array<{ $?: Record<string, string> }>;

  // Strategy 1: <meta name="cover" content="X"> → <item id="X" href="...">
  const metadata = (asArray(pkg.metadata)[0] as Record<string, unknown>) ?? {};
  const metaTags = asArray(metadata.meta) as Array<{ $?: Record<string, string> }>;
  const coverMeta = metaTags.find((m) => m.$?.name === "cover")?.$?.content;
  if (coverMeta) {
    const item = items.find((i) => i.$?.id === coverMeta);
    if (item?.$?.href) return { href: item.$.href, mime: item.$["media-type"] };
  }

  // Strategy 2: manifest item with properties="cover-image" (EPUB 3)
  const epub3Cover = items.find((i) => (i.$?.properties ?? "").split(/\s+/).includes("cover-image"));
  if (epub3Cover?.$?.href) return { href: epub3Cover.$.href, mime: epub3Cover.$["media-type"] };

  // Strategy 3: any image whose id or href contains "cover"
  const guess = items.find((i) => {
    const id = (i.$?.id ?? "").toLowerCase();
    const href = (i.$?.href ?? "").toLowerCase();
    const mt = (i.$?.["media-type"] ?? "").toLowerCase();
    return mt.startsWith("image/") && (id.includes("cover") || href.includes("cover"));
  });
  if (guess?.$?.href) return { href: guess.$.href, mime: guess.$["media-type"] };

  return {};
}

export async function readEpub(filePath: string): Promise<EpubData> {
  const zip = new AdmZip(filePath);
  const { opf, opfDir } = await readOpf(zip);
  const meta = parseMetadata(opf);
  const { href, mime } = findCoverHref(opf);
  let coverBuffer: Buffer | undefined;
  let coverMime: string | undefined;
  if (href) {
    const fullPath = opfDir ? path.posix.join(opfDir, href) : href;
    const entry = zip.getEntry(fullPath);
    if (entry) {
      coverBuffer = entry.getData();
      coverMime = mime ?? "image/jpeg";
    }
  }
  return { ...meta, coverBuffer, coverMime };
}
