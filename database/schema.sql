create extension if not exists "pgcrypto";

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  username text unique not null,
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table profiles (
  id uuid primary key,
  username text unique not null,
  display_name text,
  bio text,
  avatar_url text,
  banner_url text,
  created_at timestamptz default now()
);

create table games (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  summary text,
  release_year int,
  status text check (status in ('released', 'upcoming', 'early_access')),
  cover_url text,
  hero_url text,
  trailer_url text,
  user_score numeric(3,1) default 0,
  critic_score int,
  rating_count int default 0,
  review_count int default 0,
  popularity_score numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table platforms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null
);

create table genres (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  logo_url text,
  country text,
  founded_year int
);

create table people (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  avatar_url text
);

create table franchises (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null
);

create table game_platforms (
  game_id uuid references games(id) on delete cascade,
  platform_id uuid references platforms(id) on delete cascade,
  primary key (game_id, platform_id)
);

create table game_genres (
  game_id uuid references games(id) on delete cascade,
  genre_id uuid references genres(id) on delete cascade,
  primary key (game_id, genre_id)
);

create table game_companies (
  game_id uuid references games(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  role text check (role in ('developer', 'publisher')),
  primary key (game_id, company_id, role)
);

create table game_credits (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  person_id uuid references people(id) on delete cascade,
  role text not null
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  score int check (score between 1 and 10),
  has_spoilers boolean default false,
  helpful_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table review_helpful_votes (
  review_id uuid references reviews(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (review_id, user_id)
);

create table ratings (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  score int check (score between 1 and 10),
  comment_body text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (game_id, user_id)
);

create table user_game_statuses (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  status text check (
    status in ('want_to_play', 'playing', 'completed', 'dropped', 'paused', 'favorite')
  ),
  created_at timestamptz default now(),
  unique (game_id, user_id, status)
);

create table lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  slug text unique not null,
  title text not null,
  description text,
  cover_url text,
  is_public boolean default true,
  likes_count int default 0,
  created_at timestamptz default now()
);

create table list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references lists(id) on delete cascade,
  game_id uuid references games(id) on delete cascade,
  position int not null,
  note text,
  unique (list_id, game_id)
);

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  type text check (type in ('cover', 'hero', 'screenshot', 'trailer', 'logo', 'avatar')),
  url text not null,
  alt text,
  created_at timestamptz default now()
);

create table release_dates (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  platform_id uuid references platforms(id) on delete set null,
  release_date date,
  region text
);

create table external_sources (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  provider text check (provider in ('igdb', 'rawg')),
  external_id text not null,
  url text,
  synced_at timestamptz,
  unique (provider, external_id)
);

create table external_scores (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  provider text not null,
  score numeric,
  vote_count int,
  synced_at timestamptz default now()
);

create table dlcs (
  id uuid primary key default gen_random_uuid(),
  parent_game_id uuid references games(id) on delete cascade,
  game_id uuid references games(id) on delete cascade,
  type text check (type in ('dlc', 'expansion')),
  unique (parent_game_id, game_id)
);

create index games_slug_idx on games(slug);
create index games_release_year_idx on games(release_year);
create index games_popularity_idx on games(popularity_score desc);
create index reviews_game_id_idx on reviews(game_id);
create index ratings_game_id_idx on ratings(game_id);
create index ratings_game_comments_idx on ratings(game_id, updated_at desc) where comment_body is not null;

-- Roadmap additions: canonical catalog, reviews, lists, library and activity feed.
alter table profiles add column if not exists updated_at timestamptz default now();
alter table profiles add column if not exists onboarding_completed boolean default false;
alter table profiles add column if not exists favorite_platforms text[] default '{}';
alter table profiles add column if not exists favorite_genres text[] default '{}';
alter table profiles add column if not exists banner_url text;
alter table profiles add column if not exists featured_game_id uuid references games(id) on delete set null;

alter table games add column if not exists last_synced_at timestamptz;
alter table games add column if not exists source_priority text default 'external';

