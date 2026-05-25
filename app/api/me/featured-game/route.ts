import { NextResponse } from "next/server";
import { createServiceDatabaseClient } from "@/services/database";
import { ensureProfile, getUserFromRequest } from "@/services/community";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const slug = String(payload?.slug ?? "").trim();
  if (!slug) return NextResponse.json({ error: "Falta el slug del juego." }, { status: 400 });

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);

  const { data: game, error: gameError } = await serviceClient
    .from("games")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (gameError) return NextResponse.json({ error: gameError.message }, { status: 500 });
  if (!game) return NextResponse.json({ error: "Juego no encontrado." }, { status: 404 });

  const { data: favoriteRow, error: favoriteError } = await serviceClient
    .from("user_game_statuses")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("game_id", game.id)
    .eq("status", "favorite")
    .maybeSingle();

  if (favoriteError) return NextResponse.json({ error: favoriteError.message }, { status: 500 });
  if (!favoriteRow) {
    return NextResponse.json(
      { error: "Solo puedes destacar un juego que tengas marcado como favorito." },
      { status: 400 }
    );
  }

  const { error: updateError } = await serviceClient
    .from("profiles")
    .update({ featured_game_id: game.id, updated_at: new Date().toISOString() })
    .eq("id", auth.user.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ featuredGameSlug: game.slug });
}

export async function DELETE(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);

  const { error } = await serviceClient
    .from("profiles")
    .update({ featured_game_id: null, updated_at: new Date().toISOString() })
    .eq("id", auth.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ featuredGameSlug: null });
}
