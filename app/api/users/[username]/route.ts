import { NextResponse } from "next/server";
import { getPublicUserProfile } from "@/services/users";

type Params = Promise<{ username: string }>;

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Params }) {
  const { username } = await params;

  try {
    const profile = await getPublicUserProfile(username);
    if (!profile) return NextResponse.json({ error: "Perfil no encontrado." }, { status: 404 });
    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar el perfil." }, { status: 500 });
  }
}
