import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const envText = readFileSync(".env", "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
  if (!match) continue;
  env[match[1]] = match[2].replace(/^['\"]|['\"]$/g, "");
}

const sql = neon(env.DATABASE_URL);
const rows = await sql.query(`select table_name, column_name
from information_schema.columns
where table_name in ('app_users', 'content_reports')
order by table_name, ordinal_position`);
console.log(JSON.stringify(rows, null, 2));
