import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { exec } from "node:child_process";
import { config } from "./config";
import { sanitizeFilename } from "./library";

export type WatchState = {
  id: string;
  startedAt: number;
  destDir: string;
  desiredFilename: string;
  importedPath?: string;
  initialSet: Set<string>;
};

const watches = new Map<string, WatchState>();

export function downloadsDir(): string {
  return path.join(os.homedir(), "Downloads");
}

export function buildFilename(title: string, authors: string[]): string {
  const t = sanitizeFilename(title || "Untitled");
  const a = sanitizeFilename(authors.join(", ") || "Unknown");
  return `${t} - ${a}.epub`;
}

async function listEpubs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((n) => n.toLowerCase().endsWith(".epub"));
  } catch {
    return [];
  }
}

export async function startBrowserWatch(opts: {
  url: string;
  desiredFilename: string;
}): Promise<string> {
  const id = crypto.randomBytes(8).toString("hex");
  const dir = downloadsDir();
  const initial = new Set(await listEpubs(dir));
  watches.set(id, {
    id,
    startedAt: Date.now(),
    destDir: dir,
    desiredFilename: opts.desiredFilename,
    initialSet: initial,
  });
  // Open in user's default browser
  await new Promise<void>((resolve) =>
    exec(`open '${opts.url.replace(/'/g, "'\\''")}'`, () => resolve()),
  );
  // GC old watches
  for (const [k, v] of watches.entries()) {
    if (Date.now() - v.startedAt > 10 * 60 * 1000) watches.delete(k);
  }
  return id;
}

export async function pollWatch(id: string): Promise<{ phase: "watching" } | { phase: "imported"; path: string } | { phase: "unknown" }> {
  const w = watches.get(id);
  if (!w) return { phase: "unknown" };
  if (w.importedPath) return { phase: "imported", path: w.importedPath };
  if (Date.now() - w.startedAt > 5 * 60 * 1000) {
    watches.delete(id);
    return { phase: "unknown" };
  }
  const current = await listEpubs(w.destDir);
  const fresh = current.filter((n) => !w.initialSet.has(n));
  if (fresh.length === 0) return { phase: "watching" };

  // Pick the most recently modified fresh epub
  let pick: { name: string; mtimeMs: number } | null = null;
  for (const n of fresh) {
    const s = await fs.stat(path.join(w.destDir, n));
    if (!pick || s.mtimeMs > pick.mtimeMs) pick = { name: n, mtimeMs: s.mtimeMs };
  }
  if (!pick) return { phase: "watching" };

  // Make sure the file is fully written: size should be stable across a short delay
  const src = path.join(w.destDir, pick.name);
  const s1 = await fs.stat(src);
  await new Promise((r) => setTimeout(r, 600));
  const s2 = await fs.stat(src);
  if (s1.size !== s2.size || s2.size === 0) return { phase: "watching" };

  await fs.mkdir(config.bookshelfDir, { recursive: true });
  const dest = path.join(config.bookshelfDir, w.desiredFilename);
  await fs.rename(src, dest).catch(async () => {
    // Cross-device fallback
    await fs.copyFile(src, dest);
    await fs.unlink(src);
  });
  w.importedPath = dest;
  return { phase: "imported", path: dest };
}

export async function directDownload(opts: {
  url: string;
  desiredFilename: string;
  extraHeaders?: Record<string, string>;
}): Promise<{ kind: "saved"; path: string } | { kind: "not-epub" }> {
  const res = await fetch(opts.url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
      Accept: "application/epub+zip,application/octet-stream,*/*;q=0.5",
      ...(opts.extraHeaders ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Mirror returned ${res.status}`);
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  // If the server replied with HTML, this isn't a direct EPUB — caller should fall back.
  if (ct.includes("text/html")) return { kind: "not-epub" };

  await fs.mkdir(config.bookshelfDir, { recursive: true });
  const dest = path.join(config.bookshelfDir, opts.desiredFilename);
  const partial = `${dest}.partial`;
  const buf = Buffer.from(await res.arrayBuffer());
  // Sanity: EPUB files start with PK (zip)
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    return { kind: "not-epub" };
  }
  await fs.writeFile(partial, buf);
  await fs.rename(partial, dest);
  return { kind: "saved", path: dest };
}
