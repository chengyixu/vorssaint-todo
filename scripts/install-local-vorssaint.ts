#!/usr/bin/env bun
/**
 * Wire vors-todo into the local Vorssaint install:
 * - store under com.vorssaint.utils/Todos.json
 * - enable Command Bar availability + shortcut
 * - register Command Bar script named "todo"
 * - restart Vorssaint so the feature loads
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const DOMAIN = "com.vorssaint.utils";
const SUPPORT = join(homedir(), "Library", "Application Support", DOMAIN);
const PREFS = join(homedir(), "Library", "Preferences", `${DOMAIN}.plist`);
const SCRIPT_DIR = join(SUPPORT, "TodoScripts");
const SCRIPT_PATH = join(SCRIPT_DIR, "vors-todo-cb");
const APP = "/Applications/Vorssaint.app";

interface CommandBarLink {
  id: string;
  name: string;
  kind: "link" | "place" | "script";
  destination: string;
  runsWithoutArgument: boolean;
  runsDirectly: boolean;
}

function run(cmd: string, args: string[]): string {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(" ")} failed: ${result.stderr || result.stdout || result.status}`,
    );
  }
  return result.stdout ?? "";
}

function tryRun(cmd: string, args: string[]): { ok: boolean; stdout: string } {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  return { ok: result.status === 0, stdout: result.stdout ?? "" };
}

function readLinks(): CommandBarLink[] {
  if (!existsSync(PREFS)) return [];
  const tmp = join("/tmp", `commandBarLinks-${process.pid}.b64`);
  const extracted = tryRun("plutil", [
    "-extract",
    "commandBarLinks",
    "raw",
    "-o",
    tmp,
    PREFS,
  ]);
  if (!extracted.ok) return [];
  try {
    // `raw` for a Data value yields base64 text
    const b64 = readFileSync(tmp, "utf8").trim();
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as CommandBarLink[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  } finally {
    tryRun("rm", ["-f", tmp]);
  }
}

function writeLinks(links: CommandBarLink[]): void {
  const json = JSON.stringify(links);
  const hex = Buffer.from(json, "utf8").toString("hex");
  run("defaults", ["write", DOMAIN, "commandBarLinks", "-data", hex]);
}

function writeBool(key: string, value: boolean): void {
  run("defaults", ["write", DOMAIN, key, "-bool", value ? "true" : "false"]);
}

function appRunning(): boolean {
  return tryRun("pgrep", ["-f", "/Applications/Vorssaint.app/Contents/MacOS/Vorssaint"]).ok;
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function restartApp(): void {
  const wasRunning = appRunning();
  tryRun("killall", ["Vorssaint"]);
  for (let i = 0; i < 50; i++) {
    if (!appRunning()) break;
    sleep(100);
  }
  if (wasRunning || existsSync(APP)) {
    run("open", ["-a", "Vorssaint"]);
  }
}

function ensureScript(): void {
  mkdirSync(SCRIPT_DIR, { recursive: true });
  if (!existsSync(SCRIPT_PATH)) {
    throw new Error(`Missing Command Bar bridge script at ${SCRIPT_PATH}`);
  }
  chmodSync(SCRIPT_PATH, 0o755);
}

function main(): void {
  ensureScript();
  writeBool("featureAvailable.commandBar", true);
  writeBool("commandBarShortcutEnabled", true);

  const existing = readLinks().filter((link) => link.name.toLowerCase() !== "todo");
  const todoLink: CommandBarLink = {
    id: randomUUID(),
    name: "todo",
    kind: "script",
    destination: SCRIPT_PATH,
    runsWithoutArgument: true,
    runsDirectly: false,
  };
  writeLinks([...existing, todoLink]);

  writeFileSync(
    join(SUPPORT, ".vors-todo-install.json"),
    `${JSON.stringify(
      {
        installedAt: new Date().toISOString(),
        store: join(SUPPORT, "Todos.json"),
        script: SCRIPT_PATH,
        linkName: "todo",
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    JSON.stringify(
      {
        store: join(SUPPORT, "Todos.json"),
        script: SCRIPT_PATH,
        commandBarEnabled: true,
        link: todoLink,
      },
      null,
      2,
    ),
  );

  restartApp();
  console.log("Vorssaint restarted with Command Bar todo script registered.");
}

main();
