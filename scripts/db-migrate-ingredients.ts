import { readFileSync, writeFileSync } from "fs";
import { basename, dirname, extname, join, resolve } from "path";
import type { Household } from "../src/types";
import { migrateHouseholdsIngredients } from "../src/ingredient-migration";

interface Args {
  inputPath?: string;
  outputPath?: string;
  writeInPlace: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { writeInPlace: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) continue;

    if (token === "--in") {
      args.inputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--out") {
      args.outputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--write") {
      args.writeInPlace = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function printUsage(): void {
  console.log(
    [
      "Migrate ingredient names and dedupe legacy records in exported household JSON.",
      "",
      "Usage:",
      "  npm run db:migrate-ingredients -- --in <file> [--out <file>] [--write]",
      "",
      "Options:",
      "  --in <file>    Input JSON path (required).",
      "  --out <file>   Output JSON path (default: <input>.migrated.json).",
      "  --write        Overwrite input file in place (ignores --out).",
      "  --help         Show this help message.",
      "",
      "Examples:",
      "  npm run db:migrate-ingredients -- --in ./households-export.json",
      "  npm run db:migrate-ingredients -- --in ./households-export.json --write",
      "",
      "Tip:",
      "  Export from the app, run this script, then import the migrated file back.",
    ].join("\n"),
  );
}

function defaultOutputPath(inputPath: string): string {
  const absoluteInput = resolve(inputPath);
  const extension = extname(absoluteInput);
  const baseWithoutExt = absoluteInput.slice(0, absoluteInput.length - extension.length);
  return join(
    dirname(absoluteInput),
    `${basename(baseWithoutExt)}.migrated${extension || ".json"}`,
  );
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!args.inputPath) {
    printUsage();
    throw new Error("Missing required --in argument.");
  }

  const inputPath = resolve(args.inputPath);
  const parsed = readJson(inputPath);

  const households = Array.isArray(parsed)
    ? (parsed as Household[])
    : (() => {
        if (!parsed || typeof parsed !== "object" || !("households" in parsed)) {
          throw new Error(
            "Input JSON must be either an array of households or an object containing a households array.",
          );
        }
        const withHouseholds = parsed as { households?: unknown };
        if (!Array.isArray(withHouseholds.households)) {
          throw new Error("The 'households' property must be an array.");
        }
        return withHouseholds.households as Household[];
      })();

  const { households: migratedHouseholds, report } =
    migrateHouseholdsIngredients(households);

  const outputData =
    Array.isArray(parsed)
      ? migratedHouseholds
      : { ...(parsed as Record<string, unknown>), households: migratedHouseholds };

  const outputPath = args.writeInPlace
    ? inputPath
    : resolve(args.outputPath ?? defaultOutputPath(inputPath));

  writeFileSync(outputPath, `${JSON.stringify(outputData, null, 2)}\n`);

  console.log("Ingredient migration complete.");
  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Households processed: ${report.householdsProcessed}`);
  console.log(`Ingredients: ${report.ingredientsBefore} -> ${report.ingredientsAfter}`);
  console.log(`Normalized names updated: ${report.normalizedNameChanges}`);
  console.log(`Duplicates merged: ${report.duplicatesMerged}`);
  console.log(`References remapped: ${report.remappedReferences}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Migration failed: ${message}`);
  process.exit(1);
}
