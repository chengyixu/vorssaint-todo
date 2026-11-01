# vorssaint-todo

Local todo list shared by **humans** and **agents** (CLI + skill), designed so a future
[Vorssaint](https://github.com/vorssaint/vorssaint-utils) feature can adopt the same
document schema.

Upstream proposal: [#3764](https://github.com/vorssaint/vorssaint-utils/issues/3764).

## Quick start

```bash
bun install
bun test
bun run guards
bun link   # optional: puts `vors-todo` on PATH

VORSSAINT_TODO_SOURCE=agent vors-todo add "Ship the skill" --tags agent --json
vors-todo list --status open --json
```

Default store: `~/Library/Application Support/com.vorssaint.todo/Todos.json`.

## Layout

See [HOW-IT-WORKS.md](HOW-IT-WORKS.md) and [docs/adr/0001-architecture.md](docs/adr/0001-architecture.md).
Agent instructions: [skills/vorssaint-todo/SKILL.md](skills/vorssaint-todo/SKILL.md).

## License

GPL-3.0-or-later (compatible with Vorssaint if upstream later vendors the contract).
