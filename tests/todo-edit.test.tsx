import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import { TodoList } from "@/app/_components/todo-list";
import { apiError, installMockTodoApi, todo } from "./helpers/mock-todo-api";

const UNAVAILABLE = "Todos are unavailable, please try again";

async function open() {
  render(await HomePage());
}
const rows = () => within(screen.getByRole("list", { name: "Todos" })).getAllByRole("listitem");
/** Title of every row, whether it is shown as a label or in an input. */
const titles = () => rows().map((li) => li.querySelector("label")?.textContent?.trim() ?? (within(li).queryByRole("textbox", { name: "Title" }) as HTMLInputElement | null)?.value);
const shown = () => rows().map((li) => li.querySelector("label")?.textContent?.trim());
const editBox = () => screen.queryByRole("textbox", { name: "Title" }) as HTMLInputElement | null;
const patches = (api: ReturnType<typeof installMockTodoApi>) => api.state.calls.filter((c) => c.method === "PATCH");
const alertText = () => screen.queryByRole("alert")?.textContent;

function startEdit(title: string) {
  fireEvent.click(screen.getByRole("button", { name: `Edit ${title}` }));
  return screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement;
}
function type(value: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value } });
}
const pressEnter = () => fireEvent.submit(screen.getByRole("textbox", { name: "Title" }).closest("form")!);
const pressSave = () => fireEvent.click(screen.getByRole("button", { name: "Save" }));

const milk = () => todo(1, { title: "Buy milk" });
const mum = () => todo(2, { title: "Call mum" });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.TODO_API_URL;
});

describe("entering edit mode", () => {
  it("AC-002.1 each todo row has its own visible 'Edit' control and no row is in edit mode", async () => {
    installMockTodoApi([milk(), mum()]);
    await open();
    for (const li of rows()) {
      const edit = within(li).getByRole("button", { name: /^Edit / });
      expect(edit).toHaveTextContent(/^Edit$/);
    }
    expect(rows()).toHaveLength(2);
    expect(editBox()).not.toBeInTheDocument();
  });

  it("AC-002.2 Edit swaps the title for a focused input holding it, with Save and Cancel, in the same row, without a request", async () => {
    const api = installMockTodoApi([milk(), mum()]);
    await open();
    const href = window.location.href;
    const before = api.state.calls.length;
    const row = rows()[0];
    const input = startEdit("Buy milk");
    expect(rows()).toHaveLength(2);
    expect(row.contains(input)).toBe(true);
    expect(input).toHaveValue("Buy milk");
    await waitFor(() => expect(input).toHaveFocus());
    expect(within(row).getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(window.location.href).toBe(href);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.state.calls.length).toBe(before);
    expect(within(rows()[1]).getByRole("checkbox", { name: "Call mum" })).toBeInTheDocument();
    expect(within(rows()[1]).getByRole("button", { name: "Edit Call mum" })).toBeInTheDocument();
  });

  it("AC-002.3 choosing Edit on another row ends the first edit without saving; never more than one row in edit mode", async () => {
    const api = installMockTodoApi([milk(), mum()]);
    await open();
    startEdit("Buy milk");
    type("Buy oat milk");
    fireEvent.click(screen.getByRole("button", { name: "Edit Call mum" }));
    expect(screen.getAllByRole("textbox", { name: "Title" })).toHaveLength(1);
    expect(editBox()).toHaveValue("Call mum");
    expect(within(rows()[0]).queryByRole("textbox")).not.toBeInTheDocument();
    expect(shown()[0]).toBe("Buy milk");
    expect(patches(api)).toHaveLength(0);
  });
});

