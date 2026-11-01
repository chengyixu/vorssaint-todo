import { homedir } from "node:os";
import { join } from "node:path";

/** Canonical Application Support folder for the companion until upstream adopts Todos.json. */
export const DEFAULT_SUPPORT_DIR = join(
  homedir(),
  "Library",
  "Application Support",
  "com.vorssaint.todo",
);

export const DEFAULT_STORE_FILENAME = "Todos.json";

/**
 * One store path for humans, CLI, and skills.
 * Override with VORSSAINT_TODO_STORE for tests or to point at an upstream path.
 */
export function resolveStorePath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const override = env.VORSSAINT_TODO_STORE;
  if (override === undefined || override.trim() === "") {
    return join(DEFAULT_SUPPORT_DIR, DEFAULT_STORE_FILENAME);
  }
  return override;
}
