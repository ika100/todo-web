---
spec_id: 002-edit-a-todo-s-title-in-place-in-the-list
title: Edit a todo's title in place in the list (Edit, Save, Cancel, Enter/Escape, click outside cancels)
status: draft
priority: P1
shape: web-nextjs
parent: ika100/todo:002-update-a-notice
---

# 002 — Edit a todo's title in place in the list (Edit, Save, Cancel, Enter/Escape, click outside cancels)

## Problem

The todo list (spec 001) lets a user add, tick off and delete todos, but a todo's title can't be changed after it is added. To fix a typo or make a task more precise ("Buy milk" to "Buy oat milk"), the user has to delete the todo and add it again. That loses its place in the list, because the list is ordered oldest first, and it loses its done state. Spec 001 left title editing out on purpose; this spec adds it.

## Product context

Slice of the product plan `002-update-a-notice` in `ika100/todo` for `todo-web` (web-nextjs). The product criteria and the contract below are binding: every criterion of this spec implements one of them and names it: `(product AC-<NNN>.<n>)`.

### Product criteria

- **AC-002.1** Given a todo "Buy milk" in the list, when the user chooses that todo's "Edit" control (each todo has one), then the title is shown in place in the list (no separate page or dialog) in an editable input that already holds "Buy milk", and only this one todo is in edit mode.
- **AC-002.2** Given a todo "Buy milk" in edit mode, when the user changes the title to "Buy oat milk" and saves (with the Enter key or a "Save" control), then the todo is shown in place in the list as "Buy oat milk" without a full page reload, and it is still shown as "Buy oat milk" after the page is reloaded.
- **AC-002.3** Given a todo whose title was changed, when the list is shown, then the todo keeps its done state and its position in the list (ordering by creation time is unaffected by the change).
- **AC-002.4** Given a todo in edit mode with a changed title, when the user cancels (with the Escape key or a "Cancel" control), then edit mode ends, the original title is shown and nothing is saved, including after a page reload.
- **AC-002.5** Given a todo in edit mode, when the user saves a title that is empty or only whitespace, then the title is not changed, the todo stays in edit mode and the page shows "Title is required".
- **AC-002.6** Given a todo in edit mode, when the user saves a title longer than 200 characters, then the title is not changed, the todo stays in edit mode and the page shows "Title must be at most 200 characters"; a title of exactly 200 characters is saved.
- **AC-002.7** Given a todo in edit mode, when the user saves a title with leading or trailing spaces, then the todo is stored and shown with those spaces removed.
- **AC-002.8** Given a todo that was deleted in another browser tab, when the user saves a new title for it in the current tab, then the page shows "This todo no longer exists" and the list is refreshed from todo-api.
- **AC-002.9** Given todo-api is unreachable, when the user saves a new title, then the page shows "Todos are unavailable, please try again" within 10 seconds, the change is not shown as saved and the todo keeps its previous title after a page reload.
- **AC-002.10** Given the same todo is edited in two browser tabs, when both save different titles one after the other, then the title saved last is the one shown after reloading either tab (last save wins, no conflict warning).
- **AC-002.11** Given a todo in edit mode with a changed title, when the user clicks anywhere on the page outside that todo's input, "Save" and "Cancel" controls, then edit mode ends, the original title is shown and nothing is saved, including after a page reload.

### Contract

Base URL inside the environment: `http://todo-api` (env `TODO_API_URL` on todo-web, already set). All bodies are
JSON (`Content-Type: application/json`, UTF-8). No authentication, no user scoping: one shared list. Everything in
spec 001's contract stays valid; this plan changes only `PATCH /todos/{id}`. The full contract is restated here so
each repo's spec is self-contained.

### Todo object (unchanged)

| Field | Type | Notes |
|---|---|---|
| `id` | string | UUID (v4), assigned by todo-api; never changes |
| `title` | string | trimmed, 1..200 Unicode code points; changeable with PATCH |
| `done` | boolean | `false` on creation; changeable with PATCH |
| `created_at` | string | RFC 3339 timestamp in UTC; set on creation, **never changed by PATCH** |

