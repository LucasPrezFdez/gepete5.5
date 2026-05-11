"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[GameIndex] Global error:", error);
    }
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          backgroundColor: "#080a12",
          color: "#f4f7fb",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem"
        }}
      >
        <div
          style={{
            maxWidth: "560px",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            borderRadius: "1.5rem",
            padding: "2rem",
            textAlign: "center"
          }}
        >
          <p style={{ fontSize: "0.75rem", letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.6 }}>
            Error crítico
          </p>
          <h1 style={{ fontSize: "1.875rem", fontWeight: 900, marginTop: "0.75rem" }}>
            La aplicación se ha detenido
          </h1>
          <p style={{ marginTop: "0.75rem", opacity: 0.7 }}>
            Recarga la página para volver a empezar. Si persiste, vuelve más tarde.
          </p>
          {error.digest && (
            <p style={{ marginTop: "1rem", fontSize: "0.75rem", opacity: 0.5 }}>
              Ref: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              marginTop: "1.5rem",
              backgroundColor: "#3B82F6",
              color: "white",
              border: 0,
              borderRadius: "0.75rem",
              padding: "0.75rem 1.25rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Recargar
          </button>
        </div>
      </body>
    </html>
  );
}
