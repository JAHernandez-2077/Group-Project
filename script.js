const API_URL = "/.netlify/functions/tasks";
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const views = {
	all: { title: "All tasks", heading: "A FRESH PAGE" },
	today: { title: "Today", heading: "TODAY, AT YOUR PACE" },
	upcoming: { title: "Upcoming", heading: "ON THE HORIZON" },
	completed: { title: "Completed", heading: "LOOK WHAT YOU DID" },
};

const taskList = document.querySelector("#task-list");
const taskDialog = document.querySelector("#task-dialog");
const taskForm = document.querySelector("#task-form");
const taskTitleInput = document.querySelector("#task-title");
const taskNotesInput = document.querySelector("#task-notes");
const taskDueInput = document.querySelector("#task-due");
const taskPriorityInput = document.querySelector("#task-priority");
const searchInput = document.querySelector("#search-input");
const sortSelect = document.querySelector("#sort-select");
let tasks = [];
let activeFilter = "all";
let editingId = null;
let toastTimeout;
let isLoading = true;
let loadFailed = false;

function isValidTask(task) {
	return task && typeof task.id === "string" && typeof task.title === "string" &&
		typeof task.completed === "boolean" && typeof task.createdAt === "number";
}

async function requestApi(method, body) {
	const options = { method, headers: {} };
	if (body !== undefined) {
		options.headers["Content-Type"] = "application/json";
		options.body = JSON.stringify(body);
	}
	const response = await fetch(API_URL, options);
	const data = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(data.error || "Task request failed.");
	return data;
}

async function loadTasks() {
	try {
		const savedTasks = await requestApi("GET");
		if (!Array.isArray(savedTasks)) throw new Error("The task database returned invalid data.");
		tasks = savedTasks.filter(isValidTask);
		loadFailed = false;
	} catch (error) {
		console.error("Unable to load tasks:", error);
		loadFailed = true;
		showToast(error.message || "Unable to load tasks from the server.");
	} finally {
		isLoading = false;
		renderTasks();
	}
}

function localDateString(date = new Date()) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
	if (!dateString) return "No due date";
	const date = new Date(`${dateString}T12:00:00`);
	if (Number.isNaN(date.getTime())) return "No due date";
	return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function getVisibleTasks() {
	const today = localDateString();
	const query = searchInput.value.trim().toLocaleLowerCase();
	const filtered = tasks.filter((task) => {
		if (activeFilter === "today" && (task.completed || task.dueDate !== today)) return false;
		if (activeFilter === "upcoming" && (task.completed || !task.dueDate || task.dueDate <= today)) return false;
		if (activeFilter === "completed" && !task.completed) return false;
		return `${task.title} ${task.notes || ""}`.toLocaleLowerCase().includes(query);
	});
	const sortBy = sortSelect.value;
	return filtered.sort((first, second) => {
		if (first.completed !== second.completed) return Number(first.completed) - Number(second.completed);
		if (sortBy === "priority") return PRIORITY_ORDER[first.priority] - PRIORITY_ORDER[second.priority] || first.createdAt - second.createdAt;
		if (sortBy === "created") return second.createdAt - first.createdAt;
		return (first.dueDate || "9999-12-31").localeCompare(second.dueDate || "9999-12-31") || first.createdAt - second.createdAt;
	});
}

function updateSummary() {
	const today = localDateString();
	const completed = tasks.filter((task) => task.completed).length;
	const remaining = tasks.length - completed;
	const overdue = tasks.filter((task) => !task.completed && task.dueDate && task.dueDate < today).length;
	const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

	document.querySelector("#all-count").textContent = tasks.length;
	document.querySelector("#today-count").textContent = tasks.filter((task) => !task.completed && task.dueDate === today).length;
	document.querySelector("#upcoming-count").textContent = tasks.filter((task) => !task.completed && task.dueDate && task.dueDate > today).length;
	document.querySelector("#completed-count").textContent = completed;
	document.querySelector("#remaining-count").textContent = remaining;
	document.querySelector("#done-count").textContent = completed;
	document.querySelector("#overdue-count").textContent = overdue;
	document.querySelector("#completion-percent").textContent = `${percent}%`;
	document.querySelector("#completion-ring").setAttribute("aria-label", `${percent} percent of tasks complete`);
	document.querySelector("#ring-value").style.strokeDashoffset = `${138.23 * (1 - percent / 100)}`;
	document.querySelector("#sidebar-progress").style.width = `${percent}%`;
	document.querySelector("#sidebar-progress-label").textContent = tasks.length ? `${completed} of ${tasks.length} tasks complete` : "Your day is waiting";
	document.querySelector("#sidebar-note").textContent = percent === 100 && tasks.length ? "You made it happen." : "A little progress adds up.";
}

