"use client";

import {
  createContext,
  type Dispatch,
  type PointerEvent,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import Image from "next/image";
import Link from "next/link";
import type { Game } from "@/data/games";
import { communityLists as fallbackCommunityLists, type CommunityListGame, type CommunityListSeed } from "@/data/community";
import { arcadeTheme, type HeadlinePart, type HomeTheme } from "@/lib/theme";
import { formatCompactNumber, slugify } from "@/lib/utils";

type EnhancedGame = Game & { accent: string };
type PlatformKind = "pc" | "playstation" | "xbox" | "nintendo" | "mobile" | "mac" | "linux" | "generic";
type Platform = {
  slug: string;
  name: string;
  kind: PlatformKind;
  count: number;
};
type HomeCollections = Partial<{
  trending: Game[];
  topRated: Game[];
  upcoming: Game[];
  newReleases: Game[];
  indieGems: Game[];
  topRpg: Game[];
  bestOfYear: Game[];
}>;
type CommunityList = CommunityListSeed & { curator?: string };

const ThemeContext = createContext<HomeTheme | null>(null);

function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error("HomeExperience debe renderizarse dentro de ThemeContext.");
  }
  return theme;
}

const accentPool = ["#3B82F6", "#8B5CF6", "#A3E635", "#FB7185", "#60A5FA", "#C4B5FD"];

function enrichGames(games: Game[]): EnhancedGame[] {
  return games.map((game, index) => ({
    ...game,
    accent: accentPool[index % accentPool.length]
  }));
}

function mergeGameLists(lists: Array<Game[] | undefined>): Game[] {
  const seen = new Set<string>();
  const merged: Game[] = [];

  for (const list of lists) {
    for (const game of list ?? []) {
      const key = game.slug || game.title;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(game);
    }
  }

  return merged;
}

function platformKind(name: string): PlatformKind {
  const value = name.toLowerCase();
  if (value.includes("playstation") || value.startsWith("ps")) return "playstation";
  if (value.includes("xbox")) return "xbox";
  if (value.includes("switch") || value.includes("nintendo")) return "nintendo";
  if (value.includes("mac") || value.includes("os x")) return "mac";
  if (value.includes("linux")) return "linux";
  if (value.includes("ios") || value.includes("android") || value.includes("mobile")) return "mobile";
  if (value.includes("pc") || value.includes("windows")) return "pc";
  return "generic";
}

function PlatformGlyph({ kind, color }: { kind: PlatformKind; color: string }) {
  const props = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "playstation":
      return (
        <svg {...props}>
          <path d="M9 4v15l-3-1.2V6.5L9 4z" fill={color} stroke="none" />
          <path d="M9 9.5c2 .4 5.5 1.4 5.5 3.5 0 1.4-1.3 2-2.5 1.6" />
          <path d="M5.5 17.5l13 2.2-3.5 1.3-9.5-1.6v-1.9z" fill={color} stroke="none" opacity="0.85" />
        </svg>
      );
    case "xbox":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M7 5.5c2 1 4 3 5 5 1-2 3-4 5-5" />
          <path d="M5.5 8c1.5 2 3.5 5 4.5 9" />
          <path d="M18.5 8c-1.5 2-3.5 5-4.5 9" />
        </svg>
      );
    case "nintendo":
      return (
        <svg {...props}>
          <rect x="3.5" y="3.5" width="7" height="17" rx="2.5" />
          <rect x="13.5" y="3.5" width="7" height="17" rx="2.5" />
          <circle cx="7" cy="8.5" r="1.1" fill={color} stroke="none" />
          <circle cx="17" cy="15.5" r="1.4" fill={color} stroke="none" />
        </svg>
      );
    case "pc":
      return (
        <svg {...props}>
          <rect x="2.5" y="4" width="19" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
          <path d="M5.5 8h6M5.5 11h4" opacity="0.7" />
        </svg>
      );
    case "mac":
      return (
        <svg {...props}>
          <path d="M16.5 13c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.9-.7-1.5 0-2.9.9-3.6 2.2-1.6 2.7-.4 6.7 1.1 8.9.7 1.1 1.6 2.3 2.8 2.2 1.1 0 1.5-.7 2.9-.7 1.4 0 1.7.7 2.9.7 1.2 0 2-1.1 2.7-2.2.6-.9 1-1.7 1.3-2.6-1.5-.6-2.6-2-2.6-3.5z" fill={color} stroke="none" />
          <path d="M14 5.5c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.5.6-1 1.6-.9 2.6 1 .1 2-.5 2.6-1.2z" fill={color} stroke="none" />
        </svg>
      );
    case "linux":
      return (
        <svg {...props}>
          <path d="M12 3c-2.2 0-3.5 2-3.5 4.5 0 1.5.7 2.5.7 4 0 1.6-2.2 3-2.7 5-.4 1.6.5 3 2 3.5 1 .3 2 0 2.5-.5.4.6 1.2 1 2 1s1.6-.4 2-1c.5.5 1.5.8 2.5.5 1.5-.5 2.4-1.9 2-3.5-.5-2-2.7-3.4-2.7-5 0-1.5.7-2.5.7-4C15.5 5 14.2 3 12 3z" />
          <circle cx="10.5" cy="8" r="0.6" fill={color} stroke="none" />
          <circle cx="13.5" cy="8" r="0.6" fill={color} stroke="none" />
          <path d="M10.5 10.5c.5.5 2.5.5 3 0" />
        </svg>
      );
    case "mobile":
      return (
        <svg {...props}>
          <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
          <path d="M10 5.5h4" opacity="0.6" />
          <circle cx="12" cy="18" r="0.8" fill={color} stroke="none" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <path d="M7 8h10a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-1.5l-1.5-2h-4l-1.5 2H7a3 3 0 0 1-3-3v-2a3 3 0 0 1 3-3z" />
          <circle cx="9" cy="12" r="0.9" fill={color} stroke="none" />
          <circle cx="15" cy="12" r="0.9" fill={color} stroke="none" />
        </svg>
      );
  }
}

function buildPlatforms(games: EnhancedGame[]): Platform[] {
  const counts = new Map<string, number>();
  for (const game of games) {
    for (const platform of game.platforms) {
      counts.set(platform, (counts.get(platform) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({
      slug: slugify(name),
      name,
      count,
      kind: platformKind(name)
    }));
}

function useWindowScrollY() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return scrollY;
}

function useInView<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, inView] as const;
}

