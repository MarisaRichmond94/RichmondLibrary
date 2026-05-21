import * as cheerio from "cheerio";
import { config } from "./config";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type SearchResult = {
  md5: string;
  title: string;
  authors: string[];
  publisher?: string;
  year?: string;
  language?: string;
  ext?: string;
  sizeMb?: string;
  coverUrl?: string;
};

export type DownloadOption = {
  kind: "fast" | "slow" | "external";
  label: string;
  url: string;          // absolute URL
  serverHandled: boolean; // true → safe to fetch server-side
};

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Anna's Archive returned ${res.status} for ${url}`);
  return res.text();
}

function norm(s: string | undefined | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Parse the metadata line "English [en] · EPUB · 0.3MB · 2012 · ..."
 */
function parseMetaLine(text: string): {
  language?: string;
  ext?: string;
  sizeMb?: string;
  year?: string;
} {
  const parts = text.split("·").map((p) => p.trim());
  const out: { language?: string; ext?: string; sizeMb?: string; year?: string } = {};
  for (const p of parts) {
    if (/^[A-Za-z]+ \[[a-z]{2,3}\]$/.test(p)) out.language = p;
    else if (/^[A-Z]{2,5}\d?$/.test(p)) out.ext = p; // EPUB, PDF, MOBI, AZW3
    else if (/^[\d.]+\s*(KB|MB|GB)$/i.test(p)) out.sizeMb = p;
    else if (/^\d{4}$/.test(p)) out.year = p;
  }
  return out;
}

export async function scrapeSearch({
  title,
  author,
  ext = "epub",
}: {
  title?: string;
  author?: string;
  ext?: string;
}): Promise<SearchResult[]> {
  const q = [title, author].filter(Boolean).join(" ").trim();
  if (!q) return [];
  const url = `${config.baseUrl}/search?q=${encodeURIComponent(q)}&ext=${ext}&lang=en`;
  const html = await fetchHtml(url);
  // AA sometimes wraps lower-quality results in HTML comments; strip them so cheerio sees them.
  const visibleHtml = html.replace(/<!--\s*([\s\S]*?)\s*-->/g, (_, inner) =>
    inner.includes('href="/md5/') ? inner : "",
  );
  const $ = cheerio.load(visibleHtml);
  const seen = new Set<string>();
  const results: SearchResult[] = [];

  $("a.js-vim-focus").each((_, el) => {
    const titleA = $(el);
    const href = titleA.attr("href") ?? "";
    const m = href.match(/^\/md5\/([a-f0-9]{32})/);
    if (!m) return;
    const md5 = m[1];
    if (seen.has(md5)) return;
    seen.add(md5);

    // Tile root: closest ancestor with both "flex" and "pt-3" classes (the row wrapper).
    const tile = titleA.closest("div.flex.pt-3");
    const rTitle = norm(titleA.text());

    // Cover img lives inside the cover <a> with href="/md5/{md5}".
    const coverImg = tile.find(`a[href="/md5/${md5}"] img`).first();
    const coverUrl = coverImg.attr("src");

    // Sub-links: first is the author, second (if present) is the publisher.
    const subLinks = tile.find('a[href^="/search?q="]');
    const authorText = norm($(subLinks[0]).text());
    const publisherText = subLinks.length > 1 ? norm($(subLinks[1]).text()) : undefined;
    // Split on ; or " and ", but NOT on "," (authors are typically "Last, First").
    const authors = authorText
      .split(/\s*(?:;|&| and )\s*/i)
      .map((s) => s.trim())
      .filter(Boolean);

    // Metadata div has the signature class set: text-gray-800 + font-semibold + text-sm.
    // Use only its direct text-node children (skip the trailing <a>Save</a>/<span>...</span>).
    let metaText = "";
    const metaDiv = tile.find("div.text-gray-800.font-semibold.text-sm").first();
    if (metaDiv.length) {
      metaText = metaDiv
        .contents()
        .filter((_, n) => n.type === "text")
        .map((_, n) => $(n).text())
        .get()
        .join(" ");
    }
    const meta = parseMetaLine(norm(metaText));

    results.push({
      md5,
      title: rTitle,
      authors,
      publisher: publisherText,
      coverUrl,
      ...meta,
    });
  });

  // Strict filter so "Split" alone doesn't dump unrelated books on the user.
  return results.filter((r) => {
    if (title) {
      const t = title.toLowerCase().trim();
      if (!r.title.toLowerCase().includes(t)) return false;
    }
    if (author) {
      const a = author.toLowerCase().trim();
      if (!r.authors.join(" ").toLowerCase().includes(a)) return false;
    }
    if (ext && r.ext && r.ext.toLowerCase() !== ext.toLowerCase()) return false;
    return true;
  });
}

export async function scrapeDetail(md5: string): Promise<{
  title: string;
  authors: string[];
  coverUrl?: string;
  ext?: string;
  sizeMb?: string;
  year?: string;
  options: DownloadOption[];
}> {
  const url = `${config.baseUrl}/md5/${md5}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  // Title is the first h1-ish heading; fall back to <title>
  const title =
    norm($("div.text-3xl.font-bold").first().text()) ||
    norm($("title").text()).replace(/\s*\|\s*Anna.*$/i, "");

  const authors = norm($('a[href^="/search?q="] span.icon-\\[mdi--user-edit\\]').parent().text())
    .split(/[;,&]| and /i)
    .map((s) => s.trim())
    .filter(Boolean);

  const coverUrl = $('img[src*="covers"]').first().attr("src");

  // Metadata pill row
  const metaText = norm(
    $("div").filter((_, d) => /·\s*(EPUB|PDF|MOBI|AZW3)\s*·/i.test($(d).text())).first().text(),
  );
  const meta = parseMetaLine(metaText);

  const options: DownloadOption[] = [];
  $("a.js-download-link").each((_, el) => {
    const $a = $(el);
    const rawHref = $a.attr("href") ?? "";
    const label = norm($a.text());
    if (!rawHref) return;
    let abs = rawHref;
    if (rawHref.startsWith("/")) abs = `${config.baseUrl}${rawHref}`;
    let kind: DownloadOption["kind"] = "external";
    if (rawHref.includes("/fast_download/")) kind = "fast";
    else if (rawHref.includes("/slow_download/")) kind = "slow";
    // slow/fast download endpoints sit behind DDoS-Guard for non-donor clients,
    // so we can't reliably fetch them server-side without a donor cookie.
    const serverHandled = kind === "fast" && Boolean(config.donorKey);
    options.push({ kind, label, url: abs, serverHandled });
  });

  // De-dupe and prefer fast > slow > external
  const seen = new Set<string>();
  const dedup = options.filter((o) => {
    if (seen.has(o.url)) return false;
    seen.add(o.url);
    return true;
  });
  dedup.sort((a, b) => {
    const order = { fast: 0, slow: 1, external: 2 } as const;
    return order[a.kind] - order[b.kind];
  });

  return { title, authors, coverUrl, options: dedup, ...meta };
}
