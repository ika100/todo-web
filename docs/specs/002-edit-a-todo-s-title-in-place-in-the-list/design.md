# Design — 002 Edit a todo's title in place in the list

## Decisions

- **Same backend-for-frontend path as spec 001.** The save is a new Server Action `setTodoTitle(id, title)` in `app/actions.ts`, on top of a new `updateTodoTitle(id, title)` in the existing server-only client `app/_lib/todo-api.ts`, which reuses its `send`, `readTodo`, `errorCode` and `unavailable` helpers (same base URL handling, 5 s timeout, no retry, structured log line, fail-closed allowlist). No second client, no route handler, nothing new in the browser bundle except the UI (AC-002.17, AC-002.18, AC-002.20).
- **The title PATCH body is exactly `{"title": <trimmed>}`.** Never `done`, so a toggle made in another tab is not overwritten (AC-002.4, AC-002.15, product AC-002.10). `updateTodoDone` stays byte-for-byte as it is.
- **Validation runs twice, todo-api decides.** The client runs `validateTitle` before calling the action (immediate message, no request, AC-002.11, AC-002.12); the Server Action runs it again so no invalid title ever reaches todo-api whatever the browser sends. A `422 title_required` / `title_too_long` from todo-api is still mapped (AC-002.14).
- **Save is pessimistic.** The row keeps showing the input with the typed value until todo-api answers; only a `200` replaces the row, and it is replaced with exactly the returned Todo (`title` and `done`) at the same index (AC-002.6, AC-002.7, AC-002.15). Nothing is shown as saved on any failure (AC-002.17, AC-002.18).
- **Edit state is one value in `TodoList`**, so at most one row can ever be in edit mode (AC-002.3). Edit state lives only in React state: no Web Storage, IndexedDB or cookies (AC-002.20).
- **"Click outside cancels" is a document-level `pointerdown` listener in the capture phase**, installed only while a row is in edit mode. It cancels the edit on the press and does not call `preventDefault`/`stopPropagation`, so the control under the pointer still receives its normal `click` in the same gesture (AC-002.9, AC-002.24). Presses on the row's input, Save or Cancel are "inside" and ignored, so a click on Save saves (AC-002.10). Blur and keyboard focus moves do not cancel (the spec only names pointer presses).
- **Edit mode hides the row's done checkbox and Delete.** Toggling and deleting from edit mode are non-goals; the row in edit mode shows exactly the input, Save and Cancel.

No ADR: every choice is local to this feature and follows the patterns of spec 001's design.

## Modules

| Module | Responsibility | New / changed |
|---|---|---|
| `app/_lib/todo.ts` | `TodoActions` gains `setTodoTitle` | changed |
| `app/_lib/todo-api.ts` | `updateTodoTitle(id, title)` with the title-PATCH allowlist | changed |
| `app/actions.ts` | `"use server"` `setTodoTitle(id, title)`: validation, not-found refresh | changed |
| `app/page.tsx` | passes `setTodoTitle` in `actions` | changed |
| `app/_components/todo-list.tsx` | Edit control per row, edit mode, save/cancel/outside-press, focus, messages | changed |
| `app/globals.css` | edit-row styles (input, Save, Cancel) | changed |

## Contract

### Upstream (todo-api)

As in the spec's Contract section; binding. Added call and its allowlist (anything else is `unavailable`, logged with `op: "update"`):

| Call | Expected → result |
|---|---|
| `PATCH /todos/{id}` `{"title": t}` (t already trimmed and valid) | `200` + valid Todo → `{ok: true, data: Todo}`; `422` `title_required` → `title_required`; `422` `title_too_long` → `title_too_long`; `404` `todo_not_found` → `not_found` |

`422 invalid_request`, a 4xx without the error body, any other status, any 5xx, a non-JSON or invalid-Todo `200` body, connection error, 5 s timeout or unset `TODO_API_URL` → `unavailable` (AC-002.17, AC-002.18). Branch on status and `error.code` only. `{id}` is `encodeURIComponent`-encoded. Exactly one request per call, no retry.

### Shared types (`app/_lib/todo.ts`)

```ts
export type TodoActions = {
  addTodo: (title: string) => Promise<ActionResult<Todo>>;
  setTodoDone: (id: string, done: boolean) => Promise<ActionResult<Todo>>;
  setTodoTitle: (id: string, title: string) => Promise<ActionResult<Todo>>;   // new
  deleteTodo: (id: string) => Promise<ActionResult<null>>;
};
```

`Todo`, `TodoError`, `ActionResult`, `MESSAGES`, `validateTitle` are unchanged and reused (code-point counting already covers the 200-emoji case of AC-002.13).

### todo-api client (`app/_lib/todo-api.ts`, server-only)

```ts
export async function updateTodoTitle(id: string, title: string): Promise<ActionResult<Todo>>;
```

Never throws. Sends `title` as given (the action trims it).

### Server Action (`app/actions.ts`)

