import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Toaster } from "@/components/feedback/Toast";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { getSiteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "GameIndex — Descubre, valora y organiza videojuegos",
    template: "%s | GameIndex"
  },
  description:
    "Base de datos, comunidad y agregador de reseñas de videojuegos con rankings, listas, fichas completas y backlog personal.",
  applicationName: "GameIndex",
  keywords: [
    "videojuegos",
    "reseñas",
    "rankings",
    "backlog",
    "IGDB",
    "RAWG",
    "comunidad gaming"
  ],
  authors: [{ name: "GameIndex" }],
  openGraph: {
    title: "GameIndex",
    description:
      "Descubre videojuegos, consulta fichas completas, crea listas y sigue lanzamientos.",
    type: "website",
    locale: "es_ES",
    siteName: "GameIndex"
  },
  twitter: {
    card: "summary_large_image",
    title: "GameIndex",
    description:
      "Descubre videojuegos, consulta fichas completas, crea listas y sigue lanzamientos."
  },
  robots: {
    index: true,
    follow: true
  }
};

export const viewport: Viewport = {
  themeColor: "#080A12",
  colorScheme: "dark"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="dark">
      <body
        className="bg-background bg-premium-radial font-sans antialiased"
        suppressHydrationWarning
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-electric focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Saltar al contenido principal
        </a>
        <Header />
        <main id="main-content" className="min-h-screen pt-20">
          {children}
        </main>
        <Footer />
        <Toaster />
        <ChatWidget />
      </body>
    </html>
  );
}

