import { NextResponse } from "next/server";
import { createServiceDatabaseClient } from "@/services/database";
import { reviewFromRow } from "@/services/community";

type Params = Promise<{ slug: string }>;

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Params }) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Math.floor(Number(searchParams.get("page")) || 1));
  const pageSize = Math.max(1, Math.min(50, Math.floor(Number(searchParams.get("pageSize")) || 20)));
  const serviceClient = createServiceDatabaseClient();
  const from = (page - 1) * pageSize;

  const { data, error, count } = await serviceClient
    .from("reviews")
    .select("*, profiles:user_id(id,username,display_name,bio,avatar_url,created_at), games:game_id!inner(slug,title)", { count: "exact" })
    .eq("games.slug", slug)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ reviews: (data ?? []).map(reviewFromRow), count: count ?? 0, page, pageSize });
}

