import {
  MAX_ITEMS,
  MAX_NOTES_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  MAX_TITLE_LENGTH,
  TODO_DOCUMENT_VERSION,
  type TodoDocumentDTO,
  type TodoItemDTO,
  type TodoSource,
  type TodoStatus,
} from "../../shared/schema.ts";

export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export interface TodoItem {
  readonly id: string;
  readonly title: string;
  readonly status: TodoStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
  readonly notes: string | null;
  readonly source: TodoSource;
  readonly tags: readonly string[];
}

export interface TodoDocument {
  readonly version: typeof TODO_DOCUMENT_VERSION;
  readonly items: readonly TodoItem[];
}

export function emptyDocument(): TodoDocument {
  return { version: TODO_DOCUMENT_VERSION, items: [] };
}

export function sanitizeTitle(raw: string): string {
  const title = raw.replace(/\s+/g, " ").trim();
  if (title.length === 0) {
    throw new DomainError("empty_title", "Todo title must not be empty");
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new DomainError(
      "title_too_long",
      `Todo title exceeds ${MAX_TITLE_LENGTH} characters`,
    );
  }
  return title;
}

export function sanitizeNotes(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const notes = raw.trim();
  if (notes.length === 0) return null;
  if (notes.length > MAX_NOTES_LENGTH) {
    throw new DomainError(
      "notes_too_long",
      `Todo notes exceed ${MAX_NOTES_LENGTH} characters`,
    );
  }
  return notes;
}

export function sanitizeTags(raw: readonly string[] | undefined): string[] {
  if (raw === undefined) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const entry of raw) {
    const tag = entry.replace(/\s+/g, " ").trim().toLowerCase();
    if (tag.length === 0) continue;
    if (tag.length > MAX_TAG_LENGTH) {
      throw new DomainError(
        "tag_too_long",
        `Tag exceeds ${MAX_TAG_LENGTH} characters`,
      );
    }
    if (seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length > MAX_TAGS) {
      throw new DomainError("too_many_tags", `At most ${MAX_TAGS} tags allowed`);
    }
  }
  return tags;
}

export function createTodo(input: {
  id: string;
  title: string;
  source: TodoSource;
  notes?: string | null;
  tags?: readonly string[];
  now: Date;
}): TodoItem {
  return {
    id: input.id,
    title: sanitizeTitle(input.title),
    status: "open",
    createdAt: input.now,
    updatedAt: input.now,
    completedAt: null,
    notes: sanitizeNotes(input.notes),
    source: input.source,
    tags: sanitizeTags(input.tags),
  };
}

export function completeTodo(item: TodoItem, now: Date): TodoItem {
  if (item.status === "done") return item;
  return {
    ...item,
    status: "done",
    updatedAt: now,
    completedAt: now,
  };
}

export function reopenTodo(item: TodoItem, now: Date): TodoItem {
  if (item.status === "open") return item;
  return {
    ...item,
    status: "open",
    updatedAt: now,
    completedAt: null,
  };
}

export function updateTodo(
  item: TodoItem,
  patch: {
    title?: string;
    notes?: string | null;
    tags?: readonly string[];
  },
  now: Date,
): TodoItem {
  const next: TodoItem = {
    ...item,
    title: patch.title === undefined ? item.title : sanitizeTitle(patch.title),
    notes:
      patch.notes === undefined ? item.notes : sanitizeNotes(patch.notes),
    tags: patch.tags === undefined ? [...item.tags] : sanitizeTags(patch.tags),
    updatedAt: now,
  };
  return next;
}

export function addItem(document: TodoDocument, item: TodoItem): TodoDocument {
  if (document.items.length >= MAX_ITEMS) {
    throw new DomainError(
      "too_many_items",
      `At most ${MAX_ITEMS} todos are allowed`,
    );
  }
  if (document.items.some((existing) => existing.id === item.id)) {
    throw new DomainError("duplicate_id", `Todo id already exists: ${item.id}`);
  }
  return {
    version: TODO_DOCUMENT_VERSION,
    items: [...document.items, item],
  };
}

