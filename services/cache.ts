import { NormalizedExternalGame } from "@/services/igdb";

export type CachedGameRecord = NormalizedExternalGame & {
  syncedAt: string;
};

export async function upsertNormalizedGame(game: NormalizedExternalGame) {
  // Aquí se guardarán datos normalizados en Postgres y se disparará indexación Meilisearch.
  const cached: CachedGameRecord = {
    ...game,
    syncedAt: new Date().toISOString()
  };

  return cached;
}

export function shouldRefreshExternalGame(syncedAt?: string | null, ttlHours = 24) {
  if (!syncedAt) return true;
  const ageMs = Date.now() - new Date(syncedAt).getTime();
  return ageMs > ttlHours * 60 * 60 * 1000;
}