describe("saving", () => {
  it.each(["enter", "save"])("AC-002.4 saving via %s sends exactly PATCH {title} and shows the new title without a reload", async (how) => {
    const api = installMockTodoApi([milk(), mum()]);
    await open();
    const gets = api.count("GET");
    startEdit("Buy milk");
    type("Buy oat milk");
    if (how === "enter") pressEnter();
    else pressSave();
    await waitFor(() => expect(editBox()).not.toBeInTheDocument());
    expect(shown()).toEqual(["Buy oat milk", "Call mum"]);
    expect(patches(api)).toHaveLength(1);
    expect(patches(api)[0]).toMatchObject({ path: `/todos/${milk().id}` });
    expect(patches(api)[0].body).toEqual({ title: "Buy oat milk" });
    expect(api.count("GET")).toBe(gets);
  });

  it("AC-002.4 a message shown before is removed on a successful save", async () => {
    const api = installMockTodoApi([milk()]);
    await open();
    startEdit("Buy milk");
    type("   ");
    pressSave();
    expect(await screen.findByRole("alert")).toHaveTextContent("Title is required");
    type("Buy oat milk");
    pressSave();
    await waitFor(() => expect(editBox()).not.toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(patches(api)).toHaveLength(1);
  });

  it("AC-002.5 after a save and a reload the todo is shown with the new title and no row is in edit mode", async () => {
    installMockTodoApi([milk()]);
    await open();
    startEdit("Buy milk");
    type("Buy oat milk");
    pressEnter();
    await waitFor(() => expect(editBox()).not.toBeInTheDocument());
    cleanup();
    await open();
    expect(shown()).toEqual(["Buy oat milk"]);
    expect(editBox()).not.toBeInTheDocument();
  });

  it("AC-002.6 the edited todo keeps its position and its done state", async () => {
    installMockTodoApi([todo(1, { title: "A" }), todo(2, { title: "B", done: true }), todo(3, { title: "C" })]);
    await open();
    startEdit("B");
    type("B2");
    pressSave();
    await waitFor(() => expect(editBox()).not.toBeInTheDocument());
    expect(shown()).toEqual(["A", "B2", "C"]);
    expect(rows().map((li) => li.getAttribute("data-done"))).toEqual(["false", "true", "false"]);
    expect(screen.getByRole("checkbox", { name: "B2" })).toBeChecked();
  });

  it("AC-002.7 the row shows exactly the title and done state of todo-api's answer", async () => {
    const api = installMockTodoApi([milk(), mum()]);
    api.state.fail.PATCH = { status: 200, body: { ...milk(), title: "Server title", done: true } };
    await open();
    startEdit("Buy milk");
    type("Typed title");
    pressSave();
    await waitFor(() => expect(editBox()).not.toBeInTheDocument());
    expect(shown()).toEqual(["Server title", "Call mum"]);
    expect(rows()[0]).toHaveAttribute("data-done", "true");
    expect(screen.getByRole("checkbox", { name: "Server title" })).toBeChecked();
  });
});

describe("cancelling", () => {
  it.each(["escape", "cancel"])("AC-002.8 %s leaves edit mode with the original title, sends nothing and focuses Edit", async (how) => {
    const api = installMockTodoApi([milk(), mum()]);
    await open();
    startEdit("Buy milk");
    type("Buy oat milk");
    if (how === "escape") fireEvent.keyDown(screen.getByRole("textbox", { name: "Title" }), { key: "Escape" });
    else fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(editBox()).not.toBeInTheDocument();
    expect(shown()).toEqual(["Buy milk", "Call mum"]);
    expect(api.state.calls.filter((c) => c.method !== "GET")).toHaveLength(0);
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit Buy milk" })).toHaveFocus());
  });

  it.each([
    ["the page background", () => document.body],
    ["the heading", () => screen.getByRole("heading", { level: 1 })],
    ["the add input", () => screen.getByRole("textbox", { name: "New todo" })],
    ["another todo row", () => screen.getByText("Call mum")],
  ])("AC-002.9 a pointer press on %s cancels the edit and sends nothing", async (_n, target) => {
    const api = installMockTodoApi([milk(), mum()]);
    await open();
    startEdit("Buy milk");
    type("Buy oat milk");
    fireEvent.pointerDown(target());
    await waitFor(() => expect(editBox()).not.toBeInTheDocument());
    expect(shown()).toEqual(["Buy milk", "Call mum"]);
    expect(patches(api)).toHaveLength(0);
  });

  it("AC-002.10 a press inside the input does not cancel, and press plus click on Save saves", async () => {
    const api = installMockTodoApi([milk()]);
    await open();
    const input = startEdit("Buy milk");
    type("Buy oat milk");
    fireEvent.pointerDown(input);
    expect(editBox()).toHaveValue("Buy oat milk");
    const save = screen.getByRole("button", { name: "Save" });
    fireEvent.pointerDown(save);
    expect(editBox()).toBeInTheDocument();
    fireEvent.click(save);
    await waitFor(() => expect(editBox()).not.toBeInTheDocument());
    expect(shown()).toEqual(["Buy oat milk"]);
    expect(patches(api)[0].body).toEqual({ title: "Buy oat milk" });
  });

  it("AC-002.10 a press on Cancel does not cancel before the click", async () => {
    installMockTodoApi([milk()]);
    await open();
    startEdit("Buy milk");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Cancel" }));
    expect(editBox()).toBeInTheDocument();
  });
});

describe("validation", () => {
  it.each(["", "   "])("AC-002.11 saving %j sends no PATCH, stays in edit mode and shows 'Title is required'", async (value) => {
    const api = installMockTodoApi([milk()]);
    await open();
    startEdit("Buy milk");
    type(value);
    pressSave();
    expect(await screen.findByRole("alert")).toHaveTextContent(/^Title is required$/);
    expect(patches(api)).toHaveLength(0);
    expect(editBox()).toHaveValue(value);
  });

  it("AC-002.12 a 201 code point title sends no PATCH, stays in edit mode and shows the too-long message", async () => {
    const api = installMockTodoApi([milk()]);
    await open();
    startEdit("Buy milk");
    const value = `  ${"😀".repeat(201)}  `;
    type(value);
    pressEnter();
    expect(await screen.findByRole("alert")).toHaveTextContent(/^Title must be at most 200 characters$/);
    expect(patches(api)).toHaveLength(0);
    expect(editBox()).toHaveValue(value);
  });

  it.each([["a"], ["😀"]])("AC-002.13 a title of exactly 200 code points (%s) is sent and shown", async (ch) => {
    const api = installMockTodoApi([milk()]);
    await open();
    startEdit("Buy milk");
    const value = ch.repeat(200);
    type(value);
    pressSave();
    await waitFor(() => expect(editBox()).not.toBeInTheDocument());
    expect(patches(api)[0].body).toEqual({ title: value });
    expect(shown()).toEqual([value]);
  });

  it.each([
    ["title_required", "Title is required"],
    ["title_too_long", "Title must be at most 200 characters"],
  ])("AC-002.14 422 %s is shown as its own message whatever the API message says, in edit mode", async (code, text) => {
    const api = installMockTodoApi([milk()]);
    api.state.fail.PATCH = apiError(422, code, "banana");
    await open();
    startEdit("Buy milk");
    type("Buy oat milk");
    pressSave();
    expect(await screen.findByRole("alert")).toHaveTextContent(new RegExp(`^${text}$`));
    expect(editBox()).toHaveValue("Buy oat milk");
    expect(screen.queryByText("Buy oat milk", { selector: "label *, label" })).not.toBeInTheDocument();
  });

  it("AC-002.15 leading and trailing spaces are removed in the PATCH and in the shown title", async () => {
    const api = installMockTodoApi([milk()]);
    await open();
    startEdit("Buy milk");
    type("  Buy oat milk  ");
    pressEnter();
    await waitFor(() => expect(editBox()).not.toBeInTheDocument());
    expect(patches(api)[0].body).toEqual({ title: "Buy oat milk" });
    expect(shown()).toEqual(["Buy oat milk"]);
  });
});

describe("failures", () => {
  it("AC-002.16 404 todo_not_found shows the message, leaves edit mode and re-fetches the list", async () => {
    const api = installMockTodoApi([milk(), mum()]);
    await open();
    startEdit("Buy milk");
    type("Buy oat milk");
    api.state.todos = api.state.todos.filter((t) => t.title !== "Buy milk"); // deleted in another tab
    const gets = api.count("GET");
    pressSave();
    expect(await screen.findByRole("alert")).toHaveTextContent(/^This todo no longer exists$/);
    await waitFor(() => expect(shown()).toEqual(["Call mum"]));
    expect(editBox()).not.toBeInTheDocument();
    expect(api.count("GET")).toBe(gets + 1);
  });

  it.each([["down"], ["503"]] as const)("AC-002.17 todo-api %s: message, one PATCH, stays in edit mode, Cancel shows the old title", async (mode) => {
    const api = installMockTodoApi([milk()]);
    await open();
    api.state.fail.PATCH = mode === "down" ? "down" : apiError(503, "unavailable");
    startEdit("Buy milk");
    type("Buy oat milk");
    pressSave();
    expect(await screen.findByRole("alert")).toHaveTextContent(new RegExp(`^${UNAVAILABLE}$`));
    expect(patches(api)).toHaveLength(1);
    expect(editBox()).toHaveValue("Buy oat milk");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(shown()).toEqual(["Buy milk"]);
    cleanup();
    await open();
    expect(shown()).toEqual(["Buy milk"]);
  });

  it("AC-002.17 a PATCH that never answers is aborted after 5 s and reported as unavailable", async () => {
    const api = installMockTodoApi([milk()]);
    await open();
    api.state.fail.PATCH = "hang";
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    startEdit("Buy milk");
    type("Buy oat milk");
    pressSave();
    await vi.waitFor(() => expect(patches(api)).toHaveLength(1));
    controller.abort(new DOMException("timeout", "TimeoutError"));
    expect(await screen.findByRole("alert")).toHaveTextContent(new RegExp(`^${UNAVAILABLE}$`));
    expect(timeout).toHaveBeenCalledWith(5000);
    expect(editBox()).toHaveValue("Buy oat milk");
  });

  it.each([
    ["422 invalid_request", apiError(422, "invalid_request")],
    ["400", { status: 400, body: {} }],
    ["200 with an invalid body", { status: 200, body: { nope: true } }],
  ])("AC-002.18 an unlisted answer (%s) is unavailable and the new title is not shown as saved", async (_n, behavior) => {
    const api = installMockTodoApi([milk()]);
    api.state.fail.PATCH = behavior;
    await open();
    startEdit("Buy milk");
    type("Buy oat milk");
    pressSave();
    expect(await screen.findByRole("alert")).toHaveTextContent(new RegExp(`^${UNAVAILABLE}$`));
    expect(patches(api)).toHaveLength(1);
    expect(editBox()).toHaveValue("Buy oat milk");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(shown()).toEqual(["Buy milk"]);
  });
});

describe("while a save is waiting", () => {
  it("AC-002.19 a second Enter or Save sends nothing and Escape, Cancel and outside presses are ignored", async () => {
    const api = installMockTodoApi([milk(), mum()]);
    await open();
    api.state.fail.PATCH = "hang";
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    startEdit("Buy milk");
    type("Buy oat milk");
    pressEnter();
    await vi.waitFor(() => expect(patches(api)).toHaveLength(1));
    pressEnter();
    pressSave();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Title" }), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.pointerDown(document.body);
    fireEvent.pointerDown(screen.getByText("Call mum"));
    expect(editBox()).toHaveValue("Buy oat milk");
    expect(patches(api)).toHaveLength(1);
    controller.abort(new DOMException("timeout", "TimeoutError"));
    expect(await screen.findByRole("alert")).toHaveTextContent(new RegExp(`^${UNAVAILABLE}$`));
    expect(editBox()).toHaveValue("Buy oat milk");
    expect(patches(api)).toHaveLength(1);
  });
});

describe("server-side only and no persistence", () => {
  it("AC-002.20 the PATCH is made by the server path and nothing is written to browser storage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const idbOpen = vi.fn();
    vi.stubGlobal("indexedDB", { open: idbOpen });
    const api = installMockTodoApi([milk()]);
    await open();
    startEdit("Buy milk");
    type("Buy oat milk");
    pressSave();
    await waitFor(() => expect(editBox()).not.toBeInTheDocument());
    expect(patches(api)).toHaveLength(1);
    expect(patches(api)[0].url).toBe(`http://todo-api.test/todos/${milk().id}`);
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(idbOpen).not.toHaveBeenCalled();
    expect(document.cookie).toBe("");
  });

  it("AC-002.20 the client component only calls the setTodoTitle action it is given, never fetch", async () => {
    const api = installMockTodoApi();
    api.fetchMock.mockClear();
    const stub = {
      addTodo: vi.fn(),
      setTodoDone: vi.fn(),
      deleteTodo: vi.fn(),
      setTodoTitle: vi.fn(async () => ({ ok: true as const, data: todo(1, { title: "Buy oat milk" }) })),
    };
    render(<TodoList initialTodos={[milk()]} initialError={null} actions={stub} />);
    startEdit("Buy milk");
    type("Buy oat milk");
    pressSave();
    await waitFor(() => expect(stub.setTodoTitle).toHaveBeenCalledWith(milk().id, "Buy oat milk"));
    expect(api.fetchMock).not.toHaveBeenCalled();
  });
});

