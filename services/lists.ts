import type { Game } from "@/data/games";
import { createServiceDatabaseClient, createSqlClient } from "@/services/database";
import { ensureGame, profileFromRow } from "@/services/community";
import { slugify } from "@/lib/utils";

export const DEFAULT_PROFILE_LISTS = [
  {
    key: "rated",
    title: "Juegos Valorados",
    description: "Lista pública generada automáticamente con los juegos que he valorado en GameIndex."
  },
  {
    key: "completed",
    title: "Juegos Completados",
    description: "Lista pública generada automáticamente con los juegos que he marcado como completados."
  },
  {
    key: "favorites",
    title: "Favoritos",
    description: "Lista pública generada automáticamente con mis juegos favoritos."
  },
  {
    key: "playing",
    title: "Jugando",
    description: "Lista pública generada automáticamente con los juegos que estoy jugando."
  }
] as const;

type DefaultProfileListKey = (typeof DEFAULT_PROFILE_LISTS)[number]["key"];

export const LIST_WITH_ITEMS_SELECT =
  "*, profiles:user_id(id,username,display_name,bio,avatar_url,banner_url,created_at,updated_at,favorite_platforms,favorite_genres), list_items(position,note,games(slug,title,summary,release_year,status,cover_url,hero_url,user_score,critic_score,rating_count,review_count))";

export type ListPermissions = {
  isOwner: boolean;
  isCollaborator: boolean;
  canView: boolean;
  canEditItems: boolean;
  canManage: boolean;
};

export type ListCollaborator = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: "editor";
  createdAt: string | null;
};

