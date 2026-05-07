import { NextResponse } from "next/server";
import { registerUser } from "@/services/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);

  try {
    const session = await registerUser({
      email: String(payload?.email ?? ""),
      password: String(payload?.password ?? ""),
      username: typeof payload?.username === "string" ? payload.username : undefined
    });
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la cuenta." },
      { status: 400 }
    );
  }
}
