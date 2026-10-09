"use server";

import type { ActionResult, Todo } from "@/app/_lib/todo";
import { validateTitle } from "@/app/_lib/todo";
import { createTodo, listTodos, removeTodo, updateTodoDone, updateTodoTitle } from "@/app/_lib/todo-api";

async function withRefresh<T>(result: ActionResult<T>): Promise<ActionResult<T>> {
  if (result.ok || result.error !== "not_found") return result;
  const list = await listTodos();
  return list.ok ? { ok: false, error: "not_found", todos: list.data } : result;
}

export async function addTodo(title: string): Promise<ActionResult<Todo>> {
  const checked = validateTitle(typeof title === "string" ? title : "");
  if (!checked.ok) return { ok: false, error: checked.error };
  return createTodo(checked.title);
}

export async function setTodoDone(id: string, done: boolean): Promise<ActionResult<Todo>> {
  return withRefresh(await updateTodoDone(String(id), done === true));
}

export async function setTodoTitle(id: string, title: string): Promise<ActionResult<Todo>> {
  const checked = validateTitle(typeof title === "string" ? title : "");
  if (!checked.ok) return { ok: false, error: checked.error };
  return withRefresh(await updateTodoTitle(String(id), checked.title));
}

export async function deleteTodo(id: string): Promise<ActionResult<null>> {
  return withRefresh(await removeTodo(String(id)));
}
