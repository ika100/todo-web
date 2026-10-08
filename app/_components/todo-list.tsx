"use client";

import { useState } from "react";
import type { FormEvent } from "react";

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
    let index = todos.findIndex((t) => t.id === id);
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
      index = -1;
      setBusy(id, false);
    }
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
              <label>
                <input type="checkbox" checked={t.done} disabled={pending.has(t.id)} onChange={() => void onToggle(t)} />
                <span className="todo-title">{t.title}</span>
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                aria-label={`Delete ${t.title}`}
                disabled={pending.has(t.id)}
                onClick={() => void onDelete(t)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
