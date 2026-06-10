import { neon } from "@neondatabase/serverless";
const sql = neon("postgresql://user:pass@localhost/db");
const res = sql.query("SELECT 1 as n");
console.log("Result:", res);
console.log("Type of Result:", typeof res);
