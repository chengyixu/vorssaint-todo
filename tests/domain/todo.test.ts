import { describe, expect, test } from "bun:test";
import {
  DomainError,
  addItem,
  completeTodo,
  createTodo,
  emptyDocument,
  fromDTO,
  reopenTodo,
  sanitizeTitle,
  toDTO,
  updateTodo,
} from "../../src/todo/domain/todo.ts";

const NOW = new Date("2026-11-01T12:00:00.000Z");

describe("todo domain", () => {
  test("rejects empty titles", () => {
    expect(() => sanitizeTitle("   ")).toThrow(DomainError);
  });

  test("create → complete → reopen round trip preserves id and clears completedAt", () => {
    const created = createTodo({
      id: "t1",
      title: "Ship todos",
      source: "agent",
      tags: ["work", "Work"],
      now: NOW,
    });
    expect(created.status).toBe("open");
    expect(created.tags).toEqual(["work"]);

    const done = completeTodo(created, new Date("2026-11-01T13:00:00.000Z"));
    expect(done.status).toBe("done");
    expect(done.completedAt?.toISOString()).toBe("2026-11-01T13:00:00.000Z");

    const reopened = reopenTodo(done, new Date("2026-11-01T14:00:00.000Z"));
    expect(reopened.status).toBe("open");
    expect(reopened.completedAt).toBeNull();
    expect(reopened.id).toBe("t1");
  });

  test("document DTO round trip is lossless for valid data", () => {
    const item = createTodo({
      id: "a",
      title: "One",
      source: "cli",
      notes: "n",
      tags: ["x"],
      now: NOW,
    });
    const document = addItem(emptyDocument(), item);
    const restored = fromDTO(toDTO(document));
    expect(restored).toEqual(document);
  });

  test("update mutates only provided fields", () => {
    const item = createTodo({
      id: "b",
      title: "Old",
      source: "human",
      notes: "keep",
      tags: ["a"],
      now: NOW,
    });
    const next = updateTodo(item, { title: "New" }, new Date("2026-11-01T15:00:00.000Z"));
    expect(next.title).toBe("New");
    expect(next.notes).toBe("keep");
    expect(next.tags).toEqual(["a"]);
  });
});
