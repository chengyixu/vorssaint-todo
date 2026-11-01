# ADR 0001 — Layered companion with one document schema

## Status

Accepted (2026-11-01)

## Context

Vorssaint features are compiled into `vorssaint-utils` (no third-party plugin runtime).
Contributing asks for an issue before a substantial feature. Agents still need a CLI/skill
*now*, and humans need the same list.

Duplicating a todo schema in chat memory, a skill, and a future Swift UI would create
duplication-drift.

## Decision

1. Ship a **greenfield companion** (`vorssaint-todo`) with DDD layers:
   `domain` → `application` → `infrastructure`, plus a thin `interfaces/cli`.
2. Put the persistence/wire DTO in **`src/shared/schema.ts` only**.
3. Open upstream issue #3764; once accepted, the in-app feature must import / mirror that
   schema rather than invent a second one.
4. Agent access is the CLI wrapped by `skills/vorssaint-todo` — not a parallel store.

## Consequences

- Works before upstream merges.
- Upstream PR can stay focused on Swift UI + `AppFeature` wiring while reusing the contract.
- GPL-3.0-or-later to stay license-compatible with Vorssaint if code is later vendored.
