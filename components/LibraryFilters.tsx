"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

type Props = {
  query: string;
  onQueryChange: (v: string) => void;
  authors: string[];
  genres: string[];
  selectedAuthor: string | null;
  selectedGenre: string | null;
  onAuthor: (a: string | null) => void;
  onGenre: (g: string | null) => void;
};

export default function LibraryFilters({
  query,
  onQueryChange,
  authors,
  genres,
  selectedAuthor,
  selectedGenre,
  onAuthor,
  onGenre,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
        />
        <input
          data-search-input
          type="text"
          placeholder="Search by title"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="w-full bg-bg-1 border border-border-subtle rounded-lg pl-9 pr-9 py-2 text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-bg-3"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary p-1"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {authors.length > 0 ? (
          <Dropdown
            label="Author"
            options={authors}
            selected={selectedAuthor}
            onSelect={onAuthor}
          />
        ) : null}
        {genres.length > 0 ? (
          <Dropdown label="Genre" options={genres} selected={selectedGenre} onSelect={onGenre} />
        ) : null}
      </div>
    </div>
  );
}

const ITEM_HEIGHT_PX = 32; // matches `h-8` row height below
const MAX_VISIBLE_ROWS = 5.5;

function Dropdown({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string | null;
  onSelect: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    // Focus the search input when the menu opens.
    inputRef.current?.focus();
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(v: string | null) {
    onSelect(v);
    setOpen(false);
  }

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors " +
          (selected
            ? "bg-bg-3 border-bg-3 text-text-primary"
            : "bg-transparent border-border-subtle text-text-secondary hover:text-text-primary hover:border-bg-3")
        }
      >
        <span className="text-text-tertiary uppercase tracking-wider">{label}</span>
        <span className="max-w-[16ch] truncate">{selected ?? "All"}</span>
        <ChevronDown
          size={12}
          className={"transition-transform " + (open ? "rotate-180" : "")}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 mt-1 min-w-[16rem] max-w-[22rem] rounded-lg border border-border-subtle bg-bg-1 shadow-2xl z-20 overflow-hidden"
        >
          <div className="relative border-b border-border-subtle">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Filter ${label.toLowerCase()}s`}
              className="w-full bg-transparent pl-8 pr-7 py-2 text-sm placeholder:text-text-tertiary focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary p-0.5"
              >
                <X size={12} />
              </button>
            ) : null}
          </div>
          <ul
            className="overflow-y-auto py-1"
            style={{ maxHeight: `${ITEM_HEIGHT_PX * MAX_VISIBLE_ROWS}px` }}
          >
            {q ? null : (
              <Item active={selected === null} onClick={() => choose(null)}>
                All
              </Item>
            )}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-text-tertiary">No matches</li>
            ) : (
              filtered.map((o) => (
                <Item key={o} active={selected === o} onClick={() => choose(o)}>
                  {o}
                </Item>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Item({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        role="option"
        aria-selected={active}
        className={
          "w-full h-8 px-3 flex items-center justify-between gap-2 text-sm text-left hover:bg-bg-2 transition-colors " +
          (active ? "text-text-primary" : "text-text-secondary")
        }
      >
        <span className="truncate">{children}</span>
        {active ? <Check size={14} className="text-text-primary shrink-0" /> : null}
      </button>
    </li>
  );
}
