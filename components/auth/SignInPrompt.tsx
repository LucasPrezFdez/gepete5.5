"use client";

import { Button } from "@/components/ui/Button";
import { buildAuthRedirectUrl } from "@/hooks/useAuthSession";
import { cn } from "@/lib/utils";

type SignInPromptProps = {
  title?: string;
  description?: string;
  redirectTo?: string;
  variant?: "card" | "inline";
  className?: string;
};

export function SignInPrompt({
  title = "Inicia sesión",
  description = "Necesitas una cuenta para realizar esta acción.",
  redirectTo,
  variant = "card",
  className
}: SignInPromptProps) {
  const signinHref = buildAuthRedirectUrl(redirectTo ?? "/", "signin");
  const signupHref = buildAuthRedirectUrl(redirectTo ?? "/", "signup");

  if (variant === "inline") {
    return (
      <div className={cn("flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm", className)}>
        <p className="text-muted">
          <span className="font-semibold text-foreground">{title}.</span> {description}
        </p>
        <div className="ml-auto flex gap-2">
          <Button asChild href={signinHref} size="sm">Entrar</Button>
          <Button asChild href={signupHref} size="sm" variant="secondary">Crear cuenta</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/5 p-5", className)}>
      <h3 className="font-bold">{title}</h3>
      <p className="mt-2 text-sm text-muted">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild href={signinHref}>Entrar</Button>
        <Button asChild href={signupHref} variant="secondary">Crear cuenta</Button>
      </div>
    </div>
  );
}