function makeTag(text, className = "") {
	const tag = document.createElement("span");
	tag.className = `task-tag ${className}`.trim();
	tag.textContent = text;
	return tag;
}

function renderTask(task) {
	const row = document.createElement("article");
	row.className = `task-row${task.completed ? " is-complete" : ""}`;

	const toggle = document.createElement("button");
	toggle.type = "button";
	toggle.className = "task-toggle";
	toggle.setAttribute("aria-label", task.completed ? `Mark ${task.title} as not completed` : `Complete ${task.title}`);
	toggle.setAttribute("aria-pressed", String(task.completed));
	toggle.addEventListener("click", () => toggleTask(task.id));

	const main = document.createElement("div");
	main.className = "task-main";
	const title = document.createElement("h3");
	title.className = "task-title";
	title.textContent = task.title;
	main.append(title);
	if (task.notes) {
		const notes = document.createElement("p");
		notes.className = "task-notes";
		notes.textContent = task.notes;
		main.append(notes);
	}

	const meta = document.createElement("div");
	meta.className = "task-meta";
	const today = localDateString();
	const dueClass = !task.completed && task.dueDate < today ? "overdue" : !task.completed && task.dueDate === today ? "due-today" : "";
	meta.append(makeTag(task.dueDate ? formatDate(task.dueDate) : "No date", dueClass));
	const priority = document.createElement("span");
	priority.className = `task-tag priority-${task.priority || "medium"}`;
	const priorityDot = document.createElement("span");
	priorityDot.className = "priority-dot";
	priorityDot.setAttribute("aria-hidden", "true");
	priority.append(priorityDot, document.createTextNode(`${(task.priority || "medium").charAt(0).toUpperCase()}${(task.priority || "medium").slice(1)} priority`));
	meta.append(priority);
	main.append(meta);

	const actions = document.createElement("div");
	actions.className = "task-actions";
	const editButton = document.createElement("button");
	editButton.type = "button";
	editButton.className = "icon-button task-action";
	editButton.setAttribute("aria-label", `Edit ${task.title}`);
	editButton.title = "Edit task";
	editButton.textContent = "✎";
	editButton.addEventListener("click", () => openEditDialog(task));
	const deleteButton = document.createElement("button");
	deleteButton.type = "button";
	deleteButton.className = "icon-button task-action delete-action";
	deleteButton.setAttribute("aria-label", `Delete ${task.title}`);
	deleteButton.title = "Delete task";
	deleteButton.textContent = "×";
	deleteButton.addEventListener("click", () => deleteTask(task.id));
	actions.append(editButton, deleteButton);

	row.append(toggle, main, actions);
	return row;
}

function renderTasks() {
	const visibleTasks = getVisibleTasks();
	taskList.replaceChildren();
	document.querySelector("#list-title").textContent = views[activeFilter].title;
	document.querySelector("#greeting").textContent = views[activeFilter].heading;
	document.querySelector("#result-label").textContent = `${visibleTasks.length} ${visibleTasks.length === 1 ? "task" : "tasks"}`;

	if (!visibleTasks.length) {
		const isFiltered = searchInput.value.trim() || activeFilter !== "all";
		const empty = document.createElement("div");
		empty.className = "empty-state";
		const mark = document.createElement("span");
		mark.className = "empty-mark";
		mark.setAttribute("aria-hidden", "true");
		mark.textContent = isLoading ? "..." : loadFailed ? "!" : isFiltered ? "..." : "+";
		const heading = document.createElement("h3");
		heading.textContent = isLoading ? "Loading your tasks." : loadFailed ? "Couldn't reach your tasks." : isFiltered ? "Nothing to see here." : "Start with one small thing.";
		const description = document.createElement("p");
		description.textContent = isLoading ? "Connecting to your task database..." : loadFailed ? "Check the connection and try again." : isFiltered ? "Try another view or search term." : "Add a task and make it yours.";
		empty.append(mark, heading, description);
		if (loadFailed) {
			const retryButton = document.createElement("button");
			retryButton.type = "button";
			retryButton.className = "add-button empty-add";
			retryButton.textContent = "Try again";
			retryButton.addEventListener("click", loadTasks);
			empty.append(retryButton);
		} else if (!isLoading && !isFiltered) {
			const addButton = document.createElement("button");
			addButton.type = "button";
			addButton.className = "add-button empty-add";
			addButton.textContent = "Add your first task";
			addButton.addEventListener("click", openNewDialog);
			empty.append(addButton);
		}
		taskList.append(empty);
	} else {
		visibleTasks.forEach((task) => taskList.append(renderTask(task)));
	}

	updateSummary();
}

