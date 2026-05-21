import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { config, coversDir } from "./config";
import { readEpub } from "./epub";

export type LibraryBook = {
  id: string;
  filename: string;
  path: string;
  title: string;
  authors: string[];
  genres: string[];
  hasCover: boolean;
  size: number;
};

async function ensureDirs() {
  await fs.mkdir(config.bookshelfDir, { recursive: true });
  await fs.mkdir(coversDir(), { recursive: true });
}

function idForPath(p: string): string {
  return crypto.createHash("md5").update(p).digest("hex");
}

function coverPathFor(id: string): string {
  return path.join(coversDir(), `${id}.img`);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}

/**
 * Flip "Last, First" → "First Last" so library-supplied author names dedupe
 * against their "First Last" equivalents. Names with multiple commas or other
 * shapes are returned unchanged.
 */
export function normalizeAuthor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  const parts = trimmed.split(",");
  if (parts.length !== 2) return trimmed;
  const last = parts[0].trim();
  const first = parts[1].trim();
  if (!last || !first) return trimmed;
  // Defensive: don't flip if a part looks like a suffix the user would want kept
  // attached (e.g. "Smith Jr., John" → keep as-is rather than producing "John Smith Jr.").
  if (/\b(jr|sr|ii|iii|iv|ph\.?d|m\.?d|esq)\.?$/i.test(last)) return trimmed;
  return `${first} ${last}`;
}

export async function listLibrary(): Promise<LibraryBook[]> {
  await ensureDirs();
  const entries = await fs.readdir(config.bookshelfDir, { withFileTypes: true });
  const books: LibraryBook[] = [];

  for (const e of entries) {
    if (!e.isFile() || !e.name.toLowerCase().endsWith(".epub")) continue;
    const full = path.join(config.bookshelfDir, e.name);
    const id = idForPath(full);
    const coverFile = coverPathFor(id);
    let hasCoverFile = await fileExists(coverFile);

    let title = e.name.replace(/\.epub$/i, "");
    let authors: string[] = [];
    let genres: string[] = [];
    let size = 0;

    try {
      const stat = await fs.stat(full);
      size = stat.size;
      const data = await readEpub(full);
      if (data.title) title = data.title;
      authors = Array.from(new Set(data.authors.map(normalizeAuthor)));
      genres = data.genres;
      if (!hasCoverFile && data.coverBuffer) {
        await fs.writeFile(coverFile, data.coverBuffer);
        hasCoverFile = true;
      }
    } catch (err) {
      console.warn(`[library] Failed to parse ${e.name}:`, (err as Error).message);
    }

    books.push({
      id,
      filename: e.name,
      path: full,
      title,
      authors,
      genres,
      hasCover: hasCoverFile,
      size,
    });
  }

  books.sort((a, b) => a.title.localeCompare(b.title));
  return books;
}

export async function getCoverPath(id: string): Promise<string | null> {
  const p = coverPathFor(id);
  return (await fileExists(p)) ? p : null;
}

export function bookshelfPath(): string {
  return config.bookshelfDir;
}
