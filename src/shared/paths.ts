import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Prefer Vorssaint's own Application Support container so the companion
 * store sits next to ClipboardHistory / Scratchpad on a real install.
 * Fall back to com.vorssaint.todo only when that container does not exist yet.
 */
export const VORSSAINT_SUPPORT_DIR = join(
  homedir(),
  "Library",
  "Application Support",
  "com.vorssaint.utils",
);

export const COMPANION_SUPPORT_DIR = join(
  homedir(),
  "Library",
  "Application Support",
  "com.vorssaint.todo",
);

export const DEFAULT_STORE_FILENAME = "Todos.json";

export function defaultSupportDir(
  exists: (path: string) => boolean = existsSync,
): string {
  return exists(VORSSAINT_SUPPORT_DIR)
    ? VORSSAINT_SUPPORT_DIR
    : COMPANION_SUPPORT_DIR;
}

/** @deprecated Prefer defaultSupportDir(); kept as the live Vorssaint path. */
export const DEFAULT_SUPPORT_DIR = VORSSAINT_SUPPORT_DIR;

/**
 * One store path for humans, CLI, and skills.
 * Override with VORSSAINT_TODO_STORE for tests or to point at an upstream path.
 */
export function resolveStorePath(
  env: NodeJS.ProcessEnv = process.env,
  exists: (path: string) => boolean = existsSync,
): string {
  const override = env.VORSSAINT_TODO_STORE;
  if (override === undefined || override.trim() === "") {
    return join(defaultSupportDir(exists), DEFAULT_STORE_FILENAME);
  }
  return override;
}
