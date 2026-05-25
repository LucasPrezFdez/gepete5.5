import { neon } from "@neondatabase/serverless";

export function createSqlClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Falta DATABASE_URL para conectar con Neon.");
  }

  return neon(connectionString);
}

export function createServiceDatabaseClient() {
  return createDatabaseClient(getDatabaseConnectionString());
}

function getDatabaseConnectionString() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Falta DATABASE_URL para conectar con Neon.");
  }

  return connectionString;
}

type Filter =
  | { kind: "eq"; column: string; value: unknown }
  | { kind: "gte"; column: string; value: unknown }
  | { kind: "ilike"; column: string; value: string }
  | { kind: "in"; column: string; values: unknown[] }
  | { kind: "not"; column: string; operator: string; value: unknown };

type Order = { column: string; ascending: boolean; nullsFirst?: boolean };
type CountMode = "exact" | undefined;
type MutationKind = "insert" | "upsert" | "update" | "delete";

type QueryResult<T = any> = {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
};

const TABLES = new Set([
  "profiles",
  "games",
  "platforms",
  "genres",
  "companies",
  "people",
  "franchises",
  "game_platforms",
  "game_genres",
  "game_companies",
  "game_credits",
  "reviews",
  "review_helpful_votes",
  "ratings",
  "user_game_statuses",
  "lists",
  "list_items",
  "media_assets",
  "release_dates",
  "external_sources",
  "external_scores",
  "dlcs",
  "list_likes",
  "saved_lists",
  "list_collaborators",
  "follows",
  "activity_events",
  "app_users"
]);

const TABLE_COLUMNS: Record<string, string[]> = {
  profiles: ["id", "username", "display_name", "bio", "avatar_url", "banner_url", "created_at", "updated_at", "onboarding_completed", "favorite_platforms", "favorite_genres"],
  app_users: ["id", "email", "password_hash", "username", "display_name", "created_at", "updated_at"],
  games: ["id", "slug", "title", "summary", "release_year", "status", "cover_url", "hero_url", "trailer_url", "user_score", "critic_score", "rating_count", "review_count", "popularity_score", "created_at", "updated_at", "last_synced_at", "source_priority"],
  platforms: ["id", "slug", "name"],
  genres: ["id", "slug", "name"],
  companies: ["id", "slug", "name", "logo_url", "country", "founded_year"],
  reviews: ["id", "game_id", "user_id", "title", "body", "score", "has_spoilers", "helpful_count", "created_at", "updated_at"],
  review_helpful_votes: ["review_id", "user_id", "created_at"],
  ratings: ["id", "game_id", "user_id", "score", "comment_body", "created_at", "updated_at"],
  user_game_statuses: ["id", "game_id", "user_id", "status", "created_at"],
  lists: ["id", "user_id", "slug", "title", "description", "cover_url", "is_public", "likes_count", "created_at"],
  list_items: ["id", "list_id", "game_id", "position", "note"],
  list_likes: ["list_id", "user_id", "created_at"],
  saved_lists: ["list_id", "user_id", "created_at"],
  list_collaborators: ["list_id", "user_id", "role", "created_at"],
  follows: ["follower_id", "following_id", "created_at"],
  activity_events: ["id", "user_id", "game_id", "review_id", "list_id", "type", "message", "created_at"],
  game_platforms: ["game_id", "platform_id"],
  game_genres: ["game_id", "genre_id"],
  game_companies: ["game_id", "company_id", "role"],
  external_sources: ["id", "game_id", "provider", "external_id", "url", "synced_at"]
};

const jsonFields = new Set(["game_platforms", "game_genres", "game_companies", "profiles", "games", "list_items", "lists"]);

class DatabaseClient {
  private queryFn: ReturnType<typeof neon>;

  constructor(connectionString: string) {
    this.queryFn = neon(connectionString);
  }

  from(table: string) {
    assertTable(table);
    return new NeonQueryBuilder(this.queryFn, table);
  }
}

class NeonQueryBuilder<T = any> implements PromiseLike<QueryResult<T[]>> {
  private selectClause = "*";
  private countMode: CountMode;
  private head = false;
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitValue: number | null = null;
  private offsetValue: number | null = null;
  private mutation: MutationKind | null = null;
  private mutationRows: Record<string, unknown>[] = [];
  private updateValues: Record<string, unknown> = {};
  private onConflictColumns: string[] = [];

  constructor(private queryFn: ReturnType<typeof neon>, private table: string) {}

