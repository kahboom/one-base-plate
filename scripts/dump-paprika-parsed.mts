/**
 * One-off: parse a .paprikarecipes file with app logic and write JSON.
 * Usage: npx tsx scripts/dump-paprika-parsed.mts <path-to-export.paprikarecipes> [out.json]
 */
import { readFile, writeFile } from "node:fs/promises";
import { parsePaprikaFile, parsePaprikaRecipes } from "../src/paprika-parser.ts";

const inPath = process.argv[2] ?? "";
const outPath =
  process.argv[3] ??
  inPath.replace(/\.paprikarecipes$/i, "-parsed.json").replace(/\.[^/]+$/, "-parsed.json");

if (!inPath) {
  console.error("Usage: npx tsx scripts/dump-paprika-parsed.mts <file.paprikarecipes> [out.json]");
  process.exit(1);
}

const buf = await readFile(inPath);
const file = new File([buf], inPath.split("/").pop() ?? "export.paprikarecipes", {
  type: "application/zip",
});
const recipes = await parsePaprikaFile(file);
const parsed = parsePaprikaRecipes(recipes, [], []);

const out = {
  sourceFile: inPath,
  generatedAt: new Date().toISOString(),
  parser: "parsePaprikaFile + parsePaprikaRecipes (empty household)",
  recipeCount: parsed.length,
  recipes: parsed.map((r) => ({
    name: r.raw.name,
    uid: r.raw.uid,
    selected: r.selected,
    isDuplicate: r.isDuplicate,
    existingRecipeId: r.existingRecipeId,
    rawIngredients: r.raw.ingredients,
    parsedLines: r.parsedLines.map((l) => ({
      raw: l.raw,
      quantity: l.quantity,
      unit: l.unit,
      quantityValue: l.quantityValue,
      name: l.name,
      prepNotes: l.prepNotes,
      groupKey: l.groupKey,
      action: l.action,
      resolutionStatus: l.resolutionStatus,
      status: l.status,
      matchScore: l.matchScore,
      confidenceBand: l.confidenceBand,
      matchedIngredientId: l.matchedIngredient?.id ?? null,
      matchedIngredientName: l.matchedIngredient?.name ?? null,
      matchedCatalogId: l.matchedCatalog?.id ?? null,
      matchedCatalogName: l.matchedCatalog?.name ?? null,
    })),
  })),
};

await writeFile(outPath, JSON.stringify(out, null, 2), "utf8");
console.log(`Wrote ${outPath} (${parsed.length} recipes)`);
