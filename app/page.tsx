"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import BookCard from "@/components/BookCard";
import BookGrid from "@/components/BookGrid";
import SearchBar from "@/components/SearchBar";
import { startDownload } from "@/lib/downloadsStore";
import type { SearchResult } from "@/lib/annas";

export default function Discover() {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch() {
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (title.trim()) params.set("title", title.trim());
      if (author.trim()) params.set("author", author.trim());
      const res = await fetch(`/api/search?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults(data.results);
    } catch (err) {
      setError((err as Error).message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Discover</h1>
      <SearchBar
        title={title}
        author={author}
        onTitle={setTitle}
        onAuthor={setAuthor}
        onSubmit={runSearch}
        loading={loading}
      />

      {error ? <div className="text-sm text-accent">{error}</div> : null}

      {results === null ? (
        <EmptySearch />
      ) : results.length === 0 ? (
        <div className="text-text-secondary text-sm py-12 text-center">
          No EPUBs match that title + author. Try fewer words.
        </div>
      ) : (
        <>
          <div className="text-sm text-text-secondary">
            {results.length} result{results.length === 1 ? "" : "s"} · click any to start downloading
          </div>
          <BookGrid>
            {results.map((r) => (
              <BookCard
                key={r.md5}
                title={r.title}
                authors={r.authors}
                coverUrl={r.coverUrl}
                badge={r.sizeMb}
                onClick={() => startDownload(r)}
              />
            ))}
          </BookGrid>
        </>
      )}
    </div>
  );
}

function EmptySearch() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-text-secondary">
      <Search size={40} />
      <div className="text-sm">Search Anna&apos;s Archive for an EPUB.</div>
      <div className="text-xs text-text-tertiary max-w-sm text-center">
        Provide a title, an author, or both. Click any result to start downloading — multiple
        downloads run in parallel and show in the tray.
      </div>
    </div>
  );
}