export function HomeExperience({
  collections,
  communityLists,
  initialGames,
  theme = arcadeTheme
}: {
  collections?: HomeCollections;
  communityLists?: CommunityListSeed[];
  initialGames?: Game[];
  theme?: HomeTheme;
}) {
  const scrollY = useWindowScrollY();
  const collectionGames = useMemo(
    () => mergeGameLists([collections?.trending, collections?.topRated, collections?.upcoming, collections?.newReleases]),
    [collections?.newReleases, collections?.topRated, collections?.trending, collections?.upcoming]
  );
  const games = useMemo(
    () => enrichGames(initialGames?.length ? initialGames : collectionGames),
    [collectionGames, initialGames]
  );
  const platforms = useMemo(() => buildPlatforms(games), [games]);
  const lists = useMemo(
    () => [...(communityLists?.length ? communityLists : fallbackCommunityLists)].sort((a, b) => b.likes - a.likes) as CommunityList[],
    [communityLists]
  );
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [openGame, setOpenGame] = useState<EnhancedGame | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    let result = games;

    if (normalized.length >= 2) {
      result = result.filter((game) =>
        [
          game.title,
          game.developer,
          game.publisher,
          String(game.year),
          ...game.genres,
          ...game.platforms
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized)
      );
    }

    if (activeFilter !== "all") {
      result = result.filter((game) =>
        game.platforms.some((platform) => platform.toLowerCase().includes(activeFilter))
      );
    }

    return result;
  }, [activeFilter, games, query]);

  const trending = useMemo(
    () => enrichGames(collections?.trending?.length ? collections.trending : filtered).slice(0, 6),
    [collections?.trending, filtered]
  );
  const topRated = useMemo(
    () =>
      enrichGames(
        collections?.topRated?.length
          ? collections.topRated
          : [...filtered].filter((game) => game.userScore > 0).sort((a, b) => b.userScore - a.userScore)
      ).slice(0, 8),
    [collections?.topRated, filtered]
  );
  const upcoming = useMemo(
    () => enrichGames(collections?.upcoming?.length ? collections.upcoming : filtered.filter((game) => game.status !== "released")),
    [collections?.upcoming, filtered]
  );
  const newReleases = useMemo(
    () =>
      enrichGames(
        collections?.newReleases?.length
          ? collections.newReleases
          : [...filtered].filter((game) => game.userScore > 0).sort((a, b) => b.year - a.year)
      ).slice(0, 8),
    [collections?.newReleases, filtered]
  );
  const indieGems = useMemo(
    () =>
      enrichGames(
        collections?.indieGems?.length
          ? collections.indieGems
          : filtered.filter((game) => game.genres.some((g) => g.toLowerCase().includes("indie")))
      ).slice(0, 6),
    [collections?.indieGems, filtered]
  );
  const topRpg = useMemo(
    () =>
      enrichGames(
        collections?.topRpg?.length
          ? collections.topRpg
          : [...filtered]
              .filter((game) =>
                game.genres.some((g) => g.toLowerCase().includes("rpg") || g.toLowerCase().includes("role-playing"))
              )
              .sort((a, b) => b.userScore - a.userScore)
      ).slice(0, 8),
    [collections?.topRpg, filtered]
  );
  const bestOfYear = useMemo(
    () =>
      enrichGames(
        collections?.bestOfYear?.length
          ? collections.bestOfYear
          : [...filtered]
              .filter((game) => game.year === new Date().getFullYear() && game.userScore > 0)
              .sort((a, b) => b.userScore - a.userScore)
      ).slice(0, 6),
    [collections?.bestOfYear, filtered]
  );

  const isSearching = query.trim().length >= 2 || activeFilter !== "all";

  if (games.length === 0) {
    return (
      <ThemeContext.Provider value={theme}>
        <section className="container-page -mt-20 grid min-h-screen place-items-center pt-20 text-center">
          <div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-electric">API requerida</p>
            <h1 className="mt-3 text-4xl font-black">No hay juegos para mostrar</h1>
            <p className="mt-3 text-muted">Configura IGDB o RAWG en .env para cargar el catálogo desde la API.</p>
          </div>
        </section>
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={theme}>
      <div
        className="relative -mt-20 isolate min-h-screen overflow-hidden pt-20"
        style={{
          background: theme.bg,
          color: theme.fg,
          fontFamily: theme.fontBody
        }}
      >
        <div className="pointer-events-none fixed inset-0 z-0">
          <AnimatedMesh />
          <NoiseOverlay opacity={theme.noiseOpacity} />
        </div>

        <main className="relative z-10">
          <Hero
            activeFilter={activeFilter}
            games={games}
            query={query}
            scrollY={scrollY}
            setActiveFilter={setActiveFilter}
            setQuery={setQuery}
          />

          <Marquee
            items={games.slice(0, 6).map((game) => ({
              label: game.title.toUpperCase(),
              value: game.userScore ? game.userScore.toFixed(1) : "API"
            }))}
            speed={45}
          />

          {isSearching ? (
            <Section eyebrow="Resultados" title={`${filtered.length} juegos encontrados`}>
              <Grid games={filtered} />
            </Section>
          ) : (
            <>
              <Section eyebrow="Tendencias globales" href="/games?sort=popular" title="Lo que está jugando el mundo ahora">
                <DragCarousel>
                  {trending.map((game, index) => (
                    <div key={game.slug} style={{ flex: "0 0 240px", scrollSnapAlign: "start" }}>
                      <TiltCard game={game} priority={index < 4} />
                    </div>
                  ))}
                </DragCarousel>
              </Section>

              <Section eyebrow="Ranking vivo" href="/rankings/top-250" title="Mejores valorados">
                <RankingList games={topRated} onOpen={setOpenGame} />
              </Section>

              <Section eyebrow="RPG de élite" href="/games?genre=Role-playing (RPG)&sort=score" title="Los mejores roles del momento">
                <Grid games={topRpg.length ? topRpg : games.slice(0, 4)} />
              </Section>

              <Section eyebrow="Hype" href="/games?status=upcoming" title="Próximos lanzamientos">
                <Grid games={upcoming.length ? upcoming : games.slice(0, 4)} />
              </Section>

              <Section eyebrow="Cosecha 2026" href="/games?year=2026&sort=score" title="Lo mejor de este año">
                <DragCarousel>
                  {bestOfYear.map((game) => (
                    <div key={game.slug} style={{ flex: "0 0 240px", scrollSnapAlign: "start" }}>
                      <TiltCard game={game} />
                    </div>
                  ))}
                </DragCarousel>
              </Section>

              <Section eyebrow="Recientes" href="/games?sort=recent" title="Nuevos lanzamientos">
                <DragCarousel>
                  {newReleases.map((game) => (
                    <div key={game.slug} style={{ flex: "0 0 240px", scrollSnapAlign: "start" }}>
                      <TiltCard game={game} />
                    </div>
                  ))}
                </DragCarousel>
              </Section>

              <Section eyebrow="Joyas indie" href="/games?genre=Indie&sort=score" title="Independientes que están dando que hablar">
                <DragCarousel>
                  {indieGems.map((game) => (
                    <div key={game.slug} style={{ flex: "0 0 240px", scrollSnapAlign: "start" }}>
                      <TiltCard game={game} />
                    </div>
                  ))}
                </DragCarousel>
              </Section>

              <PlatformSection platforms={platforms} />

              <Section eyebrow="Comunidad" href="/lists/rpg-turnos-imprescindibles" title="Listas que están de moda">
                <ListsGrid games={games} lists={lists} />
              </Section>

              <FinalCTA games={games} />
            </>
          )}
        </main>

        {openGame && <GameModal game={openGame} onClose={() => setOpenGame(null)} />}

        <HomeStyles />
      </div>
    </ThemeContext.Provider>
  );
}

function AnimatedMesh() {
  const theme = useTheme();
  const [time, setTime] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      setTime((performance.now() - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const blobs = theme.meshBlobs
    .map((blob, index) => {
      const x = blob.x + Math.sin(time * blob.speed + index) * blob.range;
      const y = blob.y + Math.cos(time * blob.speed * 0.8 + index * 1.3) * blob.range;
      return `radial-gradient(circle at ${x}% ${y}%, ${blob.color} 0%, transparent ${blob.size}%)`;
    })
    .join(",");

  return (
    <div
      className="absolute inset-0"
      style={{
        background: blobs,
        filter: "blur(40px) saturate(1.4)",
        opacity: 0.65
      }}
    />
  );
}

function NoiseOverlay({ opacity }: { opacity: number }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        opacity,
        mixBlendMode: "overlay",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")"
      }}
    />
  );
}