No new field (no `updated_at`).

### Endpoints

**`GET /todos`** (unchanged) — `200`, JSON array of Todo objects ordered by `created_at` ascending, then `id`
ascending. An edited todo keeps its position.

**`POST /todos`** (unchanged) — `{"title": "<string>"}` -> `201` Todo; `422` `title_required` / `title_too_long` /
`invalid_request` as in spec 001.

**`PATCH /todos/{id}`** (extended) — change the title, the done state, or both.

- Request: a JSON object with at least one of
  - `title`: string — the new title;
  - `done`: boolean — the new done state (spec 001 behaviour).
  Unknown fields are ignored. todo-web sends `{"title": "..."}` for an edit and `{"done": true|false}` for a toggle.
- Rules, applied in this order (the first failing rule answers):
  1. body is not a JSON object -> `422 invalid_request`;
  2. neither `title` nor `done` is present -> `422 invalid_request`;
  3. `done` is present and not a boolean -> `422 invalid_request`;
  4. `title` is present and `null` -> `422 title_required`;
  5. `title` is present and not a string -> `422 invalid_request`;
  6. `title` trimmed (leading and trailing Unicode whitespace, as Python `str.strip()`) is empty -> `422 title_required`;
  7. trimmed `title` longer than 200 code points -> `422 title_too_long` (exactly 200 is accepted);
  8. no todo with this id (including ids that are not valid UUIDs and deleted todos) -> `404 todo_not_found`.
- `200` — the updated Todo object, with the trimmed `title`. Fields not in the request keep their values;
  `created_at` and `id` never change. Setting a field to its current value is a no-op that still returns `200`.
- A failed request (422, 404, 503) writes nothing.
- Concurrency: no version or precondition check. Concurrent PATCHes are applied in commit order; the last one wins
  and no conflict status is ever returned.

**`DELETE /todos/{id}`** (unchanged) — `204`; `404 todo_not_found` for unknown, invalid or already deleted ids.

### Errors

Every 4xx/5xx response produced by todo-api has this body (unchanged from spec 001):

```json
{"error": {"code": "title_required", "message": "Title is required"}}
```

| HTTP | `code` | `message` | todo-web shows (edit save) |
|---|---|---|---|
| 422 | `title_required` | `Title is required` | "Title is required", stays in edit mode |
| 422 | `title_too_long` | `Title must be at most 200 characters` | "Title must be at most 200 characters", stays in edit mode |
| 422 | `invalid_request` | free text | "Todos are unavailable, please try again" (todo-web never sends such a body; treated as unexpected) |
| 404 | `todo_not_found` | `This todo no longer exists` | "This todo no longer exists", leaves edit mode, re-fetches the list |
| 503 | `unavailable` | `Todos are unavailable, please try again` | "Todos are unavailable, please try again" |

todo-web branches on HTTP status and `code`, never on `message`. Any response the contract does not list (another
status, a 4xx without the error body, a 2xx without a valid Todo) is treated like a 5xx: "Todos are unavailable,
please try again", and the title is not shown as saved.

### Timeouts

- todo-web -> todo-api, every call (including the new title PATCH and the list re-fetch after a 404): 5 s. No
  answer within 5 s, a connection error or any 5xx is "unavailable" (well under the 10 s of AC-002.9). No retries:
  the user retries by saving again.
- todo-api -> Postgres: the existing per-operation deadline; when the database is unreachable or slow, todo-api
  answers `503 unavailable` and writes nothing.
- If the 5 s timeout fires on todo-web while todo-api still commits the update, a later reload may show the new
  title; the web never claims it was saved. This is accepted (AC-002.9 only covers todo-api being unreachable).

### Configuration

No change: todo-web keeps `TODO_API_URL=http://todo-api`; todo-api keeps `DATABASE_URL` from the postgres addon. No
events: the only interaction is synchronous HTTP from todo-web to todo-api.

