# Verification — 002 Edit a todo's title in place in the list

**Result:** pass
**Commit:** 185af73 · **Base:** 5444245 · **Trace:** 25/25 criteria named by tests (`tests/todo-edit.test.tsx`)

Acceptance tests were committed red in `3257a5c` and are unchanged since (`git diff --stat 3257a5c..HEAD -- tests/` shows only the new `tests/todo-title-internals.test.ts`). Test run: 123/123 pass, coverage gate met.

| Criterion | Verdict | Tests | Implementation | Notes |
|---|---|---|---|---|
| AC-002.1 | met | `tests/todo-edit.test.tsx` "AC-002.1 each todo row has its own visible 'Edit' control…" (l.46) | `app/_components/todo-list.tsx:257-269` | per-row `Edit` button, no `Title` textbox on load |
| AC-002.2 | met | "AC-002.2 Edit swaps the title for a focused input…" (l.57) | `todo-list.tsx:157-161`, `:233-250`, focus `:35-37` | asserts same `listitem`, value, focus, Save/Cancel, URL unchanged, no dialog, no API call, other row intact |
| AC-002.3 | met | "AC-002.3 choosing Edit on another row…" (l.77) | `todo-list.tsx:23`, `:160` | single `editing` state, so at most one row; no PATCH |
| AC-002.4 | met | "AC-002.4 saving via enter/save…" (l.92), "AC-002.4 a message shown before is removed…" (l.108) | `todo-list.tsx:171-193`; `app/_lib/todo-api.ts:121-125`; `app/actions.ts:23-27` | `toEqual({title: "Buy oat milk"})` proves there is no `done`; one PATCH; GET count unchanged, so no reload |
| AC-002.5 | met | "AC-002.5 after a save and a reload…" (l.122) | `app/page.tsx:18`; `todo-list.tsx:23` (edit state starts `null`) | |
| AC-002.6 | met | "AC-002.6 the edited todo keeps its position and its done state" (l.135) | `todo-list.tsx:191` (replace in place with `map`) | order A, B2, C; B still checked |
| AC-002.7 | met | "AC-002.7 the row shows exactly the title and done state of todo-api's answer" (l.147) | `todo-list.tsx:191` | row shows the server's `title`/`done`, not the typed value |
| AC-002.8 | met | "AC-002.8 escape/cancel leaves edit mode…" (l.162) | `todo-list.tsx:163-169`, `:209-211`, `:247`, focus effect `:39-48` | no non-GET call; focus on "Edit Buy milk" |
| AC-002.9 | met | "AC-002.9 a pointer press on %s cancels…" (l.175-189; body, heading, add input, other row) | `todo-list.tsx:50-64` (capture `pointerdown` on `document`) | |
| AC-002.10 | met | "AC-002.10 a press inside the input does not cancel…" (l.191), "AC-002.10 a press on Cancel…" (l.207) | `todo-list.tsx:55-57` (input/Save/Cancel ignored) | |
| AC-002.11 | met | "AC-002.11 saving \"\"/\"   \" sends no PATCH…" (l.217) | `todo-list.tsx:176-180`; server guard `app/actions.ts:24-25` (internals test l.69) | |
| AC-002.12 | met | "AC-002.12 a 201 code point title…" (l.228) | `app/_lib/todo.ts:29-31` (`[...title].length`) | uses 201 emoji with surrounding spaces, so it checks code points after trimming |
| AC-002.13 | met | "AC-002.13 a title of exactly 200 code points (a / 😀)…" (l.240) | `todo.ts:31`; `todo-list.tsx:191` | |
| AC-002.14 | met | "AC-002.14 422 title_required/title_too_long…" (l.252) | `todo-api.ts:126-129`; `todo-list.tsx:199-200` | API message "banana" ignored; draft kept; label does not show the new title |
| AC-002.15 | met | "AC-002.15 leading and trailing spaces are removed…" (l.267) | `actions.ts:24,26` (sends `checked.title`); `todo-list.tsx:191` | |
| AC-002.16 | met | "AC-002.16 404 todo_not_found…" (l.280) | `actions.ts:7-11,26`; `todo-list.tsx:194-198` | GET +1 asserted. Weak spot: the shown list `["Call mum"]` matches both the refreshed list and the local drop fallback. Internals test "on not_found returns the refreshed list" (`tests/todo-title-internals.test.ts:84`) and `todo-list.tsx:197-198` (uses `fresh` first) cover the gap |
| AC-002.17 | met | "AC-002.17 todo-api down/503…" (l.294), "AC-002.17 a PATCH that never answers is aborted after 5 s…" (l.311) | `todo-api.ts:7,56,59-62,133`; `todo-list.tsx:199-205` | `AbortSignal.timeout(5000)` asserted (under 10 s); one PATCH; draft kept; Cancel shows "Buy milk"; reload shows "Buy milk" |
| AC-002.18 | met | "AC-002.18 an unlisted answer (422 invalid_request / 400 / invalid 200)…" (l.327) | `todo-api.ts:66-75,126-133` | |
| AC-002.19 | met | "AC-002.19 a second Enter or Save sends nothing…" (l.347) | `todo-list.tsx:173` (guard), `:164` (cancel guard), `:51` (no outside listener while saving), `:241,244,247` (readOnly/disabled) | |
| AC-002.20 | met | "AC-002.20 the PATCH is made by the server path…" (l.373), "AC-002.20 the client component only calls the setTodoTitle action…" (l.392) | `todo-list.tsx:6-7` (imports only `app/_lib/todo`); `todo-api.ts:45-57` | storage, IndexedDB and cookies checked; isolation test still guards against importing `todo-api` from the client |
| AC-002.21 | met | "AC-002.21 saving the same title (after trimming)…" (l.411) | `todo-list.tsx:181-186` | |
| AC-002.22 | met | "AC-002.22 each Edit control has visible text 'Edit'…" (l.424) | `todo-list.tsx:258-268` | |
| AC-002.23 | met | "AC-002.23 in edit mode the input is named Title…" (l.436) | `todo-list.tsx:234-249` | edit form has no name, so "Add a todo" stays the only form landmark |
| AC-002.24 | met | "AC-002.24 one click on another row's checkbox / Delete / Add…" (l.449, 464, 478) | `todo-list.tsx:50-64` (no `preventDefault`/`stopPropagation`); spec 001 handlers `:74-155` unchanged | the toggle sends `PATCH {done: true}` for Call mum only |
| AC-002.25 | met | "AC-002.25 after a successful save focus is on the todo's Edit control…" (l.495) | `todo-list.tsx:193`, `:39-48` | |