function Hero({
  activeFilter,
  games,
  query,
  scrollY,
  setActiveFilter,
  setQuery
}: {
  activeFilter: string;
  games: EnhancedGame[];
  query: string;
  scrollY: number;
  setActiveFilter: Dispatch<SetStateAction<string>>;
  setQuery: Dispatch<SetStateAction<string>>;
}) {
  const theme = useTheme();
  const featuredGame = games[0];
  const parallax1 = scrollY * 0.4;
  const parallax2 = scrollY * 0.25;
  const parallax3 = scrollY * 0.15;
  const tags = [
    { label: "RPG", filter: "all", query: "RPG" },
    { label: "2026", filter: "all", query: "2026" },
    { label: "PlayStation", filter: "playstation", query: "" },
    { label: "Indie", filter: "all", query: "Indie" },
    { label: "Co-op", filter: "all", query: "Co-op" },
    { label: "PC", filter: "pc", query: "" },
    { label: "Switch", filter: "switch", query: "" }
  ];

  return (
    <section className="relative px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pb-20">
      <div className="relative mx-auto max-w-[1400px]">
        <div
          className="relative overflow-hidden rounded-[32px]"
          style={{
            border: `1px solid ${theme.heroBorder}`,
            background: theme.heroBg,
            minHeight: "min(85vh, 720px)"
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: `translate3d(0, ${parallax3}px, 0) scale(1.1)`,
              transition: "opacity .5s"
            }}
          >
            {featuredGame.coverUrl ? (
              <Image
                alt=""
                aria-hidden="true"
                src={featuredGame.coverUrl}
                fill
                sizes="100vw"
                priority
                className="object-cover"
                style={{ filter: "blur(2px) saturate(1.2)", opacity: 0.35 }}
              />
            ) : null}
            <div className="absolute inset-0" style={{ background: theme.heroGradient }} />
          </div>

          <FloatingDeco scrollY={scrollY} />

          <div
            className="relative grid gap-10 p-6 sm:p-8 md:p-12 lg:grid-cols-[1.4fr,1fr] lg:p-16"
            style={{ minHeight: "min(85vh, 720px)" }}
          >
            <div
              className="flex flex-col justify-center"
              style={{ transform: `translate3d(0, ${parallax2 * -0.3}px, 0)` }}
            >
              <div
                className="mb-6 inline-flex items-center gap-2.5 self-start rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]"
                style={{
                  background: theme.heroEyebrowBg,
                  color: theme.heroEyebrowFg,
                  border: `1px solid ${theme.heroEyebrowBorder}`,
                  fontFamily: theme.fontMono
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: theme.accent,
                    boxShadow: `0 0 0 4px ${theme.accent}33, 0 0 12px ${theme.accent}`,
                    animation: "home-pulse 1.8s ease-in-out infinite"
                  }}
                />
                Beta · Videojuegos · Reseñas · Listas
              </div>

              <h1
                className="font-black leading-[0.92] tracking-[-0.04em]"
                style={{
                  fontSize: "clamp(48px, 7vw, 96px)",
                  fontFamily: theme.fontDisplay,
                  color: theme.fg
                }}
              >
                <AnimatedHeadline parts={theme.headlineParts} />
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed md:text-lg" style={{ color: theme.muted }}>
                Descubre videojuegos, consulta fichas completas, compara puntuaciones, crea listas y organiza tus pendientes.
              </p>

              <div className="mt-8 max-w-2xl">
                <BigSearch games={games} query={query} setQuery={setQuery} />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {tags.map((tag, index) => {
                  const active = activeFilter === tag.filter && (tag.filter !== "all" || query === tag.query);
                  return (
                    <button
                      key={tag.label}
                      className="rounded-full px-4 py-2 text-sm font-semibold transition"
                      onClick={() => {
                        if (tag.filter === "all") {
                          setActiveFilter("all");
                          setQuery(query === tag.query ? "" : tag.query);
                        } else {
                          const isSame = activeFilter === tag.filter;
                          setActiveFilter(isSame ? "all" : tag.filter);
                          setQuery("");
                        }
                      }}
                      style={{
                        background: active ? theme.tagBgHover : theme.tagBg,
                        color: active ? theme.tagFgHover : theme.tagFg,
                        border: `1px solid ${active ? theme.accent : theme.tagBorder}`,
                        animation: `home-fade-in-up .4s ease-out ${index * 0.05}s both`
                      }}
                      type="button"
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-10 grid max-w-md grid-cols-3 gap-4 pt-6" style={{ borderTop: `1px solid ${theme.border}` }}>
                <Stat label="Juegos" value="48.2k" />
                <Stat label="Reseñas" value="1.4M" />
                <Stat label="Jugadores" value="220k" />
              </div>
            </div>

            <div
              className="relative hidden items-center justify-center lg:flex"
              style={{ transform: `translate3d(0, ${parallax1 * -0.5}px, 0)` }}
            >
              <FeaturedSpotlight game={featuredGame} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AnimatedHeadline({ parts }: { parts: HeadlinePart[] }) {
  const theme = useTheme();

  return (
    <span>
      {parts.map((part, index) => (
        <span
          key={`${part.text}-${index}`}
          style={{
            display: "inline-block",
            color: part.accent ? theme.accent : theme.fg,
            fontStyle: part.italic ? "italic" : "normal",
            animation: `home-fade-in-up .8s cubic-bezier(.2,.7,.3,1) ${index * 0.08}s both`,
            marginRight: "0.2em"
          }}
        >
          {part.text}
        </span>
      ))}
    </span>
  );
}

function FloatingDeco({ scrollY }: { scrollY: number }) {
  const theme = useTheme();

  return (
    <>
      {theme.deco.map((shape, index) => (
        <div
          key={`${shape.shape}-${index}`}
          className="pointer-events-none absolute"
          style={{
            left: shape.x,
            top: shape.y,
            width: shape.size,
            height: shape.size,
            transform: `translate3d(0, ${scrollY * shape.parallax}px, 0)`,
            animation: `home-float ${4 + index}s ease-in-out infinite ${index * 0.5}s`
          }}
        >
          {shape.shape === "circle" && (
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: shape.color,
                filter: `blur(${shape.blur ?? 0}px)`,
                opacity: shape.opacity
              }}
            />
          )}
          {shape.shape === "star" && (
            <svg
              fill={shape.color}
              style={{
                width: "100%",
                height: "100%",
                opacity: shape.opacity,
                filter: `drop-shadow(0 0 ${shape.blur ?? 0}px ${shape.color})`
              }}
              viewBox="0 0 24 24"
            >
              <path d="M12 2 L14.5 9 L22 9.5 L16 14.5 L18 22 L12 17.5 L6 22 L8 14.5 L2 9.5 L9.5 9 Z" />
            </svg>
          )}
          {shape.shape === "ring" && (
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                border: `${shape.thickness ?? 4}px solid ${shape.color}`,
                opacity: shape.opacity
              }}
            />
          )}
          {shape.shape === "cross" && (
            <svg
              fill="none"
              stroke={shape.color}
              strokeWidth="3"
              style={{
                width: "100%",
                height: "100%",
                opacity: shape.opacity,
                animation: "home-spin-slow 12s linear infinite"
              }}
              viewBox="0 0 24 24"
            >
              <path d="M4 12 L20 12 M12 4 L12 20" strokeLinecap="round" />
            </svg>
          )}
          {shape.shape === "pill" && (
            <div
              style={{
                width: "100%",
                height: "40%",
                borderRadius: 999,
                background: shape.color,
                opacity: shape.opacity,
                transform: `rotate(${shape.rotate ?? 0}deg)`,
                filter: `blur(${shape.blur ?? 0}px)`
              }}
            />
          )}
        </div>
      ))}
    </>
  );
}

function FeaturedSpotlight({ game }: { game: EnhancedGame }) {
  const theme = useTheme();
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setTilt({ rx: (0.5 - y) * 18, ry: (x - 0.5) * 18 });
  };

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setTilt({ rx: 0, ry: 0 });
      }}
      onMouseMove={onMove}
      style={{ width: 320, perspective: 1200 }}
    >
      <div
        className="absolute -left-3 -top-3 z-20 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-widest"
        style={{
          background: theme.accent,
          color: theme.btnPrimaryFg,
          fontFamily: theme.fontMono,
          transform: "rotate(-6deg) translateZ(80px)",
          boxShadow: `0 8px 24px ${theme.accent}66`,
          animation: "home-float 4s ease-in-out infinite"
        }}
      >
        Featured
      </div>

      <div
        className="relative overflow-hidden rounded-3xl"
        style={{
          aspectRatio: "3/4",
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transformStyle: "preserve-3d",
          transition: "transform .15s",
          boxShadow: `0 40px 80px -20px ${game.accent}77, 0 0 0 1px ${theme.border}`
        }}
      >
        {game.coverUrl ? (
          <Image alt={game.title} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 90vw" priority className="object-cover" src={game.coverUrl} />
        ) : null}
        <Link
          aria-label={`Ir al juego ${game.title}`}
          className="absolute inset-0"
          href={`/games/${game.slug}`}
          style={{ background: "linear-gradient(180deg, transparent 30%, rgba(0,0,0,.85) 100%)" }}
        />

        <div className="absolute left-4 top-4" style={{ transform: "translateZ(50px)" }}>
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{
              background: "rgba(0,0,0,.5)",
              backdropFilter: "blur(8px)",
              border: `1px solid ${theme.border}`
            }}
          >
            <span className="text-2xl font-black" style={{ color: theme.accent, fontFamily: theme.fontMono }}>
              {game.userScore ? game.userScore.toFixed(1) : "?"}
            </span>
            <div className="text-xs font-bold uppercase tracking-wider text-white/70">
              <div>Usuarios</div>
              <div>{formatCompactNumber(game.ratings)}</div>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5" style={{ transform: "translateZ(60px)" }}>
          <div
            className="mb-1 text-xs font-black uppercase tracking-[0.2em]"
            style={{ color: theme.accent, fontFamily: theme.fontMono }}
          >
            {game.developer} · {game.year || "TBA"}
          </div>
          <h3
            className="text-2xl font-black leading-tight"
            style={{ color: "#fff", fontFamily: theme.fontDisplay, textShadow: "0 2px 12px rgba(0,0,0,.7)" }}
          >
            {game.title}
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {game.genres.map((genre) => (
              <span
                key={genre}
                className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                style={{ background: "rgba(255,255,255,.15)", backdropFilter: "blur(4px)" }}
              >
                {genre}
              </span>
            ))}
          </div>
        </div>

        {hover && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ transform: "translateZ(70px)" }}>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                width: "40%",
                background: "linear-gradient(120deg, transparent, rgba(255,255,255,.3), transparent)",
                animation: "home-shine 1.2s ease-out"
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function BigSearch({
  games,
  query,
  setQuery
}: {
  games: EnhancedGame[];
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    return games
      .filter((game) =>
        [game.title, game.developer, game.publisher, String(game.year), ...game.genres]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())
      )
      .slice(0, 6);
  }, [games, query]);

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <svg
          className="pointer-events-none absolute left-5"
          fill="none"
          height="22"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{ color: focused ? theme.accent : theme.muted, transition: "color .2s" }}
          viewBox="0 0 24 24"
          width="22"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          className="w-full rounded-2xl py-5 pl-14 pr-6 text-base font-medium outline-none transition"
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Busca videojuegos, estudios, sagas o creadores"
          style={{
            background: focused ? theme.inputBgFocus : theme.inputBg,
            border: `2px solid ${focused ? theme.accent : theme.border}`,
            color: theme.fg,
            boxShadow: focused
              ? `0 0 0 6px ${theme.accent}22, 0 8px 24px ${theme.accent}33`
              : "0 4px 12px rgba(0,0,0,.2)",
            fontFamily: theme.fontBody
          }}
          value={query}
        />
      </div>

      {focused && results.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-3 overflow-hidden rounded-2xl"
          style={{
            background: theme.dropdown,
            border: `1px solid ${theme.border}`,
            boxShadow: theme.dropdownShadow,
            animation: "home-fade-in-up .25s cubic-bezier(.2,.7,.3,1)"
          }}
        >
          <div
            className="px-4 py-2 text-xs font-black uppercase tracking-wider"
            style={{ color: theme.muted, fontFamily: theme.fontMono, borderBottom: `1px solid ${theme.border}` }}
          >
            {results.length} resultados
          </div>
          {results.map((game) => (
            <Link
              key={game.slug}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/5"
              href={`/games/${game.slug}`}
            >
              {game.coverUrl ? (
                <Image alt="" aria-hidden="true" src={game.coverUrl} width={40} height={48} className="h-12 w-10 rounded-lg object-cover" />
              ) : (
                <span aria-hidden="true" className="h-12 w-10 rounded-lg bg-white/5" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-bold" style={{ color: theme.fg }}>
                  {game.title}
                </div>
                <div className="truncate text-xs" style={{ color: theme.muted }}>
                  {game.year || "TBA"} · {game.developer} · {game.genres.slice(0, 2).join(", ")}
                </div>
              </div>
              <RatingPill score={game.userScore} size="sm" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const [count, setCount] = useState(0);
  const [ref, inView] = useInView<HTMLDivElement>();

  useEffect(() => {
    if (!inView) return;

    const num = parseFloat(value);
    const duration = 1200;
    const startTime = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(num * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  const display = value.includes("M")
    ? `${count.toFixed(1)}M`
    : value.includes("k")
      ? `${count.toFixed(1)}k`
      : count.toFixed(0);

  return (
    <div ref={ref}>
      <div className="tabular-nums text-3xl font-black" style={{ color: theme.fg, fontFamily: theme.fontDisplay }}>
        {display}
      </div>
      <div className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.muted, fontFamily: theme.fontMono }}>
        {label}
      </div>
    </div>
  );
}

function Section({
  children,
  eyebrow,
  href,
  title
}: {
  children: ReactNode;
  eyebrow?: string;
  href?: string;
  title: string;
}) {
  const [ref, inView] = useInView<HTMLElement>();

  return (
    <section
      ref={ref}
      className="px-4 py-12 sm:px-6 md:py-16 lg:px-8"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(40px)",
        transition: "opacity .8s, transform .8s cubic-bezier(.2,.7,.3,1)"
      }}
    >
      <div className="mx-auto max-w-[1400px]">
        <SectionHeader eyebrow={eyebrow} href={href} title={title} />
        {children}
      </div>
    </section>
  );
}

function SectionHeader({
  count,
  eyebrow,
  href,
  title
}: {
  count?: number;
  eyebrow?: string;
  href?: string;
  title: string;
}) {
  const theme = useTheme();

  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="mb-2 flex items-center gap-2">
            <span style={{ width: 24, height: 2, background: theme.accent, display: "inline-block" }} />
            <span
              className="text-xs font-black uppercase tracking-[0.25em]"
              style={{ color: theme.accent, fontFamily: theme.fontMono }}
            >
              {eyebrow}
            </span>
          </div>
        )}
        <h2
          className="text-3xl font-black leading-tight tracking-tight md:text-4xl"
          style={{ color: theme.fg, fontFamily: theme.fontDisplay, letterSpacing: "-0.02em" }}
        >
          {title}
        </h2>
        {count != null && (
          <div className="mt-1 text-sm" style={{ color: theme.muted, fontFamily: theme.fontMono }}>
            {formatCompactNumber(count)} resultados
          </div>
        )}
      </div>
      {href && (
        <Link className="group flex items-center gap-1.5 text-sm font-bold transition" href={href} style={{ color: theme.accent }}>
          Ver todo
          <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </Link>
      )}
    </div>
  );
}

function Marquee({ items, speed = 50 }: { items: Array<{ label: string; value: string }>; speed?: number }) {
  const theme = useTheme();

  return (
    <div
      className="relative overflow-hidden py-4"
      style={{
        background: theme.marqueeBg,
        borderTop: `1px solid ${theme.border}`,
        borderBottom: `1px solid ${theme.border}`
      }}
    >
      <div
        className="flex w-fit gap-12 whitespace-nowrap"
        style={{ animation: `home-marquee ${speed}s linear infinite` }}
      >
        {[...items, ...items, ...items].map((item, index) => (
          <span
            key={`${item.label}-${index}`}
            className="inline-flex items-center gap-3 text-3xl font-black tracking-tight"
            style={{ color: theme.marqueeFg, fontFamily: theme.fontDisplay }}
          >
            <span>{item.label}</span>
            <span aria-hidden="true" style={{ color: theme.accent }}>★</span>
            <span style={{ color: theme.marqueeAccent, fontFamily: theme.fontMono, fontSize: 18 }}>{item.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function DragCarousel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({ down: false, startX: 0, startScroll: 0, vel: 0, lastX: 0, lastT: 0 });

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node) return;
    dragState.current = {
      down: true,
      startX: event.clientX,
      startScroll: node.scrollLeft,
      vel: 0,
      lastX: event.clientX,
      lastT: performance.now()
    };
    node.setPointerCapture(event.pointerId);
    node.style.scrollBehavior = "auto";
    node.style.cursor = "grabbing";
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node || !dragState.current.down) return;
    event.preventDefault();
    const dx = event.clientX - dragState.current.startX;
    node.scrollLeft = dragState.current.startScroll - dx;
    const now = performance.now();
    const dt = now - dragState.current.lastT;
    if (dt > 0) dragState.current.vel = (dragState.current.lastX - event.clientX) / dt;
    dragState.current.lastX = event.clientX;
    dragState.current.lastT = now;
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node || !dragState.current.down) return;
    dragState.current.down = false;
    if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
    node.style.cursor = "grab";

    let velocity = dragState.current.vel * 16;
    const decay = 0.94;
    const step = () => {
      const current = ref.current;
      if (Math.abs(velocity) < 0.5 || !current) return;
      current.scrollLeft += velocity;
      velocity *= decay;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let target = node.scrollLeft;
    let raf = 0;
    let animating = false;
    const originalSnap = node.style.scrollSnapType;

    const tick = () => {
      const current = ref.current;
      if (!current) {
        animating = false;
        return;
      }
      const diff = target - current.scrollLeft;
      if (Math.abs(diff) < 0.5) {
        current.scrollLeft = target;
        current.style.scrollSnapType = originalSnap;
        animating = false;
        return;
      }
      current.scrollLeft += diff * 0.18;
      raf = requestAnimationFrame(tick);
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);
      if (absY <= absX) return;
      const maxScroll = node.scrollWidth - node.clientWidth;
      if (maxScroll <= 0) return;
      const goingDown = event.deltaY > 0;
      if (goingDown && node.scrollLeft >= maxScroll - 1) return;
      if (!goingDown && node.scrollLeft <= 0) return;
      event.preventDefault();
      if (!animating) target = node.scrollLeft;
      target = Math.max(0, Math.min(maxScroll, target + event.deltaY));
      node.style.scrollSnapType = "none";
      if (!animating) {
        animating = true;
        raf = requestAnimationFrame(tick);
      }
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", onWheel);
      if (raf) cancelAnimationFrame(raf);
      node.style.scrollSnapType = originalSnap;
    };
  }, []);

  return (
    <div
      ref={ref}
      className="flex select-none gap-5 overflow-x-auto overflow-y-hidden pb-4"
      onPointerDown={onPointerDown}
      onPointerLeave={onPointerUp}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        cursor: "grab",
        scrollbarWidth: "none",
        scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorX: "contain"
      }}
    >
      {children}
    </div>
  );
}

