import type { Game } from "@/data/games";
import { createServiceDatabaseClient } from "@/services/database";
import { ensureProfile, getUserFromRequest, recordActivity } from "@/services/community";
import { dedupeListsByTitle, getAvailableListSlug, listFromRow, upsertListItems } from "@/services/lists";
import { slugify } from "@/lib/utils";
import { jsonError, jsonOk, publicCacheHeaders } from "@/lib/api";
import { parse, v } from "@/lib/validation";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = createLogger("api/lists");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username") ?? undefined;
  const serviceClient = createServiceDatabaseClient();

  let query = serviceClient
    .from("lists")
    .select("*, profiles:user_id(id,username,display_name,bio,avatar_url,banner_url,created_at), list_items(position,note,games(slug,title,summary,release_year,status,cover_url,hero_url,user_score,critic_score,rating_count,review_count))")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(24);

  if (username) query = query.eq("profiles.username", username);

  const { data, error } = await query;
  if (error) {
    log.error("list query failed", { reason: error.message });
    return jsonError(error.message, 500);
  }

  return jsonOk(
    { lists: dedupeListsByTitle((data ?? []).filter((row: any) => row.profiles).map(listFromRow)) },
    { headers: publicCacheHeaders({ sMaxAge: 30, swr: 300 }) }
  );
}

const createListSchema = {
  title: v.string({ min: 3, max: 120 }),
  description: v.string({ min: 0, max: 1000, optional: true }),
  isPublic: v.boolean({ defaultValue: true })
};

export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth.user) return jsonError(auth.error ?? "No autenticado.", 401);

  const payload = await request.json().catch(() => null);
  const parsed = parse(createListSchema, payload);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const games = Array.isArray((payload as any)?.games) ? ((payload as any).games as Partial<Game>[]) : [];

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);
  const slug = await getAvailableListSlug(serviceClient, slugify(parsed.value.title));

  const { data: list, error } = await serviceClient
    .from("lists")
    .insert({
      user_id: auth.user.id,
      slug,
      title: parsed.value.title,
      description: parsed.value.description || null,
      is_public: parsed.value.isPublic
    })
    .select("id, slug, title")
    .single();

  if (error || !list) {
    log.error("list insert failed", { reason: error?.message });
    return jsonError(error?.message ?? "No se pudo crear la lista.", 500);
  }

  await upsertListItems(serviceClient, list.id, games);
  await recordActivity(serviceClient, {
    userId: auth.user.id,
    listId: list.id,
    type: "list",
    message: `creó la lista ${list.title}`
  }).catch(() => null);

  return jsonOk({ ok: true, slug: list.slug });
}

