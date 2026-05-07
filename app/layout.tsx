import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://gameindex.example"),
  title: {
    default: "GameIndex — Descubre, valora y organiza videojuegos",
    template: "%s | GameIndex"
  },
  description:
    "Base de datos, comunidad y agregador de reseñas de videojuegos con rankings, listas, fichas completas y backlog personal.",
  openGraph: {
    title: "GameIndex",
    description:
      "Descubre videojuegos, consulta fichas completas, crea listas y sigue lanzamientos.",
    type: "website"
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
        <Header />
        <main className="min-h-screen pt-20">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

