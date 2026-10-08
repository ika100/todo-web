# Design — 001 Todo list page at / backed by todo-api

## Decisions

- **todo-web is a backend-for-frontend; the browser never talks to todo-api.** The initial list is fetched in the `/` Server Component; mutations are **Server Actions** (`app/actions.ts`). Server Actions post to the page's own origin, so there is no public JSON API to design, secure or document, and `TODO_API_URL` stays a server-only runtime variable (AC-001.25). Route handlers under `app/api/` are not used for todos.
- **One server-only todo-api client** (`app/_lib/todo-api.ts`) owns every HTTP call: base URL, 5 s timeout, response validation and the mapping of every status/`code` to a small closed result type. Nothing else calls `fetch` against todo-api (AC-001.17..22).
- **Fail closed on anything the contract does not list.** Each endpoint has an allowlist of expected answers; everything else (other status, other `code`, non-JSON, a 2xx body that is not a valid Todo, connection error, timeout, unset `TODO_API_URL`) becomes `unavailable` (AC-001.22).
- **The client component receives the actions as props** (`TodoList({ initialTodos, initialError, actions })`). The page passes the real Server Actions; tests render the same component with the real actions over a mocked `fetch`, or with stubs. This keeps the UI testable in Vitest + jsdom without a Next runtime.
- **Add is pessimistic, toggle and delete are optimistic with rollback.** Add only appends the todo todo-api returned (title as returned, AC-001.12) and keeps the input on failure (AC-001.18). Toggle and delete update at once (AC-001.15 "immediately") and restore the previous done state / position on any failure (AC-001.19, AC-001.20).
- **Client-side title validation mirrors the API for early feedback only** (`app/_lib/todo.ts`, pure, no env, importable from client code). The Server Action validates again before calling todo-api, so an invalid title never reaches it, whatever the client sends (AC-001.7, AC-001.9).
- **`TODO_API_URL` has no default.** Unset means every call is `unavailable` and is logged; a wrong default would silently point at the wrong service. Read at call time from `process.env`, never at build time, never `NEXT_PUBLIC_*`.
- `/` is `export const dynamic = "force-dynamic"`: it must never be prerendered at build time (no todo-api in CI, and stale lists would violate AC-001.23).
- `/api/health`, `/api/ready`, `/api/metrics` are untouched. Readiness does **not** check todo-api: the page itself degrades to "Todos are unavailable, please try again", and coupling readiness to todo-api would take the web pod out of rotation for an upstream outage (AC-001.2).

No ADR: these choices are local to this feature.

## Modules

| Module | Responsibility | New / changed |
|---|---|---|
| `app/_lib/todo.ts` | `Todo` type, `TodoError`, `ActionResult`, `TodoActions`, `MESSAGES`, `validateTitle` (pure, client-safe) | new |
| `app/_lib/todo-api.ts` | server-only HTTP client for todo-api: `listTodos`, `createTodo`, `updateTodoDone`, `removeTodo` | new |
| `app/actions.ts` | `"use server"` actions `addTodo`, `setTodoDone`, `deleteTodo` (validation, not-found refresh) | new |
| `app/_components/todo-list.tsx` | `"use client"` list UI: form, list, messages, optimistic toggle/delete | new |
| `app/page.tsx` | async Server Component: loads list, renders `TodoList` with the actions | changed (landing page removed) |
| `app/_components/feature-card.tsx`, `app/_components/icons.tsx`, `tests/page.test.tsx` | template landing page and its test | removed |
| `app/globals.css` | todo list styles (done state, list rows, message) | changed |
| `docs/env-vars.md` | documents `TODO_API_URL` | changed |

## Contract

### Upstream (todo-api)

As in the spec's Contract section; binding. Every request: `cache: "no-store"`, `Accept: application/json`, JSON body with `Content-Type: application/json` where there is one, `signal: AbortSignal.timeout(5000)`. URL = `TODO_API_URL` without trailing slash + path; `{id}` is `encodeURIComponent`-encoded.

Expected answers per endpoint (anything else is `unavailable`):

| Call | Expected → result |
|---|---|
| `GET /todos` | `200` + JSON array of valid Todos → `{ok: true, data: Todo[]}` in the order received (never re-sorted, AC-001.5) |
| `POST /todos` `{"title": t}` | `201` + valid Todo → `ok`; `422` `title_required` → `title_required`; `422` `title_too_long` → `title_too_long` |
| `PATCH /todos/{id}` `{"done": b}` | `200` + valid Todo → `ok`; `404` `todo_not_found` → `not_found` |
| `DELETE /todos/{id}` | `204` → `ok` (`data: null`); `404` `todo_not_found` → `not_found` |

A valid Todo is an object with `id: string`, `title: string`, `done: boolean`, `created_at: string`; extra fields are dropped. Error branching uses only status and `error.code`, never `message`.

### Shared types (`app/_lib/todo.ts`)

```ts
export type Todo = { id: string; title: string; done: boolean; created_at: string };
export type TodoError = "title_required" | "title_too_long" | "not_found" | "unavailable";
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: TodoError; todos?: Todo[] };   // todos: only with not_found, the refreshed list
export type TodoActions = {
  addTodo: (title: string) => Promise<ActionResult<Todo>>;
  setTodoDone: (id: string, done: boolean) => Promise<ActionResult<Todo>>;
  deleteTodo: (id: string) => Promise<ActionResult<null>>;
};
export const MAX_TITLE_LENGTH = 200;
export const MESSAGES: Record<TodoError, string> = {
  title_required: "Title is required",
  title_too_long: "Title must be at most 200 characters",
  not_found: "This todo no longer exists",
  unavailable: "Todos are unavailable, please try again",
};
/** Trims (String.prototype.trim) and counts Unicode code points ([...s].length). */
export function validateTitle(raw: string): { ok: true; title: string } | { ok: false; error: "title_required" | "title_too_long" };
```

