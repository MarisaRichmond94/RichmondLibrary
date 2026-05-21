import { pollWatch } from "@/lib/download";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ phase: "unknown" }, { status: 400 });
  const r = await pollWatch(id);
  return Response.json(r);
}
