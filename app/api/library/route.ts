import { listLibrary } from "@/lib/library";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const books = await listLibrary();
    return Response.json({ books });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