  select(clause = "*", options?: { count?: CountMode; head?: boolean }) {
    this.selectClause = clause;
    this.countMode = options?.count;
    this.head = options?.head ?? false;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ kind: "eq", column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ kind: "gte", column, value });
    return this;
  }

  ilike(column: string, value: string) {
    this.filters.push({ kind: "ilike", column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ kind: "in", column, values });
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    this.filters.push({ kind: "not", column, operator, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true, nullsFirst: options?.nullsFirst });
    return this;
  }

  limit(count: number) {
    this.limitValue = count;
    return this;
  }

  range(from: number, to: number) {
    this.offsetValue = from;
    this.limitValue = Math.max(0, to - from + 1);
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.mutation = "insert";
    this.mutationRows = normalizeRows(values);
    return this;
  }

  upsert(values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) {
    this.mutation = "upsert";
    this.mutationRows = normalizeRows(values);
    this.onConflictColumns = parseConflictColumns(options?.onConflict);
    return this;
  }

  update(values: Record<string, unknown>) {
    this.mutation = "update";
    this.updateValues = values;
    return this;
  }

  delete() {
    this.mutation = "delete";
    return this;
  }

  async single(): Promise<QueryResult<T>> {
    const result = await this.execute();
    const rows = Array.isArray(result.data) ? result.data : [];
    if (result.error) return { data: null, error: result.error, count: result.count };
    if (rows.length !== 1) {
      return { data: null, error: { message: `Se esperaba una fila y se recibieron ${rows.length}.` }, count: result.count };
    }
    return { data: rows[0] as T, error: null, count: result.count };
  }

  async maybeSingle(): Promise<QueryResult<T>> {
    const result = await this.execute();
    const rows = Array.isArray(result.data) ? result.data : [];
    if (result.error) return { data: null, error: result.error, count: result.count };
    if (rows.length > 1) {
      return { data: null, error: { message: `Se esperaba como máximo una fila y se recibieron ${rows.length}.` }, count: result.count };
    }
    return { data: (rows[0] as T) ?? null, error: null, count: result.count };
  }

  then<TResult1 = QueryResult<T[]>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null) {
    return this.execute().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null) {
    return this.execute().finally(onfinally ?? undefined);
  }

  private async execute(): Promise<QueryResult<T[]>> {
    try {
      if (this.mutation) return await this.executeMutation();
      return await this.executeSelect();
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : String(error) }, count: null };
    }
  }

  private async executeSelect(): Promise<QueryResult<T[]>> {
    const params: unknown[] = [];
    const where = buildWhere(this.table, this.filters, params);
    const order = buildOrder(this.orders);
    const limit = buildLimit(this.limitValue, this.offsetValue, params);
    const columns = buildSelectColumns(this.table, this.selectClause);
    const countSql = this.countMode ? `select count(*)::int as count from ${quoteIdent(this.table)} ${where.sql}` : null;
    const rowsSql = this.head ? null : `select ${columns} from ${quoteIdent(this.table)} ${where.sql} ${order} ${limit}`;

    const [rows, countRows] = await Promise.all([
      rowsSql ? this.queryFn.query(rowsSql, params) : Promise.resolve([]),
      countSql ? this.queryFn.query(countSql, where.params) : Promise.resolve(null)
    ]);

    const hydrated = this.head ? [] : await hydrateRows(this.queryFn, this.table, rows as any[], this.selectClause);
    return { data: hydrated as T[], error: null, count: countRows ? Number((countRows as any[])[0]?.count ?? 0) : null };
  }

  private async executeMutation(): Promise<QueryResult<T[]>> {
    const returning = buildReturningColumns(this.table, this.selectClause);
    if (this.mutation === "insert" || this.mutation === "upsert") {
      if (this.mutationRows.length === 0) return { data: [], error: null, count: 0 };
      const { sql, params } = buildInsertSql(this.table, this.mutationRows, returning, this.mutation === "upsert", this.onConflictColumns);
      const rows = (await this.queryFn.query(sql, params)) as any[];
      return { data: await hydrateRows(this.queryFn, this.table, rows, this.selectClause) as T[], error: null, count: rows.length };
    }

    if (this.mutation === "update") {
      const params: unknown[] = [];
      const setSql = buildSetSql(this.table, this.updateValues, params);
      const where = buildWhere(this.table, this.filters, params);
      const rows = (await this.queryFn.query(`update ${quoteIdent(this.table)} set ${setSql} ${where.sql} returning ${returning}`, params)) as any[];
      return { data: await hydrateRows(this.queryFn, this.table, rows, this.selectClause) as T[], error: null, count: rows.length };
    }

    const params: unknown[] = [];
    const where = buildWhere(this.table, this.filters, params);
    const rows = (await this.queryFn.query(`delete from ${quoteIdent(this.table)} ${where.sql} returning ${returning}`, params)) as any[];
    return { data: await hydrateRows(this.queryFn, this.table, rows, this.selectClause) as T[], error: null, count: rows.length };
  }
}

