---
spec_id: 001-todo-list-page-at-show-add-toggle-delete
shape: web-nextjs
spec_hash: 3214ad138e78
summary: Todo list page at / (show, add, toggle, delete) rendered server-side, mutations via Server Actions to todo-api
tasks:
- id: t1
  title: Shared todo types, messages and title validation
  files: [app/_lib/todo.ts]
  covers: [AC-001.7, AC-001.9, AC-001.10]
  parallel_safe: true
  depends_on: []
  done: true
- id: t2
  title: Server-only todo-api client and Server Actions
  files: [app/_lib/todo-api.ts, app/actions.ts, docs/env-vars.md]
  covers: [AC-001.5, AC-001.6, AC-001.7, AC-001.8, AC-001.9, AC-001.11, AC-001.12, AC-001.13, AC-001.14, AC-001.15, AC-001.16,
    AC-001.17, AC-001.18, AC-001.19, AC-001.20, AC-001.21, AC-001.22, AC-001.23, AC-001.25]
  parallel_safe: true
  depends_on: [t1]
  done: true
- id: t3
  title: TodoList client component with optimistic toggle and delete
  files: [app/_components/todo-list.tsx, app/globals.css]
  covers: [AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7, AC-001.8, AC-001.9, AC-001.10, AC-001.11, AC-001.12, AC-001.13,
    AC-001.14, AC-001.15, AC-001.16, AC-001.18, AC-001.19, AC-001.20, AC-001.22, AC-001.24]
  parallel_safe: true
  depends_on: [t1]
  done: true
- id: t4
  title: Replace the landing page at / with the todo list page
  files: [app/page.tsx, app/_components/feature-card.tsx, app/_components/icons.tsx, tests/page.test.tsx]
  covers: [AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.17, AC-001.23, AC-001.25]
  parallel_safe: false
  depends_on: [t2, t3]
---

# Plan — 001 Todo list page at /

Design and binding contracts: [design.md](design.md). Coder agent: `web:coder`. All commands via `devbox run` (`test`, `quality`, `build`). Acceptance tests already exist under `tests/` and are not edited.

Levels: t1 → t2, t3 (parallel) → t4.

## t1 — Shared todo types, messages and title validation

**Files:** app/_lib/todo.ts
**Covers:** AC-001.7, AC-001.9, AC-001.10
**Goal:** one pure, client-safe module that both the server code and the client component import: the `Todo`, `TodoError`, `ActionResult<T>` and `TodoActions` types, `MAX_TITLE_LENGTH`, the `MESSAGES` map and `validateTitle`, exactly as in design.md "Shared types".

**Implementation notes:**
- No imports from `next/*`, no `process.env`, no side effects: this file is bundled for the browser.
- `validateTitle(raw)`: `raw.trim()`; empty → `title_required`; `[...trimmed].length > 200` → `title_too_long`; else `{ ok: true, title: trimmed }`. Count code points, not `.length` (200 emoji must pass, AC-001.10).
- `MESSAGES` texts are byte-exact from the spec.

**Done when:** unit-level acceptance tests for validation (empty, whitespace-only, 200 and 201 code points, 200 emoji) pass; `devbox run quality` passes.

## t2 — Server-only todo-api client and Server Actions

**Files:** app/_lib/todo-api.ts, app/actions.ts, docs/env-vars.md
**Covers:** AC-001.5, AC-001.6, AC-001.7, AC-001.8, AC-001.9, AC-001.11, AC-001.12, AC-001.13, AC-001.14, AC-001.15, AC-001.16, AC-001.17, AC-001.18, AC-001.19, AC-001.20, AC-001.21, AC-001.22, AC-001.23, AC-001.25
**Goal:** every call to todo-api goes through `listTodos`, `createTodo`, `updateTodoDone`, `removeTodo`, which never throw and map every answer to `ActionResult` per the allowlist in design.md; `app/actions.ts` exposes `addTodo`, `setTodoDone`, `deleteTodo` as Server Actions on top of them.

