---
spec_id: 001-todo-list-page-at-show-add-toggle-delete
title: Todo list page at / (show, add, toggle, delete todos) backed by todo-api
status: building
priority: P1
shape: web-nextjs
parent: ika100/todo:001-todo-list
---

# 001 — Todo list page at / (show, add, toggle, delete todos) backed by todo-api

## Problem

The todo product is deployed (todo-api and todo-web run in `dev`), but it does nothing a user can use yet: there is no page to open and nothing to keep track of. A user who wants to note tasks and tick them off has no way to do it. This spec delivers the first usable feature: one todo list in the browser, stored by todo-api, so that the deployed product does what its name says.

## Product context

Slice of the product plan `001-todo-list` in `ika100/todo` for `todo-web` (web-nextjs). The product criteria and the contract below are binding: every criterion of this spec implements one of them and names it: `(product AC-<NNN>.<n>)`.

### Product criteria

- **AC-001.1** Given the product is running in the `dev` environment, when a user opens `http://todo-web.todo-dev.localhost:8088/` on the local cluster, then the todo list page loads.
- **AC-001.2** Given no todos exist, when the user opens the todo list page, then the page shows the message "No todos yet" and an input to add a todo.
- **AC-001.3** Given todos exist, when the user opens the todo list page, then every todo is shown with its title and its done state, ordered by creation time with the oldest first.
- **AC-001.4** Given the todo list page, when the user enters the title "Buy milk" and submits, then a todo "Buy milk" appears in the list as not done without a full page reload, and the input is cleared.
- **AC-001.5** Given the todo list page, when the user submits a title that is empty or only whitespace, then no todo is created and the page shows "Title is required".
- **AC-001.6** Given the todo list page, when the user submits a title longer than 200 characters, then no todo is created and the page shows "Title must be at most 200 characters"; a title of exactly 200 characters is accepted.
- **AC-001.7** Given a title with leading or trailing spaces, when the user adds it, then the todo is stored and shown with those spaces removed.
- **AC-001.8** Given a todo that is not done, when the user marks it as done, then it is shown as done, and it is still shown as done after the page is reloaded.
- **AC-001.9** Given a todo that is done, when the user marks it as not done, then it is shown as not done, and it is still shown as not done after the page is reloaded.
- **AC-001.10** Given a todo in the list, when the user deletes it, then it disappears from the list immediately, without a confirmation step, and does not reappear after the page is reloaded.
- **AC-001.11** Given a todo that was deleted in another browser tab, when the user marks it as done or deletes it in the current tab, then the page shows "This todo no longer exists" and the list is refreshed from todo-api.
- **AC-001.12** Given todo-api is unreachable, when the user opens the page or adds, changes or deletes a todo, then the page shows "Todos are unavailable, please try again" within 10 seconds and does not show the change as saved.
- **AC-001.13** Given todos were added in one browser, when the same page is opened in a different browser, then the same list is shown (one shared list, no sign-in).

### Contract

Base URL inside the environment: `http://todo-api` (env `TODO_API_URL` on todo-web). All bodies are JSON
(`Content-Type: application/json`, UTF-8). No authentication, no user scoping: one shared list.

### Todo object

| Field | Type | Notes |
|---|---|---|
| `id` | string | UUID (v4), assigned by todo-api |
| `title` | string | trimmed, 1..200 Unicode code points |
| `done` | boolean | `false` on creation |
| `created_at` | string | RFC 3339 timestamp in UTC, e.g. `2026-10-08T12:34:56.789Z`; set by todo-api |

### Endpoints

**`GET /todos`** — list all todos.
- `200` — JSON array of Todo objects, ordered by `created_at` ascending, then `id` ascending. Empty list: `[]`.

**`POST /todos`** — create a todo.
- Request: `{"title": "<string>"}`. Unknown fields are ignored.
- todo-api trims leading and trailing whitespace (Unicode whitespace, as Python `str.strip()`), then validates.
- `201` — the created Todo object (`done: false`, trimmed `title`).
- `422` `title_required` — `title` missing, `null`, or empty after trimming.
- `422` `title_too_long` — more than 200 code points after trimming (exactly 200 is accepted).
- `422` `invalid_request` — body is not a JSON object or `title` is not a string.

**`PATCH /todos/{id}`** — set the done state.
- Request: `{"done": true}` or `{"done": false}`. Setting the current value again is a no-op that still returns `200`.
- `200` — the updated Todo object.
- `404` `todo_not_found` — no todo with this id (including ids that are not valid UUIDs).
- `422` `invalid_request` — body is not an object or `done` is missing / not a boolean.

**`DELETE /todos/{id}`** — delete a todo.
- `204` — deleted, empty body.
- `404` `todo_not_found` — no todo with this id (including ids that are not valid UUIDs, and ids already deleted).

### Error format

