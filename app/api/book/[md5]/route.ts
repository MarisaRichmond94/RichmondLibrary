import { scrapeDetail } from "@/lib/annas";
import { config } from "@/lib/config";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ md5: string }> }) {
  const { md5 } = await ctx.params;
  if (!/^[a-f0-9]{32}$/i.test(md5)) {
    return Response.json({ error: "Invalid md5" }, { status: 400 });
  }
  try {
    const detail = await scrapeDetail(md5);
    // Without a donor key, "fast" partner servers all dead-end at a DDoS-Guard
    // login wall, so hide them to keep the option list to things that can actually work.
    const options = config.donorKey
      ? detail.options
      : detail.options.filter((o) => o.kind !== "fast");
    return Response.json({ ...detail, options });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
