import { NextResponse } from "next/server";
import { createServiceDatabaseClient } from "@/services/database";
import { ensureProfile, getUserFromRequest } from "@/services/community";
import {
  addListCollaboratorByUsername,
  getListCollaborators,
  getListPermissions,
  removeListCollaboratorByUsername
} from "@/services/lists";
import { createNotification } from "@/services/notifications";

type Params = Promise<{ slug: string }>;

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Params }) {
  const { slug } = await params;
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);
  const { data: list, error } = await serviceClient.from("lists").select("id, user_id, is_public").eq("slug", slug).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!list) return NextResponse.json({ error: "Lista no encontrada." }, { status: 404 });

  const permissions = await getListPermissions(serviceClient, list, auth.user.id);
  if (!permissions.canManage) return NextResponse.json({ error: "Solo el propietario puede gestionar colaboradores." }, { status: 403 });

  return NextResponse.json({ collaborators: await getListCollaborators(list.id) });
}

export async function POST(request: Request, { params }: { params: Params }) {
  const { slug } = await params;
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const username = String(payload?.username ?? "").trim().replace(/^@/, "");
  if (!username) return NextResponse.json({ error: "Introduce un nombre de usuario." }, { status: 400 });

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);
  const { data: list, error } = await serviceClient.from("lists").select("id, user_id, is_public").eq("slug", slug).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!list) return NextResponse.json({ error: "Lista no encontrada." }, { status: 404 });

  const permissions = await getListPermissions(serviceClient, list, auth.user.id);
  if (!permissions.canManage) return NextResponse.json({ error: "Solo el propietario puede añadir colaboradores." }, { status: 403 });

  try {
    const collaborator = await addListCollaboratorByUsername(serviceClient, list.id, list.user_id, username);
    if (collaborator?.id) {
      await createNotification({
        recipientId: collaborator.id,
        actorId: auth.user.id,
        type: "list_collaborator",
        listId: list.id
      });
    }
    return NextResponse.json({ ok: true, collaborators: await getListCollaborators(list.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo añadir el colaborador." }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Params }) {
  const { slug } = await params;
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const username = String(payload?.username ?? "").trim().replace(/^@/, "");
  if (!username) return NextResponse.json({ error: "Introduce un nombre de usuario." }, { status: 400 });

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);
  const { data: list, error } = await serviceClient.from("lists").select("id, user_id, is_public").eq("slug", slug).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!list) return NextResponse.json({ error: "Lista no encontrada." }, { status: 404 });

  const permissions = await getListPermissions(serviceClient, list, auth.user.id);
  if (!permissions.canManage) return NextResponse.json({ error: "Solo el propietario puede quitar colaboradores." }, { status: 403 });

  try {
    await removeListCollaboratorByUsername(serviceClient, list.id, username);
    return NextResponse.json({ ok: true, collaborators: await getListCollaborators(list.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo quitar el colaborador." }, { status: 400 });
  }
}
