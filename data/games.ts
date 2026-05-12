export type GameStatus = "released" | "upcoming" | "early_access";

export type GameSort = "popular" | "score" | "recent" | "upcoming" | "reviewed";

export type Game = {
  title: string;
  slug: string;
  year: number;
  platforms: string[];
  genres: string[];
  developer: string;
  publisher: string;
  userScore: number;
  criticScore: number | null;
  reviews: number;
  ratings: number;
  status: GameStatus;
  coverUrl: string;
  heroUrl: string;
  trailerUrl?: string;
  summary: string;
  modes: string[];
  franchise?: string;
  releaseDate: string;
  engine?: string;
};

export type GameDetails = Game & {
  id?: string;
  externalSources?: Array<{ provider: "igdb" | "rawg" | string; externalId: string; url?: string | null }>;
  releaseDates?: Array<{ platform?: string | null; releaseDate?: string | null; region?: string | null }>;
  screenshots?: Array<{ url: string; alt?: string | null }>;
};

export type UserGameStatus = "want_to_play" | "playing" | "completed" | "dropped" | "paused" | "favorite";

export type Profile = {
  id: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  favoritePlatforms: string[];
  favoriteGenres: string[];
};

export type ProfileStats = {
  ratingsCount: number;
  averageScore: number;
  completedCount: number;
  backlogCount: number;
  listsCount: number;
  followerCount: number;
  followingCount: number;
  favoritePlatforms: string[];
  favoriteGenres: string[];
};

export type Review = {
  id: string;
  gameSlug: string;
  gameTitle?: string;
  user: Profile;
  title: string;
  body: string;
  score: number;
  helpfulCount: number;
  hasSpoilers: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GameListItem = {
  game: Game;
  position: number;
  note?: string | null;
};

export type GameList = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  isPublic: boolean;
  likesCount: number;
  user: Profile;
  items: GameListItem[];
  createdAt: string;
};

export type ActivityEvent = {
  id: string;
  type: "rating" | "review" | "list" | "status" | "favorite";
  createdAt: string;
  user: Profile;
  game?: Game;
  review?: Review;
  list?: Pick<GameList, "slug" | "title">;
  message: string;
};
