import { exec } from "node:child_process";
import path from "node:path";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { path: target, open } = (await req.json()) as { path: string; open?: boolean };
  // Only allow operating on files inside the configured bookshelf dir.
  const resolved = path.resolve(target);
  const base = path.resolve(config.bookshelfDir);
  if (!resolved.startsWith(base + path.sep)) {
    return Response.json({ error: "Path outside library" }, { status: 400 });
  }
  const cmd = open
    ? ["open", "-a", "Books", resolved]
    : ["open", "-R", resolved];
  await new Promise<void>((resolve, reject) =>
    exec(cmd.map((s) => `'${s.replace(/'/g, "'\\''")}'`).join(" "), (err) =>
      err ? reject(err) : resolve(),
    ),
  );
  return Response.json({ ok: true });
}
