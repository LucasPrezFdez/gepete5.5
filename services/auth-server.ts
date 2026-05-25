import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthUser } from "@/services/auth-types";
import { getUserFromToken } from "@/services/auth";

const SESSION_COOKIE = "gameindex-auth-token";

export async function getServerSessionUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getUserFromToken(token);
}

export async function requireAdminPage(redirectFrom: string): Promise<AuthUser> {
  const user = await getServerSessionUser();
  if (!user) redirect(`/auth?redirect=${encodeURIComponent(redirectFrom)}`);
  if (!user.isAdmin) redirect("/");
  return user;
}
