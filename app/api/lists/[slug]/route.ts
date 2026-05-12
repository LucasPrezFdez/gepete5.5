import { NextResponse } from "next/server";
import type { Game } from "@/data/games";
import { createServiceDatabaseClient } from "@/services/database";
import { ensureProfile, getOptionalUserIdFromRequest, getUserFromRequest } from "@/services/community";
import {
  getListCollaborators,
  getListPermissions,
  LIST_WITH_ITEMS_SELECT,
  listFromRow,
  upsertListItems
} from "@/services/lists";
import { createNotification } from "@/services/notifications";

type Params = Promise<{ slug: string }>;

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Params }) {
  const { slug } = await params;
  const serviceClient = createServiceDatabaseClient();
  const { data, error } = await serviceClient
    .from("lists")
    .select(LIST_WITH_ITEMS_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Lista no encontrada." }, { status: 404 });

  try {
    const viewerId = await getOptionalUserIdFromRequest(request);
    const permissions = await getListPermissions(serviceClient, data, viewerId);
    if (!permissions.canView) return NextResponse.json({ error: "Esta lista es privada." }, { status: 403 });

    return NextResponse.json({
      list: listFromRow(data),
      permissions,
      collaborators: permissions.canManage ? await getListCollaborators(data.id) : []
    });
  } catch (permissionError) {
    return NextResponse.json({ error: permissionError instanceof Error ? permissionError.message : "No se pudo cargar la lista." }, { status: 500 });
  }
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
    .select("id, user_id, is_public")
    .eq("slug", slug)
    .maybeSingle();

  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });
  if (!list) return NextResponse.json({ error: "Lista no encontrada." }, { status: 404 });

  const permissions = await getListPermissions(serviceClient, list, auth.user.id);
  const wantsSettingsUpdate = typeof payload?.title === "string" || typeof payload?.description === "string" || typeof payload?.isPublic === "boolean";
  const wantsGamesUpdate = Array.isArray(payload?.games);

  if (wantsSettingsUpdate && !permissions.canManage) {
    return NextResponse.json({ error: "Solo el propietario puede cambiar la configuración de la lista." }, { status: 403 });
  }
  if (wantsGamesUpdate && !permissions.canEditItems) {
    return NextResponse.json({ error: "No puedes editar juegos en esta lista." }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof payload?.title === "string") {
    const title = payload.title.trim();
    if (title.length < 3) return NextResponse.json({ error: "El título de la lista es demasiado corto." }, { status: 400 });
    updates.title = title;
  }
  if (typeof payload?.description === "string") updates.description = payload.description.trim() || null;
  if (typeof payload?.isPublic === "boolean") updates.is_public = payload.isPublic;

  if (Object.keys(updates).length) {
    const { error } = await serviceClient.from("lists").update(updates).eq("id", list.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (wantsGamesUpdate) {
    await serviceClient.from("list_items").delete().eq("list_id", list.id);
    await upsertListItems(serviceClient, list.id, payload.games as Partial<Game>[]);
  }

  const { data: updated, error: updatedError } = await serviceClient
    .from("lists")
    .select(LIST_WITH_ITEMS_SELECT)
    .eq("id", list.id)
    .maybeSingle();

  if (updatedError) return NextResponse.json({ error: updatedError.message }, { status: 500 });
  return NextResponse.json({ ok: true, list: updated ? listFromRow(updated) : null });
}

export async function POST(request: Request, { params }: { params: Params }) {
  const { slug } = await params;
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);
  const { data: list, error: listError } = await serviceClient.from("lists").select("id, likes_count, user_id, is_public").eq("slug", slug).maybeSingle();
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });
  if (!list) return NextResponse.json({ error: "Lista no encontrada." }, { status: 404 });

  const permissions = await getListPermissions(serviceClient, list, auth.user.id);
  if (!permissions.canView) return NextResponse.json({ error: "Esta lista es privada." }, { status: 403 });

  const { data: existingLike } = await serviceClient
    .from("list_likes")
    .select("list_id")
    .eq("list_id", list.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const { error } = await serviceClient.from("list_likes").upsert({ list_id: list.id, user_id: auth.user.id }, { onConflict: "list_id,user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count } = await serviceClient.from("list_likes").select("list_id", { count: "exact", head: true }).eq("list_id", list.id);
  const likesCount = count ?? Number(list.likes_count ?? 0);
  await serviceClient.from("lists").update({ likes_count: likesCount }).eq("id", list.id);

  if (!existingLike && list.user_id) {
    await createNotification({
      recipientId: list.user_id,
      actorId: auth.user.id,
      type: "list_like",
      listId: list.id
    });
  }

  return NextResponse.json({ ok: true, likesCount });
}
