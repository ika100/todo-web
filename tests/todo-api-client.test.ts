import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTodo, listTodos, removeTodo, updateTodoDone } from "@/app/_lib/todo-api";
import { addTodo, deleteTodo, setTodoDone } from "@/app/actions";
import { apiError, installMockTodoApi, todo } from "./helpers/mock-todo-api";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.TODO_API_URL;
});

describe("todo-api client", () => {
  it("AC-001.5 returns todos in exactly the order todo-api answered, without re-sorting", async () => {
    const list = [todo(3, { title: "Zebra" }), todo(1, { title: "Apple" }), todo(2, { title: "Mango" })];
    installMockTodoApi(list);
    const res = await listTodos();
    expect(res).toEqual({ ok: true, data: list });
  });

  it("AC-001.25 sends every request to TODO_API_URL with no-store and a 5 s timeout", async () => {
    const api = installMockTodoApi([todo(1)]);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    await listTodos();
    await createTodo("x");
    await updateTodoDone(todo(1).id, true);
    await removeTodo(todo(1).id);
    expect(api.state.calls.map((c) => `${c.method} ${c.path.replace(todo(1).id, "{id}")}`)).toEqual(["GET /todos", "POST /todos", "PATCH /todos/{id}", "DELETE /todos/{id}"]);
    expect(timeout).toHaveBeenCalledWith(5000);
    for (const [, init] of api.fetchMock.mock.calls) expect(init?.cache).toBe("no-store");
  });

  it("AC-001.17 maps a connection error and any 5xx on GET /todos to unavailable", async () => {
    const api = installMockTodoApi();
    api.state.fail.GET = "down";
    expect(await listTodos()).toEqual({ ok: false, error: "unavailable" });
    api.state.fail.GET = apiError(503, "unavailable");
    expect(await listTodos()).toEqual({ ok: false, error: "unavailable" });
    api.state.fail.GET = { status: 200, body: { not: "an array" } };
    expect(await listTodos()).toEqual({ ok: false, error: "unavailable" });
  });

  it("AC-001.17 treats an unset TODO_API_URL as unavailable", async () => {
    installMockTodoApi();
    delete process.env.TODO_API_URL;
    expect(await listTodos()).toEqual({ ok: false, error: "unavailable" });
  });

  it("AC-001.21 gives up after 5 seconds without an answer and reports unavailable", async () => {
    const api = installMockTodoApi([todo(1)]);
    api.state.fail.GET = "hang";
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const pending = listTodos();
    await vi.waitFor(() => expect(api.state.calls).toHaveLength(1));
    expect(timeout).toHaveBeenCalledWith(5000);
    controller.abort(new DOMException("timeout", "TimeoutError"));
    expect(await pending).toEqual({ ok: false, error: "unavailable" });
  });

  it("AC-001.22 maps statuses and codes the contract does not list for an endpoint to unavailable", async () => {
    const api = installMockTodoApi([todo(1)]);
    const id = todo(1).id;
    api.state.fail.POST = apiError(422, "invalid_request");
    expect(await createTodo("x")).toEqual({ ok: false, error: "unavailable" });
    api.state.fail.POST = { status: 400, body: {} };
    expect(await createTodo("x")).toEqual({ ok: false, error: "unavailable" });
    api.state.fail.POST = { status: 201, body: { id: 1 } };
    expect(await createTodo("x")).toEqual({ ok: false, error: "unavailable" });
    api.state.fail.PATCH = apiError(422, "invalid_request");
    expect(await updateTodoDone(id, true)).toEqual({ ok: false, error: "unavailable" });
    api.state.fail.DELETE = { status: 400 };
    expect(await removeTodo(id)).toEqual({ ok: false, error: "unavailable" });
    api.state.fail.DELETE = apiError(404, "something_else");
    expect(await removeTodo(id)).toEqual({ ok: false, error: "unavailable" });
  });

  it("AC-001.8 and AC-001.11 branch on the error code, never on the message", async () => {
    const api = installMockTodoApi();
    api.state.fail.POST = apiError(422, "title_required", "banana");
    expect(await createTodo("x")).toEqual({ ok: false, error: "title_required" });
    api.state.fail.POST = apiError(422, "title_too_long", "banana");
    expect(await createTodo("x")).toEqual({ ok: false, error: "title_too_long" });
  });
});

describe("server actions", () => {
  it("AC-001.7 addTodo never calls todo-api for an empty or whitespace title", async () => {
    const api = installMockTodoApi();
    expect(await addTodo("   ")).toEqual({ ok: false, error: "title_required" });
    expect(api.fetchMock).not.toHaveBeenCalled();
  });

  it("AC-001.9 addTodo never calls todo-api for a title over 200 code points", async () => {
    const api = installMockTodoApi();
    expect(await addTodo("😀".repeat(201))).toEqual({ ok: false, error: "title_too_long" });
    expect(api.fetchMock).not.toHaveBeenCalled();
  });

  it("AC-001.10 addTodo sends a 200 emoji title to todo-api", async () => {
    const api = installMockTodoApi();
    const res = await addTodo("😀".repeat(200));
    expect(res.ok).toBe(true);
    expect(api.state.calls[0]).toMatchObject({ method: "POST", path: "/todos", body: { title: "😀".repeat(200) } });
  });

  it("AC-001.12 addTodo sends the trimmed title and returns the title todo-api answered", async () => {
    const api = installMockTodoApi();
    const res = await addTodo("  Buy milk  ");
    expect(api.state.calls[0].body).toEqual({ title: "Buy milk" });
    expect(res).toMatchObject({ ok: true, data: { title: "Buy milk", done: false } });
  });

  it("AC-001.13 setTodoDone sends {done:true} for that id", async () => {
    const api = installMockTodoApi([todo(1)]);
    const res = await setTodoDone(todo(1).id, true);
    expect(api.state.calls[0]).toMatchObject({ method: "PATCH", path: `/todos/${todo(1).id}`, body: { done: true } });
    expect(res).toMatchObject({ ok: true, data: { done: true } });
  });

  it("AC-001.16 not_found on PATCH and DELETE returns the refreshed list from GET /todos", async () => {
    const api = installMockTodoApi([todo(2)]);
    const gone = todo(1).id;
    expect(await setTodoDone(gone, true)).toEqual({ ok: false, error: "not_found", todos: [todo(2)] });
    expect(await deleteTodo(gone)).toEqual({ ok: false, error: "not_found", todos: [todo(2)] });
    expect(api.count("GET")).toBe(2);
  });

  it("AC-001.16 not_found without a successful refresh still reports not_found", async () => {
    const api = installMockTodoApi();
    api.state.fail.GET = "down";
    expect(await deleteTodo(todo(1).id)).toEqual({ ok: false, error: "not_found" });
  });

  it("AC-001.15 deleteTodo sends DELETE for that id and returns ok", async () => {
    const api = installMockTodoApi([todo(1)]);
    expect(await deleteTodo(todo(1).id)).toEqual({ ok: true, data: null });
    expect(api.state.calls[0]).toMatchObject({ method: "DELETE", path: `/todos/${todo(1).id}` });
  });
});
