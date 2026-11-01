import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { TodoDocumentDTO } from "../../shared/schema.ts";
import type { TodoRepository } from "../domain/repository.ts";
import {
  DomainError,
  emptyDocument,
  fromDTO,
  toDTO,
  type TodoDocument,
} from "../domain/todo.ts";

/**
 * Atomic JSON store. A failed read never authorizes a later overwrite of a
 * corrupt file with an empty document — callers must handle the error.
 */
export class FileTodoRepository implements TodoRepository {
  constructor(private readonly path: string) {}

  async load(): Promise<TodoDocument> {
    let raw: string;
    try {
      raw = await readFile(this.path, "utf8");
    } catch (error) {
      if (isNotFound(error)) return emptyDocument();
      throw error;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new DomainError(
        "corrupt_document",
        `Todo store is not valid JSON: ${this.path}`,
      );
    }
    return fromDTO(parsed as TodoDocumentDTO);
  }

  async save(document: TodoDocument): Promise<void> {
    const dto = toDTO(document);
    const payload = `${JSON.stringify(dto, null, 2)}\n`;
    await mkdir(dirname(this.path), { recursive: true });
    const tempPath = `${this.path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, payload, { encoding: "utf8", mode: 0o600 });
    await rename(tempPath, this.path);
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
