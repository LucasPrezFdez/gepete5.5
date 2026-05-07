import { NextResponse } from "next/server";
import type { Game } from "@/data/games";
import { createServiceDatabaseClient } from "@/services/database";
import { ensureProfile, getUserFromRequest, recordActivity } from "@/services/community";
import { getAvailableListSlug, listFromRow, upsertListItems } from "@/services/lists";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username") ?? undefined;
  const serviceClient = createServiceDatabaseClient();

  let query = serviceClient
    .from("lists")
    .select("*, profiles:user_id(id,username,display_name,bio,avatar_url,created_at), list_items(position,note,games(slug,title,summary,release_year,status,cover_url,hero_url,user_score,critic_score,rating_count,review_count))")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(24);

  if (username) query = query.eq("profiles.username", username);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ lists: (data ?? []).filter((row: any) => row.profiles).map(listFromRow) });
}

export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const title = String(payload?.title ?? "").trim();
  const description = String(payload?.description ?? "").trim();
  const isPublic = payload?.isPublic !== false;
  const games = Array.isArray(payload?.games) ? (payload.games as Partial<Game>[]) : [];

  if (title.length < 3) return NextResponse.json({ error: "El título de la lista es demasiado corto." }, { status: 400 });

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);
  const slug = await getAvailableListSlug(serviceClient, slugify(title));

  const { data: list, error } = await serviceClient
    .from("lists")
    .insert({
      user_id: auth.user.id,
      slug,
      title,
      description: description || null,
      is_public: isPublic
    })
    .select("id, slug, title")
    .single();

  if (error || !list) return NextResponse.json({ error: error?.message ?? "No se pudo crear la lista." }, { status: 500 });

  await upsertListItems(serviceClient, list.id, games);
  await recordActivity(serviceClient, {
    userId: auth.user.id,
    listId: list.id,
    type: "list",
    message: `creó la lista ${list.title}`
  }).catch(() => null);

  return NextResponse.json({ ok: true, slug: list.slug });
}

