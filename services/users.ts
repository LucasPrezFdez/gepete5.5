import type { ActivityEvent, GameList, Profile, ProfileStats, Review } from "@/data/games";
import { FALLBACK_USERS, FALLBACK_USERS_BY_USERNAME } from "@/data/fallback-users";
import { createServiceDatabaseClient, createSqlClient } from "@/services/database";
import { profileFromRow } from "@/services/community";
import { dedupeListsByTitle, listFromRow, syncDefaultProfileLists } from "@/services/lists";

export type PublicProfileActivity = Omit<ActivityEvent, "user" | "review"> & {
  game?: ActivityEvent["game"] | null;
  list?: ActivityEvent["list"] | null;
};

export type PublicUserProfile = {
  profile: Profile;
  stats: ProfileStats;
  lists: GameList[];
  reviews: Review[];
  activity: PublicProfileActivity[];
};

const PROFILE_SELECT = "id,username,display_name,bio,avatar_url,banner_url,created_at,updated_at,favorite_platforms,favorite_genres";

export async function getPublicUserProfile(username: string): Promise<PublicUserProfile | null> {
  try {
    const real = await loadPublicUserProfileFromDatabase(username);
    if (real) return real;
  } catch {
    // database unavailable — fall through to mock lookup
  }
  return getFallbackUserProfile(username);
}

function getFallbackUserProfile(username: string): PublicUserProfile | null {
  const mock = FALLBACK_USERS_BY_USERNAME.get(username.trim().toLowerCase());
  if (!mock) return null;
  return {
    profile: mock.profile,
    stats: mock.stats,
    lists: mock.lists,
    reviews: mock.reviews,
    activity: []
  };
}

async function loadPublicUserProfileFromDatabase(username: string): Promise<PublicUserProfile | null> {
  const serviceClient = createServiceDatabaseClient();
  const { data: profile, error } = await serviceClient
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("username", username)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile) return null;

  await syncDefaultProfileLists(serviceClient, { id: profile.id, username: profile.username });

  const [
    ratings,
    statuses,
    lists,
    publicListsCount,
    reviews,
    activity,
    followers,
    following
  ] = await Promise.all([
    serviceClient.from("ratings").select("score", { count: "exact" }).eq("user_id", profile.id),
    serviceClient.from("user_game_statuses").select("status", { count: "exact" }).eq("user_id", profile.id),
    serviceClient
      .from("lists")
      .select("*, profiles:user_id(id,username,display_name,bio,avatar_url,banner_url,created_at,updated_at,favorite_platforms,favorite_genres), list_items(position,note,games(slug,title,summary,release_year,status,cover_url,hero_url,user_score,critic_score,rating_count,review_count))")
      .eq("user_id", profile.id)
      .eq("is_public", true)
      .is("hidden_at", null)
      .order("created_at", { ascending: false })
      .limit(6),
    serviceClient
      .from("lists")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_public", true)
      .is("hidden_at", null),
    serviceClient
      .from("ratings")
      .select("id,score,comment_body,created_at,updated_at,profiles:user_id(id,username,display_name,bio,avatar_url,banner_url,created_at,updated_at,favorite_platforms,favorite_genres),games:game_id(slug,title)")
      .eq("user_id", profile.id)
      .not("comment_body", "is", null)
      .is("hidden_at", null)
      .order("updated_at", { ascending: false })
      .limit(6),
    serviceClient
      .from("activity_events")
      .select("id,type,message,created_at,games:game_id(slug,title,cover_url), lists:list_id(slug,title)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(12),
    serviceClient.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", profile.id),
    serviceClient.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", profile.id)
  ]);

  const scores = (ratings.data ?? []).map((item: any) => Number(item.score)).filter(Number.isFinite);
  const statusCounts = new Map<string, number>();
  for (const item of ((statuses.data ?? []) as any[])) statusCounts.set(item.status, (statusCounts.get(item.status) ?? 0) + 1);

  const mappedProfile = profileFromRow(profile);

  return {
    profile: mappedProfile,
    stats: {
      ratingsCount: ratings.count ?? scores.length,
      averageScore: scores.length ? Number((scores.reduce((total: number, score: number) => total + score, 0) / scores.length).toFixed(1)) : 0,
      completedCount: statusCounts.get("completed") ?? 0,
      backlogCount: statusCounts.get("want_to_play") ?? 0,
      listsCount: publicListsCount.count ?? lists.data?.length ?? 0,
      followerCount: followers.count ?? 0,
      followingCount: following.count ?? 0,
      favoritePlatforms: mappedProfile.favoritePlatforms,
      favoriteGenres: mappedProfile.favoriteGenres
    },
    lists: dedupeListsByTitle((lists.data ?? []).map(listFromRow)),
    reviews: (reviews.data ?? [])
      .filter((row: any) => typeof row.comment_body === "string" && row.comment_body.trim().length > 0)
      .map(ratingRowToReview),
    activity: (activity.data ?? []).map((item: any) => ({
      id: item.id,
      type: item.type,
      message: item.message,
      createdAt: item.created_at,
      game: item.games ?? null,
      list: item.lists ?? null
    }))
  };
}

