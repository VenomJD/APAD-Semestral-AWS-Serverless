"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import "./../app/app.css";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";
import { Authenticator } from '@aws-amplify/ui-react';
import { getCurrentUser } from 'aws-amplify/auth';

Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function App() {
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [filter, setFilter] = useState<string>("todas");
  const [userSub, setUserSub] = useState<string | null>(null);

  // Detecta el usuario actual y actualiza el estado cuando cambia
  useEffect(() => {
    getCurrentUser()
      .then(user => setUserSub(user.userId))
      .catch(() => setUserSub(null));
  }, []);

  // Suscríbete a los todos cada vez que cambia el usuario
  useEffect(() => {
    if (!userSub) return;
    const subscription = client.models.Todo.observeQuery().subscribe({
      next: (data) => {
        setTodos(data.items.filter(todo => todo.owner === userSub));
      },
    });
    return () => subscription.unsubscribe();
  }, [userSub]);

  // Limpia las tareas cuando no hay usuario autenticado
  useEffect(() => {
    if (!userSub) {
      setTodos([]);
    }
  }, [userSub]);

  // Función para recargar tareas manualmente
  function refreshTodos() {
    getCurrentUser()
      .then(user => {
        client.models.Todo.list().then(data => {
          setTodos(data.data.filter(todo => todo.owner === user.userId));
        });
      })
      .catch(() => setTodos([]));
  }

  function createTodo() {
    const content = window.prompt("Contenido de la tarea");
    if (!content) return;
    const status = window.prompt(
      "Estado inicial de la tarea (pendiente, en progreso, completada)",
      "pendiente"
    );
    getCurrentUser().then(user => {
      client.models.Todo.create({
        content,
        status: status || "pendiente",
        owner: user.userId, // Esto será solo el sub
      });
    });
  }

  function updateStatus(id: string, currentStatus: string) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const nextStatus = window.prompt(
      "Nuevo estado (pendiente, en progreso, completada)",
      currentStatus
    );
    if (!nextStatus || nextStatus === currentStatus) return;
    client.models.Todo.update({ id, content: todo.content, status: nextStatus });
  }

  function deleteTodo(id: string) {
    if (window.confirm("¿Seguro que quieres eliminar esta tarea?")) {
      client.models.Todo.delete({ id });
    }
  }

  function editTodo(id: string) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const newContent = window.prompt("Nuevo contenido de la tarea", todo.content);
    if (!newContent) return;
    const newStatus = window.prompt(
      "Nuevo estado (pendiente, en progreso, completada)",
      todo.status || "pendiente"
    );
    if (!newStatus) return;
    client.models.Todo.update({ id, content: newContent, status: newStatus });
  }

  // Filtrado de tareas
  const filteredTodos = filter === "todas"
    ? todos
    : todos.filter((todo) => (todo.status || "pendiente") === filter);

  return (
    <Authenticator>
     {({signOut, user}) => (
      <main>
      <div style={{ marginBottom: 16 }}>
        <b>{user?.signInDetails?.loginId ? `Usuario: ${user?.signInDetails?.loginId}` : "Usuario: ..."}</b>
      </div>
      <h1>Mis tareas</h1>
      <button onClick={createTodo}>+ nueva</button>
      <div style={{ margin: '12px 0', display: 'flex', alignItems: 'center' }}>
        <label style={{ marginRight: 8 }}>Filtrar por estado: </label>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ marginRight: 8 }}>
          <option value="todas">Todas</option>
          <option value="pendiente">Pendientes</option>
          <option value="en progreso">En progreso</option>
          <option value="completada">Completadas</option>
        </select>
        <button onClick={refreshTodos}>Actualizar</button>
      </div>
      <ul>
        {filteredTodos.map((todo) => (
          <li key={todo.id}>
            <b>{todo.content}</b>
            <br />
            <span>Estado: {todo.status || "pendiente"}</span>
            <button style={{ marginLeft: 8 }} onClick={() => updateStatus(todo.id, todo.status || "pendiente")}>Cambiar estado</button>
            <button style={{ marginLeft: 8, color: "red" }} onClick={() => deleteTodo(todo.id)}>Eliminar</button>
            <button style={{ marginLeft: 8 }} onClick={() => editTodo(todo.id)}>Editar</button>
          </li>
        ))}
      </ul>
      <button onClick={signOut}>Cerrar sesión</button>
    </main>
    )}
    </Authenticator>
  );
}
