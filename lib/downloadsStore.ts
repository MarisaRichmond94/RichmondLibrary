"use client";

import type { SearchResult, DownloadOption } from "./annas";

export type DownloadPhase =
  | "preparing"
  | "fetching"
  | "watching"
  | "saved"
  | "imported"
  | "error";

export type DownloadEntry = {
  id: string;
  md5: string;
  title: string;
  authors: string[];
  coverUrl?: string;
  phase: DownloadPhase;
  message?: string;
  mirrorLabel?: string;
  destPath?: string;
  startedAt: number;
};

type State = { entries: DownloadEntry[] };

let state: State = { entries: [] };
const listeners = new Set<() => void>();
// Track which md5s have been queued so a double-click on a result doesn't queue twice.
const inFlight = new Set<string>();

function notify() {
  for (const l of listeners) l();
}

function update(id: string, patch: Partial<DownloadEntry>) {
  state = {
    entries: state.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  };
  notify();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): State {
  return state;
}

export function getServerSnapshot(): State {
  return { entries: [] };
}

export function removeEntry(id: string) {
  const e = state.entries.find((x) => x.id === id);
  if (e) inFlight.delete(e.md5);
  state = { entries: state.entries.filter((x) => x.id !== id) };
  notify();
}

export function clearFinished() {
  for (const e of state.entries) {
    if (e.phase === "saved" || e.phase === "imported" || e.phase === "error") {
      inFlight.delete(e.md5);
    }
  }
  state = {
    entries: state.entries.filter(
      (e) => e.phase !== "saved" && e.phase !== "imported" && e.phase !== "error",
    ),
  };
  notify();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function startDownload(result: SearchResult): Promise<void> {
  if (inFlight.has(result.md5)) return;
  inFlight.add(result.md5);

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  state = {
    entries: [
      {
        id,
        md5: result.md5,
        title: result.title,
        authors: result.authors,
        coverUrl: result.coverUrl,
        phase: "preparing",
        startedAt: Date.now(),
      },
      ...state.entries,
    ],
  };
  notify();

  try {
    const detailRes = await fetch(`/api/book/${result.md5}`);
    const detail = (await detailRes.json()) as { options?: DownloadOption[]; error?: string };
    if (!detailRes.ok) throw new Error(detail.error ?? "Failed to load mirror list");
    const opt = detail.options?.[0];
    if (!opt) throw new Error("No mirrors available for this book");

    update(id, { phase: "fetching", mirrorLabel: opt.label });
    const dlRes = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        md5: result.md5,
        title: result.title,
        authors: result.authors,
        option: opt,
      }),
    });
    const dl = (await dlRes.json()) as
      | { kind: "saved"; path: string }
      | { kind: "watching"; watchId: string }
      | { error: string };
    if (!dlRes.ok || "error" in dl) {
      throw new Error("error" in dl ? dl.error : "Download failed");
    }

    if (dl.kind === "saved") {
      update(id, { phase: "saved", destPath: dl.path });
      inFlight.delete(result.md5);
      return;
    }

    // Browser-watch fallback. Poll the server-side watcher until it imports the
    // file or until 5 minutes elapse.
    update(id, { phase: "watching", message: "Click Download in the browser tab that opened" });
    const deadline = Date.now() + 5 * 60 * 1000;
    while (Date.now() < deadline) {
      await sleep(2000);
      const wr = await fetch(`/api/download/watch?id=${dl.watchId}`);
      if (!wr.ok) continue;
      const w = (await wr.json()) as
        | { phase: "watching" }
        | { phase: "imported"; path: string }
        | { phase: "unknown" };
      if (w.phase === "imported") {
        update(id, { phase: "imported", destPath: w.path, message: undefined });
        inFlight.delete(result.md5);
        return;
      }
    }
    throw new Error("Timed out waiting for new EPUB in ~/Downloads");
  } catch (err) {
    update(id, { phase: "error", message: (err as Error).message });
    inFlight.delete(result.md5);
  }
}
