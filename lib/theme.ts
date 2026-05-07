export type ScoreTone = {
  bg: string;
  fg: string;
  border: string;
  shadow: string;
};

export type HeadlinePart = {
  text: string;
  italic?: boolean;
  accent?: boolean;
};

export type MeshBlob = {
  x: number;
  y: number;
  range: number;
  speed: number;
  color: string;
  size: number;
};

export type DecoShape = {
  shape: "circle" | "ring" | "star" | "cross" | "pill";
  x: string;
  y: string;
  size: number;
  color: string;
  blur?: number;
  opacity: number;
  parallax: number;
  thickness?: number;
  rotate?: number;
};

export type HomeTheme = {
  name: string;
  bg: string;
  fg: string;
  muted: string;
  border: string;
  accent: string;
  accent2: string;
  fontDisplay: string;
  fontBody: string;
  fontMono: string;
  headerBg: string;
  headerBgCondensed: string;
  logoGradient: string;
  logoGlow: string;
  logoFg: string;
  heroBg: string;
  heroBorder: string;
  heroGradient: string;
  heroEyebrowBg: string;
  heroEyebrowFg: string;
  heroEyebrowBorder: string;
  headlineParts: HeadlinePart[];
  tagBg: string;
  tagFg: string;
  tagBorder: string;
  tagBgHover: string;
  tagFgHover: string;
  inputBg: string;
  inputBgFocus: string;
  kbdBg: string;
  dropdown: string;
  dropdownShadow: string;
  chipBg: string;
  chipHover: string;
  btnPrimary: string;
  btnPrimaryFg: string;
  btnGlow: string;
  cardBg: string;
  cardOverlay: string;
  cardShadow: string;
  cardShadowColor: string;
  rowHover: string;
  marqueeBg: string;
  marqueeFg: string;
  marqueeAccent: string;
  statusUpcomingBg: string;
  statusUpcomingFg: string;
  statusUpcomingBorder: string;
  statusEarlyBg: string;
  statusEarlyFg: string;
  statusEarlyBorder: string;
  scoreHigh: ScoreTone;
  scoreMid: ScoreTone;
  scoreLow: ScoreTone;
  scoreNone: ScoreTone;
  cursorRing: string;
  ctaBg: string;
  noiseOpacity: number;
  meshBlobs: MeshBlob[];
  deco: DecoShape[];
};

