import { createSqlClient } from "@/services/database";

export type NotificationType =
  | "follow"
  | "review_helpful"
  | "list_like"
  | "list_collaborator";

export type NotificationRow = {
  id: string;
  type: NotificationType;
  read_at: string | null;
  created_at: string;
  actor_username: string | null;
  actor_display_name: string | null;
  actor_avatar_url: string | null;
  list_slug: string | null;
  list_title: string | null;
  review_id: string | null;
  review_title: string | null;
  game_slug: string | null;
  game_title: string | null;
};

export type Notification = {
  id: string;
  type: NotificationType;
  readAt: string | null;
  createdAt: string;
  actor: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  list: { slug: string; title: string } | null;
  review: { id: string; title: string } | null;
  game: { slug: string; title: string } | null;
};

let schemaReady = false;

export async function ensureNotificationsSchema() {
  if (schemaReady) return;
  const sql = createSqlClient();
  await sql.query(`
    create table if not exists notifications (
      id uuid primary key default gen_random_uuid(),
      recipient_id uuid references profiles(id) on delete cascade not null,
      actor_id uuid references profiles(id) on delete cascade,
      type text not null,
      list_id uuid references lists(id) on delete cascade,
      review_id uuid references reviews(id) on delete cascade,
      game_id uuid references games(id) on delete cascade,
      read_at timestamptz,
      created_at timestamptz default now()
    )
  `);
  await sql.query(
    "create index if not exists notifications_recipient_created_idx on notifications(recipient_id, created_at desc)"
  );
  await sql.query(
    "create index if not exists notifications_recipient_unread_idx on notifications(recipient_id, read_at) where read_at is null"
  );
  schemaReady = true;
}

export async function createNotification(payload: {
  recipientId: string;
  actorId: string | null;
  type: NotificationType;
  listId?: string | null;
  reviewId?: string | null;
  gameId?: string | null;
}) {
  if (payload.actorId && payload.actorId === payload.recipientId) return;
  try {
    await ensureNotificationsSchema();
    const sql = createSqlClient();
    await sql.query(
      `insert into notifications (recipient_id, actor_id, type, list_id, review_id, game_id)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        payload.recipientId,
        payload.actorId ?? null,
        payload.type,
        payload.listId ?? null,
        payload.reviewId ?? null,
        payload.gameId ?? null
      ]
    );
  } catch {
    // No bloqueamos la acción del usuario si falla la notificación.
  }
}

export async function listNotifications(recipientId: string, limit = 30): Promise<Notification[]> {
  await ensureNotificationsSchema();
  const sql = createSqlClient();
  const rows = (await sql.query(
    `select n.id, n.type, n.read_at, n.created_at,
            actor.username as actor_username,
            actor.display_name as actor_display_name,
            actor.avatar_url as actor_avatar_url,
            l.slug as list_slug, l.title as list_title,
            r.id as review_id, r.title as review_title,
            g.slug as game_slug, g.title as game_title
       from notifications n
  left join profiles actor on actor.id = n.actor_id
  left join lists l on l.id = n.list_id
  left join reviews r on r.id = n.review_id
  left join games g on g.id = n.game_id
      where n.recipient_id = $1
   order by n.created_at desc
      limit $2`,
    [recipientId, limit]
  )) as NotificationRow[];

  return rows.map(notificationFromRow);
}

export async function countUnreadNotifications(recipientId: string) {
  await ensureNotificationsSchema();
  const sql = createSqlClient();
  const rows = (await sql.query(
    `select count(*)::int as count from notifications where recipient_id = $1 and read_at is null`,
    [recipientId]
  )) as Array<{ count: number }>;
  return rows[0]?.count ?? 0;
}

export async function markAllNotificationsRead(recipientId: string) {
  await ensureNotificationsSchema();
  const sql = createSqlClient();
  await sql.query(
    `update notifications set read_at = now() where recipient_id = $1 and read_at is null`,
    [recipientId]
  );
}

function notificationFromRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type,
    readAt: row.read_at,
    createdAt: row.created_at,
    actor: row.actor_username
      ? {
          username: row.actor_username,
          displayName: row.actor_display_name ?? row.actor_username,
          avatarUrl: row.actor_avatar_url
        }
      : null,
    list: row.list_slug && row.list_title ? { slug: row.list_slug, title: row.list_title } : null,
    review: row.review_id ? { id: row.review_id, title: row.review_title ?? "Reseña" } : null,
    game: row.game_slug && row.game_title ? { slug: row.game_slug, title: row.game_title } : null
  };
}
