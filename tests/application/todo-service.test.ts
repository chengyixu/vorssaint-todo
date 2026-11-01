import { describe, expect, test } from "bun:test";
import { TodoService } from "../../src/todo/application/todo-service.ts";
import { DomainError } from "../../src/todo/domain/todo.ts";
import { MemoryTodoRepository } from "../../src/todo/infrastructure/memory-todo-repository.ts";

class FixedClock {
  constructor(private current: Date) {}
  now(): Date {
    return this.current;
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

class SeqIds {
  private n = 0;
  next(): string {
    this.n += 1;
    return `id-${this.n}`;
  }
}

function service() {
  const clock = new FixedClock(new Date("2026-11-01T10:00:00.000Z"));
  const ids = new SeqIds();
  const repo = new MemoryTodoRepository();
  return {
    clock,
    svc: new TodoService(repo, clock, ids),
  };
}

describe("TodoService", () => {
  test("add and list filter by status and tag", async () => {
    const { svc, clock } = service();
    await svc.add({ title: "Open work", source: "agent", tags: ["work"] });
    clock.advance(1000);
    const second = await svc.add({
      title: "Errands",
      source: "human",
      tags: ["life"],
    });
    await svc.complete(second.id);

    const openWork = await svc.list({ status: "open", tag: "work" });
    expect(openWork).toHaveLength(1);
    expect(openWork[0]?.title).toBe("Open work");

    const done = await svc.list({ status: "done" });
    expect(done).toHaveLength(1);
    expect(done[0]?.id).toBe(second.id);
  });

  test("delete removes the item and get then fails", async () => {
    const { svc } = service();
    const created = await svc.add({ title: "Temp", source: "cli" });
    await svc.delete(created.id);
    await expect(svc.get(created.id)).rejects.toBeInstanceOf(DomainError);
  });

  test("complete is idempotent", async () => {
    const { svc, clock } = service();
    const created = await svc.add({ title: "Once", source: "agent" });
    clock.advance(5_000);
    const first = await svc.complete(created.id);
    clock.advance(5_000);
    const second = await svc.complete(created.id);
    expect(second.completedAt).toBe(first.completedAt);
  });
});
