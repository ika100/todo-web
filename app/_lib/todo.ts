export type Todo = { id: string; title: string; done: boolean; created_at: string };

export type TodoError = "title_required" | "title_too_long" | "not_found" | "unavailable";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: TodoError; todos?: Todo[] }; // todos: only with not_found, the refreshed list

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
export function validateTitle(
  raw: string,
): { ok: true; title: string } | { ok: false; error: "title_required" | "title_too_long" } {
  const title = raw.trim();
  if (title.length === 0) return { ok: false, error: "title_required" };
  if ([...title].length > MAX_TITLE_LENGTH) return { ok: false, error: "title_too_long" };
  return { ok: true, title };
}
