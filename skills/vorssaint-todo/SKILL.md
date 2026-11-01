---
name: vorssaint-todo
description: >-
  Manage the shared Vorssaint local todo list from an agent session via the
  vors-todo CLI. Use when the user or agent needs to add, list, complete,
  reopen, update, or delete todos that humans also see in the companion store
  (and later in the Vorssaint Todo feature).
---

# Vorssaint Todo (agent skill)

Humans and agents share **one** local document:

`~/Library/Application Support/com.vorssaint.todo/Todos.json`

Never invent a second store. Prefer the CLI below; do not hand-edit JSON unless
recovering a corrupt file with the user watching.

## Setup

From the companion repo (or a linked install):

```bash
cd /Users/wilsonxu/Developer/vorssaint-todo
bun install
bun link    # exposes `vors-todo` on PATH for this user
```

Override the store with `VORSSAINT_TODO_STORE=/path/to/Todos.json` for tests.
Set `VORSSAINT_TODO_SOURCE=agent` in agent sessions so `source` is recorded.

## Commands agents should use

Always pass `--json` so you parse structured output.

```bash
VORSSAINT_TODO_SOURCE=agent vors-todo list --json
VORSSAINT_TODO_SOURCE=agent vors-todo list --status open --json
VORSSAINT_TODO_SOURCE=agent vors-todo add "Title" --tags work,agent --json
VORSSAINT_TODO_SOURCE=agent vors-todo get <id> --json
VORSSAINT_TODO_SOURCE=agent vors-todo complete <id> --json
VORSSAINT_TODO_SOURCE=agent vors-todo reopen <id> --json
VORSSAINT_TODO_SOURCE=agent vors-todo update <id> --title "New" --json
VORSSAINT_TODO_SOURCE=agent vors-todo delete <id> --json
```

Exit codes: `0` ok, `2` not found, `1` other domain/usage error. JSON errors look
like `{ "error": { "code": "not_found", "message": "..." } }` on stderr.

## Rules

1. **One source of truth** — the CLI document schema in `src/shared/schema.ts`.
2. Prefer updating an existing open todo over creating duplicates with the same title.
3. Do not delete completed history unless the user asks; prefer leaving `done` items.
4. When summarizing work, `list --status open --json` first so you do not restate stale plans.
