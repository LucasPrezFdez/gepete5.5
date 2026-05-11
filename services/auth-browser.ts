import type { AuthSession } from "@/services/auth-types";

const STORAGE_KEY = "gameindex.auth.session";
const AUTH_EVENT = "gameindex-auth-change";
const SESSION_COOKIE = "gameindex-auth-token";
const SESSION_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;

type AuthCallback = (event: "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED", session: AuthSession | null) => void;

export function createBrowserAuthClient() {
  return {
    auth: {
      async getSession() {
        return { data: { session: readSession() } };
      },
      onAuthStateChange(callback: AuthCallback) {
        const listener = () => callback("TOKEN_REFRESHED", readSession());
        window.addEventListener(AUTH_EVENT, listener);
        window.addEventListener("storage", listener);
        return {
          data: {
            subscription: {
              unsubscribe() {
                window.removeEventListener(AUTH_EVENT, listener);
                window.removeEventListener("storage", listener);
              }
            }
          }
        };
      },
      async signInWithPassword(input: { email: string; password: string }) {
        return submitAuth("/api/auth/signin", input);
      },
      async signUp(input: { email: string; password: string; options?: { data?: { username?: string; display_name?: string } } }) {
        return submitAuth("/api/auth/signup", {
          email: input.email,
          password: input.password,
          username: input.options?.data?.username
        });
      },
      async signOut() {
        clearSession();
        emitAuthChange();
        return { error: null };
      }
    }
  };
}

async function submitAuth(url: string, body: unknown) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error ?? "No se pudo completar la autenticación.");
    writeSession(payload.session);
    emitAuthChange();
    return { data: { session: payload.session, user: payload.session.user }, error: null };
  } catch (error) {
    return { data: { session: null, user: null }, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

function readSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    clearSession();
    return null;
  }
}

function writeSession(session: AuthSession) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(session.access_token)}; Path=/; Max-Age=${SESSION_COOKIE_TTL_SECONDS}; SameSite=Lax${secure}`;
}

function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY);
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function emitAuthChange() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

