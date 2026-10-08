import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTodo, listTodos } from "@/app/_lib/todo-api";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  process.env.TODO_API_URL = "http://todo-api.test";
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.TODO_API_URL;
});

function stub(res: Response) {
  vi.stubGlobal("fetch", vi.fn(async () => res));
}

describe("todo-api client malformed responses", () => {
  it("maps a non-JSON 200 body on list to unavailable", async () => {
    stub(new Response("not json", { status: 200 }));
    expect(await listTodos()).toEqual({ ok: false, error: "unavailable" });
  });

  it("maps a non-array 200 body on list to unavailable", async () => {
    stub(new Response(JSON.stringify({ a: 1 }), { status: 200 }));
    expect(await listTodos()).toEqual({ ok: false, error: "unavailable" });
  });

  it("maps a non-JSON 201 body on create to unavailable", async () => {
    stub(new Response("nope", { status: 201 }));
    expect(await createTodo("x")).toEqual({ ok: false, error: "unavailable" });
  });

  it("maps a 201 with an invalid todo shape to unavailable", async () => {
    stub(new Response(JSON.stringify({ id: 1 }), { status: 201 }));
    expect(await createTodo("x")).toEqual({ ok: false, error: "unavailable" });
  });
});
