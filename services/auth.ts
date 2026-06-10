import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import {
  createServiceDatabaseClient,
  createSqlClient,
} from "@/services/database";
import type { AuthSession, AuthUser } from "@/services/auth-types";
import { slugify } from "@/lib/utils";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

type TokenPayload = {
  sub: string;
  email: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  exp: number;
};

type DbUser = {
  id: string;
  email: string;
  password_hash: string;
  username: string;
  display_name: string | null;
  banned_at: string | null;
  banned_until: string | null;
  banned_reason: string | null;
};

const USER_COLUMNS =
  "id, email, password_hash, username, display_name, banned_at, banned_until, banned_reason";

function isBanActive(user: DbUser) {
  if (!user.banned_at) return false;
  if (!user.banned_until) return true;
  return new Date(user.banned_until) > new Date();
}

export class AccountBannedError extends Error {
  bannedUntil: string | null;
  reason: string | null;
  constructor(bannedUntil: string | null, reason: string | null) {
    const until = bannedUntil
      ? ` hasta ${new Date(bannedUntil).toLocaleString()}`
      : "";
    super(
      `Tu cuenta ha sido suspendida${until}.${reason ? ` Motivo: ${reason}` : ""}`,
    );
    this.name = "AccountBannedError";
    this.bannedUntil = bannedUntil;
    this.reason = reason;
  }
}

export async function registerUser(input: {
  email: string;
  password: string;
  username?: string;
}) {
  const email = normalizeEmail(input.email);
  const password = String(input.password ?? "");

  if (!email) throw new Error("Introduce un email válido.");
  if (password.length < 6)
    throw new Error("La contraseña debe tener al menos 6 caracteres.");

  const baseUsername = getSafeUsername(input.username || email.split("@")[0]);
  const username = await getAvailableUsername(baseUsername);
  const passwordHash = hashPassword(password);
  const sql = createSqlClient();

  const existing = (await sql.query(
    "select id from app_users where email = $1",
    [email],
  )) as { id: string }[];
  if (existing.length) throw new Error("Ya existe una cuenta con ese email.");

  const rows = (await sql.query(
    `insert into app_users (email, password_hash, username, display_name)
     values ($1, $2, $3, $4)
     returning ${USER_COLUMNS}`,
    [email, passwordHash, username, username],
  )) as DbUser[];

  const user = toAuthUser(rows[0]);
  await ensureProfileForAuthUser(user);
  return createSession(user);
}

export async function authenticateUser(input: {
  email: string;
  password: string;
}) {
  const email = normalizeEmail(input.email);
  const password = String(input.password ?? "");
  const sql = createSqlClient();
  const rows = (await sql.query(
    `select ${USER_COLUMNS} from app_users where email = $1 limit 1`,
    [email],
  )) as DbUser[];
  const user = rows[0];

  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new Error("Email o contraseña incorrectos.");
  }

  if (isBanActive(user)) {
    throw new AccountBannedError(user.banned_until, user.banned_reason);
  }

  const authUser = toAuthUser(user);
  await ensureProfileForAuthUser(authUser);
  return createSession(authUser);
}

export async function getUserFromToken(
  token: string,
): Promise<AuthUser | null> {
  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const sql = createSqlClient();
  const rows = (await sql.query(
    `select ${USER_COLUMNS} from app_users where id = $1 limit 1`,
    [payload.sub],
  )) as DbUser[];
  const user = rows[0];
  if (!user) return null;
  return toAuthUser(user);
}

export function isEmailAdmin(email: string | null | undefined) {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  return getAdminEmailSet().has(normalized);
}

export function getAdminEmailSet() {
  const raw = process.env.ADMIN_EMAILS ?? "";
  const items = raw
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
  return new Set(items);
}

function createSession(user: AuthUser): AuthSession {
  return {
    access_token: createAccessToken(user),
    user,
  };
}

function createAccessToken(user: AuthUser) {
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    username: user.user_metadata.username,
    displayName: user.user_metadata.display_name,
    isAdmin: user.isAdmin,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const encodedHeader = base64UrlEncode(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  );
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyAccessToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, receivedSignature] = parts;
  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);

  if (!safeEqual(receivedSignature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as TokenPayload;
    if (
      !payload.sub ||
      !payload.email ||
      !payload.exp ||
      payload.exp < Math.floor(Date.now() / 1000)
    )
      return null;
    return payload;
  } catch {
    return null;
  }
}

async function ensureProfileForAuthUser(user: AuthUser) {
  const db = createServiceDatabaseClient();
  await db.from("profiles").upsert(
    {
      id: user.id,
      username: user.user_metadata.username,
      display_name: user.user_metadata.display_name,
    },
    { onConflict: "id" },
  );
}

async function getAvailableUsername(baseUsername: string) {
  const sql = createSqlClient();
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate =
      suffix === 0 ? baseUsername : `${baseUsername}-${suffix + 1}`;
    const existing = (await sql.query(
      "select id from app_users where username = $1 limit 1",
      [candidate],
    )) as { id: string }[];
    if (!existing.length) return candidate;
  }
  return `${baseUsername}-${Date.now()}`;
}

function toAuthUser(user: DbUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    isAdmin: isEmailAdmin(user.email),
    bannedUntil: null,
    user_metadata: {
      username: user.username,
      display_name: user.display_name ?? user.username,
    },
  };
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const actual = Buffer.from(
    scryptSync(password, salt, 64).toString("hex"),
    "hex",
  );
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function sign(value: string) {
  return createHmac("sha256", getAuthSecret())
    .update(value)
    .digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getAuthSecret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.DATABASE_URL ||
    "gameindex-local-dev-secret"
  );
}

function normalizeEmail(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getSafeUsername(value: string) {
  return slugify(value).replace(/-/g, "_").slice(0, 32) || "usuario";
}