function Grid({ games }: { games: EnhancedGame[] }) {
  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
      {games.map((game, index) => (
        <div
          key={game.slug}
          style={{ animation: `home-fade-in-up .6s cubic-bezier(.2,.7,.3,1) ${Math.min(index * 0.06, 0.6)}s both` }}
        >
          <TiltCard game={game} priority={index < 4} />
        </div>
      ))}
    </div>
  );
}

function TiltCard({ game, priority = false }: { game: EnhancedGame; priority?: boolean }) {
  const theme = useTheme();
  const ref = useRef<HTMLAnchorElement | null>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 50 });
  const [hover, setHover] = useState(false);

  const onMove = (event: React.MouseEvent<HTMLElement>) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setTilt({
      rx: (0.5 - y) * 14,
      ry: (x - 0.5) * 14,
      mx: x * 100,
      my: y * 100
    });
  };

  const onLeave = () => {
    setTilt({ rx: 0, ry: 0, mx: 50, my: 50 });
    setHover(false);
  };

  return (
    <Link
      ref={ref}
      className="group relative block cursor-pointer no-underline"
      href={`/games/${game.slug}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={onLeave}
      onMouseMove={onMove}
      onPointerDown={(event) => event.stopPropagation()}
      style={{ perspective: 1000 }}
    >
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          aspectRatio: "3/4",
          background: theme.cardBg,
          border: `1px solid ${theme.border}`,
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(0)`,
          transformStyle: "preserve-3d",
          transition: "transform .15s ease-out, box-shadow .25s",
          boxShadow: hover ? `0 30px 60px -20px ${game.accent}66, 0 0 0 1px ${game.accent}55` : theme.cardShadow
        }}
      >
        {game.coverUrl ? (
          <Image
            alt={game.title}
            fill
            sizes="(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 45vw"
            priority={priority}
            className="object-cover"
            src={game.coverUrl}
            style={{
              transform: `translateZ(20px) scale(${hover ? 1.08 : 1})`,
              transition: "transform .4s cubic-bezier(.2,.7,.3,1)"
            }}
          />
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, transparent 40%, ${theme.cardOverlay} 100%)`,
            transform: "translateZ(30px)"
          }}
        />
        <div
          className="absolute inset-0 transition-opacity"
          style={{
            background: `radial-gradient(circle at ${tilt.mx}% ${tilt.my}%, ${game.accent}55 0%, transparent 60%)`,
            opacity: hover ? 1 : 0,
            mixBlendMode: "overlay",
            transform: "translateZ(40px)"
          }}
        />

        <div className="absolute left-3 top-3" style={{ transform: "translateZ(50px)" }}>
          <RatingPill score={game.userScore} size="sm" />
        </div>
        {game.status !== "released" && (
          <div className="absolute right-3 top-3" style={{ transform: "translateZ(50px)" }}>
            <StatusBadge status={game.status} />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-4" style={{ transform: "translateZ(60px)" }}>
          <h3
            className="text-base font-black leading-tight text-white"
            style={{ textShadow: "0 2px 8px rgba(0,0,0,.6)", fontFamily: theme.fontDisplay }}
          >
            {game.title}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-white opacity-90">
            <span>{game.year > 0 ? game.year : "TBA"}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span className="truncate">{game.developer || game.publisher || game.platforms[0]}</span>
          </div>
        </div>
      </div>

      <div
        className="absolute -bottom-3 left-3 right-3 rounded-full transition-all"
        style={{
          height: 30,
          background: hover ? game.accent : theme.cardShadowColor,
          filter: "blur(20px)",
          opacity: hover ? 0.45 : 0.2,
          transform: hover ? "scaleX(0.92)" : "scaleX(0.85)"
        }}
      />
    </Link>
  );
}

function RatingPill({ score, size = "md" }: { score?: number | null; size?: "xs" | "sm" | "md" }) {
  const theme = useTheme();
  const tone = !score ? theme.scoreNone : score >= 9 ? theme.scoreHigh : score >= 7.5 ? theme.scoreMid : theme.scoreLow;
  const sizes = {
    xs: { px: 6, py: 2, fz: 11 },
    sm: { px: 8, py: 4, fz: 13 },
    md: { px: 10, py: 5, fz: 15 }
  }[size];

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md tabular-nums font-black"
      style={{
        background: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.border}`,
        padding: `${sizes.py}px ${sizes.px}px`,
        fontSize: sizes.fz,
        boxShadow: tone.shadow,
        fontFamily: theme.fontMono
      }}
    >
      {score ? score.toFixed(1) : "?"}
    </span>
  );
}

