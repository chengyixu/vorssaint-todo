# Sector: todo/domain

## Purpose
Pure todo aggregate rules and the `TodoRepository` port.

## Schema
Uses DTOs from `src/shared/schema.ts`. Domain entities use `Date` in memory.

## Dependencies
→ `shared` only. No fs, env, or CLI.

## Invariants
- Empty titles rejected.
- Done items always have `completedAt`; open items never do.
- At most `MAX_ITEMS` todos.
