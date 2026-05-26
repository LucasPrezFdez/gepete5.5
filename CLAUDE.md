# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Next.js dev server
npm run build      # production build
npm run start      # serve production build
npm run lint       # eslint .
npm run typecheck  # tsc --noEmit
```

There is no test runner configured. Verify changes via `typecheck` + `lint` + manual smoke in `dev`.

## Environment

All env vars live in `.env.example`. The app degrades gracefully when integrations are missing:
- No `RAWG_API_KEY` / IGDB creds → falls back to local data in `data/fallback-games.ts` (catalog) and `data/fallback-users.ts` (public users/lists).
- No `MEILISEARCH_*` → search service skips the Meili path and queries Neon / external APIs directly.
- No `GROQ_API_KEY` → `/api/chat` returns 503 with a "no configurado" message, and `/api/me/recommendations` returns an empty result with `emptyReason: "llm-unavailable"`.

`AUTH_SECRET` and `DATABASE_URL` are required for any auth-gated functionality (`/me`, `/onboarding`, anything reading `app_users` / `profiles`). `ADMIN_EMAILS` (comma-separated, lowercased) drives the `is_admin` flag — it's synced on every signin/signup, and the `/admin` panel is gated on that flag in middleware.

## Architecture

Next.js 15 App Router + React 19 + TS strict. Path alias `@/*` points to repo root, so imports look like `@/services/games`, `@/lib/utils`, `@/data/games`. Default: server components; client components are explicit (`"use client"`).

### Data flow: the four-tier game catalog

`services/games.ts` is the orchestration layer. Reads go through a cascading fallback (preferred → fallback):

1. **Meilisearch** (`services/search.ts`) — full-text, fastest, used when `MEILISEARCH_HOST` set.
2. **Neon Postgres** (`services/database.ts`) — cached normalized games + user data.
3. **IGDB** (`services/igdb.ts`) — primary external source.
4. **RAWG** (`services/rawg.ts`) — secondary external source, also seeds the `/games` listing.

Each result carries a `source: "meili" | "neon" | "igdb" | "rawg" | "none"` tag. `services/cache.ts` decides when a Neon-cached row is stale (`shouldRefreshExternalGame`, default TTL 24h) and triggers a re-fetch + re-index. When adding a new feature that reads games, **call into `services/games.ts`**, do not hit IGDB/RAWG directly — the cascade and indexing live there.

`data/games.ts` exports the canonical `Game` / `GameSort` / `GameStatus` types consumed across the app, plus a tiny built-in fallback list. `data/fallback-games.ts` and `data/fallback-users.ts` hold the larger mock catalog and the 50 public mock profiles (sown into Neon by `scripts/seed-fallback-content.ts`). `data/community.ts` defines list/review/rating types used by the social layer.

### Auth

Custom auth, not NextAuth. `services/auth.ts` mints HMAC-signed tokens (`AUTH_SECRET`), stores users in the `app_users` table (Neon) with `scrypt` password hashes, and `profiles` holds public profile data. The session cookie is `gameindex-auth-token`.

- **Server**: read session via `services/community.ts` → `getOptionalUserIdFromRequest(request)` for optional auth, or the stricter helpers in `services/auth.ts` for required auth. `services/auth-server.ts` centralizes admin-only helpers.
- **Middleware**: `middleware.ts` gates `/me/*` and `/onboarding/*` (token present?) and `/admin/*` (token + `isAdmin: true` claim in JWT payload, expiry check). Every other route handles auth itself.
- **Browser**: `services/auth-browser.ts` + `hooks/useAuthSession.ts` for client-side session state.
- **Database client**: prefer `createServiceDatabaseClient()` (Supabase-style) or `createSqlClient()` (raw SQL) from `services/database.ts`. Don't import `@neondatabase/serverless` directly elsewhere.

### API routes

Live under `app/api/*`. Conventions seen across the codebase:
- `export const runtime = "nodejs"` for routes using crypto / external SDKs; `export const dynamic = "force-dynamic"` for non-cacheable handlers.
- Errors return through `jsonError(message, status, extras?)` from `lib/api.ts`.
- Per-IP rate limiting via the in-memory `rateBuckets` Map pattern (see `app/api/chat/route.ts`) — process-local, fine for single-instance deploys, would need Redis for horizontal scaling.
- Logging via `createLogger("scope")` from `lib/logger.ts`; level controlled by `LOG_LEVEL`.

### Chat (`app/api/chat/route.ts`)

Streaming SSE endpoint backed by Groq. Tool-calling loop: the model can invoke `search_games` / `get_game_details` / `get_similar_games`, which dispatch into `services/games.ts`. If Groq returns a tool-call validation error, the route has an "intent rescue" path (`inferIntentFromText`) that parses the user's last message with regexes and synthesizes a `search_games` call so the user still gets an answer. `MAX_TOOL_ROUNDS` caps the loop. The final round always disables tools to force a text response. Every call (success, cache hit, fallback, error) is recorded via `logLlmCall()` for the `/admin/ai` dashboard.

### AI recommendations (`services/recommendations.ts`, `/api/me/recommendations`)

Personalized "para ti" suggestions on `/me`. Pipeline: build a **taste profile** from the user's library (top genres / platforms / developers, high-rated and disliked titles) → gather a **candidate pool** (~30 games via `getExploreGames`) → ask **Groq** to rank and produce a one-line `reason` for each → cache the top 5 in the `user_recommendations` table with a 24h TTL. Subsequent calls within the TTL return `source: "cache"` without hitting the LLM. Empty states are tagged (`no-library`, `no-candidates`, `llm-unavailable`) so the UI can show the right message. Each call logs to `llm_usage_log` with scope `"recommendations"`.

### LLM metrics (`services/llm-metrics.ts`, `/admin/ai`)

Single `logLlmCall({ scope, outcome, userId, model, tokensIn, tokensOut, latencyMs, httpStatus, errorCode })` entrypoint that writes to `llm_usage_log`. Scopes are `"chat" | "recommendations"`; outcomes are `"llm" | "cache_hit" | "fallback" | "error"`. The admin dashboard reads aggregated metrics (calls, cache hit rate, token totals, error breakdown, 14-day timeseries) per scope. Logging is fire-and-forget — failures are caught and warned, never propagated.

### Social, notifications, moderation

- **`services/community.ts`** — reviews, ratings, helpful votes, activity feed (`activity_events`), shared session helpers.
- **`services/users.ts`** — public profiles, follow graph, featured game, library aggregation.
- **`services/lists.ts`** — user-created lists, items, likes, saves, collaborators.
- **`services/notifications.ts`** — writes to the `notifications` table on follow, review_helpful, list_like, list_collaborator, game_released events. Read by `/api/me/notifications` and the bell in the header.
- **Reports & moderation** — `POST /api/reports` writes to `content_reports`; admins triage at `/admin/reports`. Hidden content lives via `hidden_at` / `hidden_by` columns on `reviews` / `lists` / `ratings`, toggled through `/api/admin/content/hide` and `/unhide`.

### Admin panel (`app/admin/*`, `services/admin-*.ts`)

Admin-only area gated by `middleware.ts`. Pages:
- `/admin` — Dashboard: stat cards, integration health badges (DB / IGDB / RAWG / Groq / Meilisearch), signups/reviews/reports timeseries, recent activity. Data from `services/admin-stats.ts`.
- `/admin/users`, `/admin/users/[id]` — User list, search, filter (all/banned/admins), per-user detail with ban/unban controls. Native `<select>` options need explicit `bg-*` classes to render readably on the dark theme.
- `/admin/games`, `/admin/games/[slug]` — Catalog management, manual resync, feature / hide toggles.
- `/admin/cache` — Submit async jobs (`backfill_covers`, `bulk_resync`) tracked in `admin_jobs`, polled via `/api/admin/jobs/[id]`. Logic in `services/admin-jobs.ts`.
- `/admin/reports`, `/admin/reports/[id]` — Triage queue, resolve / dismiss.
- `/admin/ai` — LLM metrics dashboard (see above).
- `/admin/audit` — Action log. Every admin mutation (ban, promote, hide, resync, etc.) is recorded via `services/admin-audit.ts` into `admin_audit_log` with admin ID, action, target, metadata, and request IP.

When adding an admin mutation, write to `admin_audit_log` through `services/admin-audit.ts` — the audit trail is the contract the panel relies on.

### Theming

`lib/theme.ts` exports a single `arcadeTheme` object consumed via a React context (`useTheme()` inside `components/home/HomeExperience.tsx` and similar). Colors, fonts, and headline structure are centralized there — change theme tokens in `theme.ts`, not inline.

### Components

- `components/ui/` — base primitives (shadcn-style, configured in `components.json`).
- Feature dirs by area: `activity/`, `admin/`, `auth/`, `chat/`, `feedback/`, `games/`, `home/`, `layout/`, `lists/`, `notifications/`, `rankings/`, `ratings/`, `reviews/`, `sections/`, `users/`.
- Some feature components (notably `components/home/HomeExperience.tsx`) are large monoliths that internally split into many subcomponents — prefer editing in place over premature extraction unless asked.
- Admin sub-tree (`components/admin/`) has its own shared primitives: `AdminPageHeader`, `AdminSidebar`, `AdminCharts` (ChartCard / HorizontalBarChart / SparkLine), `StatCard`, `HealthBadge`, plus feature folders (`users/`, `games/`, `reports/`, `cache/`).
- Dark-theme gotcha: native `<select>` dropdowns inherit the page background poorly. When adding a select, give each `<option>` an explicit `bg-[#0b0f1a] text-foreground` class so the dropdown is readable.

### Lib

- `lib/api.ts` — `jsonError`, JSON helpers for API routes.
- `lib/logger.ts` — `createLogger("scope")`, level via `LOG_LEVEL`.
- `lib/rate-limit.ts` — in-memory per-IP bucket helper used by chat and other write endpoints.
- `lib/validation.ts`, `lib/sanitize-review.ts` — input validation and HTML sanitization for review bodies (Tiptap-produced).
- `lib/theme.ts` — `arcadeTheme` tokens, shared `useTheme()` context.
- `lib/ranking.ts` — score / popularity math for the rankings pages.
- `lib/utils.ts`, `lib/site.ts` — `cn()`, site-wide constants.

### Database schema

`database/schema.sql` is the source of truth. ~30 tables, no migration tool — schema changes are applied manually. Grouped:

- **Auth & profile**: `app_users` (email, scrypt password_hash, is_admin, banned_at/until/by/reason), `profiles` (bio, avatar, banner, featured_game_id, onboarding flags, favorite platforms/genres).
- **Catalog**: `games`, `platforms`, `genres`, `companies`, `people`, `franchises`, and join tables `game_platforms`, `game_genres`, `game_companies`, `game_credits`. Enrichment: `media_assets`, `release_dates`, `external_sources`, `external_scores`, `dlcs`.
- **Library & social**: `user_game_statuses` (the library — want_to_play/playing/completed/dropped/paused/favorite), `ratings` (quick 1-10 + optional comment, one per user/game), `reviews` (full title + body + score, spoiler flag, `hidden_at`/`hidden_by`, `helpful_count`), `review_helpful_votes`, `follows`, `activity_events`.
- **Lists**: `lists`, `list_items`, `list_likes`, `saved_lists`, `list_collaborators`.
- **Notifications & moderation**: `notifications`, `content_reports`.
- **Admin & telemetry**: `admin_jobs` (async jobs: backfill_covers, bulk_resync), `admin_audit_log` (every admin mutation, with IP + metadata), `llm_usage_log` (chat + recommendations telemetry), `user_recommendations` (24h-TTL AI suggestions cache).

Library status lives in `user_game_statuses` (not `user_games`). Reviews and ratings are **separate tables** — a "rating" is just a score (+ optional short comment), a "review" has a title and body.