function openNewDialog() {
	editingId = null;
	taskForm.reset();
	document.querySelector("#dialog-eyebrow").textContent = "ADD TO YOUR LIST";
	document.querySelector("#dialog-title").textContent = "New task";
	document.querySelector("#save-task").textContent = "Add task";
	taskDialog.showModal();
	taskTitleInput.focus();
}

function openEditDialog(task) {
	editingId = task.id;
	taskTitleInput.value = task.title;
	taskNotesInput.value = task.notes || "";
	taskDueInput.value = task.dueDate || "";
	taskPriorityInput.value = task.priority || "medium";
	document.querySelector("#dialog-eyebrow").textContent = "MAKE A CHANGE";
	document.querySelector("#dialog-title").textContent = "Edit task";
	document.querySelector("#save-task").textContent = "Save changes";
	taskDialog.showModal();
	taskTitleInput.focus();
}

async function toggleTask(id) {
	const task = tasks.find((item) => item.id === id);
	if (!task) return;
	try {
		const updatedTask = await requestApi("PATCH", { id, completed: !task.completed });
		tasks = tasks.map((item) => item.id === id ? updatedTask : item);
		renderTasks();
	} catch (error) {
		showToast(error.message || "Unable to update task.");
	}
}

async function deleteTask(id) {
	try {
		await requestApi("DELETE", { id });
		tasks = tasks.filter((item) => item.id !== id);
		renderTasks();
		showToast("Task deleted");
	} catch (error) {
		showToast(error.message || "Unable to delete task.");
	}
}

function showToast(message) {
	const toast = document.querySelector("#toast");
	toast.textContent = message;
	toast.classList.add("is-visible");
	clearTimeout(toastTimeout);
	toastTimeout = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

document.querySelector("#current-date").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
document.querySelector("#open-task-dialog").addEventListener("click", openNewDialog);
document.querySelectorAll(".close-dialog").forEach((button) => button.addEventListener("click", () => taskDialog.close()));
document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => {
	activeFilter = button.dataset.filter;
	document.querySelectorAll(".nav-item").forEach((item) => {
		const isActive = item === button;
		item.classList.toggle("is-active", isActive);
		item.setAttribute("aria-pressed", String(isActive));
	});
	renderTasks();
}));
taskForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	const values = new FormData(taskForm);
	const title = String(values.get("title") || "").trim();
	if (!title) return taskTitleInput.focus();
	const fields = {
		title,
		notes: String(values.get("notes") || "").trim(),
		dueDate: String(values.get("dueDate") || ""),
		priority: String(values.get("priority") || "medium"),
	};
	try {
		if (editingId) {
			const updatedTask = await requestApi("PATCH", { id: editingId, ...fields });
			tasks = tasks.map((task) => task.id === editingId ? updatedTask : task);
			showToast("Changes saved");
		} else {
			const newTask = await requestApi("POST", fields);
			tasks.push(newTask);
			showToast("Task added");
		}
		taskDialog.close();
		renderTasks();
	} catch (error) {
		showToast(error.message || "Unable to save task.");
	}
});
searchInput.addEventListener("input", renderTasks);
sortSelect.addEventListener("change", renderTasks);
document.addEventListener("keydown", (event) => {
	if (event.key === "/" && !taskDialog.open && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
		event.preventDefault();
		searchInput.focus();
	}
});

renderTasks();
loadTasks();