function StatusBadge({ status }: { status: Game["status"] }) {
  const theme = useTheme();
  const isUpcoming = status === "upcoming";

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-black uppercase tracking-wider"
      style={{
        background: isUpcoming ? theme.statusUpcomingBg : theme.statusEarlyBg,
        color: isUpcoming ? theme.statusUpcomingFg : theme.statusEarlyFg,
        border: `1px solid ${isUpcoming ? theme.statusUpcomingBorder : theme.statusEarlyBorder}`
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: isUpcoming ? theme.statusUpcomingFg : theme.statusEarlyFg,
          animation: "home-pulse 1.5s ease-in-out infinite"
        }}
      />
      {isUpcoming ? "Próximo" : "Early"}
    </span>
  );
}

function RankingList({
  games,
  onOpen
}: {
  games: EnhancedGame[];
  onOpen: Dispatch<SetStateAction<EnhancedGame | null>>;
}) {
  const theme = useTheme();

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        background: theme.cardBg,
        border: `1px solid ${theme.border}`
      }}
    >
      {games.map((game, index) => (
        <RankingRow
          game={game}
          isLast={index === games.length - 1}
          key={game.slug}
          onOpen={onOpen}
          rank={index + 1}
        />
      ))}
    </div>
  );
}

function RankingRow({
  game,
  isLast,
  onOpen,
  rank
}: {
  game: EnhancedGame;
  isLast: boolean;
  onOpen: Dispatch<SetStateAction<EnhancedGame | null>>;
  rank: number;
}) {
  const theme = useTheme();
  const [hover, setHover] = useState(false);

  return (
    <button
      className="grid w-full cursor-pointer items-center text-left transition"
      onClick={() => onOpen(game)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        gridTemplateColumns: "clamp(48px, 9vw, 80px) 64px minmax(0, 1fr) auto",
        gap: 16,
        padding: "16px clamp(14px, 3vw, 24px)",
        borderBottom: isLast ? "none" : `1px solid ${theme.border}`,
        background: hover ? theme.rowHover : "transparent"
      }}
      type="button"
    >
      <div
        className="tabular-nums font-black"
        style={{
          fontSize: "clamp(24px, 5vw, 38px)",
          fontFamily: theme.fontDisplay,
          color: rank <= 3 ? theme.accent : theme.muted,
          letterSpacing: "-0.03em",
          transition: "transform .25s",
          transform: hover ? "scale(1.1) translateX(4px)" : "scale(1)"
        }}
      >
        {String(rank).padStart(2, "0")}
      </div>
      <div
        className="overflow-hidden rounded-lg"
        style={{
          width: 56,
          height: 76,
          boxShadow: hover ? `0 12px 24px -8px ${game.accent}88` : "0 4px 12px rgba(0,0,0,.3)",
          transition: "box-shadow .25s, transform .25s",
          transform: hover ? "rotate(-3deg) scale(1.05)" : "rotate(0) scale(1)"
        }}
      >
        {game.coverUrl ? (
          <Image alt={game.title} src={game.coverUrl} width={56} height={76} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="truncate text-lg font-black" style={{ color: theme.fg, fontFamily: theme.fontDisplay }}>
          {game.title}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm" style={{ color: theme.muted }}>
          <span>{game.year || "TBA"}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{game.developer}</span>
          <span className="hidden sm:inline" style={{ opacity: 0.4 }}>
            ·
          </span>
          <span className="hidden sm:inline">{game.genres.slice(0, 2).join(", ")}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden text-right text-sm md:block" style={{ color: theme.muted, fontFamily: theme.fontMono }}>
          {formatCompactNumber(game.ratings)} votos
        </span>
        <RatingPill score={game.userScore} size="md" />
      </div>
    </button>
  );
}

function PlatformSection({ platforms }: { platforms: Platform[] }) {
  const [ref, inView] = useInView<HTMLElement>();

  return (
    <section
      ref={ref}
      className="px-4 py-12 sm:px-6 md:py-16 lg:px-8"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(40px)",
        transition: "opacity .8s, transform .8s cubic-bezier(.2,.7,.3,1)"
      }}
    >
      <div className="mx-auto max-w-[1400px]">
        <SectionHeader eyebrow="Por plataforma" title="Encuentra tu ecosistema" />
        <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {platforms.map((platform, index) => (
            <PlatformCard delay={index * 0.08} key={platform.slug} platform={platform} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PlatformCard({ delay, platform }: { delay: number; platform: Platform }) {
  const theme = useTheme();
  const [hover, setHover] = useState(false);
  const colors = [theme.accent, theme.accent2, theme.scoreHigh.fg, theme.scoreMid.fg];
  const color = colors[Math.abs(platform.slug.charCodeAt(0) + platform.slug.length) % colors.length];

  return (
    <Link
      className="group relative block overflow-hidden rounded-2xl"
      href={`/platforms/${platform.slug}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: `linear-gradient(155deg, ${color}14 0%, ${theme.cardBg} 55%)`,
        border: `1px solid ${hover ? color : theme.border}`,
        animation: `home-fade-in-up .6s cubic-bezier(.2,.7,.3,1) ${delay}s both`,
        transition: "border-color .25s, transform .25s, box-shadow .25s",
        transform: hover ? "translateY(-6px)" : "translateY(0)",
        boxShadow: hover ? `0 24px 50px -16px ${color}66, 0 0 0 1px ${color}22 inset` : "0 1px 0 rgba(255,255,255,0.03) inset"
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `linear-gradient(${theme.fg} 1px, transparent 1px), linear-gradient(90deg, ${theme.fg} 1px, transparent 1px)`,
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(circle at 90% 0%, black 0%, transparent 65%)",
          WebkitMaskImage: "radial-gradient(circle at 90% 0%, black 0%, transparent 65%)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full"
        style={{
          background: color,
          opacity: hover ? 0.35 : 0.18,
          filter: "blur(48px)",
          transition: "opacity .3s, transform .4s",
          transform: hover ? "scale(1.25)" : "scale(1)"
        }}
      />
      <div className="relative p-6">
        <div className="mb-5 flex items-start justify-between">
          <div
            className="grid h-14 w-14 place-items-center rounded-2xl"
            style={{
              background: `linear-gradient(140deg, ${color}33 0%, ${color}10 100%)`,
              border: `1px solid ${color}55`,
              boxShadow: hover ? `0 10px 24px -10px ${color}aa` : "none",
              transition: "transform .35s cubic-bezier(.2,.7,.3,1), box-shadow .3s",
              transform: hover ? "rotate(-8deg) scale(1.08)" : "rotate(0) scale(1)"
            }}
          >
            <PlatformGlyph color={color} kind={platform.kind} />
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-xs font-black tracking-wide tabular-nums"
            style={{
              background: hover ? `${color}1f` : theme.chipBg,
              color: hover ? color : theme.muted,
              border: `1px solid ${hover ? color + "44" : "transparent"}`,
              fontFamily: theme.fontMono,
              transition: "background .2s, color .2s, border-color .2s"
            }}
          >
            {formatCompactNumber(platform.count)} JUEGOS
          </span>
        </div>
        <div
          className="text-2xl font-black leading-tight"
          style={{ color: theme.fg, fontFamily: theme.fontDisplay, letterSpacing: "-0.01em" }}
        >
          {platform.name}
        </div>
        <div className="mt-2 text-sm leading-relaxed" style={{ color: theme.muted }}>
          Rankings, lanzamientos y los más jugados.
        </div>
        <div
          className="mt-5 flex items-center justify-between border-t pt-4 text-xs font-black uppercase tracking-[0.14em]"
          style={{
            borderColor: hover ? `${color}33` : theme.border,
            color: hover ? color : theme.muted,
            transition: "color .2s, border-color .2s"
          }}
        >
          <span>Explorar</span>
          <span
            className="grid h-7 w-7 place-items-center rounded-full"
            style={{
              background: hover ? color : "transparent",
              color: hover ? theme.cardBg : color,
              border: `1px solid ${color}`,
              transition: "background .2s, color .2s, transform .25s",
              transform: hover ? "translateX(4px)" : "translateX(0)"
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

function ListsGrid({ games, lists }: { games: EnhancedGame[]; lists: CommunityList[] }) {
  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
      {lists.map((list, index) => (
        <CommunityListCard delay={index * 0.1} games={games} key={list.slug} list={list} />
      ))}
    </div>
  );
}

function CommunityListCard({
  delay,
  games,
  list
}: {
  delay: number;
  games: EnhancedGame[];
  list: CommunityList;
}) {
  const theme = useTheme();
  const [hover, setHover] = useState(false);
  const previewGames = list.games.slice(0, 3).map((item) => resolveCommunityPreviewGame(item, games));

  return (
    <Link
      className="block overflow-hidden rounded-2xl"
      href={`/lists/${list.slug}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: theme.cardBg,
        border: `1px solid ${hover ? theme.accent : theme.border}`,
        transition: "border-color .25s, transform .25s, box-shadow .25s",
        transform: hover ? "translateY(-6px)" : "translateY(0)",
        boxShadow: hover ? `0 24px 48px -12px ${theme.accent}55` : "0 4px 12px rgba(0,0,0,.15)",
        animation: `home-fade-in-up .6s cubic-bezier(.2,.7,.3,1) ${delay}s both`
      }}
    >
      <div className="relative h-44 overflow-hidden" style={{ background: theme.chipBg }}>
        {previewGames.map((game, index) => (
          <div
            key={`${game.title}-${index}`}
            className="absolute overflow-hidden rounded-lg"
            style={{
              width: 110,
              height: 150,
              left: `${30 + index * 30}%`,
              top: "50%",
              transform: `translate(-50%, -50%) rotate(${(index - 1) * 8}deg) ${
                hover ? `translateY(-${index * 6}px) rotate(${(index - 1) * 12}deg)` : ""
              }`,
              boxShadow: "0 8px 24px rgba(0,0,0,.4)",
              border: `2px solid ${theme.bg}`,
              transition: "transform .35s cubic-bezier(.2,.7,.3,1)",
              zIndex: index + 1
            }}
          >
            {game.coverUrl ? (
              <Image alt={game.title} src={game.coverUrl} width={110} height={150} className="h-full w-full object-cover" />
            ) : (
              <div
                aria-label={`Portada no disponible para ${game.title}`}
                className="h-full w-full"
                style={{
                  background: `linear-gradient(135deg, ${theme.cardBg}, ${theme.chipBg})`,
                  boxShadow: `inset 0 0 0 1px ${theme.border}`
                }}
              />
            )}
          </div>
        ))}
        <div
          className="absolute left-3 top-3 z-10 rounded-md px-2 py-1 text-xs font-black uppercase tracking-wider text-white"
          style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)", fontFamily: theme.fontMono }}
        >
          {list.query?.pageSize ?? list.games.length} juegos
        </div>
      </div>
      <div className="p-5">
        <div className="mb-1 text-xs font-black uppercase tracking-wider" style={{ color: theme.accent, fontFamily: theme.fontMono }}>
          {list.curator ?? "Curaduría comunitaria"}
        </div>
        <h3 className="text-lg font-black leading-tight" style={{ color: theme.fg, fontFamily: theme.fontDisplay }}>
          {list.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: theme.muted }}>
          {list.description}
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs font-bold" style={{ color: theme.muted, fontFamily: theme.fontMono }}>
          <span className="inline-flex shrink-0" style={{ color: theme.scoreLow.fg }} aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </span>
          <span>{formatCompactNumber(list.likes)} likes</span>
        </div>
      </div>
    </Link>
  );
}

function resolveCommunityPreviewGame(item: CommunityListGame, games: EnhancedGame[]) {
  const seed = typeof item === "string" ? { title: item, coverUrl: null } : { title: item.title, coverUrl: item.coverUrl ?? null };
  const matched = games.find((game) => normalizeTitleForMatch(game.title) === normalizeTitleForMatch(seed.title));
  return {
    title: seed.title,
    coverUrl: seed.coverUrl ?? matched?.coverUrl ?? null
  };
}

function normalizeTitleForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function FinalCTA({ games }: { games: EnhancedGame[] }) {
  const theme = useTheme();
  const [ref, inView] = useInView<HTMLDivElement>();

  const floatingGames = games.slice(0, 8);
  const floatingLayout = [
    { left: "4%", top: "18%", w: 96, h: 130, rot: -12, delay: 0, dur: 6, opacity: 0.85 },
    { left: "2%", top: "62%", w: 88, h: 120, rot: 9, delay: 0.6, dur: 7, opacity: 0.7 },
    { left: "11%", top: "86%", w: 78, h: 106, rot: -6, delay: 1.1, dur: 5.5, opacity: 0.6 },
    { left: "88%", top: "12%", w: 92, h: 126, rot: 10, delay: 0.3, dur: 6.5, opacity: 0.8 },
    { left: "92%", top: "48%", w: 96, h: 130, rot: -8, delay: 0.9, dur: 5.8, opacity: 0.85 },
    { left: "86%", top: "82%", w: 82, h: 112, rot: 6, delay: 1.4, dur: 6.2, opacity: 0.65 },
    { left: "18%", top: "8%", w: 64, h: 88, rot: 14, delay: 1.8, dur: 7.5, opacity: 0.45 },
    { left: "80%", top: "2%", w: 60, h: 84, rot: -14, delay: 2.2, dur: 7, opacity: 0.4 }
  ];

  const stats: { value: string; label: string }[] = [
    { value: "10k+", label: "Juegos" },
    { value: "50k+", label: "Jugadores" },
    { value: "120k+", label: "Reseñas" }
  ];

  return (
    <section className="px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div
          ref={ref}
          className="relative overflow-hidden rounded-[32px] px-6 py-14 text-center md:px-20 md:py-24"
          style={{
            background: theme.ctaBg,
            border: `1px solid ${theme.border}`,
            opacity: inView ? 1 : 0,
            transform: inView ? "scale(1)" : "scale(0.95)",
            transition: "opacity .8s, transform .8s cubic-bezier(.2,.7,.3,1)"
          }}
        >
          <div
            className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full"
            style={{ background: `radial-gradient(circle, ${theme.accent}22, transparent 70%)`, filter: "blur(20px)" }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-40 -right-32 h-[460px] w-[460px] rounded-full"
            style={{ background: `radial-gradient(circle, ${theme.accent}1c, transparent 70%)`, filter: "blur(20px)" }}
            aria-hidden
          />

          <div className="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden>
            {floatingGames.map((game, index) => {
              const layout = floatingLayout[index];
              if (!layout) return null;
              return (
                <div
                  key={game.slug}
                  className="absolute overflow-hidden rounded-xl"
                  style={{
                    width: layout.w,
                    height: layout.h,
                    left: layout.left,
                    top: layout.top,
                    transform: `rotate(${layout.rot}deg)`,
                    opacity: layout.opacity,
                    animation: `home-float ${layout.dur}s ease-in-out infinite ${layout.delay}s`,
                    boxShadow: `0 18px 48px rgba(0,0,0,.55), 0 0 0 1px ${theme.border}`
                  }}
                >
                  {game.coverUrl ? (
                    <Image alt="" aria-hidden="true" src={game.coverUrl} width={layout.w} height={layout.h} className="h-full w-full object-cover" />
                  ) : null}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{ background: `linear-gradient(180deg, transparent 55%, rgba(0,0,0,.55))` }}
                  />
                </div>
              );
            })}
          </div>

          <div className="relative mx-auto max-w-2xl">
            <div
              className="mb-6 inline-flex items-center gap-2.5 rounded-full py-2 pl-2 pr-4 text-[11px] font-black uppercase tracking-[0.24em] backdrop-blur-sm"
              style={{
                background: `linear-gradient(135deg, ${theme.accent}1f, ${theme.accent}0a)`,
                color: theme.accent,
                border: `1px solid ${theme.accent}44`,
                boxShadow: `0 8px 24px -8px ${theme.accent}55, inset 0 1px 0 ${theme.accent}22`,
                fontFamily: theme.fontMono
              }}
            >
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}aa)`,
                  boxShadow: `0 0 16px ${theme.accent}cc, inset 0 1px 0 rgba(255,255,255,.35)`
                }}
                aria-hidden
              >
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              Únete a la comunidad
            </div>
            <h2
              className="font-black leading-[0.95] tracking-[-0.03em]"
              style={{
                fontSize: "clamp(38px, 5.5vw, 72px)",
                fontFamily: theme.fontDisplay,
                color: theme.fg
              }}
            >
              Tu biblioteca de{" "}
              <span
                style={{
                  background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}99)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text"
                }}
              >
                videojuegos
              </span>
              <br />
              en un solo lugar
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: theme.muted }}>
              Guarda pendientes, marca juegos completados, escribe reseñas y sigue lanzamientos.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <button
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-8 py-4 text-base font-black transition hover:scale-[1.03]"
                style={{
                  background: theme.btnPrimary,
                  color: theme.btnPrimaryFg,
                  boxShadow: theme.btnGlow
                }}
                type="button"
              >
                <span
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ background: "linear-gradient(120deg, transparent 30%, rgba(255,255,255,.25) 50%, transparent 70%)" }}
                  aria-hidden
                />
                <svg className="relative h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="relative">Crear cuenta gratis</span>
              </button>
              <Link
                className="group inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-black transition hover:scale-[1.03]"
                href="/games"
                style={{
                  background: theme.heroEyebrowBg,
                  color: theme.fg,
                  border: `1px solid ${theme.border}`
                }}
              >
                Explorar juegos
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div
              className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 border-t pt-8"
              style={{ borderColor: theme.border }}
            >
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col items-center">
                  <div
                    className="text-2xl font-black tracking-tight sm:text-3xl"
                    style={{ color: theme.fg, fontFamily: theme.fontDisplay }}
                  >
                    {stat.value}
                  </div>
                  <div
                    className="mt-1 text-[10px] font-black uppercase tracking-[0.22em]"
                    style={{ color: theme.muted, fontFamily: theme.fontMono }}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-6 text-xs" style={{ color: theme.muted, fontFamily: theme.fontMono }}>
              Registro gratuito · Catálogo actualizado · Comunidad activa
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function GameModal({ game, onClose }: { game: EnhancedGame; onClose: () => void }) {
  const theme = useTheme();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center p-4 sm:p-8"
      onClick={onClose}
      style={{
        background: "rgba(0,0,0,.75)",
        backdropFilter: "blur(16px)",
        animation: "home-fade-in-up .25s"
      }}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl"
        onClick={(event) => event.stopPropagation()}
        style={{
          background: theme.cardBg,
          border: `1px solid ${theme.border}`,
          animation: "home-fade-in-up .4s cubic-bezier(.2,.7,.3,1)"
        }}
      >
        <div className="relative h-48 overflow-hidden">
          {game.coverUrl ? (
            <Image alt="" aria-hidden="true" src={game.coverUrl} fill sizes="100vw" className="object-cover" style={{ filter: "blur(2px)" }} />
          ) : null}
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent, ${theme.cardBg})` }} />
          <button
            aria-label="Cerrar"
            className="absolute right-4 top-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            onClick={onClose}
            style={{ background: "rgba(0,0,0,.6)", color: "#fff", backdropFilter: "blur(8px)" }}
            type="button"
          >
            <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="relative grid gap-6 p-6 sm:-mt-24 sm:grid-cols-[140px,1fr]">
          {game.coverUrl ? (
            <Image
              alt={game.title}
              src={game.coverUrl}
              width={140}
              height={190}
              className="hidden h-[190px] w-[140px] rounded-xl object-cover sm:block"
              style={{ boxShadow: `0 20px 40px ${game.accent}77` }}
            />
          ) : null}
          <div className="sm:pt-24">
            <div className="mb-1 text-xs font-black uppercase tracking-wider" style={{ color: theme.accent, fontFamily: theme.fontMono }}>
              {game.developer} · {game.year || "TBA"}
            </div>
            <h2 className="text-2xl font-black leading-tight md:text-3xl" style={{ color: theme.fg, fontFamily: theme.fontDisplay }}>
              {game.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: theme.muted }}>
              {game.summary}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {game.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-full px-3 py-1 text-xs font-bold"
                  style={{ background: theme.chipBg, color: theme.fg, border: `1px solid ${theme.border}` }}
                >
                  {genre}
                </span>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <RatingPill score={game.userScore} size="md" />
              <div className="text-xs" style={{ color: theme.muted, fontFamily: theme.fontMono }}>
                {formatCompactNumber(game.ratings)} votos · {formatCompactNumber(game.reviews)} reseñas
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeStyles() {
  return (
    <style>{`
      @keyframes home-marquee {
        from { transform: translateX(0); }
        to { transform: translateX(-33.333%); }
      }
      @keyframes home-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(0.9); }
      }
      @keyframes home-float {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-12px) rotate(2deg); }
      }
      @keyframes home-fade-in-up {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes home-spin-slow {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes home-shine {
        0% { transform: translateX(-100%) skewX(-20deg); }
        100% { transform: translateX(200%) skewX(-20deg); }
      }
      .home-scrollbarless::-webkit-scrollbar,
      .home-scrollbarless *::-webkit-scrollbar { display: none; }
    `}</style>
  );
}

