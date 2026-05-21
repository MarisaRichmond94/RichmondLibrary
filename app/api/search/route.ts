import { scrapeSearch } from "@/lib/annas";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const title = sp.get("title") ?? undefined;
  const author = sp.get("author") ?? undefined;
  if (!title && !author) {
    return Response.json({ results: [] });
  }
  try {
    const results = await scrapeSearch({ title, author });
    return Response.json({ results });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
