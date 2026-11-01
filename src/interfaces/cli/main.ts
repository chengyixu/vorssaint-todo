#!/usr/bin/env bun
import { randomUUID } from "node:crypto";
import { resolveStorePath } from "../../shared/paths.ts";
import type { TodoSource, TodoStatus } from "../../shared/schema.ts";
import { TodoService } from "../../todo/application/todo-service.ts";
import { DomainError } from "../../todo/domain/todo.ts";
import { FileTodoRepository } from "../../todo/infrastructure/file-todo-repository.ts";

interface ParsedArgs {
  command: string;
  flags: Record<string, string | boolean>;
  positionals: string[];
  json: boolean;
}

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  if (args.command === "help" || args.command === "--help" || args.command === "-h") {
    printHelp();
    return 0;
  }

  const storePath =
    typeof args.flags.store === "string" ? args.flags.store : resolveStorePath();
  const service = new TodoService(
    new FileTodoRepository(storePath),
    { now: () => new Date() },
    { next: () => randomUUID() },
  );

  try {
    const result = await dispatch(service, args);
    if (args.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else if (result !== undefined) {
      writeHuman(result);
    }
    return 0;
  } catch (error) {
    return fail(error, args.json);
  }
}

async function dispatch(service: TodoService, args: ParsedArgs): Promise<unknown> {
  switch (args.command) {
    case "list": {
      const status = optionalStatus(args.flags.status);
      const tag = optionalString(args.flags.tag);
      const source = optionalSource(args.flags.source);
      return service.list({
        ...(status !== undefined ? { status } : {}),
        ...(tag !== undefined ? { tag } : {}),
        ...(source !== undefined ? { source } : {}),
      });
    }
    case "get": {
      const id = requirePositional(args, 0, "id");
      return service.get(id);
    }
    case "add": {
      const title =
        optionalString(args.flags.title) ??
        requirePositional(args, 0, "title");
      const source = optionalSource(args.flags.source) ?? inferSource();
      const notes = optionalNullableString(args.flags.notes);
      const tags = parseTags(args.flags.tags);
      return service.add({
        title,
        source,
        ...(notes !== undefined ? { notes } : {}),
        ...(tags !== undefined ? { tags } : {}),
      });
    }
    case "complete":
      return service.complete(requirePositional(args, 0, "id"));
    case "reopen":
      return service.reopen(requirePositional(args, 0, "id"));
    case "update": {
      const id = requirePositional(args, 0, "id");
      const patch: {
        title?: string;
        notes?: string | null;
        tags?: string[];
      } = {};
      const title = optionalString(args.flags.title);
      if (title !== undefined) patch.title = title;
      if ("notes" in args.flags) {
        patch.notes = optionalNullableString(args.flags.notes) ?? null;
      }
      if ("tags" in args.flags) {
        patch.tags = parseTags(args.flags.tags) ?? [];
      }
      if (Object.keys(patch).length === 0) {
        throw new DomainError("empty_patch", "Provide --title, --notes, and/or --tags");
      }
      return service.update(id, patch);
    }
    case "delete": {
      const id = requirePositional(args, 0, "id");
      await service.delete(id);
      return { deleted: id };
    }
    case "path":
      return {
        store:
          typeof args.flags.store === "string"
            ? args.flags.store
            : resolveStorePath(),
      };
    case "export":
      return service.document();
    default:
      throw new DomainError(
        "unknown_command",
        `Unknown command: ${args.command || "(none)"}. Try vors-todo help`,
      );
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  let command = "help";
  let sawCommand = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (token === "--json") {
      flags.json = true;
      continue;
    }
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
      continue;
    }
    if (!sawCommand) {
      command = token;
      sawCommand = true;
      continue;
    }
    positionals.push(token);
  }

  return {
    command,
    flags,
    positionals,
    json: flags.json === true,
  };
}

function requirePositional(args: ParsedArgs, index: number, name: string): string {
  const value = args.positionals[index];
  if (value === undefined || value.trim() === "") {
    throw new DomainError("missing_arg", `Missing required argument: ${name}`);
  }
  return value;
}

function optionalString(value: string | boolean | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  return value;
}

function optionalNullableString(
  value: string | boolean | undefined,
): string | null | undefined {
  if (value === true) return null;
  if (typeof value !== "string") return undefined;
  return value;
}

function optionalStatus(value: string | boolean | undefined): TodoStatus | undefined {
  if (typeof value !== "string") return undefined;
  if (value !== "open" && value !== "done") {
    throw new DomainError("invalid_status", `status must be open|done, got ${value}`);
  }
  return value;
}

function optionalSource(value: string | boolean | undefined): TodoSource | undefined {
  if (typeof value !== "string") return undefined;
  if (value !== "human" && value !== "agent" && value !== "cli") {
    throw new DomainError(
      "invalid_source",
      `source must be human|agent|cli, got ${value}`,
    );
  }
  return value;
}

function parseTags(value: string | boolean | undefined): string[] | undefined {
  if (typeof value !== "string") return undefined;
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function inferSource(): TodoSource {
  if (process.env.VORSSAINT_TODO_SOURCE === "agent") return "agent";
  if (process.env.VORSSAINT_TODO_SOURCE === "human") return "human";
  if (process.stdin.isTTY === false) return "agent";
  return "cli";
}

function writeHuman(result: unknown): void {
  if (Array.isArray(result)) {
    if (result.length === 0) {
      process.stdout.write("(no todos)\n");
      return;
    }
    for (const item of result as Array<Record<string, unknown>>) {
      const mark = item.status === "done" ? "[x]" : "[ ]";
      process.stdout.write(`${mark} ${String(item.id)}  ${String(item.title)}\n`);
    }
    return;
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function fail(error: unknown, json: boolean): number {
  if (error instanceof DomainError) {
    if (json) {
      process.stderr.write(
        `${JSON.stringify({ error: { code: error.code, message: error.message } })}\n`,
      );
    } else {
      process.stderr.write(`error(${error.code}): ${error.message}\n`);
    }
    return error.code === "not_found" ? 2 : 1;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (json) {
    process.stderr.write(`${JSON.stringify({ error: { code: "internal", message } })}\n`);
  } else {
    process.stderr.write(`error: ${message}\n`);
  }
  return 1;
}

function printHelp(): void {
  process.stdout.write(`vors-todo — shared local todos for humans and agents

Usage:
  vors-todo list [--status open|done] [--tag NAME] [--source human|agent|cli] [--json]
  vors-todo get <id> [--json]
  vors-todo add "title" [--notes TEXT] [--tags a,b] [--source human|agent|cli] [--json]
  vors-todo complete <id> [--json]
  vors-todo reopen <id> [--json]
  vors-todo update <id> [--title TEXT] [--notes TEXT] [--tags a,b] [--json]
  vors-todo delete <id> [--json]
  vors-todo export [--json]
  vors-todo path [--json]

Store:
  Default: ~/Library/Application Support/com.vorssaint.todo/Todos.json
  Override: --store PATH or VORSSAINT_TODO_STORE
  Agent default source: VORSSAINT_TODO_SOURCE=agent
`);
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    },
  );
}

export { main, parseArgs };
