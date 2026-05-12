import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromToken } from "@/services/auth";
import { createServiceDatabaseClient } from "@/services/database";
import { ensureProfile } from "@/services/community";

export const dynamic = "force-dynamic";

const SESSION_COOKIE = "gameindex-auth-token";

export default async function MePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) redirect("/auth?redirect=/me");

  const user = await getUserFromToken(token);
  if (!user) redirect("/auth?redirect=/me");

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, user);

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const username = profile?.username ?? user.user_metadata?.username;
  if (!username) redirect("/onboarding");

  redirect(`/users/${encodeURIComponent(username)}`);
}
