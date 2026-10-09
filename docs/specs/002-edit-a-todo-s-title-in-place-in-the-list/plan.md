---
spec_id: 002-edit-a-todo-s-title-in-place-in-the-list
shape: web-nextjs
spec_hash: 1f6563727fe4
summary: Edit a todo's title in place (Edit, Save, Cancel, Enter/Escape, click outside cancels) via a setTodoTitle Server
  Action to PATCH /todos/{id}
tasks:
- id: t1
  title: Title PATCH in the todo-api client, setTodoTitle Server Action and page wiring
  files: [app/_lib/todo.ts, app/_lib/todo-api.ts, app/actions.ts, app/page.tsx]
  covers: [AC-002.4, AC-002.5, AC-002.11, AC-002.12, AC-002.13, AC-002.14, AC-002.15, AC-002.16, AC-002.17, AC-002.18, AC-002.20]
  parallel_safe: true
  depends_on: []
  done: true
- id: t2
  title: In-place edit mode in TodoList (Edit, Save, Cancel, keyboard, outside press, focus)
  files: [app/_components/todo-list.tsx, app/globals.css]
  covers: [AC-002.1, AC-002.2, AC-002.3, AC-002.4, AC-002.5, AC-002.6, AC-002.7, AC-002.8, AC-002.9, AC-002.10, AC-002.11,
    AC-002.12, AC-002.13, AC-002.14, AC-002.15, AC-002.16, AC-002.17, AC-002.18, AC-002.19, AC-002.20, AC-002.21, AC-002.22,
    AC-002.23, AC-002.24, AC-002.25]
  parallel_safe: false
  depends_on: [t1]
---

# Plan — 002 Edit a todo's title in place in the list

Design and binding contracts: [design.md](design.md). Coder agent: `web:coder`. All commands via `devbox run` (`test`, `quality`, `build`, `bundle-check`). Acceptance tests already exist under `tests/` (including the updated `tests/helpers/mock-todo-api.ts` and the `setTodoTitle` stub in `tests/todo-isolation.test.tsx`) and are not edited.

Levels: t1 → t2. t2 needs the `setTodoTitle` member of `TodoActions` and the Server Action that t1 adds; splitting the type into its own task would leave `app/page.tsx` failing typecheck between tasks for no parallelism gain.

## t1 — Title PATCH in the todo-api client, setTodoTitle Server Action and page wiring

**Files:** app/_lib/todo.ts, app/_lib/todo-api.ts, app/actions.ts, app/page.tsx
**Covers:** AC-002.4, AC-002.5, AC-002.11, AC-002.12, AC-002.13, AC-002.14, AC-002.15, AC-002.16, AC-002.17, AC-002.18, AC-002.20
**Goal:** the server-side path of a title save, exactly as in design.md "Contract": `TodoActions.setTodoTitle`, `updateTodoTitle(id, title)` with the title-PATCH allowlist, the `"use server"` action `setTodoTitle(id, title)`, and `app/page.tsx` passing it to `TodoList`.

**Implementation notes:**
- `app/_lib/todo.ts`: add `setTodoTitle: (id: string, title: string) => Promise<ActionResult<Todo>>` to `TodoActions`; nothing else changes.
- `updateTodoTitle`: reuse `send("update", "PATCH", `/todos/${encodeURIComponent(id)}`, { title })`, `readTodo`, `errorCode`, `unavailable`. `200` → `readTodo`; `422` with `title_required`/`title_too_long` → that error; `404` with `todo_not_found` → `not_found`; everything else → `unavailable(..., "status")`. Body is `{title}` only, never `done` (AC-002.4).
- Leave `updateTodoDone`, `createTodo`, `listTodos`, `removeTodo` and the logging format unchanged (spec 001 tests must keep passing).
- `setTodoTitle` in `app/actions.ts`: `validateTitle(typeof title === "string" ? title : "")`; error → return it without any fetch (AC-002.11, AC-002.12); else `withRefresh(await updateTodoTitle(String(id), checked.title))` (trimmed title, AC-002.15; refresh on not-found, AC-002.16).
- `app/page.tsx`: import `setTodoTitle` and pass `actions={{ addTodo, setTodoDone, setTodoTitle, deleteTodo }}`; keep `force-dynamic`.

**Done when:** the server-action / client acceptance tests for the title PATCH pass (exact body, trimmed title, no PATCH for empty/whitespace/201 code points, 200 emoji sent, 422 code mapping regardless of `message`, 404 → one `GET /todos` and `todos` attached, timeout/connection error/5xx/`422 invalid_request`/`400`/invalid `200` body → `unavailable` with exactly one PATCH); all spec 001 tests still pass; `devbox run quality` passes.

## t2 — In-place edit mode in TodoList (Edit, Save, Cancel, keyboard, outside press, focus)

**Files:** app/_components/todo-list.tsx, app/globals.css
**Covers:** AC-002.1 to AC-002.25
**Goal:** implement the row DOM contract and behaviour of design.md "UI" in the existing `"use client"` `TodoList`: an "Edit" control per row, a single edit mode replacing the row's content with the input, Save and Cancel, pessimistic save through `actions.setTodoTitle`, Escape/Cancel/outside-press cancel, in-flight guard and focus management.

**Implementation notes:**
- State: `editing: { id: string; draft: string } | null` and `saving: boolean`; refs for the edit input, Save and Cancel, and a per-id map of Edit button refs for focus.
- Row not in edit mode: add `<button type="button" aria-label={`Edit ${t.title}`}>Edit</button>`; disabled when the row is in `pending` or `saving` is true (AC-002.1, AC-002.19, AC-002.22).
- Row in edit mode: same `<li>` (same key, same index); render only an unnamed `<form noValidate>` with the input (`aria-label="Title"`, `readOnly` while saving), `Save` (`type="submit"`) and `Cancel` (`type="button"`), both disabled while saving (AC-002.2, AC-002.23). Focus the input when edit mode starts.
- Save / Cancel / Start / not-found / unavailable flows exactly as listed in design.md "Behaviour" (client `validateTitle` first; unchanged-after-trim → leave without a call; `ok` → replace at index with the returned Todo; 422 codes and `unavailable` keep the draft; `not_found` → list from `todos` or drop the item; a thrown action is `unavailable`).
- Escape: `onKeyDown` on the edit form (`event.key === "Escape"`) → cancel unless saving (AC-002.8, AC-002.19).
- Outside press: `useEffect` keyed on `editing?.id` and `saving` that adds `document.addEventListener("pointerdown", handler, true)` and removes it on cleanup; the handler cancels when the target is not contained in the input, Save or Cancel and not saving; no `preventDefault`/`stopPropagation`, no focus change (AC-002.9, AC-002.10, AC-002.24).
- Focus after Cancel/Escape, after an unchanged save and after a successful save: set a `focusEditId` state and focus that row's Edit button in an effect after render (button name reflects the returned title, AC-002.25).
- Clear the message on start, on save start and on cancel; spec 001's add/toggle/delete code paths stay unchanged; end edit mode if the edited id is no longer in `todos`.
- No Web Storage, IndexedDB, cookies or `fetch`; import only from `app/_lib/todo.ts` (AC-002.20).
- `app/globals.css`: edit-row styles with existing tokens; input and buttons `min-height: 2.75rem` so the row height does not change when entering or leaving edit mode (design.md "Risks").

**Done when:** all acceptance tests pass with `devbox run test` (including the coverage gate), `devbox run quality`, `devbox run build` and `devbox run bundle-check` pass.
