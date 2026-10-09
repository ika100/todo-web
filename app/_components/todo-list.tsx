"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import { MESSAGES, validateTitle } from "@/app/_lib/todo";
import type { Todo, TodoActions, TodoError } from "@/app/_lib/todo";

export type TodoListProps = {
  initialTodos: Todo[];
  initialError: "unavailable" | null;
  actions: TodoActions;
};

export function TodoList({ initialTodos, initialError, actions }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [loadFailed] = useState(initialError !== null);
  const [message, setMessage] = useState<TodoError | null>(initialError);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());

  const [editingState, setEditing] = useState<{ id: string; draft: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const focusEditId = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const saveRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const editButtons = useRef(new Map<string, HTMLButtonElement>());

  // Edit mode ends when the edited todo is no longer in the list.
  const editing = editingState && todos.some((t) => t.id === editingState.id) ? editingState : null;
  const editingId = editing?.id ?? null;

  useEffect(() => {
    if (editingId !== null) inputRef.current?.focus();
  }, [editingId]);

  useEffect(() => {
    // Runs after every render; a pending focus request is served once the Edit button exists.
    const id = focusEditId.current;
    if (id === null) return;
    const button = editButtons.current.get(id);
    if (button) {
      focusEditId.current = null;
      button.focus();
    }
  });

  useEffect(() => {
    if (editingId === null || saving) return;
    const handler = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node) {
        for (const el of [inputRef.current, saveRef.current, cancelRef.current]) {
          if (el?.contains(target)) return;
        }
      }
      setEditing(null);
      setMessage(null);
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [editingId, saving]);

  const setBusy = (id: string, busy: boolean) =>
    setPending((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adding) return;
    setMessage(null);
    const checked = validateTitle(title);
    if (!checked.ok) {
      setMessage(checked.error);
      return;
    }
    setAdding(true);
    try {
      const result = await actions.addTodo(title);
      if (result.ok) {
        setTodos((prev) => [...prev, result.data]);
        setTitle("");
      } else {
        setMessage(result.error);
      }
    } catch {
      setMessage("unavailable");
    } finally {
      setAdding(false);
    }
  }

  async function onToggle(item: Todo) {
    const id = item.id;
    setMessage(null);
    setBusy(id, true);
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !item.done } : t)));
    try {
      const result = await actions.setTodoDone(id, !item.done);
      if (result.ok) {
        setTodos((prev) => prev.map((t) => (t.id === id ? result.data : t)));
      } else if (result.error === "not_found") {
        setMessage("not_found");
        const fresh = result.todos;
        setTodos((prev) => fresh ?? prev.filter((t) => t.id !== id));
      } else {
        setTodos((prev) => prev.map((t) => (t.id === id ? item : t)));
        setMessage(result.error);
      }
    } catch {
      setTodos((prev) => prev.map((t) => (t.id === id ? item : t)));
      setMessage("unavailable");
    } finally {
      setBusy(id, false);
    }
  }

  async function onDelete(item: Todo) {
    const id = item.id;
    setMessage(null);
    setBusy(id, true);
    const index = todos.findIndex((t) => t.id === id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
    const restore = () =>
      setTodos((prev) => {
        if (prev.some((t) => t.id === id)) return prev;
        const next = [...prev];
        next.splice(Math.min(Math.max(index, 0), next.length), 0, item);
        return next;
      });
    try {
      const result = await actions.deleteTodo(id);
      if (!result.ok) {
        if (result.error === "not_found") {
          setMessage("not_found");
          const fresh = result.todos;
          if (fresh) setTodos(fresh);
        } else {
          restore();
          setMessage(result.error);
        }
      }
    } catch {
      restore();
      setMessage("unavailable");
    } finally {
      setBusy(id, false);
    }
  }

  function startEdit(item: Todo) {
    if (saving) return;
    setMessage(null);
    setEditing({ id: item.id, draft: item.title });
  }

  function cancelEdit() {
    if (saving || !editing) return;
    const id = editing.id;
    setEditing(null);
    setMessage(null);
    focusEditId.current = id;
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !editing) return;
    const { id, draft } = editing;
    setMessage(null);
    const checked = validateTitle(draft);
    if (!checked.ok) {
      setMessage(checked.error);
      return;
    }
    const current = todos.find((t) => t.id === id);
    if (current && current.title === checked.title) {
      setEditing(null);
      focusEditId.current = id;
      return;
    }
    setSaving(true);
    try {
      const result = await actions.setTodoTitle(id, draft);
      if (result.ok) {
        setTodos((prev) => prev.map((t) => (t.id === id ? result.data : t)));
        setEditing(null);
        focusEditId.current = id;
      } else if (result.error === "not_found") {
        setMessage("not_found");
        setEditing(null);
        const fresh = result.todos;
        setTodos((prev) => fresh ?? prev.filter((t) => t.id !== id));
      } else {
        setMessage(result.error);
      }
    } catch {
      setMessage("unavailable");
    } finally {
      setSaving(false);
    }
  }

  function onEditKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") cancelEdit();
  }

  return (
    <div className="container todo-page">
      <h1>Todos</h1>
      <form aria-label="Add a todo" noValidate onSubmit={onSubmit} className="todo-form">
        <label htmlFor="new-todo">New todo</label>
        <input id="new-todo" type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" />
        <button type="submit" className="btn btn-primary" disabled={adding}>
          Add
        </button>
      </form>
      {message ? (
        <p role="alert" className="todo-message">
          {MESSAGES[message]}
        </p>
      ) : null}
      {todos.length === 0 && !loadFailed ? <p className="todo-empty">No todos yet</p> : null}
      {todos.length > 0 ? (
        <ul aria-label="Todos" className="todo-items">
          {todos.map((t) => (
            <li key={t.id} data-done={t.done ? "true" : "false"} className="todo-item">
              {editing?.id === t.id ? (
                <form noValidate onSubmit={(e) => void onSave(e)} onKeyDown={onEditKeyDown} className="todo-edit">
                  <input
                    ref={inputRef}
                    type="text"
                    aria-label="Title"
                    autoComplete="off"
                    value={editing.draft}
                    readOnly={saving}
                    onChange={(e) => setEditing({ id: t.id, draft: e.target.value })}
                  />
                  <button ref={saveRef} type="submit" className="btn btn-primary" disabled={saving}>
                    Save
                  </button>
                  <button ref={cancelRef} type="button" className="btn btn-secondary" disabled={saving} onClick={cancelEdit}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <label>
                    <input type="checkbox" checked={t.done} disabled={pending.has(t.id)} onChange={() => void onToggle(t)} />
                    <span className="todo-title">{t.title}</span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    aria-label={`Edit ${t.title}`}
                    disabled={pending.has(t.id) || saving}
                    ref={(el) => {
                      if (el) editButtons.current.set(t.id, el);
                      else editButtons.current.delete(t.id);
                    }}
                    onClick={() => startEdit(t)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    aria-label={`Delete ${t.title}`}
                    disabled={pending.has(t.id)}
                    onClick={() => void onDelete(t)}
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
