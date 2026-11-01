/**
 * Wire / persistence contract for the todo document.
 * ONE home — CLI, skill, and any future Vorssaint UI import this shape.
 * Do not redefine these fields elsewhere.
 */
export const TODO_DOCUMENT_VERSION = 1 as const;

export type TodoStatus = "open" | "done";
export type TodoSource = "human" | "agent" | "cli";

export interface TodoItemDTO {
  id: string;
  title: string;
  status: TodoStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  notes: string | null;
  source: TodoSource;
  tags: string[];
}

export interface TodoDocumentDTO {
  version: typeof TODO_DOCUMENT_VERSION;
  items: TodoItemDTO[];
}

export const MAX_TITLE_LENGTH = 200;
export const MAX_NOTES_LENGTH = 4_000;
export const MAX_TAG_LENGTH = 40;
export const MAX_TAGS = 16;
export const MAX_ITEMS = 500;
