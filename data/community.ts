export type CommunityListGame = string | {
  title: string;
  coverUrl?: string | null;
};

export type CommunityListQuery = {
  genre?: string;
  theme?: string;
  themes?: string[];
  status?: "released" | "upcoming";
  year?: number;
  sort?: "popular" | "score" | "recent" | "upcoming" | "reviewed";
  scoreMin?: number;
  pageSize?: number;
};

export type CommunityListSeed = {
  slug: string;
  title: string;
  description: string;
  likes: number;
  games: CommunityListGame[];
  query?: CommunityListQuery;
};

export const COMMUNITY_LIST_MAX_GAMES = 100;

export const communityLists: CommunityListSeed[] = [
  {
    slug: "rpg-turnos-imprescindibles",
    title: "Mejores RPG por turnos",
    description: "Combate táctico, decisiones y progresión profunda.",
    likes: 2214,
    query: {
      genre: "Role-playing (RPG)",
      sort: "popular",
      pageSize: COMMUNITY_LIST_MAX_GAMES
    },
    games: [
      {
        title: "Baldur's Gate 3",
        coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co670h.jpg"
      },
      {
        title: "Clair Obscur: Expedition 33",
        coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co9gam.jpg"
      },
      {
        title: "Persona 5 Royal",
        coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co8h07.jpg"
      }
    ]
  },
  {
    slug: "mejores-juegos-terror",
    title: "Mis mejores juegos de terror",
    description: "Terror psicológico, survival horror y atmósferas densas.",
    likes: 1840,
    query: {
      themes: ["Horror", "Survival"],
      sort: "popular",
      pageSize: COMMUNITY_LIST_MAX_GAMES
    },
    games: [
      {
        title: "Alan Wake II",
        coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co6jar.jpg"
      },
      {
        title: "Resident Evil 4 Remake",
        coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co2wk8.jpg"
      },
      {
        title: "Dead Space",
        coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co5th8.jpg"
      }
    ]
  },
  {
    slug: "pendientes-para-2026",
    title: "Pendientes para 2026",
    description: "Lanzamientos de 2026 que tengo en el radar.",
    likes: 1290,
    query: {
      status: "upcoming",
      year: 2026,
      sort: "upcoming",
      pageSize: COMMUNITY_LIST_MAX_GAMES
    },
    games: [
      {
        title: "Hollow Knight: Silksong",
        coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/coaob9.jpg"
      },
      {
        title: "PRAGMATA",
        coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/cobxnx.jpg"
      },
      {
        title: "Fable",
        coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co2q4c.jpg"
      }
    ]
  }
];

export const emptyReviews: never[] = [];
