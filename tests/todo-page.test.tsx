import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import { apiError, installMockTodoApi, todo } from "./helpers/mock-todo-api";

const UNAVAILABLE = "Todos are unavailable, please try again";

async function open() {
  render(await HomePage());
}
const input = () => screen.getByRole("textbox", { name: "New todo" }) as HTMLInputElement;
const items = () => (screen.queryByRole("list", { name: "Todos" }) ? within(screen.getByRole("list", { name: "Todos" })).getAllByRole("listitem") : []);
const titles = () => items().map((li) => li.querySelector("label")?.textContent?.trim());
function add(value: string) {
  fireEvent.change(input(), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.TODO_API_URL;
});

describe("page and empty state", () => {
  it("AC-001.1 GET / renders the todo list page with the add input, not the template landing page", async () => {
    installMockTodoApi();
    await open();
    expect(screen.getByRole("heading", { level: 1, name: "Todos" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("form", { name: "Add a todo" })).toBeInTheDocument();
    expect(input()).toBeInTheDocument();
    expect(screen.queryByText("Get started")).not.toBeInTheDocument();
  });

  it("AC-001.3 shows 'No todos yet' and the add input when there are no todos", async () => {
    installMockTodoApi();
    await open();
    expect(screen.getByText("No todos yet")).toBeInTheDocument();
    expect(input()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toHaveAttribute("type", "submit");
    expect(screen.queryByRole("list", { name: "Todos" })).not.toBeInTheDocument();
  });
});

describe("showing todos", () => {
  it("AC-001.4 shows exactly three todos in order with distinguishable done state", async () => {
    installMockTodoApi([todo(1, { title: "A", done: true }), todo(2, { title: "B" }), todo(3, { title: "C" })]);
    await open();
    expect(titles()).toEqual(["A", "B", "C"]);
    expect(items().map((li) => li.getAttribute("data-done"))).toEqual(["true", "false", "false"]);
    expect(screen.getByRole("checkbox", { name: "A" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "B" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "C" })).not.toBeChecked();
    expect(screen.queryByText("No todos yet")).not.toBeInTheDocument();
  });

  it("AC-001.5 keeps the order todo-api returned (not alphabetical, not by id)", async () => {
    installMockTodoApi([todo(3, { title: "Zebra" }), todo(1, { title: "Apple" }), todo(2, { title: "Mango" })]);
    await open();
    expect(titles()).toEqual(["Zebra", "Apple", "Mango"]);
  });

  it("AC-001.23 a second browser with no shared state shows the same todos in the same order", async () => {
    const api = installMockTodoApi();
    await open();
    add("First");
    await screen.findByText("First");
    add("Second");
    await screen.findByText("Second");
    cleanup();
    localStorage.clear();
    await open(); // fresh page load, state only from GET /todos
    expect(titles()).toEqual(["First", "Second"]);
    expect(screen.queryByRole("textbox", { name: /password|user|email/i })).not.toBeInTheDocument();
    expect(api.count("GET")).toBe(2);
  });
});

describe("adding", () => {
  it("AC-001.6 adds 'Buy milk' via the button, appends it as not done and clears the input", async () => {
    const api = installMockTodoApi([todo(1, { title: "Existing" })]);
    await open();
    add("Buy milk");
    await waitFor(() => expect(titles()).toEqual(["Existing", "Buy milk"]));
    expect(api.state.calls.filter((c) => c.method === "POST")).toHaveLength(1);
    expect(api.state.calls.find((c) => c.method === "POST")?.body).toEqual({ title: "Buy milk" });
    expect(items()[1]).toHaveAttribute("data-done", "false");
    expect(input().value).toBe("");
    expect(api.count("GET")).toBe(1); // no reload of the list
  });

  it("AC-001.6 adds by pressing Enter (form submit)", async () => {
    const api = installMockTodoApi();
    await open();
    fireEvent.change(input(), { target: { value: "Buy milk" } });
    fireEvent.submit(screen.getByRole("form", { name: "Add a todo" }));
    await screen.findByText("Buy milk");
    expect(api.count("POST")).toBe(1);
  });

  it.each(["", "   "])("AC-001.7 blocks empty/whitespace title %j: no POST, list unchanged, 'Title is required'", async (value) => {
    const api = installMockTodoApi([todo(1, { title: "Existing" })]);
    await open();
    add(value);
    expect(await screen.findByRole("alert")).toHaveTextContent(/^Title is required$/);
    expect(api.count("POST")).toBe(0);
    expect(titles()).toEqual(["Existing"]);
  });

  it("AC-001.8 shows 'Title is required' on 422 title_required whatever the message says", async () => {
    const api = installMockTodoApi();
    api.state.fail.POST = apiError(422, "title_required", "banana");
    await open();
    add("Buy milk");
    expect(await screen.findByRole("alert")).toHaveTextContent(/^Title is required$/);
    expect(screen.queryByText("Buy milk", { selector: "label *, label" })).not.toBeInTheDocument();
    expect(items()).toHaveLength(0);
  });

  it("AC-001.9 blocks a 201 code point title (after trimming): no POST, 'Title must be at most 200 characters'", async () => {
    const api = installMockTodoApi([todo(1, { title: "Existing" })]);
    await open();
    add(`  ${"😀".repeat(201)}  `);
    expect(await screen.findByRole("alert")).toHaveTextContent(/^Title must be at most 200 characters$/);
    expect(api.count("POST")).toBe(0);
    expect(titles()).toEqual(["Existing"]);
  });

  it.each([["a"], ["😀"]])("AC-001.10 accepts a title of exactly 200 code points (%s)", async (ch) => {
    const api = installMockTodoApi();
    await open();
    const title = ch.repeat(200);
    add(title);
    await waitFor(() => expect(items()).toHaveLength(1));
    expect(api.state.calls.find((c) => c.method === "POST")?.body).toEqual({ title });
    expect(titles()).toEqual([title]);
  });

  it("AC-001.11 shows 'Title must be at most 200 characters' on 422 title_too_long whatever the message says", async () => {
    const api = installMockTodoApi();
    api.state.fail.POST = apiError(422, "title_too_long", "banana");
    await open();
    add("Buy milk");
    expect(await screen.findByRole("alert")).toHaveTextContent(/^Title must be at most 200 characters$/);
    expect(items()).toHaveLength(0);
  });

  it("AC-001.12 shows the title todo-api returned, without leading or trailing spaces", async () => {
    installMockTodoApi();
    await open();
    add("  Buy milk  ");
    await waitFor(() => expect(titles()).toEqual(["Buy milk"]));
  });
});

describe("toggling", () => {
  it("AC-001.13 marks a todo as done, sends {done:true}, and it is done after a reload", async () => {
    const t = todo(1, { title: "Task" });
    const api = installMockTodoApi([t]);
    await open();
    fireEvent.click(screen.getByRole("checkbox", { name: "Task" }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Task" })).toBeChecked());
    expect(items()[0]).toHaveAttribute("data-done", "true");
    expect(api.state.calls.find((c) => c.method === "PATCH")).toMatchObject({ path: `/todos/${t.id}`, body: { done: true } });
    cleanup();
    await open();
    expect(screen.getByRole("checkbox", { name: "Task" })).toBeChecked();
  });

  it("AC-001.14 marks a done todo as not done, sends {done:false}, and it is not done after a reload", async () => {
    const t = todo(1, { title: "Task", done: true });
    const api = installMockTodoApi([t]);
    await open();
    fireEvent.click(screen.getByRole("checkbox", { name: "Task" }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Task" })).not.toBeChecked());
    expect(items()[0]).toHaveAttribute("data-done", "false");
    expect(api.state.calls.find((c) => c.method === "PATCH")).toMatchObject({ path: `/todos/${t.id}`, body: { done: false } });
    cleanup();
    await open();
    expect(screen.getByRole("checkbox", { name: "Task" })).not.toBeChecked();
  });
});

describe("deleting", () => {
  it("AC-001.15 deletes without confirmation, removes the item and it stays gone after a reload", async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);
    const api = installMockTodoApi([todo(1, { title: "One" }), todo(2, { title: "Two" })]);
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Delete One" }));
    await waitFor(() => expect(titles()).toEqual(["Two"]));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.state.calls.find((c) => c.method === "DELETE")?.path).toBe(`/todos/${todo(1).id}`);
    cleanup();
    await open();
    expect(titles()).toEqual(["Two"]);
  });
});

describe("todo deleted elsewhere", () => {
  it.each(["toggle", "delete"])("AC-001.16 %s on a vanished todo shows 'This todo no longer exists' and refreshes from GET /todos", async (action) => {
    const api = installMockTodoApi([todo(1, { title: "Gone" }), todo(2, { title: "Stays" })]);
    await open();
    api.state.todos = api.state.todos.filter((t) => t.title !== "Gone"); // deleted in another tab
    const gets = api.count("GET");
    if (action === "toggle") fireEvent.click(screen.getByRole("checkbox", { name: "Gone" }));
    else fireEvent.click(screen.getByRole("button", { name: "Delete Gone" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/^This todo no longer exists$/);
    await waitFor(() => expect(titles()).toEqual(["Stays"]));
    expect(api.count("GET")).toBe(gets + 1);
  });
});

describe("todo-api unavailable", () => {
  it.each([["down"], ["503"]] as const)("AC-001.17 opening the page while todo-api is %s shows the page with the message, no todos, no empty state", async (mode) => {
    const api = installMockTodoApi([todo(1)]);
    api.state.fail.GET = mode === "down" ? "down" : apiError(503, "unavailable");
    await open();
    expect(screen.getByRole("heading", { level: 1, name: "Todos" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(new RegExp(`^${UNAVAILABLE}$`));
    expect(items()).toHaveLength(0);
    expect(screen.queryByText("No todos yet")).not.toBeInTheDocument();
    expect(input()).toBeInTheDocument();
  });

  it("AC-001.18 failing add shows the message, no new todo, and keeps the input value", async () => {
    const api = installMockTodoApi([todo(1, { title: "Existing" })]);
    await open();
    api.state.fail.POST = "down";
    add("Buy milk");
    expect(await screen.findByRole("alert")).toHaveTextContent(new RegExp(`^${UNAVAILABLE}$`));
    expect(titles()).toEqual(["Existing"]);
    expect(input().value).toBe("Buy milk");
  });

  it.each([[false], [true]])("AC-001.19 failing toggle (done=%s) shows the message and restores the previous state", async (done) => {
    const api = installMockTodoApi([todo(1, { title: "Task", done })]);
    await open();
    api.state.fail.PATCH = "down";
    fireEvent.click(screen.getByRole("checkbox", { name: "Task" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(new RegExp(`^${UNAVAILABLE}$`));
    await waitFor(() => expect((screen.getByRole("checkbox", { name: "Task" }) as HTMLInputElement).checked).toBe(done));
    expect(items()[0]).toHaveAttribute("data-done", String(done));
  });

  it("AC-001.20 failing delete shows the message and restores the todo at its previous position", async () => {
    const api = installMockTodoApi([todo(1, { title: "One" }), todo(2, { title: "Two" }), todo(3, { title: "Three" })]);
    await open();
    api.state.fail.DELETE = "down";
    fireEvent.click(screen.getByRole("button", { name: "Delete Two" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(new RegExp(`^${UNAVAILABLE}$`));
    await waitFor(() => expect(titles()).toEqual(["One", "Two", "Three"]));
  });

  it("AC-001.21 a request that never answers is aborted at 5 s and the page shows the message (page load, add)", async () => {
    const api = installMockTodoApi([todo(1, { title: "Existing" })]);
    api.state.fail.GET = "hang";
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const loading = HomePage();
    await vi.waitFor(() => expect(api.count("GET")).toBe(1));
    controller.abort(new DOMException("timeout", "TimeoutError"));
    render(await loading);
    expect(timeout).toHaveBeenCalledWith(5000);
    expect(screen.getByRole("alert")).toHaveTextContent(new RegExp(`^${UNAVAILABLE}$`));

    api.state.fail.POST = "hang";
    const second = new AbortController();
    timeout.mockReturnValue(second.signal);
    add("Buy milk");
    await vi.waitFor(() => expect(api.count("POST")).toBe(1));
    second.abort(new DOMException("timeout", "TimeoutError"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(new RegExp(`^${UNAVAILABLE}$`)));
    expect(input().value).toBe("Buy milk");
  });

  it.each([
    ["POST 422 invalid_request", "POST", apiError(422, "invalid_request")],
    ["POST 400", "POST", { status: 400, body: {} }],
    ["PATCH 422 invalid_request", "PATCH", apiError(422, "invalid_request")],
    ["PATCH 400", "PATCH", { status: 400, body: {} }],
    ["DELETE 400", "DELETE", { status: 400, body: {} }],
  ])("AC-001.22 an unlisted answer (%s) is shown as unavailable and the change is not shown as saved", async (_n, method, behavior) => {
    const api = installMockTodoApi([todo(1, { title: "Task" })]);
    await open();
    api.state.fail[method] = behavior;
    if (method === "POST") add("Buy milk");
    else if (method === "PATCH") fireEvent.click(screen.getByRole("checkbox", { name: "Task" }));
    else fireEvent.click(screen.getByRole("button", { name: "Delete Task" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(new RegExp(`^${UNAVAILABLE}$`));
    await waitFor(() => expect(titles()).toEqual(["Task"]));
    expect(screen.getByRole("checkbox", { name: "Task" })).not.toBeChecked();
  });
});
