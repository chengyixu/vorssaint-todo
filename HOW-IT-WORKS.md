# How it works

```
src/
  shared/                 # ONE schema + default paths
  todo/
    domain/               # pure rules + TodoRepository port
    application/          # TodoService use cases
    infrastructure/       # FileTodoRepository + MemoryTodoRepository
  interfaces/cli/         # vors-todo binary
skills/vorssaint-todo/    # agent instructions wrapping the CLI
```

Flow: CLI (or skill) → `TodoService` → `TodoRepository` → `Todos.json`.

Humans can use the CLI today; later a Vorssaint panel should call the same document
shape (issue #3764).

## Commands

```bash
bun install
bun test
bun run guards
bun run src/interfaces/cli/main.ts add "Example" --json
bun run src/interfaces/cli/main.ts list --json
```
