# Sector: todo/application

## Purpose
`TodoService` use cases (list/add/complete/reopen/update/delete).

## Dependencies
→ `todo/domain` port only. Never import `infrastructure` concretely.

## Invariants
Filters apply after load; mutations go through domain helpers then `save`.
