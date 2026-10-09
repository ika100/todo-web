// Server-only: must never be imported from a "use client" module.
import type { ActionResult, Todo } from "@/app/_lib/todo";

type Op = "list" | "create" | "update" | "delete";
type Reason = "timeout" | "network" | "status" | "body" | "config";

const TIMEOUT_MS = 5000;

function unavailable(op: Op, status: number | null, reason: Reason): { ok: false; error: "unavailable" } {
  process.stderr.write(
    JSON.stringify({ level: "error", msg: "todo-api unavailable", op, status, reason }) + "\n",
  );
  return { ok: false, error: "unavailable" };
}

function parseTodo(value: unknown): Todo | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.id !== "string" ||
    typeof v.title !== "string" ||
    typeof v.done !== "boolean" ||
    typeof v.created_at !== "string"
  ) {
    return null;
  }
  return { id: v.id, title: v.title, done: v.done, created_at: v.created_at };
}

async function errorCode(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.json();
    if (typeof body !== "object" || body === null) return null;
    const err = (body as { error?: unknown }).error;
    if (typeof err !== "object" || err === null) return null;
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  } catch {
    return null;
  }
}

type Sent = { res: Response } | { fail: { ok: false; error: "unavailable" } };

async function send(op: Op, method: string, path: string, body?: unknown): Promise<Sent> {
  const base = (process.env.TODO_API_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) return { fail: unavailable(op, null, "config") };
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  try {
    const res = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { res };
  } catch (e) {
    const name = e instanceof Error || e instanceof DOMException ? e.name : "";
    const timedOut = name === "AbortError" || name === "TimeoutError";
    return { fail: unavailable(op, null, timedOut ? "timeout" : "network") };
  }
}

async function readTodo(op: Op, res: Response): Promise<ActionResult<Todo>> {
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return unavailable(op, res.status, "body");
  }
  const parsed = parseTodo(json);
  return parsed ? { ok: true, data: parsed } : unavailable(op, res.status, "body");
}

export async function listTodos(): Promise<ActionResult<Todo[]>> {
  const sent = await send("list", "GET", "/todos");
  if ("fail" in sent) return sent.fail;
  const { res } = sent;
  if (res.status !== 200) return unavailable("list", res.status, "status");
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return unavailable("list", res.status, "body");
  }
  if (!Array.isArray(json)) return unavailable("list", res.status, "body");
  const todos: Todo[] = [];
  for (const item of json) {
    const t = parseTodo(item);
    if (!t) return unavailable("list", res.status, "body");
    todos.push(t);
  }
  return { ok: true, data: todos };
}

export async function createTodo(title: string): Promise<ActionResult<Todo>> {
  const sent = await send("create", "POST", "/todos", { title });
  if ("fail" in sent) return sent.fail;
  const { res } = sent;
  if (res.status === 201) return readTodo("create", res);
  if (res.status === 422) {
    const code = await errorCode(res);
    if (code === "title_required" || code === "title_too_long") return { ok: false, error: code };
  }
  return unavailable("create", res.status, "status");
}

export async function updateTodoDone(id: string, done: boolean): Promise<ActionResult<Todo>> {
  const sent = await send("update", "PATCH", `/todos/${encodeURIComponent(id)}`, { done });
  if ("fail" in sent) return sent.fail;
  const { res } = sent;
  if (res.status === 200) return readTodo("update", res);
  if (res.status === 404 && (await errorCode(res)) === "todo_not_found") {
    return { ok: false, error: "not_found" };
  }
  return unavailable("update", res.status, "status");
}

export async function updateTodoTitle(id: string, title: string): Promise<ActionResult<Todo>> {
  const sent = await send("update", "PATCH", `/todos/${encodeURIComponent(id)}`, { title });
  if ("fail" in sent) return sent.fail;
  const { res } = sent;
  if (res.status === 200) return readTodo("update", res);
  if (res.status === 422) {
    const code = await errorCode(res);
    if (code === "title_required" || code === "title_too_long") return { ok: false, error: code };
  }
  if (res.status === 404 && (await errorCode(res)) === "todo_not_found") {
    return { ok: false, error: "not_found" };
  }
  return unavailable("update", res.status, "status");
}

export async function removeTodo(id: string): Promise<ActionResult<null>> {
  const sent = await send("delete", "DELETE", `/todos/${encodeURIComponent(id)}`);
  if ("fail" in sent) return sent.fail;
  const { res } = sent;
  if (res.status === 204) return { ok: true, data: null };
  if (res.status === 404 && (await errorCode(res)) === "todo_not_found") {
    return { ok: false, error: "not_found" };
  }
  return unavailable("delete", res.status, "status");
}
