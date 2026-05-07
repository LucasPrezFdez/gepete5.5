"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserAuthClient } from "@/services/auth-browser";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type AuthMode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [redirectTo, setRedirectTo] = useState("/games");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextMode = params.get("mode");
    const nextRedirect = params.get("redirect");

    if (nextMode === "signup") {
      setMode("signup");
    }

    if (nextRedirect?.startsWith("/")) {
      setRedirectTo(nextRedirect);
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const authClient = createBrowserAuthClient();

      if (mode === "signup") {
        const cleanUsername = getSafeUsername(username || email.split("@")[0]);
        const { data, error: signUpError } = await authClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: cleanUsername,
              display_name: cleanUsername
            }
          }
        });

        if (signUpError) {
          throw signUpError;
        }

        if (data.user && data.session) {
          await fetch("/api/me/profile", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${data.session.access_token}`
            }
          });
          router.push(redirectTo === "/games" ? "/onboarding" : redirectTo);
          router.refresh();
          return;
        }

        setMessage("Cuenta creada. Revisa tu email para confirmar el registro antes de iniciar sesión.");
        setMode("signin");
      } else {
        const { error: signInError } = await authClient.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) {
          throw signInError;
        }

        router.push(redirectTo);
        router.refresh();
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "No se pudo completar la autenticación.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="container-page grid min-h-[70vh] place-items-center py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-electric">
            GameIndex
          </p>
          <h1 className="text-3xl font-black">
            {mode === "signin" ? "Entrar" : "Crear cuenta"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {mode === "signin"
              ? "Inicia sesión para valorar juegos y publicar comentarios."
              : "Crea una cuenta para guardar tus puntuaciones."}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="username">
                  Nombre de usuario
                </label>
                <Input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="norapixel"
                  minLength={3}
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="password">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
            </div>

            {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
            {message && <p className="rounded-xl bg-lime/10 p-3 text-sm text-lime">{message}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Procesando..." : mode === "signin" ? "Entrar" : "Crear cuenta"}
            </Button>
          </form>

          <button
            type="button"
            className="mt-5 w-full text-center text-sm font-semibold text-electric hover:text-blue-300"
            onClick={() => {
              setMode((value) => (value === "signin" ? "signup" : "signin"));
              setError(null);
              setMessage(null);
            }}
          >
            {mode === "signin" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Entra"}
          </button>
        </CardContent>
      </Card>
    </section>
  );
}

function getSafeUsername(value: string) {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 32);

  return normalized || "usuario";
}




