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
