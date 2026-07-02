"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Folder } from "lucide-react";
import BookCard from "@/components/BookCard";
import BookGrid from "@/components/BookGrid";
import LibraryFilters from "@/components/LibraryFilters";
import type { LibraryBook } from "@/lib/library";

export default function LibraryPage() {
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selected, setSelected] = useState<LibraryBook | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/library");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Failed to load library");
        setBooks(data.books);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        (document.querySelector("[data-search-input]") as HTMLInputElement | null)?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const authors = useMemo(() => {
    const s = new Set<string>();
    for (const b of books) for (const a of b.authors) s.add(a);
    return Array.from(s).sort();
  }, [books]);

  const genres = useMemo(() => {
    const s = new Set<string>();
    for (const b of books) for (const g of b.genres) s.add(g);
    return Array.from(s).sort();
  }, [books]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      if (q && !b.title.toLowerCase().includes(q)) return false;
      if (selectedAuthor && !b.authors.includes(selectedAuthor)) return false;
      if (selectedGenre && !b.genres.includes(selectedGenre)) return false;
      return true;
    });
  }, [books, query, selectedAuthor, selectedGenre]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Book Shelf</h1>
        <span className="text-sm text-text-secondary">
          {filtered.length} of {books.length}
        </span>
      </div>

      <LibraryFilters
        query={query}
        onQueryChange={setQuery}
        authors={authors}
        genres={genres}
        selectedAuthor={selectedAuthor}
        selectedGenre={selectedGenre}
        onAuthor={setSelectedAuthor}
        onGenre={setSelectedGenre}
      />

      {loading ? (
        <div className="text-text-secondary text-sm py-12 text-center">Loading...</div>
      ) : error ? (
        <div className="text-accent text-sm py-12 text-center">{error}</div>
      ) : books.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="text-text-secondary text-sm py-12 text-center">
          No books match those filters.
        </div>
      ) : (
        <BookGrid>
          {filtered.map((b) => (
            <BookCard
              key={b.id}
              title={b.title}
              authors={b.authors}
              coverUrl={b.hasCover ? `/api/cover/${b.id}?v=${b.coverVersion}` : undefined}
              onClick={() => setSelected(b)}
            />
          ))}
        </BookGrid>
      )}

      {selected ? <DetailDrawer book={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-text-secondary">
      <BookOpen size={40} />
      <div className="text-sm">Your book shelf is empty.</div>
      <div className="text-xs text-text-tertiary">
        Drop EPUB files into ~/BookShelf, or search on the Discover tab.
      </div>
    </div>
  );
}

function DetailDrawer({ book, onClose }: { book: LibraryBook; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <aside
        className="relative ml-auto h-full w-full max-w-sm bg-bg-1 border-l border-border-subtle p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aspect-[2/3] w-40 mb-4 bg-bg-2 rounded-md overflow-hidden book-cover-shadow mx-auto">
          {book.hasCover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/cover/${book.id}?v=${book.coverVersion}`}
              alt={book.title}
              className="object-cover w-full h-full"
            />
          ) : null}
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-center">{book.title}</h2>
        <p className="text-sm text-text-secondary text-center">
          {book.authors.join(", ") || "Unknown author"}
        </p>
        {book.genres.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
            {book.genres.map((g) => (
              <span
                key={g}
                className="text-[11px] px-2 py-0.5 rounded-full bg-bg-2 text-text-secondary"
              >
                {g}
              </span>
            ))}
          </div>
        ) : null}
        <dl className="mt-6 text-xs text-text-secondary space-y-1">
          <div className="flex justify-between gap-3">
            <dt>File</dt>
            <dd className="text-right text-text-primary truncate" title={book.filename}>
              {book.filename}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Size</dt>
            <dd className="text-right text-text-primary">{formatSize(book.size)}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            className="w-full text-sm py-2 rounded-lg bg-bg-3 hover:bg-bg-2 transition-colors"
            onClick={() =>
              fetch("/api/reveal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: book.path }),
              })
            }
          >
            <Folder size={14} className="inline mr-1.5 -mt-0.5" />
            Reveal in Finder
          </button>
          <button
            type="button"
            className="w-full text-sm py-2 rounded-lg bg-bg-3 hover:bg-bg-2 transition-colors"
            onClick={() =>
              fetch("/api/reveal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: book.path, open: true }),
              })
            }
          >
            Open in Apple Books
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full text-sm py-2 rounded-lg text-text-secondary hover:text-text-primary"
          >
            Close
          </button>
        </div>
      </aside>
    </div>
  );
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
