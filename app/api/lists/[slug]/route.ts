import { NextResponse } from "next/server";
import type { Game } from "@/data/games";
import { createServiceDatabaseClient } from "@/services/database";
import { ensureProfile, getUserFromRequest } from "@/services/community";
import { listFromRow, upsertListItems } from "@/services/lists";

type Params = Promise<{ slug: string }>;

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Params }) {
  const { slug } = await params;
  const serviceClient = createServiceDatabaseClient();
  const { data, error } = await serviceClient
    .from("lists")
    .select("*, profiles:user_id(id,username,display_name,bio,avatar_url,created_at), list_items(position,note,games(slug,title,summary,release_year,status,cover_url,hero_url,user_score,critic_score,rating_count,review_count))")
    .eq("slug", slug)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Lista no encontrada." }, { status: 404 });

  return NextResponse.json({ list: listFromRow(data) });
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { slug } = await params;
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);

  const { data: list, error: listError } = await serviceClient
    .from("lists")
    .select("id, user_id")
    .eq("slug", slug)
    .maybeSingle();

  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });
  if (!list) return NextResponse.json({ error: "Lista no encontrada." }, { status: 404 });
  if (list.user_id !== auth.user.id) return NextResponse.json({ error: "No puedes editar esta lista." }, { status: 403 });

  const updates: Record<string, unknown> = {};
  if (typeof payload?.title === "string" && payload.title.trim().length >= 3) updates.title = payload.title.trim();
  if (typeof payload?.description === "string") updates.description = payload.description.trim() || null;
  if (typeof payload?.isPublic === "boolean") updates.is_public = payload.isPublic;

  if (Object.keys(updates).length) {
    const { error } = await serviceClient.from("lists").update(updates).eq("id", list.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(payload?.games)) {
    await serviceClient.from("list_items").delete().eq("list_id", list.id);
    await upsertListItems(serviceClient, list.id, payload.games as Partial<Game>[]);
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, { params }: { params: Params }) {
  const { slug } = await params;
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);
  const { data: list, error: listError } = await serviceClient.from("lists").select("id, likes_count").eq("slug", slug).maybeSingle();
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });
  if (!list) return NextResponse.json({ error: "Lista no encontrada." }, { status: 404 });

  const { error } = await serviceClient.from("list_likes").upsert({ list_id: list.id, user_id: auth.user.id }, { onConflict: "list_id,user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count } = await serviceClient.from("list_likes").select("list_id", { count: "exact", head: true }).eq("list_id", list.id);
  const likesCount = count ?? Number(list.likes_count ?? 0);
  await serviceClient.from("lists").update({ likes_count: likesCount }).eq("id", list.id);

  return NextResponse.json({ ok: true, likesCount });
}

