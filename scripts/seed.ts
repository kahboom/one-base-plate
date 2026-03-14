import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const STORAGE_KEY = "onebaseplate_households";

const fixturesDir = join(import.meta.dirname, "..", "fixtures", "households");
const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));
const households = files.map((f) =>
  JSON.parse(readFileSync(join(fixturesDir, f), "utf-8")),
);

const output = JSON.stringify(households);
console.log(`Seed data for key "${STORAGE_KEY}":`);
console.log(output);
console.log(`\nLoaded ${households.length} household(s) from fixtures.`);
console.log("To seed the app, paste this into the browser console:");
console.log(`localStorage.setItem("${STORAGE_KEY}", '${output.replace(/'/g, "\\'")}')`);
