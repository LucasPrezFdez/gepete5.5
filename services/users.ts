import type { ActivityEvent, GameList, Profile, ProfileStats, Review } from "@/data/games";
import { createServiceDatabaseClient } from "@/services/database";
import { profileFromRow, reviewFromRow } from "@/services/community";
import { listFromRow, syncDefaultProfileLists } from "@/services/lists";

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

const PROFILE_SELECT = "id,username,display_name,bio,avatar_url,created_at,updated_at,favorite_platforms,favorite_genres";

export async function getPublicUserProfile(username: string): Promise<PublicUserProfile | null> {
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
      .select("*, profiles:user_id(id,username,display_name,bio,avatar_url,created_at,updated_at,favorite_platforms,favorite_genres), list_items(position,note,games(slug,title,summary,release_year,status,cover_url,hero_url,user_score,critic_score,rating_count,review_count))")
      .eq("user_id", profile.id)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(6),
    serviceClient.from("lists").select("id", { count: "exact", head: true }).eq("user_id", profile.id).eq("is_public", true),
    serviceClient
      .from("reviews")
      .select("*, profiles:user_id(id,username,display_name,bio,avatar_url,created_at,updated_at,favorite_platforms,favorite_genres), games:game_id(slug,title)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
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
    lists: (lists.data ?? []).map(listFromRow),
    reviews: (reviews.data ?? []).map(reviewFromRow),
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