Every 4xx/5xx response produced by todo-api has this body (FastAPI's default validation body is replaced):

```json
{"error": {"code": "title_required", "message": "Title is required"}}
```

| HTTP | `code` | `message` |
|---|---|---|
| 422 | `title_required` | `Title is required` |
| 422 | `title_too_long` | `Title must be at most 200 characters` |
| 422 | `invalid_request` | free text describing the problem |
| 404 | `todo_not_found` | `This todo no longer exists` |
| 503 | `unavailable` | `Todos are unavailable, please try again` (database unreachable) |

todo-web branches on `code` and status, never on `message`. todo-web treats any 5xx, a connection error, or no
response within 5 seconds as "unavailable".

### Probes

- `GET /health` -> `200 {"status": "ok"}` whenever the process runs (no DB check).
- `GET /ready` -> `200 {"status": "ready"}` when the database answers; `503` otherwise.

### Configuration

| Repo | Variable | Value in `dev` | Set by |
|---|---|---|---|
| todo-api | `DATABASE_URL` (+ `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`) | from Secret `todo-postgres-app` | postgres addon, `uses: [postgres]` |
| todo-web | `TODO_API_URL` | `http://todo-api` | `services.yaml` `env` |

No events: the only interaction is synchronous HTTP from todo-web to todo-api.

### Notes for this repo

todo-api is not published: the browser never calls it. All calls go server-side (Server Components for the
initial list, Server Actions or app/api route handlers for mutations) to TODO_API_URL (server-only env var,
never NEXT_PUBLIC_*; deployed value http://todo-api). Every call to todo-api uses a 5 s timeout.
The todo list replaces the template landing page at `/`; keep /api/health, /api/ready, /api/metrics.
Document TODO_API_URL in docs/env-vars.md. Test against a mocked todo-api that follows the contract.

## Stories

As a user of the todo product, I want to open one page and see all my todos with their done state, so that I know what is left to do.

As a user, I want to add a todo by typing a title and submitting, so that I can note a task in seconds without the page reloading.

As a user, I want to mark a todo as done or not done and to delete it, so that the list reflects what I have actually finished.

As a user, I want a clear message when a todo has disappeared or the list cannot be reached, so that I never believe a change was saved when it was not.

## Acceptance criteria

All requests to todo-api below are made by the todo-web server to the base URL in `TODO_API_URL`, never by the browser. "Unavailable" means, as in the contract: a connection error, any 5xx answer, or no answer within 5 seconds.

- **AC-001.1** Given the container image is running with its default port 3000 and `TODO_API_URL` pointing to a todo-api that answers `GET /todos` with `200 []`, when a client requests `GET /`, then the answer is `200` with an HTML page that is the todo list page (it contains the add input), and the template landing page is no longer served. (product AC-001.1)
- **AC-001.2** Given the todo list page is deployed, when a client requests `GET /api/health`, `GET /api/ready` and `GET /api/metrics`, then each answers as it did before this feature. (product AC-001.1)
- **AC-001.3** Given todo-api answers `GET /todos` with `200 []`, when the user opens the page, then the page shows the message "No todos yet" and an input to add a todo. (product AC-001.2)
- **AC-001.4** Given todo-api answers `GET /todos` with three todos A (done), B (not done), C (not done) in that order, when the user opens the page, then exactly three todos are shown, in the order A, B, C, each with its title and a done state that is visibly and accessibly distinguishable (A done, B and C not done), and "No todos yet" is not shown. (product AC-001.3)
- **AC-001.5** Given todo-api answers `GET /todos` in an order that is not alphabetical and not by `id`, when the page is shown, then the todos appear in exactly the order todo-api returned them (todo-web does not re-sort). (product AC-001.3)
- **AC-001.6** Given the page is open and todo-api answers `POST /todos` with `201` and a Todo titled "Buy milk" with `done: false`, when the user enters "Buy milk" and submits (by pressing Enter or the add button), then todo-api receives one `POST /todos` with `title` "Buy milk", the todo "Buy milk" appears as not done at the end of the list without a full page reload, and the input is empty. (product AC-001.4)
- **AC-001.7** Given the page is open, when the user submits an empty title or a title made only of whitespace, then no `POST /todos` reaches todo-api, the list is unchanged and the page shows "Title is required". (product AC-001.5)
- **AC-001.8** Given todo-api answers `POST /todos` with `422` and code `title_required`, when the user submits a title, then no todo is added to the list and the page shows "Title is required", whatever text the API's `message` contains. (product AC-001.5)
- **AC-001.9** Given the page is open, when the user submits a title that is 201 characters long after trimming leading and trailing whitespace, counted in Unicode code points, then no `POST /todos` reaches todo-api, the list is unchanged and the page shows "Title must be at most 200 characters". (product AC-001.6)
- **AC-001.10** Given the page is open, when the user submits a title of exactly 200 code points, including a title of 200 emoji characters (each one code point but two UTF-16 units), then it is sent to todo-api and, on `201`, the todo appears in the list. (product AC-001.6)
- **AC-001.11** Given todo-api answers `POST /todos` with `422` and code `title_too_long`, when the user submits a title, then no todo is added to the list and the page shows "Title must be at most 200 characters", whatever text the API's `message` contains. (product AC-001.6)
- **AC-001.12** Given the user enters "  Buy milk  " and todo-api answers `201` with `title` "Buy milk", when the todo is added, then it is shown as "Buy milk" with no leading or trailing spaces; the shown title is always the `title` todo-api returned. (product AC-001.7)
- **AC-001.13** Given a todo shown as not done, when the user marks it as done and todo-api answers `PATCH /todos/{id}` with `200` and `done: true`, then todo-api received `{"done": true}` for that id, the todo is shown as done without a full page reload, and after a reload it is shown as done because `GET /todos` returns it as done. (product AC-001.8)
- **AC-001.14** Given a todo shown as done, when the user marks it as not done and todo-api answers `PATCH /todos/{id}` with `200` and `done: false`, then todo-api received `{"done": false}` for that id, the todo is shown as not done without a full page reload, and after a reload it is shown as not done because `GET /todos` returns it as not done. (product AC-001.9)
- **AC-001.15** Given a todo in the list, when the user activates its delete control and todo-api answers `DELETE /todos/{id}` with `204`, then no confirmation step is shown, the todo disappears from the list without a full page reload, and it is not shown after a reload once `GET /todos` no longer returns it. (product AC-001.10)
- **AC-001.16** Given todo-api answers `PATCH /todos/{id}` or `DELETE /todos/{id}` with `404` and code `todo_not_found`, when the user marks that todo as done or not done, or deletes it, then the page shows "This todo no longer exists", todo-web requests `GET /todos` again and the list shown is the one that request returned (so the missing todo is gone). (product AC-001.11)
- **AC-001.17** Given todo-api is unavailable for `GET /todos`, when the user opens the page, then the page (not the error page) is shown within 10 seconds with the message "Todos are unavailable, please try again", shows no todos and does not show "No todos yet". (product AC-001.12)
- **AC-001.18** Given the page shows todos and todo-api is unavailable for `POST /todos`, when the user adds "Buy milk", then within 10 seconds the page shows "Todos are unavailable, please try again", no todo "Buy milk" is in the list, and the input still contains "Buy milk". (product AC-001.12)
- **AC-001.19** Given the page shows a todo and todo-api is unavailable for `PATCH /todos/{id}`, when the user marks it as done or not done, then within 10 seconds the page shows "Todos are unavailable, please try again" and the todo is shown in its previous done state (any intermediate display is rolled back). (product AC-001.12)
- **AC-001.20** Given the page shows a todo and todo-api is unavailable for `DELETE /todos/{id}`, when the user deletes it, then within 10 seconds the page shows "Todos are unavailable, please try again" and the todo is shown in the list at its previous position. (product AC-001.12)
- **AC-001.21** Given todo-api accepts the connection but sends no answer, when the user opens the page or adds, changes or deletes a todo, then todo-web gives up on that request after 5 seconds and shows "Todos are unavailable, please try again" before 10 seconds have passed since the action. (product AC-001.12)
- **AC-001.22** Given todo-api answers a request with a status or `code` the contract does not list for that endpoint (for example `422 invalid_request` or `400`), when the user adds, changes or deletes a todo, then the page shows "Todos are unavailable, please try again" and the change is not shown as saved. (product AC-001.12)
- **AC-001.23** Given todos were added through the page in one browser, when the page is opened in a second browser with no shared state, then the second browser shows the same todos in the same order, taken from `GET /todos`; no sign-in is asked for. (product AC-001.13)
- **AC-001.24** Given the user has used the page (opened it, added, toggled and deleted todos), when the browser's storage is inspected, then no todo data is held in localStorage, sessionStorage, IndexedDB or cookies, and every list the page shows comes from todo-api. (product AC-001.13)
- **AC-001.25** Given `TODO_API_URL` is set to the address of a mocked todo-api, when the page is opened and todos are added, changed and deleted, then every request reaches that address from the todo-web server, the browser makes no request to that address, and the value of `TODO_API_URL` does not appear in any file sent to the browser. (product AC-001.13)

## Non-goals

- Reachability at `http://todo-web.todo-dev.localhost:8088/`, the hostname, the Gateway and setting `TODO_API_URL` in `dev`: owned by the `todo` gitops repo (product AC-001.1).
- Validating, trimming or storing titles authoritatively, persistence across restarts (product AC-001.14) and ordering: owned by todo-api; todo-web only mirrors the rules for early feedback.
- Editing a todo's title, reordering, filtering, due dates, multiple lists, sign-in or per-user lists.
- Live updates between tabs or browsers (a change elsewhere is seen after a reload or after the refresh of AC-001.16).
- Retrying failed requests automatically, offline use, or caching todos in the browser.
- Promotion to `staging` or `prod`.

## Open questions

- ~~Confirm: an answer from todo-api the contract does not list for that endpoint (e.g. `422 invalid_request`, `400`) is shown as "Todos are unavailable, please try again" with the change not shown as saved. (suggested: yes; affects AC-001.22)~~ Answered: yes, any response the contract does not list for that endpoint is shown as "Todos are unavailable, please try again" and the change is not shown as saved; see AC-001.22.

## Changelog

- 2026-10-08 created
- 2026-10-08 amended: open question on responses the contract does not list answered (shown as unavailable, change not saved); confirms AC-001.22, no criteria added or withdrawn
- 2026-10-08 approved
- 2026-10-08 building
