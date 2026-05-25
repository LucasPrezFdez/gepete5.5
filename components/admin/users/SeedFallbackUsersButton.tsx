"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/feedback/Toast";
import { useAuthSession } from "@/hooks/useAuthSession";

export function SeedFallbackUsersButton() {
  const router = useRouter();
  const { accessToken } = useAuthSession();
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    if (submitting) return;
    if (!window.confirm("Vamos a sembrar los usuarios mock de fallback-users.ts en app_users y profiles. Es idempotente — puedes ejecutarlo varias veces.")) {
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/seed/fallback-users", {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        toast({ tone: "error", title: "Seed fallido", description: result?.error });
        return;
      }
      toast({
        tone: "success",
        title: "Mocks sembrados",
        description: `${result.inserted} nuevos · ${result.updated} actualizados · ${result.skipped} con error`
      });
      router.refresh();
    } catch (error) {
      toast({ tone: "error", title: "Error de conexión", description: error instanceof Error ? error.message : String(error) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={handleClick} disabled={submitting}>
      {submitting ? "Sembrando..." : "Sembrar mocks"}
    </Button>
  );
}
