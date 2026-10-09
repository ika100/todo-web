import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setTodoTitle } from "@/app/actions";
import { updateTodoTitle } from "@/app/_lib/todo-api";

const TODO = { id: "a/b", title: "New", done: false, created_at: "2026-01-01T00:00:00Z" };

beforeEach(() => {
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  process.env.TODO_API_URL = "http://todo-api.test/";
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.TODO_API_URL;
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}
function stubSeq(...res: Response[]) {
  const f = vi.fn(async () => res.shift() as Response);
  vi.stubGlobal("fetch", f);
  return f;
}
const err = (code: string) => ({ error: { code, message: "m" } });

describe("updateTodoTitle", () => {
  it("PATCHes the encoded id with only the title and returns the todo", async () => {
    const f = stubSeq(json(200, TODO));
    expect(await updateTodoTitle("a/b", "New")).toEqual({ ok: true, data: TODO });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://todo-api.test/todos/a%2Fb");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ title: "New" });
  });

  it.each(["title_required", "title_too_long"])("maps 422 %s", async (code) => {
    stubSeq(json(422, err(code)));
    expect(await updateTodoTitle("1", "x")).toEqual({ ok: false, error: code });
  });

  it("maps 422 with an unknown code to unavailable", async () => {
    stubSeq(json(422, err("other")));
    expect(await updateTodoTitle("1", "x")).toEqual({ ok: false, error: "unavailable" });
  });

  it("maps 404 todo_not_found to not_found", async () => {
    stubSeq(json(404, err("todo_not_found")));
    expect(await updateTodoTitle("1", "x")).toEqual({ ok: false, error: "not_found" });
  });

  it("maps 404 with another code, 500 and network errors to unavailable", async () => {
    stubSeq(json(404, err("nope")));
    expect(await updateTodoTitle("1", "x")).toEqual({ ok: false, error: "unavailable" });
    stubSeq(json(500, {}));
    expect(await updateTodoTitle("1", "x")).toEqual({ ok: false, error: "unavailable" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("down"); }));
    expect(await updateTodoTitle("1", "x")).toEqual({ ok: false, error: "unavailable" });
  });

  it("maps a 200 with a malformed body to unavailable", async () => {
    stubSeq(json(200, { id: 1 }));
    expect(await updateTodoTitle("1", "x")).toEqual({ ok: false, error: "unavailable" });
  });
});

describe("setTodoTitle action", () => {
  it("rejects an invalid title without calling the API", async () => {
    const f = stubSeq();
    expect(await setTodoTitle("1", "   ")).toEqual({ ok: false, error: "title_required" });
    expect(await setTodoTitle("1", "x".repeat(201))).toEqual({ ok: false, error: "title_too_long" });
    expect(await setTodoTitle("1", undefined as unknown as string)).toEqual({ ok: false, error: "title_required" });
    expect(f).not.toHaveBeenCalled();
  });

  it("sends the trimmed title and returns the updated todo", async () => {
    const f = stubSeq(json(200, TODO));
    expect(await setTodoTitle("1", "  New  ")).toEqual({ ok: true, data: TODO });
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toEqual({ title: "New" });
  });

  it("on not_found returns the refreshed list", async () => {
    stubSeq(json(404, err("todo_not_found")), json(200, [TODO]));
    expect(await setTodoTitle("1", "x")).toEqual({ ok: false, error: "not_found", todos: [TODO] });
  });

  it("on not_found with a failing refresh returns plain not_found", async () => {
    stubSeq(json(404, err("todo_not_found")), json(500, {}));
    expect(await setTodoTitle("1", "x")).toEqual({ ok: false, error: "not_found" });
  });
});
