import fs from "node:fs/promises";
import { getCoverPath } from "@/lib/library";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function sniffMime(buf: Buffer): string {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return "application/octet-stream";
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-f0-9]{32}$/i.test(id)) {
    return new Response("Bad id", { status: 400 });
  }
  const filePath = await getCoverPath(id);
  if (!filePath) return new Response("Not found", { status: 404 });
  const buf = await fs.readFile(filePath);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": sniffMime(buf),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
