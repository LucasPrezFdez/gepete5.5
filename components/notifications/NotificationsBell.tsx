"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthSession } from "@/services/auth-types";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: "follow" | "review_helpful" | "list_like" | "list_collaborator";
  readAt: string | null;
  createdAt: string;
  actor: { username: string; displayName: string; avatarUrl: string | null } | null;
  list: { slug: string; title: string } | null;
  review: { id: string; title: string } | null;
  game: { slug: string; title: string } | null;
};

type NotificationsResponse = {
  notifications: Notification[];
  unreadCount: number;
};

const POLL_INTERVAL_MS = 60_000;

export function NotificationsBell({ session }: { session: AuthSession }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const token = session.access_token;

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/me/notifications", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      if (!response.ok) return;
      const data = (await response.json()) as NotificationsResponse;
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setUnread(Number(data.unreadCount ?? 0));
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    let mounted = true;
    fetchNotifications();
    const interval = window.setInterval(() => {
      if (mounted) fetchNotifications();
    }, POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await fetchNotifications();
      setLoading(false);
      if (unread > 0) {
        try {
          await fetch("/api/me/notifications", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          });
          setUnread(0);
          setItems((prev) =>
            prev.map((item) => (item.readAt ? item : { ...item, readAt: new Date().toISOString() }))
          );
        } catch {
          // ignore
        }
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : "Notificaciones"}
        aria-expanded={open}
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border motion-safe:transition-all motion-safe:duration-200",
          open
            ? "border-white/[0.15] bg-white/[0.08] text-foreground"
            : "border-white/[0.08] text-muted hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-foreground"
        )}
      >
        <BellIcon />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/[0.08] bg-background/98 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
            <span className="text-sm font-semibold">Notificaciones</span>
            {items.length > 0 && (
              <span className="text-[11px] text-muted">{items.length}</span>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted">Cargando...</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted">
                No tienes notificaciones todavía.
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {items.map((item) => (
                  <NotificationItem key={item.id} notification={item} onNavigate={() => setOpen(false)} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  onNavigate
}: {
  notification: Notification;
  onNavigate: () => void;
}) {
  const { href, label } = describeNotification(notification);

  const content = (
    <div className="flex items-start gap-3 px-4 py-3 motion-safe:transition-colors motion-safe:duration-150 hover:bg-white/[0.04]">
      <Avatar actor={notification.actor} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug text-foreground">{label}</p>
        <p className="mt-1 text-[11px] text-muted">{formatRelative(notification.createdAt)}</p>
      </div>
      {!notification.readAt && (
        <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-electric" aria-label="Sin leer" />
      )}
    </div>
  );

  if (href) {
    return (
      <li>
        <Link href={href} onClick={onNavigate} className="block">
          {content}
        </Link>
      </li>
    );
  }
  return <li>{content}</li>;
}

function Avatar({ actor }: { actor: Notification["actor"] }) {
  const initial = (actor?.displayName ?? actor?.username ?? "?").trim().charAt(0).toUpperCase() || "?";
  if (actor?.avatarUrl) {
    return (
      <img
        src={actor.avatarUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}
    >
      {initial}
    </span>
  );
}

function describeNotification(notification: Notification): { href: string | null; label: React.ReactNode } {
  const actorName = notification.actor?.displayName ?? notification.actor?.username ?? "Alguien";
  const actorUsername = notification.actor?.username;

  switch (notification.type) {
    case "follow":
      return {
        href: actorUsername ? `/users/${actorUsername}` : null,
        label: (
          <>
            <strong className="font-semibold">{actorName}</strong> ha empezado a seguirte.
          </>
        )
      };
    case "review_helpful":
      return {
        href: notification.game ? `/games/${notification.game.slug}/reviews` : null,
        label: (
          <>
            <strong className="font-semibold">{actorName}</strong> ha marcado tu reseña
            {notification.review?.title ? <> de «{notification.review.title}»</> : null} como útil.
          </>
        )
      };
    case "list_like":
      return {
        href: notification.list ? `/lists/${notification.list.slug}` : null,
        label: (
          <>
            <strong className="font-semibold">{actorName}</strong> ha dado like a tu lista
            {notification.list?.title ? <> «{notification.list.title}»</> : null}.
          </>
        )
      };
    case "list_collaborator":
      return {
        href: notification.list ? `/lists/${notification.list.slug}` : null,
        label: (
          <>
            <strong className="font-semibold">{actorName}</strong> te ha añadido como colaborador
            {notification.list?.title ? <> en «{notification.list.title}»</> : null}.
          </>
        )
      };
    default:
      return { href: null, label: "Tienes una notificación nueva." };
  }
}

function formatRelative(value: string) {
  const date = new Date(value);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "ahora mismo";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
