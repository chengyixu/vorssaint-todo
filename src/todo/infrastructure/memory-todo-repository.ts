import type { TodoRepository } from "../domain/repository.ts";
import { emptyDocument, type TodoDocument } from "../domain/todo.ts";

/** In-memory port for hermetic tests — implements the same contract as the file store. */
export class MemoryTodoRepository implements TodoRepository {
  private document: TodoDocument = emptyDocument();

  async load(): Promise<TodoDocument> {
    return {
      version: this.document.version,
      items: this.document.items.map((item) => ({ ...item, tags: [...item.tags] })),
    };
  }

  async save(document: TodoDocument): Promise<void> {
    this.document = {
      version: document.version,
      items: document.items.map((item) => ({ ...item, tags: [...item.tags] })),
    };
  }
}
