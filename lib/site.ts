const DEFAULT_SITE_URL = "http://localhost:3000";

export function getSiteUrl() {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!fromEnv) return DEFAULT_SITE_URL;
  return fromEnv.startsWith("http") ? fromEnv.replace(/\/$/, "") : `https://${fromEnv}`.replace(/\/$/, "");
}

export function absoluteUrl(path = "/") {
  const base = getSiteUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
