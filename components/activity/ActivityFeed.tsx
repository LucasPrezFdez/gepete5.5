"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LoadingSkeleton } from "@/components/feedback/LoadingSkeleton";

type ActivityEvent = {
  id: string;
  type: "rating" | "review" | "list" | "status" | "favorite";
  message: string;
  createdAt: string | null;
  user: { username: string; displayName: string; avatarUrl: string | null } | null;
  game: { slug: string; title: string; cover_url?: string | null } | null;
  list: { slug: string; title: string } | null;
};

const dateFormatter = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit"
});

export function ActivityFeed({ username, limit = 12 }: { username?: string; limit?: number }) {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (username) params.set("username", username);
    params.set("limit", String(limit));

    fetch(`/api/activity?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as { events: ActivityEvent[] };
      })
      .then((data) => {
        if (!cancelled) setEvents(data.events ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error desconocido");
      });

    return () => {
      cancelled = true;
    };
  }, [username, limit]);

  if (error) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-muted">
        No hemos podido cargar la actividad ahora mismo.
      </div>
    );
  }

  if (!events) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <LoadingSkeleton key={index} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-muted">
        Aún no hay actividad reciente.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {events.map((event) => (
        <li
          key={event.id}
          className="surface-card flex items-start gap-3 rounded-2xl p-4 text-sm"
        >
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
            {event.user?.avatarUrl ? (
              <Image
                src={event.user.avatarUrl}
                alt=""
                fill
                sizes="40px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="grid h-full w-full place-items-center text-xs font-black">
                {(event.user?.displayName ?? "?").slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-foreground">
              {event.user && (
                <Link
                  href={`/users/${encodeURIComponent(event.user.username)}`}
                  className="font-semibold hover:text-electric"
                >
                  {event.user.displayName}
                </Link>
              )}{" "}
              <span className="text-muted">{event.message}</span>
              {event.game && (
                <>
                  {" "}
                  ·{" "}
                  <Link href={`/games/${event.game.slug}`} className="hover:text-electric">
                    {event.game.title}
                  </Link>
                </>
              )}
              {event.list && (
                <>
                  {" "}
                  ·{" "}
                  <Link href={`/lists/${event.list.slug}`} className="hover:text-electric">
                    {event.list.title}
                  </Link>
                </>
              )}
            </p>
            {event.createdAt && (
              <p className="mt-1 text-xs text-muted">
                {formatDate(event.createdAt)}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}
