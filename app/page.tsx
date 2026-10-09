import type { Metadata } from "next";

import { TodoList } from "@/app/_components/todo-list";
import { addTodo, deleteTodo, setTodoDone, setTodoTitle } from "@/app/actions";
import { listTodos } from "@/app/_lib/todo-api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Todos" };

export default async function HomePage() {
  const result = await listTodos();
  const initialTodos = result.ok ? result.data : [];
  const initialError = result.ok ? null : ("unavailable" as const);
  return (
    <TodoList
      initialTodos={initialTodos}
      initialError={initialError}
      actions={{ addTodo, setTodoDone, setTodoTitle, deleteTodo }}
    />
  );
}
