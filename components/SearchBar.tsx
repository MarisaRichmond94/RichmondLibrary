"use client";

import { Search } from "lucide-react";
import { useEffect, useRef } from "react";

type Props = {
  title: string;
  author: string;
  onTitle: (v: string) => void;
  onAuthor: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
};

export default function SearchBar({ title, author, onTitle, onAuthor, onSubmit, loading }: Props) {
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        titleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      className="flex flex-col sm:flex-row gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="relative flex-1">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
        />
        <input
          ref={titleRef}
          data-search-input
          type="text"
          placeholder="Title (e.g. Split)"
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          className="w-full bg-bg-1 border border-border-subtle rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-bg-3"
        />
      </div>
      <input
        type="text"
        placeholder="Author (e.g. Avasthi)"
        value={author}
        onChange={(e) => onAuthor(e.target.value)}
        className="sm:flex-1 bg-bg-1 border border-border-subtle rounded-lg px-3 py-2 text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-bg-3"
      />
      <button
        type="submit"
        disabled={loading || (!title.trim() && !author.trim())}
        className="px-5 py-2 rounded-lg bg-text-primary text-bg-0 font-medium text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
      >
        {loading ? "Searching..." : "Search"}
      </button>
    </form>
  );
}