describe("unchanged title", () => {
  it("AC-002.21 saving the same title (after trimming) leaves edit mode and sends nothing", async () => {
    const api = installMockTodoApi([milk()]);
    await open();
    startEdit("Buy milk");
    type("  Buy milk ");
    pressSave();
    await waitFor(() => expect(editBox()).not.toBeInTheDocument());
    expect(shown()).toEqual(["Buy milk"]);
    expect(api.state.calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  });
});

describe("accessibility", () => {
  it("AC-002.22 each Edit control has visible text 'Edit' and the accessible name 'Edit <title>'", async () => {
    installMockTodoApi([milk(), mum()]);
    await open();
    for (const name of ["Edit Buy milk", "Edit Call mum"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveTextContent(/^Edit$/);
      expect(button).toHaveAttribute("type", "button");
    }
    expect(within(rows()[0]).getByRole("button", { name: "Edit Buy milk" })).toBeInTheDocument();
    expect(within(rows()[1]).getByRole("button", { name: "Edit Call mum" })).toBeInTheDocument();
  });

  it("AC-002.23 in edit mode the input is named Title and the controls are buttons named Save and Cancel", async () => {
    installMockTodoApi([milk()]);
    await open();
    startEdit("Buy milk");
    const row = rows()[0];
    expect(within(row).getByRole("textbox", { name: "Title" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Add a todo" })).toBeInTheDocument();
  });
});

describe("click outside that lands on a control", () => {
  it("AC-002.24 one click on another row's checkbox cancels the edit and toggles that todo", async () => {
    const api = installMockTodoApi([milk(), mum()]);
    await open();
    startEdit("Buy milk");
    type("Buy oat milk");
    const box = screen.getByRole("checkbox", { name: "Call mum" });
    fireEvent.pointerDown(box);
    fireEvent.click(box);
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Call mum" })).toBeChecked());
    expect(editBox()).not.toBeInTheDocument();
    expect(shown()).toEqual(["Buy milk", "Call mum"]);
    expect(patches(api)).toHaveLength(1);
    expect(patches(api)[0]).toMatchObject({ path: `/todos/${mum().id}`, body: { done: true } });
  });

  it("AC-002.24 one click on another row's Delete cancels the edit and deletes that todo", async () => {
    const api = installMockTodoApi([milk(), mum()]);
    await open();
    startEdit("Buy milk");
    type("Buy oat milk");
    const del = screen.getByRole("button", { name: "Delete Call mum" });
    fireEvent.pointerDown(del);
    fireEvent.click(del);
    await waitFor(() => expect(shown()).toEqual(["Buy milk"]));
    expect(editBox()).not.toBeInTheDocument();
    expect(patches(api)).toHaveLength(0);
    expect(api.count("DELETE")).toBe(1);
  });

  it("AC-002.24 one click on Add cancels the edit and adds the todo", async () => {
    const api = installMockTodoApi([milk()]);
    await open();
    startEdit("Buy milk");
    type("Buy oat milk");
    fireEvent.change(screen.getByRole("textbox", { name: "New todo" }), { target: { value: "New one" } });
    const add = screen.getByRole("button", { name: "Add" });
    fireEvent.pointerDown(add);
    fireEvent.click(add);
    await waitFor(() => expect(shown()).toEqual(["Buy milk", "New one"]));
    expect(editBox()).not.toBeInTheDocument();
    expect(patches(api)).toHaveLength(0);
    expect(api.count("POST")).toBe(1);
  });
});

describe("focus after save", () => {
  it("AC-002.25 after a successful save focus is on the todo's Edit control, now named after the new title", async () => {
    installMockTodoApi([milk()]);
    await open();
    startEdit("Buy milk");
    type("Buy oat milk");
    pressSave();
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit Buy oat milk" })).toHaveFocus());
    expect(alertText()).toBeUndefined();
  });
});