function createDatabaseClient(connectionString: string) {
  return new DatabaseClient(connectionString) as any;
}

function normalizeRows(values: Record<string, unknown> | Record<string, unknown>[]) {
  return (Array.isArray(values) ? values : [values]).filter(Boolean);
}

function parseConflictColumns(value?: string) {
  return (value ?? "")
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean)
    .map((column) => {
      assertColumnName(column);
      return column;
    });
}

function buildSelectColumns(table: string, selectClause: string) {
  if (selectClause.includes("*") || selectClause.includes("(") || selectClause.includes(":")) return `${quoteIdent(table)}.*`;
  return buildColumnList(table, selectClause);
}

function buildReturningColumns(table: string, selectClause: string) {
  if (!selectClause || selectClause === "*" || selectClause.includes("(") || selectClause.includes(":")) return "*";
  return buildColumnList(table, selectClause);
}

function buildColumnList(table: string, clause: string) {
  const allowed = TABLE_COLUMNS[table] ?? [];
  const columns = clause
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean)
    .map((column) => {
      assertColumnName(column);
      if (allowed.length && !allowed.includes(column)) throw new Error(`Columna no permitida: ${table}.${column}`);
      return quoteIdent(column);
    });
  return columns.length ? columns.join(", ") : "*";
}

function buildWhere(table: string, filters: Filter[], params: unknown[]) {
  const clauses: string[] = [];
  for (const filter of filters) {
    const sql = filterToSql(table, filter, params);
    if (sql) clauses.push(sql);
  }
  return { sql: clauses.length ? `where ${clauses.join(" and ")}` : "", params: [...params] };
}

function filterToSql(table: string, filter: Filter, params: unknown[]) {
  const relationFilter = relationFilterToSql(table, filter, params);
  if (relationFilter) return relationFilter;

  assertColumnName(filter.column);
  if (!TABLE_COLUMNS[table]?.includes(filter.column)) throw new Error(`Columna no permitida: ${table}.${filter.column}`);
  const column = quoteIdent(filter.column);

  if (filter.kind === "eq") {
    params.push(filter.value);
    return `${column} = $${params.length}`;
  }
  if (filter.kind === "gte") {
    params.push(filter.value);
    return `${column} >= $${params.length}`;
  }
  if (filter.kind === "ilike") {
    params.push(filter.value);
    return `${column} ilike $${params.length}`;
  }
  if (filter.kind === "in") {
    if (filter.values.length === 0) return "false";
    const placeholders = filter.values.map((value) => {
      params.push(value);
      return `$${params.length}`;
    });
    return `${column} in (${placeholders.join(", ")})`;
  }
  if (filter.kind === "not" && filter.operator === "is" && filter.value === null) {
    return `${column} is not null`;
  }
  throw new Error(`Filtro no soportado: ${filter.kind} ${filter.operator ?? ""}`.trim());
}

function relationFilterToSql(table: string, filter: Filter, params: unknown[]) {
  if (filter.kind !== "eq") return null;
  const [relation, column] = filter.column.split(".");
  if (!relation || !column) return null;
  assertColumnName(column);
  params.push(filter.value);
  const placeholder = `$${params.length}`;

  if (relation === "games" && ["reviews", "user_game_statuses", "ratings", "activity_events"].includes(table)) {
    return `${quoteIdent("game_id")} in (select id from games where ${quoteIdent(column)} = ${placeholder})`;
  }
  if (relation === "profiles" && ["reviews", "ratings", "lists", "activity_events"].includes(table)) {
    return `${quoteIdent("user_id")} in (select id from profiles where ${quoteIdent(column)} = ${placeholder})`;
  }
  return null;
}

function buildOrder(orders: Order[]) {
  if (!orders.length) return "";
  const parts = orders.map((order) => {
    if (order.column.includes(".")) throw new Error(`Orden por relación no soportado: ${order.column}`);
    assertColumnName(order.column);
    const nulls = order.nullsFirst === undefined ? "" : order.nullsFirst ? " nulls first" : " nulls last";
    return `${quoteIdent(order.column)} ${order.ascending ? "asc" : "desc"}${nulls}`;
  });
  return `order by ${parts.join(", ")}`;
}