### Notes for this repo

Same server-side call path as spec 001: the browser never calls todo-api; the save goes through a Server Action
or app/api route handler to TODO_API_URL with the existing 5 s timeout and error mapping (reuse it, do not add a
second client). Saving sends `{"title": ...}` only, never `done`, so a concurrent toggle in another tab is not
overwritten. Test against a mocked todo-api that follows the contract below.

## Stories

As a user, I want to change the title of a todo right where it is in the list, so that I can fix a typo or refine a task without losing its place or its done state.

As a user, I want Escape, a "Cancel" control or a click elsewhere to throw away a change I started, so that I never change a todo by accident.

As a user, I want a clear message when my new title can't be saved, so that I never believe a title was changed when it was not.

## Acceptance criteria

All requests to todo-api below are made by the todo-web server to the base URL in `TODO_API_URL`, never by the browser. "Unavailable" means, as in the contract and in spec 001: a connection error, any 5xx answer, or no answer within 5 seconds. "Edit mode" means the row shows an editable input instead of its title. Spec 001's behaviour (add, toggle, delete, messages) stays as it is.

- **AC-002.1** Given todo-api returns todos "Buy milk" and "Call mum", when the page is shown, then each todo row has its own control with the visible text "Edit", and no row is in edit mode. (product AC-002.1)
- **AC-002.2** Given a todo "Buy milk" in the list, when the user chooses its "Edit" control, then in the same row of the list (the URL does not change and no dialog opens) the title is replaced by a text input that holds "Buy milk" and has keyboard focus, next to a control "Save" and a control "Cancel"; no request is sent to todo-api and every other row is unchanged. (product AC-002.1)
- **AC-002.3** Given todo "Buy milk" is in edit mode with a changed input, when the user chooses "Edit" on todo "Call mum", then "Buy milk" leaves edit mode showing its original title, nothing is sent to todo-api for it, and "Call mum" is in edit mode; at no time is more than one row in edit mode. (product AC-002.1)
- **AC-002.4** Given todo "Buy milk" (id X) is in edit mode and todo-api answers `PATCH /todos/X` with `200` and a Todo titled "Buy oat milk", when the user changes the input to "Buy oat milk" and saves by pressing Enter in the input or by choosing "Save", then todo-api receives exactly one `PATCH /todos/X` whose body is exactly `{"title": "Buy oat milk"}` (no `done` field), the row leaves edit mode and shows "Buy oat milk" without a full page reload, and any message shown before is removed. (product AC-002.2, product AC-002.10)
- **AC-002.5** Given a title was saved as in AC-002.4 and `GET /todos` now returns it as "Buy oat milk", when the page is reloaded, then the todo is shown as "Buy oat milk" and no row is in edit mode. (product AC-002.2)
- **AC-002.6** Given todo-api returns todos A (not done), B (done), C (not done) in that order, when the user edits B's title and todo-api answers the `PATCH` with `200` and B with the new title and `done: true`, then the list shows A, B, C in that order and B is still shown as done (the edited todo is not moved or re-sorted). (product AC-002.3)
- **AC-002.7** Given a todo is saved and todo-api's `200` answer carries a title or done state different from what the row showed (for example a change made in another tab), when the row leaves edit mode, then it shows exactly the `title` and `done` of that answer. (product AC-002.10, product AC-002.3)
- **AC-002.8** Given todo "Buy milk" is in edit mode with the input changed to "Buy oat milk", when the user presses Escape in the input or chooses "Cancel", then the row leaves edit mode showing "Buy milk", no request is sent to todo-api, and keyboard focus is on that todo's "Edit" control. (product AC-002.4)
- **AC-002.9** Given todo "Buy milk" is in edit mode with the input changed to "Buy oat milk", when the user presses the pointer anywhere on the page outside that row's input, "Save" and "Cancel" controls (for example on the page background, the heading, the add input or another todo row), then the row leaves edit mode showing "Buy milk" and no request is sent to todo-api for that todo (a control hit by the press still acts, see AC-002.24). (product AC-002.11)
- **AC-002.10** Given todo "Buy milk" is in edit mode with the input changed to "Buy oat milk", when the user presses the pointer inside the input or presses and releases it on "Save", then edit mode is not cancelled by that press; choosing "Save" saves as in AC-002.4. (product AC-002.11, product AC-002.2)
- **AC-002.11** Given a todo is in edit mode, when the user saves an input that is empty or made only of whitespace, then no `PATCH` reaches todo-api, the row stays in edit mode with the typed value, the list still shows no changed title, and the page shows "Title is required". (product AC-002.5)
- **AC-002.12** Given a todo is in edit mode, when the user saves an input that is 201 Unicode code points long after removing leading and trailing whitespace, then no `PATCH` reaches todo-api, the row stays in edit mode with the typed value and the page shows "Title must be at most 200 characters". (product AC-002.6)
- **AC-002.13** Given a todo is in edit mode, when the user saves a title of exactly 200 code points, including a title of 200 emoji characters (each one code point but two UTF-16 units), then it is sent to todo-api and, on `200`, the row shows the new title and leaves edit mode. (product AC-002.6)
- **AC-002.14** Given todo-api answers the title `PATCH` with `422` and code `title_required` or `title_too_long`, when the user saves, then the row stays in edit mode with the typed value, the list does not show the new title, and the page shows "Title is required" or "Title must be at most 200 characters" respectively, whatever text the API's `message` contains. (product AC-002.5, product AC-002.6)
- **AC-002.15** Given a todo in edit mode, when the user enters "  Buy oat milk  " and saves, then the `PATCH` body is `{"title": "Buy oat milk"}` and the row shows "Buy oat milk" with no leading or trailing spaces; the title shown after a save is always the `title` todo-api returned. (product AC-002.7)
- **AC-002.16** Given todo-api answers the title `PATCH /todos/X` with `404` and code `todo_not_found`, when the user saves, then the page shows "This todo no longer exists", no row is in edit mode, todo-web requests `GET /todos` again and the list shown is the one that request returned. (product AC-002.8)
- **AC-002.17** Given todo-api is unavailable for the title `PATCH`, when the user saves "Buy oat milk" for todo "Buy milk", then within 10 seconds the page shows "Todos are unavailable, please try again", exactly one `PATCH` was sent (no automatic retry), the row stays in edit mode with "Buy oat milk" in the input so the user can save again, and choosing "Cancel" then shows "Buy milk". (product AC-002.9)
- **AC-002.18** Given todo-api answers the title `PATCH` with a response the contract does not list (for example `422 invalid_request`, `400`, or a `200` whose body is not a valid Todo), when the user saves, then the page shows "Todos are unavailable, please try again" and the row behaves as in AC-002.17 (new title not shown as saved). (product AC-002.9)
- **AC-002.19** Given a save is waiting for todo-api's answer, when the user presses Enter again or chooses "Save" again, then no second `PATCH` is sent for that todo, and Escape, "Cancel" or a pointer press outside the row do not end edit mode before the answer arrives. (product AC-002.2)
- **AC-002.20** Given `TODO_API_URL` points to a mocked todo-api, when the user saves a new title, then the `PATCH` reaches that address from the todo-web server, the browser makes no request to that address, and no title, draft or todo data is written to localStorage, sessionStorage, IndexedDB or cookies. (product AC-002.2)
- **AC-002.21** Given todo "Buy milk" is in edit mode and the input, after removing leading and trailing whitespace, equals "Buy milk", when the user saves, then the row leaves edit mode showing "Buy milk" and no request is sent to todo-api. (product AC-002.2)
- **AC-002.22** Given todo-api returns todos "Buy milk" and "Call mum", when the page is shown, then each row's edit control shows the visible text "Edit" and has the accessible name "Edit <title>" of its own todo ("Edit Buy milk", "Edit Call mum"), so screen-reader users can tell the rows apart. (product AC-002.1)
- **AC-002.23** Given todo "Buy milk" is in edit mode, when the row is inspected by role and accessible name, then its text input is named "Title", and its two controls are buttons named "Save" and "Cancel". (product AC-002.1, product AC-002.2, product AC-002.4)
- **AC-002.24** Given todo "Buy milk" is in edit mode with the input changed to "Buy oat milk" and todo "Call mum" is not done, when the user clicks a control outside that row (for example "Call mum"'s done checkbox, "Call mum"'s "Delete", or the "Add" button), then in that same single click "Buy milk" leaves edit mode showing "Buy milk" with nothing sent to todo-api for it, and the clicked control does its normal spec 001 action (here: `PATCH /todos/<id of Call mum>` with `{"done": true}` is sent and "Call mum" is shown as done), without a second click. (product AC-002.11)
- **AC-002.25** Given todo "Buy milk" is saved as "Buy oat milk" and todo-api answers `200`, when the row leaves edit mode, then keyboard focus is on that todo's edit control, now named "Edit Buy oat milk". (product AC-002.2)

