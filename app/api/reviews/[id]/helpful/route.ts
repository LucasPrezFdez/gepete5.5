import { NextResponse } from "next/server";
import { createServiceDatabaseClient } from "@/services/database";
import { ensureProfile, getUserFromRequest } from "@/services/community";
import { createNotification } from "@/services/notifications";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);

  const { data: existingVote } = await serviceClient
    .from("review_helpful_votes")
    .select("review_id")
    .eq("review_id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

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

  if (!existingVote) {
    const { data: review } = await serviceClient
      .from("reviews")
      .select("user_id, game_id")
      .eq("id", id)
      .maybeSingle();
    if (review?.user_id) {
      await createNotification({
        recipientId: review.user_id,
        actorId: auth.user.id,
        type: "review_helpful",
        reviewId: id,
        gameId: review.game_id ?? null
      });
    }
  }

  return NextResponse.json({ ok: true, helpfulCount });
}

