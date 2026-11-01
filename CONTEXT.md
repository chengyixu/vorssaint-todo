# CONTEXT — vorssaint-todo

## What this is

Companion package for a shared **local todo list** usable by humans and agents.
Upstream product discussion: [vorssaint/vorssaint-utils#3764](https://github.com/vorssaint/vorssaint-utils/issues/3764).

Until Vorssaint lands an in-app Todo feature, this repo owns:

- the typed document schema (`src/shared/schema.ts`)
- domain + application services
- `vors-todo` CLI
- OwlSpace/agent skill under `skills/vorssaint-todo/`

## Env / paths

| Variable | Role |
|---|---|
| `VORSSAINT_TODO_STORE` | Absolute path to `Todos.json` (tests / alternate location) |
| `VORSSAINT_TODO_SOURCE` | Default `source` for `add` when not passed: `agent` \| `human` \| (else inferred) |

Default store (macOS):

`~/Library/Application Support/com.vorssaint.todo/Todos.json`

When upstream adopts the feature, point `VORSSAINT_TODO_STORE` at their Application Support path so CLI/skill keep working against the same file.

## Deploy parity

There is no server deploy. "Production" means the user's local store + a linked `vors-todo` binary.

Sanity:

```bash
bun install
bun test
bun run guards
bun run src/interfaces/cli/main.ts path --json
```

## Resource ownership

- One JSON file per machine user (unless overridden).
- Writes are atomic (`*.tmp` then rename).
- Mode `0600` on write.