## Non-goals

- No toggle or delete from edit mode: the edit row renders only the input, Save and Cancel (`todo-list.tsx:233-250`). ✔
- No dialog or separate page, no multi-edit (single `editing` state). ✔
- No cross-tab detection, history, undo or `updated_at`. ✔
- No automatic retry (`send` makes one request, `todo-api.ts:45-64`); no draft persisted (AC-002.20 test). ✔
- No gitops or deployment changes. ✔
- Title validation in todo-web is advisory only. `validateTitle` uses JS `trim()`, which differs at the edges from the contract's Python `str.strip()` (for example U+001C–U+001F and U+FEFF). todo-api decides, and its 422 is mapped (AC-002.14), so this is acceptable under the first non-goal.

## Deviations from the plan

- `tests/helpers/mock-todo-api.ts`, `tests/todo-isolation.test.tsx`, `tests/todo-edit.test.tsx`: in no task's `files`, but they are the red acceptance-test commit (`3257a5c`) that `design.md` § Tests and the plan preamble require. Acceptable.
- `tests/todo-title-internals.test.ts`: unit tests for the internals, added in QA (`185af73`). Acceptable.
- `docs/security/scan-2026-10-09.md`: security scan report (0 findings). Acceptable.
- Both tasks t1 and t2 are `done: true`.
- Lint warning: `titles` is unused in `tests/todo-edit.test.tsx:15`. It is cosmetic, and the file is a frozen acceptance test, so coders may not edit it. Acceptable. Remove it in a later test-only change if wanted.

## Contract

- `design.md` contract is followed. `updateTodoTitle` (`todo-api.ts:121-134`) reuses `send`/`readTodo`/`errorCode`/`unavailable`, has the specified allowlist (200 → Todo, 422 `title_required`/`title_too_long`, 404 `todo_not_found`, everything else unavailable) and encodes the id. `updateTodoDone` is byte-for-byte unchanged. The `setTodoTitle` action matches the specified shape (`actions.ts:23-27`). `TodoActions` gained only `setTodoTitle` (`todo.ts:12`). The page wiring matches (`page.tsx:18`). The UI DOM contract matches (Edit `type="button"` with `aria-label`, unnamed `noValidate` form, `Title` input with no `required`/`maxLength` and `readOnly` while saving, Save `submit`, Cancel `button`).
- Cross-repo contract (`ika100/todo` `docs/plan/002-update-a-notice.md`, PATCH `/todos/{id}`) is followed. The body is `{"title": ...}` only, never `done`. Status and code branching never uses `message`. The 5 s timeout and no retry are reused from spec 001.
  - Difference from the product plan: the product plan names the control "Edit" and sends the "input value". This repo uses the accessible name "Edit <title>" with visible text "Edit", and sends the trimmed value. Both are recorded repo-level decisions (spec Changelog 2026-10-08, AC-002.15) and agree with the contract (todo-api trims anyway). Acceptable.
