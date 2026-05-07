import { NextResponse } from "next/server";
import { createServiceDatabaseClient } from "@/services/database";
import { ensureProfile, getUserFromRequest } from "@/services/community";

export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });
  const payload = await request.json().catch(() => null);
  const favoritePlatforms = Array.isArray(payload?.favoritePlatforms) ? payload.favoritePlatforms.map(String).slice(0, 8) : [];
  const favoriteGenres = Array.isArray(payload?.favoriteGenres) ? payload.favoriteGenres.map(String).slice(0, 8) : [];
  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);
  const { error } = await serviceClient
    .from("profiles")
    .update({ favorite_platforms: favoritePlatforms, favorite_genres: favoriteGenres, onboarding_completed: true, updated_at: new Date().toISOString() })
    .eq("id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