### todo-api client (`app/_lib/todo-api.ts`, server-only)

```ts
export async function listTodos(): Promise<ActionResult<Todo[]>>;
export async function createTodo(title: string): Promise<ActionResult<Todo>>;
export async function updateTodoDone(id: string, done: boolean): Promise<ActionResult<Todo>>;
export async function removeTodo(id: string): Promise<ActionResult<null>>;
```

Never throws: every failure is a result. On `unavailable` it writes one structured log line to stderr: `{"level":"error","msg":"todo-api unavailable","op":"<list|create|update|delete>","status":<number|null>,"reason":"<timeout|network|status|body|config>"}`.

### Server Actions (`app/actions.ts`, `"use server"`)

- `addTodo(title)`: `validateTitle`; on failure return that error **without calling todo-api**; else `createTodo(trimmed)`. todo-web sends the trimmed title (todo-api trims again; the shown title is always the one returned).
- `setTodoDone(id, done)`: `updateTodoDone`. On `not_found`, call `listTodos()`; if it succeeds return `{ok: false, error: "not_found", todos}`, else `{ok: false, error: "not_found"}`.
- `deleteTodo(id)`: `removeTodo`, same `not_found` refresh as above.

### Page and UI (DOM contract for tests)

`app/page.tsx`: `export default async function HomePage()`; calls `listTodos()` and renders `<TodoList initialTodos={ok ? data : []} initialError={ok ? null : "unavailable"} actions={{ addTodo, setTodoDone, deleteTodo }} />`. It never throws to `error.tsx` for todo-api failures (AC-001.17). Tests may `render(await HomePage())` with `fetch` mocked.

`TodoList` renders, in this order:

| Element | Accessible query | Rules |
|---|---|---|
| Heading | `heading` level 1, name `Todos` | the only `h1` on `/` |
| Add form | `form` named `Add a todo` (`aria-label`), `noValidate` | submit by Enter or button |
| Title input | `textbox` named `New todo` (visible `<label>`) | no `required`, no `maxLength`; cleared only after a successful add; keeps its value on any failure |
| Add button | `button` named `Add`, `type="submit"` | disabled while an add is in flight |
| Message | `alert` (`<p role="alert">`) | present only when there is a message; text is exactly one `MESSAGES` value; cleared when the user starts the next action |
| Empty state | text `No todos yet` | shown only when the list is empty **and** the last load did not fail |
| List | `list` named `Todos` (`<ul aria-label="Todos">`) | rendered only when there is at least one todo; one `listitem` per todo, in state order |
| Done toggle | `checkbox` named by the todo title (`<label>` wraps checkbox + title) | `checked` = `done`; the `listitem` has `data-done="true"|"false"` and done titles are struck through (visible + accessible, AC-001.4) |
| Delete | `button` named `Delete <title>` (`aria-label`), visible text `Delete` | no confirmation |

Behaviour:

- Submit: client `validateTitle`; on error show its message, no action call. Else `await actions.addTodo(raw)`; `ok` → append `data` at the end, clear input; error → show `MESSAGES[error]`, list and input unchanged.
- Toggle: set `done = !done` at once, call `setTodoDone(id, newDone)`; `ok` → replace the item with `data`; `not_found` → show message, replace the list with `todos` if present, else drop the item; other error → restore the previous item, show message.
- Delete: remove at once (remember index), call `deleteTodo(id)`; `ok` → done; `not_found` → show message, replace the list with `todos` if present (item stays removed otherwise); other error → re-insert at its previous index, show message.
- While a toggle/delete for an item is in flight, that item's checkbox and delete button are disabled.
- Nothing is written to localStorage, sessionStorage, IndexedDB or cookies (AC-001.24). No `fetch` from the client to anything but the Server Action endpoint.

## Configuration

| Variable | Default | Where read |
|---|---|---|
| `TODO_API_URL` | unset (all calls `unavailable`) | `app/_lib/todo-api.ts` at call time only |

Deployed value `http://todo-api`, set in the todo gitops repo `services.yaml` (`todo-web.env.TODO_API_URL`). Port (3000) and probes unchanged.

## Tests

Acceptance tests are written before coding under `tests/` (Vitest + Testing Library, jsdom), mocking `globalThis.fetch` as a contract-following todo-api. They must not use the path `tests/page.test.tsx`: that is the template landing-page test, deleted by t4. AC-001.25's "value not in any browser file" check runs against the `.next/static` output of a build with a sentinel `TODO_API_URL` (`devbox run bundle-check`).

## Risks

- A Server Action module imported into a client component exposes only an action reference, but `app/_lib/todo-api.ts` must never be imported from a `"use client"` module, or the env read would be bundled for the browser (it would resolve to `undefined`, not leak, but it would break). Keep the import graph: `page.tsx` / `actions.ts` → `todo-api.ts`; `todo-list.tsx` → `todo.ts` only.
- Not-found refresh can take up to 2 × 5 s; acceptable, the 10 s bound applies only to unavailability (AC-001.17..21).
