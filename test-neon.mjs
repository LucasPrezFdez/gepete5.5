import { neon } from "@neondatabase/serverless";
const sql = neon("postgresql://user:pass@localhost/db");
console.log("Type of sql:", typeof sql);
console.log("Type of sql.query:", typeof sql.query);