**Implementation notes:**
- Read `process.env.TODO_API_URL` inside each call (never at module load); strip a trailing slash; unset/empty → `unavailable` with `reason: "config"`.
- `fetch` with `cache: "no-store"`, JSON headers, `signal: AbortSignal.timeout(5000)`; `AbortError`/`TimeoutError` → `reason: "timeout"`, other throws → `reason: "network"` (AC-001.21).
- Per-endpoint allowlist exactly as in design.md; any other status or `error.code`, any 5xx, non-JSON or invalid Todo body → `unavailable` (AC-001.22). Branch on status + `error.code` only, never `message`.
- Validate 2xx bodies (Todo shape; array for list); return the list in received order, never sort (AC-001.5).
- `encodeURIComponent(id)` in the path.
- One structured JSON log line on stderr per `unavailable` (fields in design.md); no other logging of bodies.
- `app/actions.ts` starts with `"use server"`; `addTodo` runs `validateTitle` first and returns its error without any fetch (AC-001.7, AC-001.9); sends the trimmed title.
- `setTodoDone` / `deleteTodo`: on `not_found`, call `listTodos()` and attach `todos` when it succeeds (AC-001.16).
- `docs/env-vars.md`: add `TODO_API_URL` under a new "Upstream services" section (no default; server-only, never `NEXT_PUBLIC_`; deployed value `http://todo-api` from the gitops repo; 5 s timeout).

**Done when:** acceptance tests for the client/actions against the mocked todo-api pass (status mapping, unknown codes, timeout via fake timers or a never-resolving fetch, not-found refresh, no POST for invalid titles); `devbox run quality` passes.

## t3 — TodoList client component with optimistic toggle and delete

**Files:** app/_components/todo-list.tsx, app/globals.css
**Covers:** AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7, AC-001.8, AC-001.9, AC-001.10, AC-001.11, AC-001.12, AC-001.13, AC-001.14, AC-001.15, AC-001.16, AC-001.18, AC-001.19, AC-001.20, AC-001.22, AC-001.24
**Goal:** `"use client"` component `TodoList({ initialTodos, initialError, actions }: { initialTodos: Todo[]; initialError: "unavailable" | null; actions: TodoActions })` that implements the DOM contract and behaviour in design.md "Page and UI". It imports only from `app/_lib/todo.ts` (types, `MESSAGES`, `validateTitle`), never from `todo-api.ts` or `actions.ts`.

**Implementation notes:**
- Accessible names and roles exactly as in the design table (`heading` "Todos", form "Add a todo", textbox "New todo", button "Add", `alert`, list "Todos", checkbox named by title, button "Delete <title>").
- Form `noValidate`; input without `required` or `maxLength`; submit on Enter and button click; `preventDefault` (no full reload).
- Add: client validation first; on success append the returned todo (its `title`, not the input) and clear input; on error keep list and input, show `MESSAGES[error]`.
- Toggle: optimistic flip, replace with returned todo on `ok`, rollback on any non-`not_found` error.
- Delete: optimistic removal, re-insert at previous index on any non-`not_found` error; no confirm dialog.
- `not_found`: show message; replace the list with `result.todos` when present, else drop the item.
- "No todos yet" only when list empty and no load failure; when `initialError` is set, show the `alert` with `MESSAGES.unavailable` and no empty state.
- Disable an item's controls while its request is in flight; disable Add while adding; clear the message when a new action starts.
- No Web Storage, IndexedDB or cookies (AC-001.24).
- CSS in `app/globals.css` using existing tokens: list rows, `[data-done="true"]` title struck through and muted, `.todo-message` style; keep existing rules except the now-unused landing-page ones may stay.

**Done when:** component acceptance tests (rendered with stub or real actions) for empty state, order, add, validation messages, toggle, delete, not-found refresh and rollbacks pass; `devbox run quality` passes.

## t4 — Replace the landing page at / with the todo list page

**Files:** app/page.tsx, app/_components/feature-card.tsx, app/_components/icons.tsx, tests/page.test.tsx
**Covers:** AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.17, AC-001.23, AC-001.25
**Goal:** `/` is an async Server Component that loads the list with `listTodos()` and renders `TodoList` with the three Server Actions; the template landing page, its components and its template test are removed.

**Implementation notes:**
- `export const dynamic = "force-dynamic"`; `export const metadata = { title: "Todos" }`.
- `HomePage()` awaits `listTodos()`; `ok` → `initialTodos = data`, `initialError = null`; otherwise `initialTodos = []`, `initialError = "unavailable"`. Never throw for todo-api failures (AC-001.17: page, not the error page).
- Pass `actions={{ addTodo, setTodoDone, deleteTodo }}` imported from `app/actions.ts`.
- Delete `app/_components/feature-card.tsx`, `app/_components/icons.tsx` and the template test `tests/page.test.tsx` (it asserts the landing page that AC-001.1 removes; it is not an acceptance test).
- Do not touch `app/api/health`, `app/api/ready`, `app/api/metrics` or `app/layout.tsx` (AC-001.2).
- Verify `devbox run build` succeeds without `TODO_API_URL` set (page must not prerender).

**Done when:** all acceptance tests pass with `devbox run test` (including the 80% coverage gate), `devbox run quality` and `devbox run build` pass, and the built `.next/static` contains no `TODO_API_URL` value (AC-001.25).
