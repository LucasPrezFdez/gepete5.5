import { NextResponse } from "next/server";
import { createServiceDatabaseClient } from "@/services/database";
import { ensureProfile, getUserFromRequest } from "@/services/community";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);

  const { error: voteError } = await serviceClient
    .from("review_helpful_votes")
    .upsert({ review_id: id, user_id: auth.user.id }, { onConflict: "review_id,user_id" });

  if (voteError) return NextResponse.json({ error: voteError.message }, { status: 500 });

  const { count, error: countError } = await serviceClient
    .from("review_helpful_votes")
    .select("review_id", { count: "exact", head: true })
    .eq("review_id", id);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

  const helpfulCount = count ?? 0;
  await serviceClient.from("reviews").update({ helpful_count: helpfulCount }).eq("id", id);

  return NextResponse.json({ ok: true, helpfulCount });
}

