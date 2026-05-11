"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type ToastTone = "info" | "success" | "error";
export type ToastInput = { id?: string; tone?: ToastTone; title: string; description?: string; durationMs?: number };

type Toast = Required<Omit<ToastInput, "description">> & { description?: string };

const TOAST_EVENT = "gameindex:toast";
const DEFAULT_DURATION = 4500;

export function toast(input: ToastInput) {
  if (typeof window === "undefined") return;
  const event = new CustomEvent<Toast>(TOAST_EVENT, {
    detail: {
      id: input.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tone: input.tone ?? "info",
      title: input.title,
      description: input.description,
      durationMs: input.durationMs ?? DEFAULT_DURATION
    }
  });
  window.dispatchEvent(event);
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    function handler(event: Event) {
      const detail = (event as CustomEvent<Toast>).detail;
      if (!detail) return;
      setToasts((current) => [...current.filter((item) => item.id !== detail.id), detail]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== detail.id));
      }, detail.durationMs);
    }
    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, []);

  if (!toasts.length) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          className={cn(
            "pointer-events-auto w-full max-w-sm rounded-2xl border bg-surface/95 px-4 py-3 text-sm shadow-card backdrop-blur transition",
            item.tone === "success" && "border-lime/40",
            item.tone === "error" && "border-danger/50",
            item.tone === "info" && "border-white/10"
          )}
        >
          <p className="font-semibold text-foreground">{item.title}</p>
          {item.description && <p className="mt-1 text-muted">{item.description}</p>}
        </div>
      ))}
    </div>
  );
}
