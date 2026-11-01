import type { TodoDocument } from "./todo.ts";

/** Persistence port — application depends on this contract, never on file guts. */
export interface TodoRepository {
  load(): Promise<TodoDocument>;
  save(document: TodoDocument): Promise<void>;
}
