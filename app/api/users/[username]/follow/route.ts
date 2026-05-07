import { NextResponse } from "next/server";
import { createServiceDatabaseClient } from "@/services/database";
import { ensureProfile, getOptionalUserIdFromRequest, getUserFromRequest } from "@/services/community";
import { getFollowCounts, getIsFollowing, getProfileRowByUsername } from "@/services/users";

type Params = Promise<{ username: string }>;

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Params }) {
  const { username } = await params;

  try {
    const profile = await getProfileRowByUsername(username);
    if (!profile) return NextResponse.json({ error: "Perfil no encontrado." }, { status: 404 });

    const viewerId = await getOptionalUserIdFromRequest(request);
    const [counts, isFollowing] = await Promise.all([
      getFollowCounts(profile.id),
      getIsFollowing(viewerId, profile.id)
    ]);

    return NextResponse.json({
      profileId: profile.id,
      isOwnProfile: viewerId === profile.id,
      isFollowing,
      ...counts
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar el seguimiento." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Params }) {
  const { username } = await params;
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const profile = await getProfileRowByUsername(username);
    if (!profile) return NextResponse.json({ error: "Perfil no encontrado." }, { status: 404 });
    if (profile.id === auth.user.id) return NextResponse.json({ error: "No puedes seguirte a ti mismo." }, { status: 400 });

    const payload = await request.json().catch(() => null);
    const enabled = payload?.enabled !== false;
    const serviceClient = createServiceDatabaseClient();
    await ensureProfile(serviceClient, auth.user);

    if (enabled) {
      const { error } = await serviceClient.from("follows").upsert(
        { follower_id: auth.user.id, following_id: profile.id },
        { onConflict: "follower_id,following_id" }
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await serviceClient
        .from("follows")
        .delete()
        .eq("follower_id", auth.user.id)
        .eq("following_id", profile.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const counts = await getFollowCounts(profile.id);
    return NextResponse.json({
      ok: true,
      isFollowing: enabled,
      isOwnProfile: false,
      ...counts
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el seguimiento." }, { status: 500 });
  }
}
