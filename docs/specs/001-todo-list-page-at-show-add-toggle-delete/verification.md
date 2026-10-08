# Verification — 001 Todo list page at / (show, add, toggle, delete todos) backed by todo-api

**Result:** pass
**Commit:** 93cbd1f · **Base:** 0110608 · **Trace:** 25/25 criteria named by tests

Tests run (Phase 3, plus fix cycle 1 in `93cbd1f`): `devbox run bundle-check` pass (re-run by the reviewer: build succeeded, `/` built as dynamic `ƒ`, placeholder not in `.next/static`), `devbox run quality` pass, `devbox run test` 70/70 (96.79 % lines, 94.33 % functions), `devbox run security` pass. Acceptance tests from `b77b097` are unchanged since that commit (`git diff b77b097..HEAD -- tests` shows only the deleted template test and the added `tests/todo-api-branches.test.ts`).

| Criterion | Verdict | Tests | Implementation | Notes |
|---|---|---|---|---|
| AC-001.1 | met | `tests/todo-page.test.tsx` "AC-001.1 GET / renders the todo list page…" | `app/page.tsx:7`, `app/page.tsx:10-21`, `app/_components/todo-list.tsx:116-123` | The page is rendered in-process (`render(await HomePage())`), as design.md "Page and UI" allows. No HTTP or container-level `GET /` test. The landing page is gone: its components were deleted, and the test asserts one `h1` "Todos" and no "Get started". |
| AC-001.2 | met | `tests/todo-health.test.ts` "AC-001.2 …answer as before" | `app/api/{health,ready,metrics}` (no diff since base) | Status and body asserted for health and ready; metrics status and content-type asserted. |
| AC-001.3 | met | `tests/todo-page.test.tsx` "AC-001.3 shows 'No todos yet'…" | `app/_components/todo-list.tsx:129`, `:117-123` | |
| AC-001.4 | met | `tests/todo-page.test.tsx` "AC-001.4 shows exactly three todos…" | `app/_components/todo-list.tsx:131-136`, `app/globals.css` `.todo-item[data-done="true"] .todo-title` | Order, `data-done`, checkbox `checked` (accessible) and the absence of the empty state are all asserted. |
| AC-001.5 | met | `tests/todo-api-client.test.ts` "AC-001.5 returns todos in exactly the order…"; `tests/todo-page.test.tsx` "AC-001.5 keeps the order…" | `app/_lib/todo-api.ts:89-95`, `app/_components/todo-list.tsx:132` | Fixture order Z, A, M is neither alphabetical nor by id. |
| AC-001.6 | met | `tests/todo-page.test.tsx` "AC-001.6 adds 'Buy milk' via the button…", "AC-001.6 adds by pressing Enter" | `app/_components/todo-list.tsx:32`, `:44-45`; `app/actions.ts:13-17`; `app/_lib/todo-api.ts:98-102` | Asserts one POST with body `{title:"Buy milk"}`, the todo appended last with `data-done=false`, an empty input and no second GET (no reload). |
| AC-001.7 | met | `tests/todo-page.test.tsx` "AC-001.7 blocks empty/whitespace…" (`""`, `"   "`); `tests/todo-api-client.test.ts` "AC-001.7 addTodo never calls todo-api…"; `tests/todo-lib.test.ts` | `app/_lib/todo.ts:29`, `app/_components/todo-list.tsx:35-39`, `app/actions.ts:14-15` | Validated on both client and server. |
| AC-001.8 | met | `tests/todo-page.test.tsx` "AC-001.8 shows 'Title is required' on 422…"; `tests/todo-api-client.test.ts` "AC-001.8 and AC-001.11 branch on the error code…" | `app/_lib/todo-api.ts:103-106`, `app/_components/todo-list.tsx:47` | The API message is "banana", so the code is used and the message ignored. |
| AC-001.9 | met | `tests/todo-page.test.tsx` "AC-001.9 blocks a 201 code point title…"; `tests/todo-api-client.test.ts` "AC-001.9 addTodo never calls…"; `tests/todo-lib.test.ts` | `app/_lib/todo.ts:30`, `app/_components/todo-list.tsx:35-39`, `app/actions.ts:15` | Tested with 201 emoji plus padding spaces, so code points are counted after trimming. |
| AC-001.10 | met | `tests/todo-page.test.tsx` "AC-001.10 accepts a title of exactly 200 code points" (`a`, `😀`); `tests/todo-api-client.test.ts` "AC-001.10…"; `tests/todo-lib.test.ts` | `app/_lib/todo.ts:30` (`[...title].length`) | |
| AC-001.11 | met | `tests/todo-page.test.tsx` "AC-001.11 shows 'Title must be at most 200 characters' on 422…"; `tests/todo-api-client.test.ts` "AC-001.8 and AC-001.11…" | `app/_lib/todo-api.ts:103-106` | |
| AC-001.12 | met | `tests/todo-page.test.tsx` "AC-001.12 shows the title todo-api returned…"; `tests/todo-api-client.test.ts` "AC-001.12 addTodo sends the trimmed title…" | `app/_components/todo-list.tsx:44` (appends `result.data`), `app/actions.ts:16` | No test has todo-api return a title that differs from the trimmed input, so "always the title todo-api returned" is shown by the code (`:44`), not by a test. |
| AC-001.13 | met | `tests/todo-page.test.tsx` "AC-001.13 marks a todo as done…"; `tests/todo-api-client.test.ts` "AC-001.13 setTodoDone sends {done:true}…" | `app/_components/todo-list.tsx:56-64`, `app/_lib/todo-api.ts:110-114` | Path, body, the shown state and the state after a re-render from `GET /todos` are all asserted. |
| AC-001.14 | met | `tests/todo-page.test.tsx` "AC-001.14 marks a done todo as not done…" | `app/_components/todo-list.tsx:56-64`, `app/_lib/todo-api.ts:110-114` | |
| AC-001.15 | met | `tests/todo-page.test.tsx` "AC-001.15 deletes without confirmation…"; `tests/todo-api-client.test.ts` "AC-001.15 deleteTodo sends DELETE…" | `app/_components/todo-list.tsx:81-86`, `:138-146`; `app/_lib/todo-api.ts:121-125` | The test asserts `confirm` is not called and no dialog appears. |
| AC-001.16 | met | `tests/todo-page.test.tsx` "AC-001.16 %s on a vanished todo…" (toggle, delete); `tests/todo-api-client.test.ts` two AC-001.16 tests | `app/actions.ts:7-11`, `:19-25`; `app/_components/todo-list.tsx:65-68`, `:97-100`; `app/_lib/todo-api.ts:115`, `:126` | Asserts the message, exactly one extra GET, and the list replaced by the GET result. |
| AC-001.17 | met | `tests/todo-page.test.tsx` "AC-001.17 opening the page while todo-api is %s…" (down, 503); `tests/todo-api-client.test.ts` two AC-001.17 tests | `app/page.tsx:11-13`, `app/_components/todo-list.tsx:17-18`, `:129`; `app/_lib/todo-api.ts:47`, `:81` | The page renders with the heading (not the error page), no items and no empty state. |
| AC-001.18 | met | `tests/todo-page.test.tsx` "AC-001.18 failing add…" | `app/_components/todo-list.tsx:46-50` (input cleared only on `ok`) | |
| AC-001.19 | met | `tests/todo-page.test.tsx` "AC-001.19 failing toggle (done=%s)…" (both directions) | `app/_components/todo-list.tsx:69-75` | |
| AC-001.20 | met | `tests/todo-page.test.tsx` "AC-001.20 failing delete…" | `app/_components/todo-list.tsx:85-93`, `:101-108` | The middle item is restored to its middle position. |
| AC-001.21 | met | `tests/todo-page.test.tsx` "AC-001.21 a request that never answers…" (page load, add); `tests/todo-api-client.test.ts` "AC-001.21 gives up after 5 seconds…" | `app/_lib/todo-api.ts:56`, `:59-62` | The hang path is tested for open and add only. Change and delete use the same `send()` with an unconditional `AbortSignal.timeout(5000)` (`:56`), and their UI handling of `unavailable` is proven by AC-001.19 and AC-001.20. A hang test for PATCH/DELETE is recommended but not required. |
| AC-001.22 | met | `tests/todo-page.test.tsx` "AC-001.22 an unlisted answer (%s)…" (5 cases); `tests/todo-api-client.test.ts` "AC-001.22 maps statuses and codes…" | `app/_lib/todo-api.ts:74`, `:107`, `:118`, `:129` | Asserts the list is unchanged and the checkbox unchecked, so the change is not shown as saved. |
| AC-001.23 | met | `tests/todo-page.test.tsx` "AC-001.23 a second browser…" | `app/page.tsx:7`, `:11`; `app/_lib/todo-api.ts:55` (`no-store`) | Fresh render after `cleanup()` and clearing storage; asserts the same order, 2 GETs and no sign-in fields. |
| AC-001.24 | met | `tests/todo-isolation.test.tsx` "AC-001.24 holds no todo data…" | `app/_components/todo-list.tsx` (state only, no storage APIs; `grep` for `localStorage`, `sessionStorage`, `indexedDB` and `document.cookie` in `app/` finds none) | |
| AC-001.25 | met | `tests/todo-isolation.test.tsx` two AC-001.25 tests; `tests/todo-api-client.test.ts` "AC-001.25 sends every request to TODO_API_URL…"; `scripts/bundle-check.sh` (`devbox run bundle-check`) | `app/_lib/todo-api.ts:46`; `app/_components/todo-list.tsx:6-7` (imports only `todo.ts`) | Requests reach `TODO_API_URL` from the server only, and the client component makes no fetch. Fix cycle 1 adds `scripts/bundle-check.sh`, which builds with `TODO_API_URL=http://todo-api-bundle-check.invalid:9999` and greps `.next/static` for the URL and the host, exiting non-zero on a hit. The reviewer re-ran it: OK. The `/` HTML is rendered at request time and receives only todos as props, never the URL. |

