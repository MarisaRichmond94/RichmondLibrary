import { buildFilename, directDownload, startBrowserWatch } from "@/lib/download";
import { config } from "@/lib/config";
import type { DownloadOption } from "@/lib/annas";

export const dynamic = "force-dynamic";

type Body = {
  md5: string;
  title: string;
  authors: string[];
  option: DownloadOption;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.option?.url || !/^[a-f0-9]{32}$/i.test(body.md5)) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const filename = buildFilename(body.title, body.authors);

  // Server-side download path: only attempt for mirrors we expect to bypass DDoS-Guard,
  // i.e. fast_download with a donor key, or direct external mirrors that serve binaries.
  const shouldTryDirect =
    body.option.serverHandled ||
    /\.(epub|zip)(\?|$)/i.test(body.option.url) ||
    /\/file\.php\?id=/.test(body.option.url);

  if (shouldTryDirect) {
    try {
      const extraHeaders: Record<string, string> = {};
      if (body.option.kind === "fast" && config.donorKey) {
        // AA reads the donor key from a cookie named "aa_account_id2".
        extraHeaders.Cookie = `aa_account_id2=${config.donorKey}`;
      }
      const r = await directDownload({
        url: body.option.url,
        desiredFilename: filename,
        extraHeaders,
      });
      if (r.kind === "saved") {
        return Response.json({ kind: "saved", path: r.path });
      }
    } catch (err) {
      console.warn(`[download] direct ${body.option.url} failed:`, (err as Error).message);
    }
  }

  // Fallback: open the URL in the user's default browser and watch ~/Downloads.
  const watchId = await startBrowserWatch({
    md5: body.md5,
    url: body.option.url,
    desiredFilename: filename,
  });
  return Response.json({ kind: "watching", watchId });
}
