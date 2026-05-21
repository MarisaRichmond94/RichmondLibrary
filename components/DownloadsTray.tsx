"use client";

import { useSyncExternalStore, useState } from "react";
import { Check, ChevronDown, Loader2, TriangleAlert, X } from "lucide-react";
import {
  clearFinished,
  getServerSnapshot,
  getSnapshot,
  removeEntry,
  subscribe,
  type DownloadEntry,
  type DownloadPhase,
} from "@/lib/downloadsStore";

export default function DownloadsTray() {
  const { entries } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [collapsed, setCollapsed] = useState(false);

  if (entries.length === 0) return null;

  const active = entries.filter(
    (e) => e.phase !== "saved" && e.phase !== "imported" && e.phase !== "error",
  ).length;
  const done = entries.length - active;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border-subtle bg-bg-1/95 backdrop-blur-xl shadow-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-b border-border-subtle hover:bg-bg-2 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Downloads</span>
          {active > 0 ? (
            <span className="text-xs text-text-tertiary">{active} in progress</span>
          ) : (
            <span className="text-xs text-text-tertiary">{done} done</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {done > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearFinished();
              }}
              className="text-[11px] text-text-tertiary hover:text-text-primary px-2 py-1 rounded hover:bg-bg-3 transition-colors"
            >
              Clear done
            </button>
          ) : null}
          <ChevronDown
            size={14}
            className={"text-text-tertiary transition-transform " + (collapsed ? "" : "rotate-180")}
          />
        </div>
      </button>
      {collapsed ? null : (
        <ul className="max-h-80 overflow-y-auto divide-y divide-border-subtle">
          {entries.map((e) => (
            <Row key={e.id} entry={e} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ entry }: { entry: DownloadEntry }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <PhaseIcon phase={entry.phase} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" title={entry.title}>
          {entry.title}
        </div>
        <div className="text-xs text-text-secondary truncate">
          {entry.authors.join(", ") || "Unknown author"}
        </div>
        <div className="text-[11px] text-text-tertiary mt-1 truncate">{statusLine(entry)}</div>
      </div>
      <button
        type="button"
        onClick={() => removeEntry(entry.id)}
        className="text-text-tertiary hover:text-text-primary p-1 -m-1 rounded"
        title={
          entry.phase === "saved" || entry.phase === "imported" || entry.phase === "error"
            ? "Remove"
            : "Cancel (download continues in background if already started)"
        }
      >
        <X size={14} />
      </button>
    </li>
  );
}

function PhaseIcon({ phase }: { phase: DownloadPhase }) {
  if (phase === "saved" || phase === "imported") {
    return <Check size={16} className="text-green-400 shrink-0 mt-0.5" />;
  }
  if (phase === "error") {
    return <TriangleAlert size={16} className="text-accent shrink-0 mt-0.5" />;
  }
  return <Loader2 size={16} className="text-text-secondary animate-spin shrink-0 mt-0.5" />;
}

function statusLine(e: DownloadEntry): string {
  switch (e.phase) {
    case "preparing":
      return "Finding mirrors...";
    case "fetching":
      return `Trying ${e.mirrorLabel ?? "mirror"}...`;
    case "watching":
      return e.message ?? "Waiting for download in browser";
    case "saved":
      return `Saved to ${shortPath(e.destPath)}`;
    case "imported":
      return `Imported to ${shortPath(e.destPath)}`;
    case "error":
      return e.message ?? "Failed";
  }
}

function shortPath(p?: string): string {
  if (!p) return "";
  return p.replace(/^.*\//, "");
}
