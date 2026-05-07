import { NextResponse } from "next/server";
import { getExploreGames } from "@/services/games";
import type { GameSort } from "@/data/games";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = await getExploreGames({
    query: searchParams.get("q") ?? searchParams.get("search") ?? undefined,
    page: getPositiveInteger(searchParams.get("page"), 1),
    pageSize: getPositiveInteger(searchParams.get("pageSize"), 24),
    platform: searchParams.get("platform") ?? undefined,
    genre: searchParams.get("genre") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    year: getOptionalInteger(searchParams.get("year")),
    scoreMin: getOptionalInteger(searchParams.get("scoreMin")),
    sort: getSort(searchParams.get("sort"))
  });

  return NextResponse.json(result);
}

function getPositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function getOptionalInteger(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function getSort(value: string | null): GameSort | undefined {
  return value === "popular" || value === "score" || value === "recent" || value === "upcoming" || value === "reviewed"
    ? value
    : undefined;
}
