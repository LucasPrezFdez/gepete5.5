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
  },
  {
    slug: "soulslike-imprescindibles",
    title: "Soulslike imprescindibles",
    description: "Combate exigente, mundos opresivos y satisfacción al caer un boss.",
    likes: 1720,
    games: [
      { title: "Elden Ring" },
      { title: "Dark Souls III" },
      { title: "Dark Souls Remastered" },
      { title: "Dark Souls II: Scholar of the First Sin" },
      { title: "Demon's Souls" },
      { title: "Bloodborne" },
      { title: "Sekiro: Shadows Die Twice" },
      { title: "Lies of P" },
      { title: "Nioh 2" },
      { title: "Wo Long: Fallen Dynasty" },
      { title: "Lords of the Fallen" },
      { title: "The Surge 2" },
      { title: "Mortal Shell" },
      { title: "Code Vein" },
      { title: "Remnant II" },
      { title: "Black Myth: Wukong" }
    ]
  },
  {
    slug: "mundo-abierto-inolvidable",
    title: "Mundo abierto inolvidable",
    description: "Mapas vivos donde perderse 100 horas no es exageración.",
    likes: 1450,
    query: {
      themes: ["Open world"],
      sort: "popular",
      pageSize: COMMUNITY_LIST_MAX_GAMES
    },
    games: [
      { title: "The Witcher 3: Wild Hunt" },
      { title: "Red Dead Redemption 2" },
      { title: "The Legend of Zelda: Tears of the Kingdom" }
    ]
  },
  {
    slug: "metroidvania-esenciales",
    title: "Metroidvania esenciales",
    description: "Mapas interconectados, exploración recompensada y backtracking adictivo.",
    likes: 1050,
    query: {
      genre: "Platform",
      sort: "score",
      scoreMin: 7,
      pageSize: COMMUNITY_LIST_MAX_GAMES
    },
    games: [
      { title: "Hollow Knight" },
      { title: "Metroid Dread" },
      { title: "Blasphemous 2" }
    ]
  },
  {
    slug: "shooters-competitivos",
    title: "Shooters competitivos",
    description: "Tiroteos rápidos, esports y skill ceiling alto.",
    likes: 870,
    games: [
      { title: "Counter-Strike 2" },
      { title: "Valorant" },
      { title: "Apex Legends" },
      { title: "Overwatch 2" },
      { title: "Tom Clancy's Rainbow Six Siege" },
      { title: "Call of Duty: Modern Warfare III" },
      { title: "Call of Duty: Warzone" },
      { title: "Fortnite" },
      { title: "PUBG: Battlegrounds" },
      { title: "Halo Infinite" },
      { title: "The Finals" },
      { title: "XDefiant" },
      { title: "Splitgate" },
      { title: "Quake Champions" }
    ]
  }
];

export const emptyReviews: never[] = [];