export async function getAvailableListSlug(serviceClient: ReturnType<typeof createServiceDatabaseClient>, baseSlug: string) {
  const normalized = slugify(baseSlug) || "lista";
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? normalized : `${normalized}-${suffix + 1}`;
    const { data } = await serviceClient.from("lists").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${normalized}-${Date.now()}`;
}

export async function upsertListItems(
  serviceClient: ReturnType<typeof createServiceDatabaseClient>,
  listId: string,
  games: Partial<Game>[]
) {
  if (games.length === 0) return;

  const rows = [];
  for (const [index, game] of games.entries()) {
    if (!game.slug) continue;
    const dbGame = await ensureGame(serviceClient, game.slug, game);
    rows.push({
      list_id: listId,
      game_id: dbGame.id,
      position: index + 1,
      note: typeof (game as any).note === "string" ? (game as any).note : null
    });
  }

  if (rows.length) await serviceClient.from("list_items").upsert(rows, { onConflict: "list_id,game_id" });
}

export async function syncDefaultProfileLists(
  serviceClient: ReturnType<typeof createServiceDatabaseClient>,
  profile: { id: string; username: string }
) {
  for (const list of DEFAULT_PROFILE_LISTS) {
    const dbList = await ensureDefaultProfileList(serviceClient, profile, list);
    const gameIds = await getDefaultListGameIds(profile.id, list.key);
    await replaceListGameIds(serviceClient, dbList.id, gameIds);
  }
}

export function dedupeListsByTitle<T extends { title: string; createdAt?: string | null }>(lists: T[]) {
  const seen = new Set<string>();
  const reservedTitles = new Set(DEFAULT_PROFILE_LISTS.map((list) => list.title.toLowerCase()));
  return lists
    .slice()
    .sort((left, right) => getTime(left.createdAt) - getTime(right.createdAt))
    .filter((list) => {
      const key = list.title.trim().toLowerCase();
      if (!reservedTitles.has(key)) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => getTime(right.createdAt) - getTime(left.createdAt));
}

export async function ensureListCollaborationSchema() {
  const sql = createSqlClient();
  await sql.query(`
    create table if not exists list_collaborators (
      list_id uuid references lists(id) on delete cascade,
      user_id uuid references profiles(id) on delete cascade,
      role text default 'editor' check (role in ('editor')),
      created_at timestamptz default now(),
      primary key (list_id, user_id)
    )
  `);
  await sql.query("create index if not exists list_collaborators_user_idx on list_collaborators(user_id, created_at desc)");
}

export async function getListPermissions(
  serviceClient: ReturnType<typeof createServiceDatabaseClient>,
  list: { id: string; user_id?: string; userId?: string; is_public?: boolean; isPublic?: boolean; hidden_at?: string | null; hiddenAt?: string | null },
  viewerId: string | null
): Promise<ListPermissions> {
  await ensureListCollaborationSchema();
  const ownerId = list.user_id ?? list.userId;
  const isOwner = Boolean(viewerId && ownerId === viewerId);
  const isCollaborator = Boolean(viewerId && !isOwner && (await isListCollaborator(serviceClient, list.id, viewerId)));
  const isPublic = Boolean(list.is_public ?? list.isPublic);
  const isHidden = Boolean(list.hidden_at ?? list.hiddenAt);

  return {
    isOwner,
    isCollaborator,
    canView: (isPublic && !isHidden) || isOwner || isCollaborator,
    canEditItems: isOwner || isCollaborator,
    canManage: isOwner
  };
}

export async function getListCollaborators(listId: string): Promise<ListCollaborator[]> {
  await ensureListCollaborationSchema();
  const sql = createSqlClient();
  const rows = await sql.query(
    `select p.username, p.display_name, p.avatar_url, lc.role, lc.created_at
     from list_collaborators lc
     join profiles p on p.id = lc.user_id
     where lc.list_id = $1
     order by lc.created_at desc`,
    [listId]
  ) as Array<{ username: string; display_name: string | null; avatar_url: string | null; role: "editor"; created_at: string | null }>;

  return rows.map((row) => ({
    username: row.username,
    displayName: row.display_name ?? row.username,
    avatarUrl: row.avatar_url,
    role: row.role,
    createdAt: row.created_at
  }));
}

export async function addListCollaboratorByUsername(
  serviceClient: ReturnType<typeof createServiceDatabaseClient>,
  listId: string,
  ownerId: string,
  username: string
) {
  await ensureListCollaborationSchema();
  const { data: profile, error } = await serviceClient
    .from("profiles")
    .select("id, username")
    .eq("username", username)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile) throw new Error("No existe ningún usuario con ese nombre.");
  if (profile.id === ownerId) throw new Error("El propietario ya puede editar la lista.");

  const { error: insertError } = await serviceClient.from("list_collaborators").upsert(
    { list_id: listId, user_id: profile.id, role: "editor" },
    { onConflict: "list_id,user_id" }
  );
  if (insertError) throw new Error(insertError.message);

  return profile;
}

export async function removeListCollaboratorByUsername(
  serviceClient: ReturnType<typeof createServiceDatabaseClient>,
  listId: string,
  username: string
) {
  await ensureListCollaborationSchema();
  const { data: profile, error } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile) return;

  const { error: deleteError } = await serviceClient
    .from("list_collaborators")
    .delete()
    .eq("list_id", listId)
    .eq("user_id", profile.id);
  if (deleteError) throw new Error(deleteError.message);
}

async function isListCollaborator(
  serviceClient: ReturnType<typeof createServiceDatabaseClient>,
  listId: string,
  userId: string
) {
  const { data, error } = await serviceClient
    .from("list_collaborators")
    .select("user_id")
    .eq("list_id", listId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function ensureDefaultProfileList(
  serviceClient: ReturnType<typeof createServiceDatabaseClient>,
  profile: { id: string; username: string },
  list: (typeof DEFAULT_PROFILE_LISTS)[number]
) {
  const { data: matches, error: existingError } = await serviceClient
    .from("lists")
    .select("id, slug")
    .eq("user_id", profile.id)
    .eq("title", list.title)
    .order("created_at", { ascending: true });

  if (existingError) throw new Error(existingError.message);

  const existing = (matches ?? [])[0] ?? null;
  const duplicates = (matches ?? []).slice(1);
  if (duplicates.length) {
    const sql = createSqlClient();
    await sql.query(
      "delete from lists where id = any($1::uuid[])",
      [duplicates.map((row: { id: string }) => row.id)]
    );
  }

  if (existing) {
    const { error } = await serviceClient
      .from("lists")
      .update({ description: list.description, is_public: true })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return existing;
  }

  const slug = await getAvailableListSlug(serviceClient, `${profile.username}-${slugify(list.title)}`);
  const { data, error } = await serviceClient
    .from("lists")
    .insert({
      user_id: profile.id,
      slug,
      title: list.title,
      description: list.description,
      is_public: true
    })
    .select("id, slug")
    .single();

  if (error || !data) throw new Error(error?.message ?? "No se pudo crear la lista automática.");
  return data;
}

async function getDefaultListGameIds(userId: string, key: DefaultProfileListKey) {
  const sql = createSqlClient();

  if (key === "rated") {
    const rows = await sql.query(
      "select game_id from ratings where user_id = $1 order by updated_at desc, created_at desc",
      [userId]
    ) as Array<{ game_id: string }>;
    return rows.map((row) => row.game_id);
  }

  const status = key === "completed" ? "completed" : key === "favorites" ? "favorite" : "playing";
  const rows = await sql.query(
    "select game_id from user_game_statuses where user_id = $1 and status = $2 order by created_at desc",
    [userId, status]
  ) as Array<{ game_id: string }>;
  return rows.map((row) => row.game_id);
}

async function replaceListGameIds(
  serviceClient: ReturnType<typeof createServiceDatabaseClient>,
  listId: string,
  gameIds: string[]
) {
  const { error: deleteError } = await serviceClient.from("list_items").delete().eq("list_id", listId);
  if (deleteError) throw new Error(deleteError.message);

  const rows = Array.from(new Set(gameIds)).map((gameId, index) => ({
    list_id: listId,
    game_id: gameId,
    position: index + 1
  }));

  if (!rows.length) return;
  const { error } = await serviceClient.from("list_items").insert(rows);
  if (error) throw new Error(error.message);
}

export function listFromRow(row: any) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverUrl: row.cover_url,
    isPublic: Boolean(row.is_public),
    likesCount: Number(row.likes_count ?? 0),
    createdAt: row.created_at,
    user: profileFromRow(Array.isArray(row.profiles) ? row.profiles[0] : row.profiles),
    items: (row.list_items ?? [])
      .sort((a: any, b: any) => Number(a.position) - Number(b.position))
      .map((item: any) => ({ position: item.position, note: item.note, game: gameFromMinimalRow(item.games) }))
      .filter((item: any) => item.game)
  };
}

function gameFromMinimalRow(row: any) {
  if (!row) return null;
  return {
    title: row.title,
    slug: row.slug,
    year: Number(row.release_year ?? 0),
    platforms: Array.isArray(row.platforms) ? row.platforms.map(String) : [],
    genres: Array.isArray(row.genres) ? row.genres.map(String) : [],
    developer: "Desarrolladora no disponible",
    publisher: "Publisher no disponible",
    userScore: Number(row.user_score ?? 0),
    criticScore: row.critic_score === null || row.critic_score === undefined ? null : Number(row.critic_score),
    reviews: Number(row.review_count ?? 0),
    ratings: Number(row.rating_count ?? 0),
    status: row.status === "upcoming" || row.status === "early_access" ? row.status : "released",
    coverUrl: row.cover_url ?? "",
    heroUrl: row.hero_url ?? row.cover_url ?? "",
    summary: row.summary ?? "Sinopsis no disponible.",
    modes: [],
    releaseDate: row.release_year ? String(row.release_year) : "Fecha por anunciar"
  };
}

function getTime(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

