import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../../src/interfaces/cli/main.ts";

const dirs: string[] = [];

afterEach(async () => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

async function withStore(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vors-todo-"));
  dirs.push(dir);
  return join(dir, "Todos.json");
}

async function run(
  store: string,
  argv: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  const originalOut = process.stdout.write;
  const originalErr = process.stderr.write;
  let stdout = "";
  let stderr = "";
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof process.stderr.write;
  try {
    const code = await main(["--store", store, ...argv]);
    return { code, stdout, stderr };
  } finally {
    process.stdout.write = originalOut;
    process.stderr.write = originalErr;
  }
}

describe("vors-todo CLI", () => {
  test("add + list --json round trips through the file store", async () => {
    const store = await withStore();
    const added = await run(store, [
      "add",
      "Write skill",
      "--tags",
      "agent,cli",
      "--source",
      "agent",
      "--json",
    ]);
    expect(added.code).toBe(0);
    const item = JSON.parse(added.stdout);
    expect(item.title).toBe("Write skill");
    expect(item.source).toBe("agent");

    const listed = await run(store, ["list", "--json"]);
    expect(listed.code).toBe(0);
    const items = JSON.parse(listed.stdout);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(item.id);

    const onDisk = JSON.parse(await readFile(store, "utf8"));
    expect(onDisk.version).toBe(1);
    expect(onDisk.items[0].title).toBe("Write skill");
  });

  test("complete then reopen updates status on disk", async () => {
    const store = await withStore();
    const added = await run(store, ["add", "Flip", "--json"]);
    const id = JSON.parse(added.stdout).id as string;

    const done = await run(store, ["complete", id, "--json"]);
    expect(JSON.parse(done.stdout).status).toBe("done");

    const open = await run(store, ["reopen", id, "--json"]);
    expect(JSON.parse(open.stdout).status).toBe("open");
    expect(JSON.parse(open.stdout).completedAt).toBeNull();
  });

  test("missing id fails with structured JSON error", async () => {
    const store = await withStore();
    const result = await run(store, ["get", "missing", "--json"]);
    expect(result.code).toBe(2);
    const payload = JSON.parse(result.stderr);
    expect(payload.error.code).toBe("not_found");
  });
});