`setTodoTitle(id, title)`: `validateTitle(typeof title === "string" ? title : "")`; on failure return `{ok: false, error}` **without any fetch**; else `withRefresh(await updateTodoTitle(String(id), checked.title))`, i.e. on `not_found` one `GET /todos` and `{ok: false, error: "not_found", todos}` when it succeeds, `{ok: false, error: "not_found"}` otherwise (AC-002.16).

### Page

`app/page.tsx` passes `actions={{ addTodo, setTodoDone, setTodoTitle, deleteTodo }}`. Nothing else changes; a reload renders the list from `GET /todos` with no row in edit mode (AC-002.5).

### UI (DOM contract for tests)

Row **not** in edit mode (spec 001 row plus one button):

| Element | Accessible query | Rules |
|---|---|---|
| Done toggle, title | as spec 001 | unchanged |
| Edit | `button` named `Edit <title>` (`aria-label`), visible text `Edit`, `type="button"` | one per row (AC-002.1, AC-002.22); disabled while that row's toggle/delete is in flight and while any title save is in flight |
| Delete | as spec 001 | unchanged |

Row **in** edit mode (same `listitem`, same position; checkbox, title text, Edit and Delete are not rendered):

| Element | Accessible query | Rules |
|---|---|---|
| Edit form | `<form noValidate>` without an accessible name (so it is not a `form` landmark and never clashes with "Add a todo") | Enter in the input submits it |
| Title input | `textbox` named `Title` (`aria-label`) | value starts as the todo's title; focused on entering edit mode; no `required`, no `maxLength`; `readOnly` while saving |
| Save | `button` named `Save`, `type="submit"` | disabled while saving |
| Cancel | `button` named `Cancel`, `type="button"` | disabled while saving |

"No row is in edit mode" ⇔ no `textbox` named `Title` exists. The `alert` and `MESSAGES` texts are spec 001's.

Behaviour (state: `editing: { id, draft } | null`, `saving: boolean`):

- **Start** (Edit on row R): if `saving`, no-op. Set `editing = { id: R.id, draft: R.title }` (replaces any other edit without saving, AC-002.3), clear the message, focus the input. No action call (AC-002.2).
- **Save** (Enter in the input or Save): if `saving`, no-op (AC-002.19). Clear the message. `validateTitle(draft)` fails → show its message, stay in edit mode, keep the draft, no action call (AC-002.11, AC-002.12). Trimmed value equals the row's current title → leave edit mode, focus Edit, no action call (AC-002.21). Otherwise `saving = true`, `await actions.setTodoTitle(id, draft)`, then `saving = false` and:
  - `ok` → replace the todo at its index with `data`, leave edit mode, focus that row's Edit (now named `Edit <data.title>`) (AC-002.4, AC-002.6, AC-002.7, AC-002.13, AC-002.15, AC-002.25);
  - `title_required` / `title_too_long` → show `MESSAGES[error]`, stay in edit mode with the draft (AC-002.14);
  - `not_found` → show `MESSAGES.not_found`, leave edit mode, replace the list with `todos` if present, else drop the todo (AC-002.16);
  - `unavailable`, or the action throws → show `MESSAGES.unavailable`, stay in edit mode with the draft, list unchanged (AC-002.17, AC-002.18).
- **Cancel** (Escape keydown anywhere in the edit form, or Cancel): if `saving`, no-op. Leave edit mode, clear the message, focus that row's Edit (AC-002.8).
- **Outside press**: while `editing !== null`, a `pointerdown` listener on `document` (capture) checks `event.target`; if it is not the input, Save or Cancel (or inside them) and not `saving`, leave edit mode and clear the message, without moving focus and without `preventDefault`/`stopPropagation`. The listener is removed when edit mode ends or the component unmounts (AC-002.9, AC-002.10, AC-002.24).
- If the edited todo disappears from the list (e.g. another row's not-found refresh), edit mode ends.
- Toggle, delete and add on other rows keep spec 001 behaviour, including while a title save is in flight.

## Configuration

No change. `TODO_API_URL` as in spec 001. Port, probes and env in the gitops repo are unchanged.

## Tests

Acceptance tests (Vitest + Testing Library, jsdom) are written before coding; coders do not edit them. Notes for the testers:

- Outside presses must be dispatched as `pointerdown` (`fireEvent.pointerDown(target)`), followed by `fireEvent.click(target)` for AC-002.24; the implementation does not listen to `mousedown`.
- `tests/helpers/mock-todo-api.ts` handles `PATCH` as done-only today (`found.done = body.done`); it must follow the extended contract (title and/or done, trimming, `title_required`/`title_too_long`, done-only behaviour unchanged).
- `tests/todo-isolation.test.tsx` builds a `TodoActions` stub without `setTodoTitle`; it must gain one, or `devbox run typecheck` (which includes `tests/`) fails once the type changes.

## Risks

- Cancelling on `pointerdown` re-renders the edited row before the `click`. If the edit row has a different height than a normal row, rows below it shift and the release can land on a different element. The edit row's input and buttons use the same `min-height` as the row's existing controls (`2.75rem`) so the row height does not change.
- `app/_lib/todo-api.ts` must still never be imported from `todo-list.tsx` (the isolation test checks it).