## Non-goals

- Validating, trimming and storing titles authoritatively, keeping `created_at` and ordering on an edit, and last-save-wins semantics: owned by todo-api; todo-web only mirrors the title rules for early feedback.
- Changing the done state or deleting a todo from edit mode; the done state is still changed with spec 001's control.
- Editing on a separate page or in a dialog, editing several todos at once.
- Detecting or warning about edits in another tab, live updates between tabs (a change elsewhere is seen after a reload, a save, or the refresh of AC-002.16).
- History of changes, undo, showing when a todo was last changed.
- Retrying a failed save automatically, or keeping an unsaved draft across a page reload.
- Deployment, exposure, `TODO_API_URL` wiring and promotion to `staging` or `prod`: owned by the `todo` gitops repo.

## Open questions

- ~~Accessible names: should each edit control be named "Edit <title>" (visible text stays "Edit"), and the input "Title" with Save/Cancel named "Save" and "Cancel"?~~ Answered: yes, see AC-002.22 and AC-002.23 (repo-level decision, see Changelog).
- ~~When a pointer press outside the row cancels edit mode and lands on another control, should that control also do its normal action in the same click?~~ Answered: yes, the edit is cancelled and the control acts as usual in the same click, see AC-002.9 and AC-002.24.
- ~~Confirm: while a save is waiting for todo-api, a second Enter or "Save" sends nothing; Escape, "Cancel" and clicks outside are ignored until the answer arrives.~~ Answered: confirmed, see AC-002.19.
- ~~Confirm: after Escape or "Cancel" keyboard focus returns to that todo's "Edit" control. Should the same happen after a successful save?~~ Answered: yes to both, see AC-002.8 and AC-002.25.
- ~~Confirm: saving an unchanged title (after trimming) just leaves edit mode without calling todo-api.~~ Answered: confirmed, see AC-002.21.
- ~~Confirm: after an unavailable or unexpected answer the row stays in edit mode with the typed value so the user can save again.~~ Answered: stays in edit mode with the typed value, see AC-002.17 and AC-002.18.

## Changelog

- 2026-10-08 created
- 2026-10-08 amended: all six open questions answered. Added AC-002.22 (edit control accessible name "Edit <title>"), AC-002.23 (input named "Title", buttons "Save" and "Cancel"), AC-002.24 (a click outside that lands on another control cancels the edit and that control acts in the same click) and AC-002.25 (focus returns to the todo's edit control after a successful save); clarified AC-002.9 (no request for the edited todo); confirmed AC-002.8, AC-002.17, AC-002.18, AC-002.19 and AC-002.21 unchanged. Repo-level decision beyond the product contract (which only says "Edit"): the edit control's accessible name is "Edit <title>" (visible text stays "Edit"), the input's is "Title", and the buttons' are "Save" and "Cancel", matching spec 001's "Delete <title>".