export const arcadeTheme = {
  name: "Arcade Pop",
  bg: "#080A12",
  fg: "#F4F7FB",
  muted: "#9BA7BD",
  border: "rgba(255,255,255,0.10)",
  accent: "#3B82F6",
  accent2: "#A3E635",
  fontDisplay: '"Space Grotesk", ui-sans-serif, system-ui',
  fontBody: '"Inter", ui-sans-serif, system-ui',
  fontMono: '"JetBrains Mono", ui-monospace, monospace',
  headerBg: "transparent",
  headerBgCondensed: "rgba(8,10,18,0.85)",
  logoGradient: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #A3E635 100%)",
  logoGlow: "0 0 30px rgba(59,130,246,.5), 0 0 60px rgba(139,92,246,.3)",
  logoFg: "#fff",
  heroBg: "linear-gradient(135deg, #111522 0%, #181D2E 100%)",
  heroBorder: "rgba(255,255,255,0.10)",
  heroGradient: "linear-gradient(180deg, rgba(8,10,18,0.5) 0%, rgba(8,10,18,0.95) 100%)",
  heroEyebrowBg: "rgba(163,230,53,0.10)",
  heroEyebrowFg: "#A3E635",
  heroEyebrowBorder: "rgba(163,230,53,0.40)",
  headlineParts: [
    { text: "La" },
    { text: "base" },
    { text: "de", italic: true },
    { text: "datos" },
    { text: "social", accent: true },
    { text: "para" },
    { text: "decidir" },
    { text: "qué" },
    { text: "jugar", accent: true },
    { text: "después." }
  ],
  tagBg: "rgba(255,255,255,0.04)",
  tagFg: "#9BA7BD",
  tagBorder: "rgba(255,255,255,0.10)",
  tagBgHover: "rgba(59,130,246,0.15)",
  tagFgHover: "#F4F7FB",
  inputBg: "rgba(255,255,255,0.04)",
  inputBgFocus: "rgba(255,255,255,0.06)",
  kbdBg: "rgba(255,255,255,0.05)",
  dropdown: "#111522",
  dropdownShadow: "0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.2)",
  chipBg: "rgba(255,255,255,0.05)",
  chipHover: "rgba(255,255,255,0.08)",
  btnPrimary: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
  btnPrimaryFg: "#fff",
  btnGlow: "0 8px 24px rgba(59,130,246,0.4), 0 0 0 1px rgba(255,255,255,0.1)",
  cardBg: "rgba(17,21,34,0.85)",
  cardOverlay: "rgba(8,10,18,0.92)",
  cardShadow: "0 18px 50px rgba(0,0,0,0.35)",
  cardShadowColor: "#3B82F6",
  rowHover: "rgba(255,255,255,0.04)",
  marqueeBg: "rgba(8,10,18,0.6)",
  marqueeFg: "#F4F7FB",
  marqueeAccent: "#A3E635",
  statusUpcomingBg: "rgba(163,230,53,0.15)",
  statusUpcomingFg: "#A3E635",
  statusUpcomingBorder: "rgba(163,230,53,0.40)",
  statusEarlyBg: "rgba(139,92,246,0.18)",
  statusEarlyFg: "#C4B5FD",
  statusEarlyBorder: "rgba(139,92,246,0.50)",
  scoreHigh: {
    bg: "rgba(163,230,53,0.18)",
    fg: "#A3E635",
    border: "rgba(163,230,53,0.5)",
    shadow: "0 0 12px rgba(163,230,53,0.3)"
  },
  scoreMid: {
    bg: "rgba(59,130,246,0.18)",
    fg: "#60A5FA",
    border: "rgba(59,130,246,0.5)",
    shadow: "0 0 12px rgba(59,130,246,0.25)"
  },
  scoreLow: {
    bg: "rgba(244,63,94,0.18)",
    fg: "#FB7185",
    border: "rgba(244,63,94,0.5)",
    shadow: "0 0 12px rgba(244,63,94,0.25)"
  },
  scoreNone: {
    bg: "rgba(255,255,255,0.05)",
    fg: "#9BA7BD",
    border: "rgba(255,255,255,0.10)",
    shadow: "none"
  },
  cursorRing: "#A3E635",
  ctaBg:
    "radial-gradient(ellipse at top, rgba(59,130,246,0.18), transparent 60%), radial-gradient(ellipse at bottom right, rgba(139,92,246,0.18), transparent 60%), #0E1220",
  noiseOpacity: 0.04,
  meshBlobs: [
    { x: 15, y: 20, range: 12, speed: 0.18, color: "rgba(59,130,246,0.55)", size: 50 },
    { x: 80, y: 30, range: 14, speed: 0.13, color: "rgba(139,92,246,0.45)", size: 45 },
    { x: 70, y: 80, range: 10, speed: 0.22, color: "rgba(163,230,53,0.30)", size: 40 },
    { x: 25, y: 75, range: 16, speed: 0.16, color: "rgba(59,130,246,0.35)", size: 55 }
  ],
  deco: [
    { shape: "circle", x: "8%", y: "12%", size: 14, color: "#A3E635", blur: 0, opacity: 1, parallax: 0.4 },
    { shape: "ring", x: "85%", y: "18%", size: 60, color: "#3B82F6", thickness: 3, opacity: 0.6, parallax: 0.25 },
    { shape: "star", x: "12%", y: "78%", size: 32, color: "#A3E635", blur: 8, opacity: 0.9, parallax: 0.3 },
    { shape: "cross", x: "92%", y: "70%", size: 36, color: "#8B5CF6", opacity: 0.6, parallax: 0.2 },
    { shape: "circle", x: "78%", y: "85%", size: 22, color: "#3B82F6", blur: 4, opacity: 0.8, parallax: 0.5 },
    { shape: "ring", x: "30%", y: "8%", size: 28, color: "#A3E635", thickness: 2, opacity: 0.5, parallax: 0.35 },
    { shape: "pill", x: "50%", y: "92%", size: 80, color: "#8B5CF6", blur: 10, opacity: 0.4, rotate: -20, parallax: 0.15 }
  ]
} satisfies HomeTheme;

export const theme = arcadeTheme;

export default arcadeTheme;
