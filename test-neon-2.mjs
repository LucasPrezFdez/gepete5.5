import { neon } from "@neondatabase/serverless";
const sql = neon("postgresql://user:pass@localhost/db");
console.log("Calling sql.query...");
try {
  const res = sql.query("SELECT 1 as n");
  console.log("Result of sql.query is promise?", res instanceof Promise);
} catch (e) {
  console.log("Error calling sql.query:", e.message);
}
