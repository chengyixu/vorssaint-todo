#!/usr/bin/env bash
#
# repo-guards.sh — PROJECT-AGNOSTIC static guards. Copy into any repo's scripts/
# directory and run it in CI (and before commits). It turns "things that should
# never reach a shared branch" into a check that fails loudly, instead of relying
# on a human reviewer to catch them later.
#
# Why: most regressions in agent-driven development are re-violations of an
# invariant that lived only as prose (a doc, a CLAUDE.md rule, tribal knowledge).
# Prose gets skimmed; a failing check does not. This is the universal half of
# that idea — the checks here apply to ANY language/repo. Add repo-specific
# checks in a sibling script (e.g. k1-guards.sh) layered on top.
#
# Design contract:
#   HARD (exit 1): things that are ALWAYS a mistake on a shared branch and have
#                  near-zero false positives. Blocks merge.
#   WARN (exit 0): real debt worth surfacing. Never blocks; listed for triage.
#
# Pure bash + grep, no dependencies. Uses `git grep` over tracked files when in a
# git repo (so build/, node_modules/, vendored dirs are skipped automatically).
#
# Usage:  bash repo-guards.sh [repo-root]
#         (default root = git toplevel, else current dir)

set -uo pipefail

ROOT="${1:-}"
if [ -z "$ROOT" ]; then
  ROOT="$(git -C . rev-parse --show-toplevel 2>/dev/null || pwd)"
fi

IS_GIT=0
git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1 && IS_GIT=1

# Directories never worth scanning even if accidentally tracked.
EXC=(
  ':(exclude)**/node_modules/**' ':(exclude)**/build/**' ':(exclude)**/dist/**'
  ':(exclude)**/vendor/**' ':(exclude)**/Pods/**' ':(exclude)**/.gradle/**'
  ':(exclude)**/DerivedData/**' ':(exclude)**/__pycache__/**' ':(exclude)**/.venv/**'
)
GREP_EXCLUDES="--exclude-dir=.git --exclude-dir=node_modules --exclude-dir=build --exclude-dir=dist --exclude-dir=vendor --exclude-dir=Pods --exclude-dir=.gradle --exclude-dir=DerivedData --exclude-dir=__pycache__ --exclude-dir=.venv"

# scan <regex> [pathspec-globs...] → matching "file:line:text" lines (text files only)
scan() {
  local re="$1"; shift
  if [ "$IS_GIT" = 1 ]; then
    if [ "$#" -gt 0 ]; then
      git -C "$ROOT" grep -nIE "$re" -- "$@" "${EXC[@]}" 2>/dev/null
    else
      git -C "$ROOT" grep -nIE "$re" -- . "${EXC[@]}" 2>/dev/null
    fi
  else
    # shellcheck disable=SC2086
    grep -rnIE $GREP_EXCLUDES "$re" "$ROOT" 2>/dev/null
  fi
}

hard_failures=0
red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow(){ printf '\033[33m%s\033[0m\n' "$*"; }

# hard_rule <name> <hint> <hits>
hard_rule() {
  local name="$1" hint="$2" hits="$3"
  if [ -n "$hits" ]; then
    red "✗ HARD: $name"
    printf '%s\n' "$hits" | head -20 | sed 's/^/    /'
    echo "    → $hint"
    hard_failures=$((hard_failures + 1))
  else
    green "✓ $name"
  fi
}

# warn_rule <name> <hint> <hits>  (count-aware, never blocks)
warn_rule() {
  local name="$1" hint="$2" hits="$3"
  local n; n=$(printf '%s' "$hits" | grep -c . || true)
  if [ "$n" -gt 0 ]; then
    yellow "⚠ WARN: $name ($n)"
    printf '%s\n' "$hits" | head -10 | sed 's/^/    /'
    [ "$n" -gt 10 ] && echo "    … and $((n - 10)) more"
    echo "    → $hint"
  fi
}

echo "── repo-guards ($(basename "$ROOT")) ─────────────────────────"

# ── HARD: always a mistake on a shared branch ───────────────────────────────

# Unresolved merge-conflict markers. The start/end markers (with trailing space
# + label) never appear legitimately in source.
hard_rule "No merge-conflict markers" \
  "Resolve the conflict before committing." \
  "$(scan '^(<{7}|>{7}) ')"

# Focused tests silently skip the REST of the suite → green CI that tested almost
# nothing. The classic false-confidence regression.
# NOTE: POSIX ERE (git grep -E / grep -E) does NOT support \b word boundaries,
# so boundaries are written explicitly: (^|[^ident]) for the left edge and a
# trailing "(" for the right (focused/skipped test helpers are always called).
hard_rule "No focused tests (.only / fdescribe / fit)" \
  "Remove .only/fdescribe/fit so the full suite runs." \
  "$(scan '(^|[^A-Za-z0-9_$.])((describe|context|it|test)\.only|f(describe|it))[[:space:]]*\(' '*.js' '*.jsx' '*.ts' '*.tsx' '*.mjs')"

# Leftover JS debugger breakpoints.
hard_rule "No leftover debugger; statements" \
  "Remove the debugger; breakpoint." \
  "$(scan '^[[:space:]]*debugger;[[:space:]]*$' '*.js' '*.jsx' '*.ts' '*.tsx' '*.mjs')"

echo "────────────────────────────────────────────────────────────"

# ── WARN: real debt, surfaced for triage, never blocks ──────────────────────

# Silent-swallow: empty catch / except-pass hides failures (and in coroutine code
# can swallow cancellation). Each one needs at least a log or a one-line reason.
warn_rule "Empty catch / except-pass (silent swallow)" \
  "Log at WARN+ or rethrow; a truly-irrelevant case still needs a one-line // why." \
  "$(scan 'catch[[:space:]]*\([^)]*\)[[:space:]]*\{[[:space:]]*\}'; scan 'except[^:]*:[[:space:]]*pass[[:space:]]*$' '*.py')"

# Intentionally-skipped tests rot into permanent coverage holes if untracked.
warn_rule "Skipped / ignored tests" \
  "Each skip should reference a ticket and a removal condition." \
  "$(scan '(\.skip[[:space:]]*\(|(^|[^A-Za-z0-9_$.])x(it|describe)[[:space:]]*\(|@(Ignore|Disabled)([^A-Za-z0-9_]|$)|@pytest\.mark\.skip|#\[ignore\])')"

# TODO/FIXME without a tracking reference drift forever.
warn_rule "TODO / FIXME / HACK / XXX markers" \
  "Convert long-lived ones into tracked issues." \
  "$(scan '(TODO|FIXME|HACK|XXX)([: (]|$)')"

echo "────────────────────────────────────────────────────────────"
if [ "$hard_failures" -gt 0 ]; then
  red "repo-guards FAILED: $hard_failures hard rule(s) violated. Fix before merge."
  exit 1
fi
green "repo-guards passed (hard rules clean)."
exit 0
