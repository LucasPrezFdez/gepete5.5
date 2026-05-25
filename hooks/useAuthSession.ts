"use client";

import { useEffect, useState } from "react";
import type { AuthSession } from "@/services/auth-types";
import { createBrowserAuthClient } from "@/services/auth-browser";

export type AuthSessionState = {
  session: AuthSession | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
};

export function useAuthSession(): AuthSessionState {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let authClient: ReturnType<typeof createBrowserAuthClient>;
    try {
      authClient = createBrowserAuthClient();
    } catch {
      setIsLoading(false);
      return () => {
        mounted = false;
      };
    }

    authClient.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription }
    } = authClient.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    accessToken: session?.access_token ?? null,
    isAuthenticated: Boolean(session?.access_token),
    isAdmin: Boolean(session?.user?.isAdmin),
    isLoading
  };
}

export function buildAuthRedirectUrl(redirectTo: string, mode: "signin" | "signup" = "signin") {
  const params = new URLSearchParams();
  if (mode === "signup") params.set("mode", "signup");
  if (redirectTo) params.set("redirect", redirectTo);
  const query = params.toString();
  return query ? `/auth?${query}` : "/auth";
}
