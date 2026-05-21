import os from "node:os";
import path from "node:path";

function expandHome(p: string): string {
  if (p.startsWith("~")) return path.join(os.homedir(), p.slice(1));
  return p;
}

export const config = {
  bookshelfDir: expandHome(process.env.BOOKSHELF_DIR ?? "~/BookShelf"),
  donorKey: process.env.AA_DONOR_KEY ?? "",
  baseUrl: process.env.AA_BASE_URL ?? "https://annas-archive.gl",
};

export function coversDir(): string {
  return path.join(config.bookshelfDir, ".covers");
}
