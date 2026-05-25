import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { createServiceDatabaseClient } from "@/services/database";
import { createLogger } from "@/lib/logger";

const log = createLogger("sitemap");

const STATIC_PATHS: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/games", changeFrequency: "hourly", priority: 0.9 },
  { path: "/rankings", changeFrequency: "daily", priority: 0.7 },
  { path: "/rankings/top-50", changeFrequency: "daily", priority: 0.7 }
];

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority
  }));

  if (!process.env.DATABASE_URL) {
    return entries;
  }

  try {
    const serviceClient = createServiceDatabaseClient();

    const [gamesResult, listsResult, profilesResult] = await Promise.all([
      serviceClient
        .from("games")
        .select("slug, updated_at")
        .order("popularity_score", { ascending: false })
        .limit(1000),
      serviceClient
        .from("lists")
        .select("slug, created_at")
        .eq("is_public", true)
        .order("likes_count", { ascending: false })
        .limit(500),
      serviceClient
        .from("profiles")
        .select("username, updated_at")
        .order("updated_at", { ascending: false })
        .limit(500)
    ]);

    for (const row of (gamesResult.data ?? []) as { slug: string; updated_at?: string | null }[]) {
      if (!row.slug) continue;
      entries.push({
        url: `${base}/games/${encodeURIComponent(row.slug)}`,
        lastModified: parseDate(row.updated_at) ?? now,
        changeFrequency: "weekly",
        priority: 0.6
      });
    }

    for (const row of (listsResult.data ?? []) as { slug: string; created_at?: string | null }[]) {
      if (!row.slug) continue;
      entries.push({
        url: `${base}/lists/${encodeURIComponent(row.slug)}`,
        lastModified: parseDate(row.created_at) ?? now,
        changeFrequency: "weekly",
        priority: 0.5
      });
    }

    for (const row of (profilesResult.data ?? []) as { username: string; updated_at?: string | null }[]) {
      if (!row.username) continue;
      entries.push({
        url: `${base}/users/${encodeURIComponent(row.username)}`,
        lastModified: parseDate(row.updated_at) ?? now,
        changeFrequency: "weekly",
        priority: 0.4
      });
    }
  } catch (error) {
    log.warn("sitemap fallback to static entries", { error });
  }

  return entries;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
