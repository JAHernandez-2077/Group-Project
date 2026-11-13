import { getStore } from "@netlify/blobs";

const store = getStore({ name: "daybook-tasks", consistency: "strong" });
const tasksKey = "tasks.json";
const validPriorities = new Set(["low", "medium", "high"]);

function jsonResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function readTasks() {
  const tasks = await store.get(tasksKey, { type: "json" });
  return Array.isArray(tasks) ? tasks : [];
}

function validateFields(body, current = {}) {
  const title = body.title === undefined ? current.title : String(body.title).trim();
  const notes = body.notes === undefined ? current.notes || "" : String(body.notes).trim();
  const dueDate = body.dueDate === undefined ? current.dueDate || "" : String(body.dueDate);
  const priority = body.priority === undefined ? current.priority || "medium" : String(body.priority);

  if (typeof title !== "string" || !title || title.length > 120) {
    return { error: "Task name is required and must be 120 characters or fewer." };
  }
  if (notes.length > 500) return { error: "Task details must be 500 characters or fewer." };
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { error: "Due date must use YYYY-MM-DD format." };
  if (!validPriorities.has(priority)) return { error: "Priority must be low, medium, or high." };

  return { fields: { title, notes, dueDate, priority } };
}

export default async function handler(request) {
  try {
    if (request.method === "GET") {
      return jsonResponse(await readTasks());
    }

    if (!["POST", "PATCH", "DELETE"].includes(request.method)) {
      return jsonResponse({ error: "Method not allowed." }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400);
    }

    const tasks = await readTasks();

    if (request.method === "POST") {
      const { fields, error } = validateFields(body);
      if (error) return jsonResponse({ error }, 400);

      const task = {
        id: crypto.randomUUID(),
        ...fields,
        completed: false,
        createdAt: Date.now(),
      };
      await store.setJSON(tasksKey, [...tasks, task]);
      return jsonResponse(task, 201);
    }

    if (typeof body.id !== "string") return jsonResponse({ error: "Task id is required." }, 400);
    const taskIndex = tasks.findIndex((task) => task.id === body.id);
    if (taskIndex === -1) return jsonResponse({ error: "Task not found." }, 404);

    if (request.method === "DELETE") {
      const [deleted] = tasks.splice(taskIndex, 1);
      await store.setJSON(tasksKey, tasks);
      return jsonResponse(deleted);
    }

    const current = tasks[taskIndex];
    const { fields, error } = validateFields(body, current);
    if (error) return jsonResponse({ error }, 400);
    if (body.completed !== undefined && typeof body.completed !== "boolean") {
      return jsonResponse({ error: "Completed must be true or false." }, 400);
    }

    const updated = {
      ...current,
      ...fields,
      completed: body.completed === undefined ? current.completed : body.completed,
    };
    tasks[taskIndex] = updated;
    await store.setJSON(tasksKey, tasks);
    return jsonResponse(updated);
  } catch (error) {
    console.error("Task API error:", error);
    return jsonResponse({ error: "Unable to access the task database." }, 500);
  }
}