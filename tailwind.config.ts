import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./data/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#080A12",
        foreground: "#F4F7FB",
        surface: "#111522",
        elevated: "#181D2E",
        border: "#293044",
        muted: "#9BA7BD",
        electric: "#3B82F6",
        violet: "#8B5CF6",
        lime: "#A3E635",
        danger: "#F43F5E"
      },
      boxShadow: {
        glow: "0 0 40px rgba(59, 130, 246, 0.18)",
        card: "0 18px 50px rgba(0, 0, 0, 0.35)"
      },
      backgroundImage: {
        "premium-radial":
          "radial-gradient(circle at top left, rgba(59,130,246,.22), transparent 34%), radial-gradient(circle at top right, rgba(139,92,246,.18), transparent 30%)"
      }
    }
  },
  plugins: []
};

export default config;
