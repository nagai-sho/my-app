import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const dbIndex = process.argv.indexOf("--db");
const dbName = dbIndex >= 0 ? process.argv[dbIndex + 1] : "my-app";
const migrationsDir = "migrations";

const files = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort((a, b) => a.localeCompare(b));

for (const file of files) {
  const result = spawnSync("npx", ["wrangler", "d1", "execute", dbName, "--remote", "--file", `${migrationsDir}/${file}`, "--yes"], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("D1 migrations are up to date.");
