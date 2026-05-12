import { NextResponse } from "next/server";
import { createServiceDatabaseClient } from "@/services/database";
import { ensureProfile, getUserFromRequest, profileFromRow } from "@/services/community";

export const dynamic = "force-dynamic";

const PROFILE_SELECT = "id,username,display_name,bio,avatar_url,banner_url,created_at,updated_at,favorite_platforms,favorite_genres";
const MAX_BIO_LENGTH = 300;
const MAX_AVATAR_URL_LENGTH = 500;
const MAX_AVATAR_DATA_BYTES = 750_000;
const MAX_BANNER_URL_LENGTH = 2000;
const MAX_BANNER_DATA_BYTES = 1_000_000;
const ALLOWED_AVATAR_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);

  const { data, error } = await serviceClient
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Perfil no encontrado." }, { status: 404 });

  return NextResponse.json({ profile: profileFromRow(data) });
}

export async function PATCH(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Datos de perfil no válidos." }, { status: 400 });
  }

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);

  const { data: existingProfile, error: existingError } = await serviceClient
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", auth.user.id)
    .maybeSingle();

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (!existingProfile) return NextResponse.json({ error: "Perfil no encontrado." }, { status: 404 });

  const hasField = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
  const displayName = hasField("displayName")
    ? String(payload.displayName ?? "").trim()
    : String(existingProfile.display_name ?? existingProfile.username ?? "Usuario").trim();
  const bio = normalizeNullableText(hasField("bio") ? payload.bio : existingProfile.bio, MAX_BIO_LENGTH);
  const avatarUrl = normalizeAvatarUrl(hasField("avatarUrl") ? payload.avatarUrl : existingProfile.avatar_url);
  const bannerUrl = normalizeBannerUrl(hasField("bannerUrl") ? payload.bannerUrl : existingProfile.banner_url);
  const favoritePlatforms = hasField("favoritePlatforms")
    ? normalizeStringList(payload.favoritePlatforms)
    : normalizeStringList(existingProfile.favorite_platforms);
  const favoriteGenres = hasField("favoriteGenres")
    ? normalizeStringList(payload.favoriteGenres)
    : normalizeStringList(existingProfile.favorite_genres);

  if (displayName.length < 2 || displayName.length > 60) {
    return NextResponse.json({ error: "El nombre visible debe tener entre 2 y 60 caracteres." }, { status: 400 });
  }
  if (bio.error) return NextResponse.json({ error: bio.error }, { status: 400 });
  if (avatarUrl.error) return NextResponse.json({ error: avatarUrl.error }, { status: 400 });
  if (bannerUrl.error) return NextResponse.json({ error: bannerUrl.error }, { status: 400 });

  const now = new Date().toISOString();

  const { data, error } = await serviceClient
    .from("profiles")
    .update({
      display_name: displayName,
      bio: bio.value,
      avatar_url: avatarUrl.value,
      banner_url: bannerUrl.value,
      favorite_platforms: favoritePlatforms,
      favorite_genres: favoriteGenres,
      onboarding_completed: true,
      updated_at: now
    })
    .eq("id", auth.user.id)
    .select(PROFILE_SELECT)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Perfil no encontrado." }, { status: 404 });

  const { error: userError } = await serviceClient
    .from("app_users")
    .update({ display_name: displayName, updated_at: now })
    .eq("id", auth.user.id);

  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });

  return NextResponse.json({ profile: profileFromRow(data) });
}

export async function POST(request: Request) {
  return GET(request);
}

function normalizeNullableText(value: unknown, maxLength: number) {
  const text = String(value ?? "").trim();
  if (!text) return { value: null, error: null };
  if (text.length > maxLength) return { value: null, error: `El texto no puede superar ${maxLength} caracteres.` };
  return { value: text, error: null };
}

function normalizeAvatarUrl(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return { value: null, error: null };

  if (text.startsWith("data:")) {
    const match = /^data:([^;]+);base64,(.+)$/i.exec(text);
    if (!match) return { value: null, error: "La imagen del avatar no es válida." };
    const mime = match[1].toLowerCase();
    if (!ALLOWED_AVATAR_MIME.has(mime)) {
      return { value: null, error: "El avatar debe ser JPEG, PNG o WebP." };
    }
    const base64Length = match[2].length;
    const approxBytes = Math.floor(base64Length * 0.75);
    if (approxBytes > MAX_AVATAR_DATA_BYTES) {
      return { value: null, error: "La imagen pesa más de 750 KB. Súbela más comprimida o más pequeña." };
    }
    return { value: text, error: null };
  }

  if (text.length > MAX_AVATAR_URL_LENGTH) return { value: null, error: "La URL del avatar es demasiado larga." };

  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { value: null, error: "La URL del avatar debe empezar por http:// o https://." };
    }
    return { value: url.toString(), error: null };
  } catch {
    return { value: null, error: "La URL del avatar no es válida." };
  }
}

function normalizeBannerUrl(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return { value: null, error: null };

  if (text.startsWith("data:")) {
    const match = /^data:([^;]+);base64,(.+)$/i.exec(text);
    if (!match) return { value: null, error: "La imagen del banner no es válida." };
    const mime = match[1].toLowerCase();
    if (!ALLOWED_AVATAR_MIME.has(mime)) {
      return { value: null, error: "El banner debe ser JPEG, PNG o WebP." };
    }
    const base64Length = match[2].length;
    const approxBytes = Math.floor(base64Length * 0.75);
    if (approxBytes > MAX_BANNER_DATA_BYTES) {
      return { value: null, error: "La imagen del banner pesa demasiado. Prueba con menos de 1 MB o una URL." };
    }
    return { value: text, error: null };
  }

  if (text.length > MAX_BANNER_URL_LENGTH) return { value: null, error: "La URL del banner es demasiado larga." };

  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { value: null, error: "La URL del banner debe empezar por http:// o https://." };
    }
    return { value: url.toString(), error: null };
  } catch {
    return { value: null, error: "La URL del banner no es válida." };
  }
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    const text = String(item ?? "").trim().slice(0, 40);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= 8) break;
  }

  return result;
}
