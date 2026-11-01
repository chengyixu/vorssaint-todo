# Sector: todo/infrastructure

## Purpose
`FileTodoRepository` (atomic JSON) and `MemoryTodoRepository` (tests).

## Dependencies
→ `todo/domain`, `shared`.

## Invariants
Corrupt JSON throws; missing file → empty document. Never silently wipe corrupt data.