function ratingRowToReview(row: any): Review {
  const profileRow = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const gameRow = Array.isArray(row.games) ? row.games[0] : row.games;
  const gameTitle = gameRow?.title ?? gameRow?.slug ?? "Juego";
  const updatedAt = row.updated_at ?? row.created_at ?? new Date().toISOString();
  return {
    id: row.id,
    gameSlug: gameRow?.slug ?? "",
    gameTitle,
    user: profileFromRow(profileRow ?? { id: row.user_id, username: "usuario" }),
    title: gameTitle,
    body: String(row.comment_body ?? "").trim(),
    score: Number(row.score ?? 0),
    helpfulCount: 0,
    hasSpoilers: false,
    createdAt: row.created_at ?? updatedAt,
    updatedAt
  };
}

export async function getProfileRowByUsername(username: string) {
  const serviceClient = createServiceDatabaseClient();
  const { data, error } = await serviceClient
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("username", username)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getFollowCounts(profileId: string) {
  const serviceClient = createServiceDatabaseClient();
  const [followers, following] = await Promise.all([
    serviceClient.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", profileId),
    serviceClient.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", profileId)
  ]);

  if (followers.error) throw new Error(followers.error.message);
  if (following.error) throw new Error(following.error.message);

  return {
    followerCount: followers.count ?? 0,
    followingCount: following.count ?? 0
  };
}

export async function getIsFollowing(followerId: string | null, followingId: string) {
  if (!followerId || followerId === followingId) return false;

  const serviceClient = createServiceDatabaseClient();
  const { data, error } = await serviceClient
    .from("follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

export type DirectoryUserCard = {
  profile: Profile;
  stats: Pick<ProfileStats, "ratingsCount" | "averageScore" | "completedCount" | "followerCount" | "listsCount">;
};

export type DirectorySort = "followers" | "ratings" | "completed" | "alphabetical";

export type DirectoryResult = {
  users: DirectoryUserCard[];
  count: number;
  page: number;
  pageSize: number;
  nextPage: number | null;
  previousPage: number | null;
};

export async function listPublicUsers({
  query,
  sort = "followers",
  page = 1,
  pageSize = 24
}: {
  query?: string;
  sort?: DirectorySort;
  page?: number;
  pageSize?: number;
} = {}): Promise<DirectoryResult> {
  const realUsers = await loadRealDirectoryUsers().catch(() => [] as DirectoryUserCard[]);
  const realUsernames = new Set(realUsers.map((user) => user.profile.username.toLowerCase()));

  const mockUsers: DirectoryUserCard[] = FALLBACK_USERS
    .filter((mock) => !realUsernames.has(mock.profile.username.toLowerCase()))
    .map((mock) => ({
      profile: mock.profile,
      stats: {
        ratingsCount: mock.stats.ratingsCount,
        averageScore: mock.stats.averageScore,
        completedCount: mock.stats.completedCount,
        followerCount: mock.stats.followerCount,
        listsCount: mock.stats.listsCount
      }
    }));

  const combined = [...realUsers, ...mockUsers];
  const filtered = filterDirectoryUsers(combined, query);
  const sorted = sortDirectoryUsers(filtered, sort);

  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(60, Math.max(1, Math.floor(pageSize)));
  const from = (safePage - 1) * safePageSize;
  const slice = sorted.slice(from, from + safePageSize);

  return {
    users: slice,
    count: sorted.length,
    page: safePage,
    pageSize: safePageSize,
    nextPage: from + safePageSize < sorted.length ? safePage + 1 : null,
    previousPage: safePage > 1 ? safePage - 1 : null
  };
}

async function loadRealDirectoryUsers(): Promise<DirectoryUserCard[]> {
  const serviceClient = createServiceDatabaseClient();
  const { data, error } = await serviceClient
    .from("profiles")
    .select(PROFILE_SELECT)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  if (!data?.length) return [];

  const profiles = data as any[];
  const ids = profiles.map((row) => row.id);

  const sql = createSqlClient();
  const [ratingsRows, completedRows, listsRows, followersRows] = await Promise.all([
    sql.query(
      "select user_id, count(*)::int as n, coalesce(round(avg(score)::numeric, 1), 0) as avg_score from ratings where user_id = any($1::uuid[]) and hidden_at is null group by user_id",
      [ids]
    ),
    sql.query(
      "select user_id, count(*)::int as n from user_game_statuses where user_id = any($1::uuid[]) and status = 'completed' group by user_id",
      [ids]
    ),
    sql.query(
      "select user_id, count(*)::int as n from lists where user_id = any($1::uuid[]) and is_public = true and hidden_at is null group by user_id",
      [ids]
    ),
    sql.query(
      "select following_id, count(*)::int as n from follows where following_id = any($1::uuid[]) group by following_id",
      [ids]
    )
  ]);

  const ratingsBy = new Map<string, { count: number; avg: number }>();
  for (const row of ratingsRows as any[]) {
    ratingsBy.set(row.user_id, { count: row.n, avg: Number(row.avg_score) });
  }
  const completedBy = new Map<string, number>();
  for (const row of completedRows as any[]) completedBy.set(row.user_id, row.n);
  const listsBy = new Map<string, number>();
  for (const row of listsRows as any[]) listsBy.set(row.user_id, row.n);
  const followersBy = new Map<string, number>();
  for (const row of followersRows as any[]) followersBy.set(row.following_id, row.n);

  return profiles.map((row) => {
    const r = ratingsBy.get(row.id);
    return {
      profile: profileFromRow(row),
      stats: {
        ratingsCount: r?.count ?? 0,
        averageScore: r?.avg ?? 0,
        completedCount: completedBy.get(row.id) ?? 0,
        followerCount: followersBy.get(row.id) ?? 0,
        listsCount: listsBy.get(row.id) ?? 0
      }
    };
  });
}

function filterDirectoryUsers(users: DirectoryUserCard[], query?: string): DirectoryUserCard[] {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return users;
  return users.filter((user) => {
    const { username, displayName, bio } = user.profile;
    return (
      username.toLowerCase().includes(normalized) ||
      displayName.toLowerCase().includes(normalized) ||
      (bio ? bio.toLowerCase().includes(normalized) : false)
    );
  });
}

function sortDirectoryUsers(users: DirectoryUserCard[], sort: DirectorySort): DirectoryUserCard[] {
  const copy = [...users];
  switch (sort) {
    case "ratings":
      copy.sort((a, b) => b.stats.ratingsCount - a.stats.ratingsCount || b.stats.followerCount - a.stats.followerCount);
      break;
    case "completed":
      copy.sort((a, b) => b.stats.completedCount - a.stats.completedCount || b.stats.followerCount - a.stats.followerCount);
      break;
    case "alphabetical":
      copy.sort((a, b) => a.profile.displayName.localeCompare(b.profile.displayName, "es"));
      break;
    case "followers":
    default:
      copy.sort((a, b) => b.stats.followerCount - a.stats.followerCount || b.stats.ratingsCount - a.stats.ratingsCount);
  }
  return copy;
}
