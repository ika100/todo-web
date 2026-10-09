import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import { API, installMockTodoApi, todo } from "./helpers/mock-todo-api";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.TODO_API_URL;
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
}

describe("no browser-side persistence and server-only API address", () => {
  it("AC-001.24 holds no todo data in localStorage, sessionStorage, IndexedDB or cookies", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const idbOpen = vi.fn();
    vi.stubGlobal("indexedDB", { open: idbOpen });
    installMockTodoApi([todo(1, { title: "Task" }), todo(2, { title: "Other" })]);
    render(await HomePage());
    fireEvent.change(screen.getByRole("textbox", { name: "New todo" }), { target: { value: "Buy milk" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByText("Buy milk");
    fireEvent.click(screen.getByRole("checkbox", { name: "Task" }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Task" })).toBeChecked());
    fireEvent.click(screen.getByRole("button", { name: "Delete Other" }));
    await waitFor(() => expect(screen.queryByText("Other")).not.toBeInTheDocument());
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(idbOpen).not.toHaveBeenCalled();
    expect(document.cookie).toBe("");
  });

  it("AC-001.25 every request goes to TODO_API_URL, and the browser UI makes none to that address", async () => {
    const api = installMockTodoApi([todo(1, { title: "Task" })]);
    render(await HomePage());
    const afterLoad = api.state.calls.length;
    expect(afterLoad).toBe(1);
    expect(api.state.calls.every((c) => c.url.startsWith(API))).toBe(true);

    // The client component only talks to the actions it is given: with stub actions, no fetch happens at all.
    api.fetchMock.mockClear();
    const { TodoList } = await import("@/app/_components/todo-list");
    const stub = {
      addTodo: vi.fn(async () => ({ ok: true as const, data: todo(9, { title: "New" }) })),
      setTodoDone: vi.fn(async () => ({ ok: true as const, data: todo(1, { title: "Task", done: true }) })),
      setTodoTitle: vi.fn(async () => ({ ok: true as const, data: todo(1, { title: "Task" }) })),
      deleteTodo: vi.fn(async () => ({ ok: true as const, data: null })),
    };
    const { unmount } = render(<TodoList initialTodos={[todo(1, { title: "Task" })]} initialError={null} actions={stub} />);
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Task" }).at(-1)!);
    await waitFor(() => expect(stub.setTodoDone).toHaveBeenCalledWith(todo(1).id, true));
    expect(api.fetchMock).not.toHaveBeenCalled();
    unmount();
  });

  it("AC-001.25 client code never references TODO_API_URL, process.env or the server-only api client", () => {
    const clientFiles = ["app/_components/todo-list.tsx", "app/_lib/todo.ts"];
    for (const f of clientFiles) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src, f).not.toMatch(/TODO_API_URL|process\.env|todo-api"|NEXT_PUBLIC_/);
    }
    const all = walk(join(process.cwd(), "app")).filter((f) => /\.(tsx?|css)$/.test(f));
    for (const f of all) expect(readFileSync(f, "utf8"), f).not.toMatch(/NEXT_PUBLIC_TODO/);
    const api = readFileSync(join(process.cwd(), "app/_lib/todo-api.ts"), "utf8");
    expect(api).toContain("process.env.TODO_API_URL");
  });
});
