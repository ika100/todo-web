import { vi } from "vitest";

import type { Todo } from "@/app/_lib/todo";

export const API = "http://todo-api.test";

export type Behavior =
  | "down" // connection error
  | "hang" // accepts the connection, never answers (until the request signal aborts)
  | { status: number; body?: unknown };

export type Call = { method: string; path: string; body: unknown; url: string; signal?: AbortSignal | null };

export function todo(n: number, over: Partial<Todo> = {}): Todo {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    title: `Todo ${n}`,
    done: false,
    created_at: new Date(Date.UTC(2026, 9, 8, 12, 0, n)).toISOString(),
    ...over,
  };
}

function json(status: number, body?: unknown): Response {
  if (status === 204) return new Response(null, { status });
  return new Response(JSON.stringify(body ?? {}), { status, headers: { "Content-Type": "application/json" } });
}

export const apiError = (status: number, code: string, message = "free text") => ({ status, body: { error: { code, message } } });

/**
 * In-memory todo-api that follows the contract. `fail["PATCH"]` etc. overrides the answer for a method.
 * Installs itself as globalThis.fetch and sets TODO_API_URL.
 */
export function installMockTodoApi(initial: Todo[] = []) {
  const state = {
    todos: [...initial],
    calls: [] as Call[],
    fail: {} as Record<string, Behavior | undefined>,
    seq: 100,
  };
  process.env.TODO_API_URL = API;

  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input instanceof Request ? input.url : input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (!url.startsWith(API)) throw new TypeError(`unexpected fetch to ${url}`);
    const path = url.slice(API.length);
    let body: unknown = undefined;
    if (typeof init?.body === "string") body = JSON.parse(init.body);
    state.calls.push({ method, path, body, url, signal: init?.signal });

    const f = state.fail[method];
    if (f === "down") throw new TypeError("fetch failed");
    if (f === "hang") {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("The operation timed out", "TimeoutError")));
      });
    }
    if (f) return json(f.status, f.body);

    const id = decodeURIComponent(path.split("/")[2] ?? "");
    if (method === "GET" && path === "/todos") return json(200, state.todos);
    if (method === "POST" && path === "/todos") {
      const title = String((body as { title?: string })?.title ?? "").trim();
      if (!title) return json(422, { error: { code: "title_required", message: "Title is required" } });
      const t: Todo = { id: `00000000-0000-4000-8000-${String(++state.seq).padStart(12, "0")}`, title, done: false, created_at: new Date(Date.UTC(2026, 9, 9, 0, 0, state.seq)).toISOString() };
      state.todos.push(t);
      return json(201, t);
    }
    const found = state.todos.find((t) => t.id === id);
    if (path.startsWith("/todos/") && method === "PATCH") {
      if (!found) return json(404, { error: { code: "todo_not_found", message: "This todo no longer exists" } });
      found.done = (body as { done: boolean }).done;
      return json(200, found);
    }
    if (path.startsWith("/todos/") && method === "DELETE") {
      if (!found) return json(404, { error: { code: "todo_not_found", message: "This todo no longer exists" } });
      state.todos = state.todos.filter((t) => t.id !== id);
      return json(204);
    }
    return json(404, { error: { code: "todo_not_found", message: "x" } });
  };

  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return {
    state,
    fetchMock,
    count: (method: string) => state.calls.filter((c) => c.method === method).length,
  };
}