create table if not exists list_likes (
  list_id uuid references lists(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (list_id, user_id)
);

create table if not exists saved_lists (
  list_id uuid references lists(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (list_id, user_id)
);

create table if not exists list_collaborators (
  list_id uuid references lists(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text default 'editor' check (role in ('editor')),
  created_at timestamptz default now(),
  primary key (list_id, user_id)
);

create table if not exists follows (
  follower_id uuid references profiles(id) on delete cascade,
  following_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  game_id uuid references games(id) on delete cascade,
  review_id uuid references reviews(id) on delete cascade,
  list_id uuid references lists(id) on delete cascade,
  type text check (type in ('rating', 'review', 'list', 'status', 'favorite')) not null,
  message text not null,
  created_at timestamptz default now()
);

create index if not exists games_user_score_idx on games(user_score desc);
create index if not exists games_rating_count_idx on games(rating_count desc);
create index if not exists game_platforms_platform_id_idx on game_platforms(platform_id);
create index if not exists game_genres_genre_id_idx on game_genres(genre_id);
create index if not exists game_companies_company_role_idx on game_companies(company_id, role);
create index if not exists lists_user_id_idx on lists(user_id, created_at desc);
create index if not exists list_items_list_position_idx on list_items(list_id, position);
create index if not exists list_collaborators_user_idx on list_collaborators(user_id, created_at desc);
create index if not exists user_game_statuses_user_status_idx on user_game_statuses(user_id, status, created_at desc);
create index if not exists activity_events_user_created_idx on activity_events(user_id, created_at desc);
create index if not exists activity_events_created_idx on activity_events(created_at desc);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references profiles(id) on delete cascade not null,
  actor_id uuid references profiles(id) on delete cascade,
  type text check (type in ('follow', 'review_helpful', 'list_like', 'list_collaborator', 'list_comment', 'game_released')) not null,
  list_id uuid references lists(id) on delete cascade,
  review_id uuid references reviews(id) on delete cascade,
  game_id uuid references games(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists notifications_recipient_created_idx on notifications(recipient_id, created_at desc);
create index if not exists notifications_recipient_unread_idx on notifications(recipient_id, read_at) where read_at is null;

-- Admin & moderation
alter table app_users add column if not exists is_admin boolean not null default false;
alter table app_users add column if not exists banned_at timestamptz;
alter table app_users add column if not exists banned_until timestamptz;
alter table app_users add column if not exists banned_reason text;
alter table app_users add column if not exists banned_by uuid references app_users(id) on delete set null;

create index if not exists app_users_is_admin_idx on app_users(is_admin) where is_admin = true;
create index if not exists app_users_banned_idx on app_users(banned_at) where banned_at is not null;

alter table reviews add column if not exists hidden_at timestamptz;
alter table reviews add column if not exists hidden_reason text;
alter table reviews add column if not exists hidden_by uuid references app_users(id) on delete set null;

alter table lists add column if not exists hidden_at timestamptz;
alter table lists add column if not exists hidden_reason text;
alter table lists add column if not exists hidden_by uuid references app_users(id) on delete set null;

alter table ratings add column if not exists hidden_at timestamptz;
alter table ratings add column if not exists hidden_reason text;
alter table ratings add column if not exists hidden_by uuid references app_users(id) on delete set null;

create index if not exists reviews_visible_idx on reviews(game_id, created_at desc) where hidden_at is null;
create index if not exists lists_visible_idx on lists(user_id, created_at desc) where hidden_at is null;

alter table games add column if not exists is_featured boolean not null default false;
alter table games add column if not exists featured_rank int;
alter table games add column if not exists is_hidden boolean not null default false;
alter table games add column if not exists hidden_reason text;

create index if not exists games_featured_idx on games(featured_rank) where is_featured = true;
create index if not exists games_visible_popularity_idx on games(popularity_score desc) where is_hidden = false;

create table if not exists content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references app_users(id) on delete set null,
  target_type text not null check (target_type in ('review','list','profile','comment','game')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','harassment','spoiler','offensive','inaccurate','other')),
  details text,
  status text not null default 'pending' check (status in ('pending','resolved','dismissed')),
  resolved_by uuid references app_users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz default now()
);

create index if not exists content_reports_pending_idx on content_reports(created_at desc) where status = 'pending';
create index if not exists content_reports_target_idx on content_reports(target_type, target_id);

create table if not exists admin_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('backfill_covers','bulk_resync')),
  status text not null default 'pending' check (status in ('pending','running','done','error')),
  progress int default 0,
  total int,
  started_by uuid references app_users(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz default now()
);

-- Telemetría de llamadas al proveedor LLM (Groq) y cache hits de IA.
create table if not exists llm_usage_log (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  outcome text not null check (outcome in ('llm', 'cache_hit', 'fallback', 'error')),
  user_id uuid references profiles(id) on delete set null,
  model text,
  tokens_in int,
  tokens_out int,
  latency_ms int,
  http_status int,
  error_code text,
  created_at timestamptz default now()
);

create index if not exists llm_usage_log_created_idx on llm_usage_log(created_at desc);
create index if not exists llm_usage_log_scope_created_idx on llm_usage_log(scope, created_at desc);
create index if not exists llm_usage_log_outcome_idx on llm_usage_log(outcome, created_at desc);

-- Trazabilidad de acciones administrativas (auditoría).
create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references app_users(id) on delete set null,
  admin_username text,
  action text not null,
  target_type text not null,
  target_id text,
  target_label text,
  metadata jsonb default '{}'::jsonb,
  ip_address text,
  created_at timestamptz default now()
);

create index if not exists admin_audit_log_created_idx on admin_audit_log(created_at desc);
create index if not exists admin_audit_log_admin_idx on admin_audit_log(admin_id, created_at desc);
create index if not exists admin_audit_log_action_idx on admin_audit_log(action, created_at desc);
create index if not exists admin_audit_log_target_idx on admin_audit_log(target_type, target_id);

-- AI-powered recommendations cached per user (24h TTL).
create table if not exists user_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  game_id uuid references games(id) on delete cascade not null,
  reason text not null,
  affinity_score numeric(4,1),
  position int not null,
  generated_at timestamptz default now(),
  expires_at timestamptz default now() + interval '24 hours',
  unique (user_id, game_id)
);

create index if not exists user_recommendations_user_position_idx
  on user_recommendations(user_id, position);
create index if not exists user_recommendations_expires_idx
  on user_recommendations(expires_at);