export function replaceItem(
  document: TodoDocument,
  item: TodoItem,
): TodoDocument {
  const index = document.items.findIndex((existing) => existing.id === item.id);
  if (index < 0) {
    throw new DomainError("not_found", `Todo not found: ${item.id}`);
  }
  const items = document.items.slice();
  items[index] = item;
  return { version: TODO_DOCUMENT_VERSION, items };
}

export function removeItem(
  document: TodoDocument,
  id: string,
): TodoDocument {
  const items = document.items.filter((item) => item.id !== id);
  if (items.length === document.items.length) {
    throw new DomainError("not_found", `Todo not found: ${id}`);
  }
  return { version: TODO_DOCUMENT_VERSION, items };
}

export function findItem(
  document: TodoDocument,
  id: string,
): TodoItem | undefined {
  return document.items.find((item) => item.id === id);
}

export function toDTO(document: TodoDocument): TodoDocumentDTO {
  return {
    version: TODO_DOCUMENT_VERSION,
    items: document.items.map(itemToDTO),
  };
}

export function itemToDTO(item: TodoItem): TodoItemDTO {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    completedAt: item.completedAt ? item.completedAt.toISOString() : null,
    notes: item.notes,
    source: item.source,
    tags: [...item.tags],
  };
}

export function fromDTO(dto: TodoDocumentDTO): TodoDocument {
  if (dto.version !== TODO_DOCUMENT_VERSION) {
    throw new DomainError(
      "unsupported_version",
      `Unsupported document version: ${String(dto.version)}`,
    );
  }
  if (!Array.isArray(dto.items)) {
    throw new DomainError("corrupt_document", "items must be an array");
  }
  if (dto.items.length > MAX_ITEMS) {
    throw new DomainError("too_many_items", `At most ${MAX_ITEMS} todos are allowed`);
  }
  const seen = new Set<string>();
  const items: TodoItem[] = [];
  for (const raw of dto.items) {
    const item = itemFromDTO(raw);
    if (seen.has(item.id)) {
      throw new DomainError("duplicate_id", `Duplicate todo id: ${item.id}`);
    }
    seen.add(item.id);
    items.push(item);
  }
  return { version: TODO_DOCUMENT_VERSION, items };
}

function itemFromDTO(raw: TodoItemDTO): TodoItem {
  if (typeof raw.id !== "string" || raw.id.trim() === "") {
    throw new DomainError("corrupt_item", "Todo id is required");
  }
  if (raw.status !== "open" && raw.status !== "done") {
    throw new DomainError("corrupt_item", `Invalid status: ${String(raw.status)}`);
  }
  if (raw.source !== "human" && raw.source !== "agent" && raw.source !== "cli") {
    throw new DomainError("corrupt_item", `Invalid source: ${String(raw.source)}`);
  }
  const createdAt = parseInstant(raw.createdAt, "createdAt");
  const updatedAt = parseInstant(raw.updatedAt, "updatedAt");
  const completedAt =
    raw.completedAt === null ? null : parseInstant(raw.completedAt, "completedAt");
  if (raw.status === "done" && completedAt === null) {
    throw new DomainError("corrupt_item", "done todos require completedAt");
  }
  if (raw.status === "open" && completedAt !== null) {
    throw new DomainError("corrupt_item", "open todos must not have completedAt");
  }
  return {
    id: raw.id,
    title: sanitizeTitle(raw.title),
    status: raw.status,
    createdAt,
    updatedAt,
    completedAt,
    notes: sanitizeNotes(raw.notes),
    source: raw.source,
    tags: sanitizeTags(raw.tags),
  };
}

function parseInstant(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new DomainError("corrupt_item", `Invalid ${field}: ${value}`);
  }
  return date;
}
