import { NextResponse } from "next/server";
import { IgdbApiError, listIgdbGames } from "@/services/igdb";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasClientId = Boolean(process.env.IGDB_CLIENT_ID?.trim());
  const hasClientSecret = Boolean(process.env.IGDB_CLIENT_SECRET?.trim());

  try {
    const result = await listIgdbGames({ query: "zelda", pageSize: 1 });

    return NextResponse.json({
      ok: true,
      provider: "igdb",
      credentials: {
        hasClientId,
        hasClientSecret
      },
      test: {
        query: result.query,
        count: result.count,
        results: result.results.length,
        first: result.results[0]
          ? {
              id: result.results[0].id,
              name: result.results[0].name,
              slug: result.results[0].slug
            }
          : null
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        provider: "igdb",
        credentials: {
          hasClientId,
          hasClientSecret
        },
        error:
          error instanceof IgdbApiError
            ? { name: error.name, code: error.code, message: error.message }
            : { name: "UnknownError", message: error instanceof Error ? error.message : "Error desconocido" }
      },
      { status: 500 }
    );
  }
}
