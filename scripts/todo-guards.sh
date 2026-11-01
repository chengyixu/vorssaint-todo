#!/usr/bin/env bash
# Project-specific guards for vorssaint-todo (layered on scripts/repo-guards.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
hard_failures=0
red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }

fail() {
  red "✗ HARD: $1"
  echo "    → $2"
  hard_failures=$((hard_failures + 1))
}

pass() { green "✓ $1"; }

echo "── todo-guards ────────────────────────────────────────────"

# Domain must stay free of Node/Bun I/O and CLI guts.
if git -C "$ROOT" grep -nIE 'node:fs|node:path|bun:|process\.env|stdout|stderr' -- 'src/todo/domain/**' >/tmp/todo-guard-domain 2>/dev/null; then
  fail "domain layer I/O / env coupling" "Keep fs/env/cli out of src/todo/domain (see hits below)"
  sed 's/^/    /' /tmp/todo-guard-domain | head -20
else
  pass "domain has no fs/env/cli imports"
fi

# Application must not import infrastructure concretely.
if git -C "$ROOT" grep -nIE 'todo/infrastructure|FileTodoRepository' -- 'src/todo/application/**' >/tmp/todo-guard-app 2>/dev/null; then
  fail "application imports infrastructure" "Depend on TodoRepository only"
  sed 's/^/    /' /tmp/todo-guard-app | head -20
else
  pass "application depends on repository port only"
fi

# Schema lives in exactly one home.
schema_hits="$(git -C "$ROOT" grep -l 'TODO_DOCUMENT_VERSION' -- '*.ts' ':!src/shared/schema.ts' ':!src/todo/domain/todo.ts' ':!tests/**' || true)"
# domain may import the constant; forbidding a second DTO definition is the real rule.
if git -C "$ROOT" grep -nIE 'interface TodoItemDTO|interface TodoDocumentDTO' -- ':!src/shared/schema.ts' >/tmp/todo-guard-dto 2>/dev/null; then
  fail "Todo DTO redefined outside shared/schema.ts" "Import from src/shared/schema.ts — one contract only"
  sed 's/^/    /' /tmp/todo-guard-dto | head -20
else
  pass "Todo DTOs defined only in shared/schema.ts"
fi

echo "────────────────────────────────────────────────────────────"
if [ "$hard_failures" -gt 0 ]; then
  red "todo-guards FAILED: $hard_failures hard rule(s)"
  exit 1
fi
green "todo-guards passed."
exit 0
