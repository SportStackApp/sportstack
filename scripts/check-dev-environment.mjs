import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEV_PROJECT_REF = "icqegnpjbizccjebjfhb";
const DEV_HOST = `${DEV_PROJECT_REF}.supabase.co`;
const args = new Set(process.argv.slice(2));
const checkFrontend = !args.has("--cli-only");
const checkCli = !args.has("--frontend-only");
const errors = [];

function readEnvironmentFile(path) {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return separator === -1
          ? [line, ""]
          : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      }),
  );
}

if (checkFrontend) {
  const environmentPath = resolve(".env.development.local");

  if (!existsSync(environmentPath)) {
    errors.push("Local development override is missing.");
  } else {
    const environment = readEnvironmentFile(environmentPath);
    let host = "";

    try {
      host = new URL(environment.VITE_SUPABASE_URL ?? "").hostname;
    } catch {
      errors.push("The local Supabase URL is invalid.");
    }

    if (host && host !== DEV_HOST) {
      errors.push("Local development is not pointing to SportStack Dev.");
    }

    if (environment.VITE_SUPABASE_PROJECT_ID !== DEV_PROJECT_REF) {
      errors.push("The local Supabase project ID is not SportStack Dev.");
    }

    if (!environment.VITE_SUPABASE_PUBLISHABLE_KEY) {
      errors.push("The local Supabase publishable key is missing.");
    }
  }
}

if (checkCli) {
  const projectRefPath = resolve("supabase", ".temp", "project-ref");

  if (!existsSync(projectRefPath)) {
    errors.push("The Supabase CLI is not linked to SportStack Dev.");
  } else if (readFileSync(projectRefPath, "utf8").trim() !== DEV_PROJECT_REF) {
    errors.push("The Supabase CLI is linked to the wrong project.");
  }
}

if (errors.length > 0) {
  console.error("Development environment check failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

const targets = [
  checkFrontend ? "local frontend" : null,
  checkCli ? "Supabase CLI" : null,
].filter(Boolean);

console.log(`Development environment check passed: ${targets.join(" and ")} target SportStack Dev.`);