function buildLimit(limitValue: number | null, offsetValue: number | null, params: unknown[]) {
  const parts: string[] = [];
  if (limitValue !== null) {
    params.push(limitValue);
    parts.push(`limit $${params.length}`);
  }
  if (offsetValue !== null) {
    params.push(offsetValue);
    parts.push(`offset $${params.length}`);
  }
  return parts.join(" ");
}

function buildInsertSql(table: string, rows: Record<string, unknown>[], returning: string, upsert: boolean, conflictColumns: string[]) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  columns.forEach((column) => {
    assertColumnName(column);
    if (!TABLE_COLUMNS[table]?.includes(column)) throw new Error(`Columna no permitida: ${table}.${column}`);
  });

  const params: unknown[] = [];
  const valuesSql = rows
    .map((row) => `(${columns.map((column) => {
      params.push(row[column] ?? null);
      return `$${params.length}`;
    }).join(", ")})`)
    .join(", ");

  const conflictSql = upsert ? buildConflictSql(table, columns, conflictColumns) : "";
  const sql = `insert into ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) values ${valuesSql} ${conflictSql} returning ${returning}`;
  return { sql, params };
}

function buildConflictSql(table: string, columns: string[], conflictColumns: string[]) {
  if (conflictColumns.length === 0) throw new Error(`Faltan columnas onConflict para upsert en ${table}.`);
  const updateColumns = columns.filter((column) => !conflictColumns.includes(column));
  const target = conflictColumns.map(quoteIdent).join(", ");
  if (updateColumns.length === 0) return `on conflict (${target}) do nothing`;
  return `on conflict (${target}) do update set ${updateColumns.map((column) => `${quoteIdent(column)} = excluded.${quoteIdent(column)}`).join(", ")}`;
}

function buildSetSql(table: string, values: Record<string, unknown>, params: unknown[]) {
  const entries = Object.entries(values);
  if (!entries.length) throw new Error(`No hay valores para actualizar en ${table}.`);
  return entries
    .map(([column, value]) => {
      assertColumnName(column);
      if (!TABLE_COLUMNS[table]?.includes(column)) throw new Error(`Columna no permitida: ${table}.${column}`);
      params.push(value);
      return `${quoteIdent(column)} = $${params.length}`;
    })
    .join(", ");
}

async function hydrateRows(queryFn: ReturnType<typeof neon>, table: string, rows: any[], selectClause: string) {
  if (!rows.length) return rows;
  const needs = (token: string) => selectClause.includes(token);
  const hydrated = rows.map((row) => ({ ...row }));

  if (table === "games" && (needs("game_platforms") || needs("game_genres") || needs("game_companies"))) {
    await hydrateGameRelations(queryFn, hydrated);
  }
  if (needs("profiles") && ["ratings", "reviews", "lists"].includes(table)) {
    await hydrateProfiles(queryFn, hydrated, "user_id", "profiles");
  }
  if (needs("games") && ["reviews", "user_game_statuses", "list_items", "activity_events"].includes(table)) {
    await hydrateGames(queryFn, hydrated, "game_id", "games");
  }
  if (table === "lists" && needs("list_items")) {
    await hydrateProfiles(queryFn, hydrated, "user_id", "profiles");
    await hydrateListItems(queryFn, hydrated);
  }
  if (table === "activity_events") {
    if (needs("games")) await hydrateGames(queryFn, hydrated, "game_id", "games");
    if (needs("lists")) await hydrateActivityLists(queryFn, hydrated);
    if (needs("profiles")) await hydrateProfiles(queryFn, hydrated, "user_id", "profiles");
  }

  stripJsonNulls(hydrated);
  return hydrated;
}

async function hydrateProfiles(queryFn: ReturnType<typeof neon>, rows: any[], fk: string, target: string) {
  const ids = unique(rows.map((row) => row[fk]).filter(Boolean));
  if (!ids.length) return;
  const profiles = await queryFn.query(`select id, username, display_name, bio, avatar_url, banner_url, created_at, favorite_platforms, favorite_genres from profiles where id = any($1::uuid[])`, [ids]) as any[];
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  rows.forEach((row) => { row[target] = byId.get(row[fk]) ?? null; });
}

