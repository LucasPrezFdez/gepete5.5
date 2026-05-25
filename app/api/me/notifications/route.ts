import { NextResponse } from "next/server";
import { createServiceDatabaseClient } from "@/services/database";
import { ensureProfile, getUserFromRequest } from "@/services/community";
import { countUnreadNotifications, listNotifications, markAllNotificationsRead } from "@/services/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);

  try {
    const [items, unreadCount] = await Promise.all([
      listNotifications(auth.user.id),
      countUnreadNotifications(auth.user.id)
    ]);
    return NextResponse.json({ notifications: items, unreadCount });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las notificaciones." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);

  try {
    await markAllNotificationsRead(auth.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron marcar como leídas." },
      { status: 500 }
    );
  }
}
