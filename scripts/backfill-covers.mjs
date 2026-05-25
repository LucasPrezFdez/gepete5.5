// One-shot script: reads data/fallback-games.ts, for every entry that has
// `cover(null)` it queries IGDB to resolve the cover image_id from the title,
// then rewrites the file replacing `cover(null)` with `cover("<id>")`.
//
// Usage:  node scripts/backfill-covers.mjs
// Reads IGDB_CLIENT_ID / IGDB_CLIENT_SECRET from .env (Node parses them via dotenv-like fallback).

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "..");
const FILE = resolve(REPO, "data/fallback-games.ts");

async function loadEnv() {
  try {
    const text = await readFile(resolve(REPO, ".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!match) continue;
      const [, key, raw] = match;
      if (process.env[key]) continue;
      const value = raw.replace(/^['"]|['"]$/g, "");
      process.env[key] = value;
    }
  } catch {
    // .env optional
  }
}

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_API = "https://api.igdb.com/v4";

let cachedToken = null;

async function getAccessToken() {
  const clientId = process.env.IGDB_CLIENT_ID?.trim();
  const clientSecret = process.env.IGDB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Missing IGDB_CLIENT_ID / IGDB_CLIENT_SECRET in .env");
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.accessToken;

  const url = new URL(TWITCH_TOKEN_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", "client_credentials");

  const response = await fetch(url, { method: "POST" });
  if (!response.ok) throw new Error(`Twitch OAuth failed: ${response.status}`);
  const data = await response.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Math.max(60, data.expires_in ?? 3600) * 1000
  };
  return cachedToken.accessToken;
}

function escapeIgdbString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

async function igdbSearch(title, year) {
  const accessToken = await getAccessToken();
  const clientId = process.env.IGDB_CLIENT_ID.trim();

  const body = [
    `search "${escapeIgdbString(title)}";`,
    "fields id,name,slug,first_release_date,cover.image_id;",
    "limit 8;"
  ].join("\n");

  const response = await fetch(`${IGDB_API}/games`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Client-ID": clientId,
      Authorization: `Bearer ${accessToken}`
    },
    body
  });

  if (!response.ok) {
    if (response.status === 429) {
      // rate limited, back off
      await sleep(2000);
      return igdbSearch(title, year);
    }
    throw new Error(`IGDB ${response.status} for "${title}"`);
  }

  const results = await response.json();
  return Array.isArray(results) ? results : [];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pickBestMatch(results, expectedTitle, expectedYear) {
  if (!results.length) return null;
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const target = normalize(expectedTitle);

  // Filter to entries that have a cover at all
  const withCover = results.filter((r) => r.cover?.image_id);
  if (!withCover.length) return null;

  // Score: exact title match + year proximity
  let best = null;
  let bestScore = -Infinity;
  for (const r of withCover) {
    const candidate = normalize(r.name ?? "");
    let score = 0;
    if (candidate === target) score += 100;
    else if (candidate.includes(target) || target.includes(candidate)) score += 40;
    if (typeof r.first_release_date === "number" && expectedYear) {
      const candidateYear = new Date(r.first_release_date * 1000).getUTCFullYear();
      const diff = Math.abs(candidateYear - expectedYear);
      if (diff === 0) score += 50;
      else if (diff <= 1) score += 30;
      else if (diff <= 3) score += 10;
      else score -= diff;
    }
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  // Require at least a partial title match. Avoid grabbing random unrelated games.
  return bestScore >= 10 ? best : null;
}

// --- Parser: extract (slug, title, year) for every entry where coverUrl uses cover(null) ---
function parseEntries(source) {
  const entries = [];
  // Find every block starting with `{` after the FALLBACK_GAMES array opening.
  // Each entry is delimited by `{ ... }` with the fields we need.
  const arrayStart = source.indexOf("FALLBACK_GAMES: Game[] = [");
  if (arrayStart < 0) throw new Error("Could not find FALLBACK_GAMES array start");

  const region = source.slice(arrayStart);
  // Pattern that captures title, slug, year, and whether coverUrl is cover(null)
  // We rely on the formatter putting each field on its own line.
  const blockRe = /\{\s*title:\s*"([^"]+)",\s*slug:\s*"([^"]+)",\s*year:\s*(\d+)[\s\S]*?coverUrl:\s*cover\(([^)]*)\)/g;

  let match;
  while ((match = blockRe.exec(region)) !== null) {
    const [, title, slug, year, coverArg] = match;
    if (coverArg.trim() === "null") {
      entries.push({ title, slug, year: Number(year) });
    }
  }
  return entries;
}

function rewriteSourceWithCovers(source, slugToImageId) {
  // We replace BOTH `coverUrl: cover(null)` and `heroUrl: cover(null)` for each entry
  // whose slug is in the map. We do it by walking entry-by-entry.
  let out = source;
  let cursor = 0;
  let updated = 0;

  while (true) {
    const slugIdx = out.indexOf('slug: "', cursor);
    if (slugIdx < 0) break;
    const slugEnd = out.indexOf('"', slugIdx + 7);
    const slug = out.slice(slugIdx + 7, slugEnd);
    cursor = slugEnd;

    const imageId = slugToImageId[slug];
    if (!imageId) continue;

    // Find the end of THIS entry: search for the next `slug: "` OR the array's closing `];`.
    const nextSlugIdx = out.indexOf('slug: "', cursor);
    const entryEnd = nextSlugIdx > 0 ? nextSlugIdx : out.length;

    const entryStart = slugIdx;
    const block = out.slice(entryStart, entryEnd);
    const replaced = block
      .replace(/coverUrl:\s*cover\(null\)/, `coverUrl: cover("${imageId}")`)
      .replace(/heroUrl:\s*cover\(null\)/, `heroUrl: cover("${imageId}")`);

    if (replaced !== block) {
      out = out.slice(0, entryStart) + replaced + out.slice(entryEnd);
      updated += 1;
      // adjust cursor since length may have changed slightly
      cursor = entryStart + replaced.length;
    }
  }

  return { source: out, updated };
}

async function main() {
  await loadEnv();
  const source = await readFile(FILE, "utf8");
  const entries = parseEntries(source);
  console.log(`Found ${entries.length} entries with cover(null) to backfill.`);

  const slugToImageId = {};
  const failures = [];
  let i = 0;

  for (const entry of entries) {
    i += 1;
    try {
      const results = await igdbSearch(entry.title, entry.year);
      const best = pickBestMatch(results, entry.title, entry.year);
      if (best?.cover?.image_id) {
        slugToImageId[entry.slug] = best.cover.image_id;
        console.log(`[${i}/${entries.length}] ${entry.slug} -> ${best.cover.image_id}`);
      } else {
        failures.push(entry.slug);
        console.log(`[${i}/${entries.length}] ${entry.slug} -> NO MATCH`);
      }
    } catch (err) {
      failures.push(entry.slug);
      console.log(`[${i}/${entries.length}] ${entry.slug} -> ERROR: ${err.message}`);
    }
    // throttle to ~4 req/s (IGDB limit)
    await sleep(260);
  }

  const matched = Object.keys(slugToImageId).length;
  console.log(`\nMatched ${matched}/${entries.length} covers. ${failures.length} failures.`);

  if (matched === 0) {
    console.log("Nothing to write. Exiting.");
    return;
  }

  const { source: nextSource, updated } = rewriteSourceWithCovers(source, slugToImageId);
  await writeFile(FILE, nextSource, "utf8");
  console.log(`Wrote ${updated} updated entries to data/fallback-games.ts`);

  if (failures.length) {
    console.log(`\nFailures (kept as cover(null)):`);
    for (const slug of failures) console.log(`  - ${slug}`);
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
