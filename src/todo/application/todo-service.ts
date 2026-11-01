import type { TodoSource, TodoStatus } from "../../shared/schema.ts";
import type { TodoRepository } from "../domain/repository.ts";
import {
  DomainError,
  addItem,
  completeTodo,
  createTodo,
  findItem,
  itemToDTO,
  removeItem,
  reopenTodo,
  replaceItem,
  toDTO,
  updateTodo,
  type TodoDocument,
  type TodoItem,
} from "../domain/todo.ts";

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

export interface ListFilter {
  status?: TodoStatus;
  tag?: string;
  source?: TodoSource;
}

export class TodoService {
  constructor(
    private readonly repository: TodoRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async list(filter: ListFilter = {}): Promise<ReturnType<typeof itemToDTO>[]> {
    const document = await this.repository.load();
    return document.items
      .filter((item) => matches(item, filter))
      .map(itemToDTO);
  }

  async get(id: string): Promise<ReturnType<typeof itemToDTO>> {
    const document = await this.repository.load();
    const item = requireItem(document, id);
    return itemToDTO(item);
  }

  async add(input: {
    title: string;
    source: TodoSource;
    notes?: string | null;
    tags?: readonly string[];
  }): Promise<ReturnType<typeof itemToDTO>> {
    const document = await this.repository.load();
    const item = createTodo({
      id: this.ids.next(),
      title: input.title,
      source: input.source,
      now: this.clock.now(),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
    });
    await this.repository.save(addItem(document, item));
    return itemToDTO(item);
  }

  async complete(id: string): Promise<ReturnType<typeof itemToDTO>> {
    return this.mutate(id, (item) => completeTodo(item, this.clock.now()));
  }

  async reopen(id: string): Promise<ReturnType<typeof itemToDTO>> {
    return this.mutate(id, (item) => reopenTodo(item, this.clock.now()));
  }

  async update(
    id: string,
    patch: { title?: string; notes?: string | null; tags?: readonly string[] },
  ): Promise<ReturnType<typeof itemToDTO>> {
    return this.mutate(id, (item) => updateTodo(item, patch, this.clock.now()));
  }

  async delete(id: string): Promise<void> {
    const document = await this.repository.load();
    await this.repository.save(removeItem(document, id));
  }

  async document(): Promise<ReturnType<typeof toDTO>> {
    return toDTO(await this.repository.load());
  }

  private async mutate(
    id: string,
    transform: (item: TodoItem) => TodoItem,
  ): Promise<ReturnType<typeof itemToDTO>> {
    const document = await this.repository.load();
    const current = requireItem(document, id);
    const next = transform(current);
    await this.repository.save(replaceItem(document, next));
    return itemToDTO(next);
  }
}

function requireItem(document: TodoDocument, id: string): TodoItem {
  const item = findItem(document, id);
  if (!item) {
    throw new DomainError("not_found", `Todo not found: ${id}`);
  }
  return item;
}

function matches(item: TodoItem, filter: ListFilter): boolean {
  if (filter.status !== undefined && item.status !== filter.status) return false;
  if (filter.source !== undefined && item.source !== filter.source) return false;
  if (filter.tag !== undefined) {
    const needle = filter.tag.trim().toLowerCase();
    if (!item.tags.includes(needle)) return false;
  }
  return true;
}
