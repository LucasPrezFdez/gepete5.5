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
- No `RAWG_API_KEY` / IGDB creds → falls back to local data in `data/games.ts`.
- No `MEILISEARCH_*` → search service skips the Meili path and queries Neon / external APIs directly.
- No `GROQ_API_KEY` → `/api/chat` returns 503 with a "no configurado" message.

`AUTH_SECRET` and `DATABASE_URL` are required for any auth-gated functionality (`/me`, `/onboarding`, anything reading `app_users` / `profiles`).

## Architecture

Next.js 15 App Router + React 19 + TS strict. Path alias `@/*` points to repo root, so imports look like `@/services/games`, `@/lib/utils`, `@/data/games`. Default: server components; client components are explicit (`"use client"`).

### Data flow: the four-tier game catalog

`services/games.ts` is the orchestration layer. Reads go through a cascading fallback (preferred → fallback):

1. **Meilisearch** (`services/search.ts`) — full-text, fastest, used when `MEILISEARCH_HOST` set.
2. **Neon Postgres** (`services/database.ts`) — cached normalized games + user data.
3. **IGDB** (`services/igdb.ts`) — primary external source.
4. **RAWG** (`services/rawg.ts`) — secondary external source, also seeds the `/games` listing.

Each result carries a `source: "meili" | "neon" | "igdb" | "rawg" | "none"` tag. `services/cache.ts` decides when a Neon-cached row is stale (`shouldRefreshExternalGame`, default TTL 24h) and triggers a re-fetch + re-index. When adding a new feature that reads games, **call into `services/games.ts`**, do not hit IGDB/RAWG directly — the cascade and indexing live there.

`data/games.ts` and `data/community.ts` hold the static fallback dataset used when no integrations are configured. Both define the canonical `Game` / `GameSort` / `GameStatus` types consumed across the app.

### Auth

Custom auth, not NextAuth. `services/auth.ts` mints HMAC-signed tokens (`AUTH_SECRET`), stores users in the `app_users` table (Neon) with `scrypt` password hashes, and `profiles` holds public profile data. The session cookie is `gameindex-auth-token`.

- **Server**: read session via `services/community.ts` → `getOptionalUserIdFromRequest(request)` for optional auth, or the stricter helpers in `services/auth.ts` for required auth.
- **Middleware**: `middleware.ts` only gates `/me/*` and `/onboarding/*` — every other route handles auth itself (or treats it as optional).
- **Browser**: `services/auth-browser.ts` + `hooks/useAuthSession.ts` for client-side session state.
- **Database client**: prefer `createServiceDatabaseClient()` (Supabase-style) or `createSqlClient()` (raw SQL) from `services/database.ts`. Don't import `@neondatabase/serverless` directly elsewhere.

### API routes

Live under `app/api/*`. Conventions seen across the codebase:
- `export const runtime = "nodejs"` for routes using crypto / external SDKs; `export const dynamic = "force-dynamic"` for non-cacheable handlers.
- Errors return through `jsonError(message, status, extras?)` from `lib/api.ts`.
- Per-IP rate limiting via the in-memory `rateBuckets` Map pattern (see `app/api/chat/route.ts`) — process-local, fine for single-instance deploys, would need Redis for horizontal scaling.
- Logging via `createLogger("scope")` from `lib/logger.ts`; level controlled by `LOG_LEVEL`.

### Chat (`app/api/chat/route.ts`)

Streaming SSE endpoint backed by Groq. Tool-calling loop: the model can invoke `search_games` / `get_game_details` / `get_similar_games`, which dispatch into `services/games.ts`. If Groq returns a tool-call validation error, the route has an "intent rescue" path (`inferIntentFromText`) that parses the user's last message with regexes and synthesizes a `search_games` call so the user still gets an answer. `MAX_TOOL_ROUNDS` caps the loop. The final round always disables tools to force a text response.

### Theming

`lib/theme.ts` exports a single `arcadeTheme` object consumed via a React context (`useTheme()` inside `components/home/HomeExperience.tsx` and similar). Colors, fonts, and headline structure are centralized there — change theme tokens in `theme.ts`, not inline.

### Components

- `components/ui/` — base primitives (shadcn-style, configured in `components.json`).
- Feature dirs (`components/games/`, `components/home/`, etc.) own the page-specific composition.
- Some feature components (notably `components/home/HomeExperience.tsx`) are large monoliths that internally split into many subcomponents — prefer editing in place over premature extraction unless asked.

### Database schema

`database/schema.sql` is the source of truth. Key tables: `app_users` (auth), `profiles` (public profile), `user_games` (library + status), plus game/review tables. There is no migration tool — schema changes are applied manually.
