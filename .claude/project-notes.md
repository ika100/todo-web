# Project notes

- `todo-web` is the frontend of the todo system (gitops repo `ika100/todo`): it consumes the `todo-api-rest` API of `todo-api` at `TODO_API_URL` (`http://todo-api` in the cluster), wrapped in `app/_lib/todo-api.ts`. It is the only component published through the Gateway.
- Changes that need a new or changed API endpoint start as a system spec in `ika100/todo`.
