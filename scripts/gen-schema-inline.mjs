// تولید src/js/schema-inline.js از sql/schema.sql
import { readFileSync, writeFileSync } from "node:fs";
const sql = readFileSync(new URL("../sql/schema.sql", import.meta.url), "utf8");
const out = `// AUTO-GENERATED — do not edit. From sql/schema.sql
export const SCHEMA_SQL = ${JSON.stringify(sql)};
`;
writeFileSync(new URL("../src/js/schema-inline.js", import.meta.url), out);
console.log("schema-inline.js generated (" + sql.length + " chars)");
