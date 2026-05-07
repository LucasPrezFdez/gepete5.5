import { NextResponse } from "next/server";
import { authenticateUser } from "@/services/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);

  try {
    const session = await authenticateUser({
      email: String(payload?.email ?? ""),
      password: String(payload?.password ?? "")
    });
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar sesión." },
      { status: 401 }
    );
  }
}