## Non-goals

- No title editing, reordering, filtering, due dates, multiple lists, or sign-in or per-user lists. ✔
- No live updates between tabs: the list refreshes only on `not_found` (`app/actions.ts:7-11`), which is allowed. ✔
- No automatic retry, offline mode or browser caching: one `fetch` per call (`app/_lib/todo-api.ts:51`) and no storage APIs. ✔
- No authoritative validation or sorting in todo-web: validation is early feedback, the API's returned title is shown and no re-sort is done. ✔
- No gitops, hostname or promotion changes. ✔

## Deviations from the plan

- `tests/helpers/mock-todo-api.ts`, the five `tests/todo-*.test.ts[x]` acceptance files and `tests/todo-api-branches.test.ts` are in no task's `files`. These are the acceptance tests (written before the tasks) and extra unit tests. Acceptable.
- `docs/security/scan-2026-10-08.md` is in no task's `files`. It is the security phase output. Acceptable.
- All tasks t1 to t4 are `done: true`. ✔
- Plan t4 "Done when" (build passes, `.next/static` holds no `TODO_API_URL` value) is now evidenced by `devbox run bundle-check`, which the reviewer re-ran. ✔
- `scripts/bundle-check.sh` and `devbox.json` (new `bundle-check` recipe) are in no task's `files`. They were added in fix cycle 1 as the AC-001.25 proof. Acceptable.

## Contract

The code matches design.md:
- Shared types and `MESSAGES` are byte-exact (`app/_lib/todo.ts:1-32`).
- Each endpoint has an allowlist, and branching uses status and `error.code` only.
- Requests use `no-store`, `Accept`/`Content-Type`, a 5 s timeout and `encodeURIComponent(id)`.
- Each unavailable result writes one structured stderr log line (`app/_lib/todo-api.ts:9-14`).
- Server Action semantics and the `not_found` refresh match.
- The DOM contract (roles, names, `data-done`, `noValidate`, no `required`/`maxLength`, in-flight disabling) matches.
- Add is pessimistic; toggle and delete are optimistic with rollback.

The AC-001.25 build-output check now exists as design.md "Tests" requires (updated in `93cbd1f` to name `devbox run bundle-check`). The import graph stays as the design requires: `todo-list.tsx` imports `todo.ts` only.

## Fix cycles

- Cycle 1 (`93cbd1f`): AC-001.25 went from partial to met by adding the build-output check `devbox run bundle-check`. Acceptance tests are unchanged.