async function hydrateGames(queryFn: ReturnType<typeof neon>, rows: any[], fk: string, target: string) {
  const ids = unique(rows.map((row) => row[fk]).filter(Boolean));
  if (!ids.length) return;
  const games = await queryFn.query(`select id, slug, title, summary, release_year, status, cover_url, hero_url, user_score, critic_score, rating_count, review_count from games where id = any($1::uuid[])`, [ids]) as any[];
  const byId = new Map(games.map((game) => [game.id, game]));
  rows.forEach((row) => { row[target] = byId.get(row[fk]) ?? null; });
}

async function hydrateGameRelations(queryFn: ReturnType<typeof neon>, games: any[]) {
  const ids = unique(games.map((game) => game.id).filter(Boolean));
  if (!ids.length) return;
  const [platforms, genres, companies] = await Promise.all([
    queryFn.query(`select gp.game_id, p.name from game_platforms gp join platforms p on p.id = gp.platform_id where gp.game_id = any($1::uuid[])`, [ids]) as Promise<any[]>,
    queryFn.query(`select gg.game_id, g.name from game_genres gg join genres g on g.id = gg.genre_id where gg.game_id = any($1::uuid[])`, [ids]) as Promise<any[]>,
    queryFn.query(`select gc.game_id, gc.role, c.name from game_companies gc join companies c on c.id = gc.company_id where gc.game_id = any($1::uuid[])`, [ids]) as Promise<any[]>
  ]);

  games.forEach((game) => {
    game.game_platforms = platforms.filter((item) => item.game_id === game.id).map((item) => ({ platforms: { name: item.name } }));
    game.game_genres = genres.filter((item) => item.game_id === game.id).map((item) => ({ genres: { name: item.name } }));
    game.game_companies = companies.filter((item) => item.game_id === game.id).map((item) => ({ role: item.role, companies: { name: item.name } }));
  });
}

async function hydrateListItems(queryFn: ReturnType<typeof neon>, lists: any[]) {
  const ids = unique(lists.map((list) => list.id).filter(Boolean));
  if (!ids.length) return;
  const items = await queryFn.query(
    `select li.id, li.list_id, li.position, li.note, g.slug, g.title, g.summary, g.release_year, g.status, g.cover_url, g.hero_url, g.user_score, g.critic_score, g.rating_count, g.review_count,
       coalesce(array_agg(distinct p.name) filter (where p.name is not null), '{}') as platforms,
       coalesce(array_agg(distinct ge.name) filter (where ge.name is not null), '{}') as genres
     from list_items li
     join games g on g.id = li.game_id
     left join game_platforms gp on gp.game_id = g.id
     left join platforms p on p.id = gp.platform_id
     left join game_genres gg on gg.game_id = g.id
     left join genres ge on ge.id = gg.genre_id
     where li.list_id = any($1::uuid[])
     group by li.id, li.list_id, li.position, li.note, g.slug, g.title, g.summary, g.release_year, g.status, g.cover_url, g.hero_url, g.user_score, g.critic_score, g.rating_count, g.review_count
     order by li.position asc`,
    [ids]
  ) as any[];
  lists.forEach((list) => {
    list.list_items = items.filter((item) => item.list_id === list.id).map((item) => ({
      id: item.id,
      position: item.position,
      note: item.note,
      games: {
        slug: item.slug,
        title: item.title,
        summary: item.summary,
        release_year: item.release_year,
        status: item.status,
        cover_url: item.cover_url,
        hero_url: item.hero_url,
        user_score: item.user_score,
        critic_score: item.critic_score,
        rating_count: item.rating_count,
        review_count: item.review_count,
        platforms: item.platforms,
        genres: item.genres
      }
    }));
  });
}

async function hydrateActivityLists(queryFn: ReturnType<typeof neon>, rows: any[]) {
  const ids = unique(rows.map((row) => row.list_id).filter(Boolean));
  if (!ids.length) return;
  const lists = await queryFn.query(`select id, slug, title from lists where id = any($1::uuid[])`, [ids]) as any[];
  const byId = new Map(lists.map((list) => [list.id, list]));
  rows.forEach((row) => { row.lists = byId.get(row.list_id) ?? null; });
}

function stripJsonNulls(rows: any[]) {
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (jsonFields.has(key) && row[key] === null) row[key] = undefined;
    }
  }
}

function unique(values: unknown[]) {
  return Array.from(new Set(values));
}

function assertTable(table: string) {
  if (!TABLES.has(table)) throw new Error(`Tabla no permitida: ${table}`);
}

function assertColumnName(column: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(column)) throw new Error(`Identificador no permitido: ${column}`);
}

function quoteIdent(identifier: string) {
  assertColumnName(identifier);
  return `"${identifier}"`;
}
