// ACT 8 - TASK MANAGER

const taskForm = document.getElementById("taskForm");
const taskName = document.getElementById("taskName");
const dueDate = document.getElementById("dueDate");

const hourSelect = document.getElementById("hour");
const minuteSelect = document.getElementById("minute");
const periodSelect = document.getElementById("period");

const taskList = document.getElementById("taskList");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const formError = document.getElementById("formError");

let tasks = [];
let currentFilter = "all";

// Load previously saved tasks
try {
    const saved = JSON.parse(localStorage.getItem("act8Tasks"));
    tasks = Array.isArray(saved) ? saved : [];
} catch {
    tasks = [];
}

// Save tasks
function saveTasks() {
    localStorage.setItem("act8Tasks", JSON.stringify(tasks));
}

// Format dates in local time
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// Create hour options
for (let i = 1; i <= 12; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = i;
    hourSelect.appendChild(option);
}

// Set dropdown time from a Date
function setTime(date) {
    const hours = date.getHours();

    hourSelect.value = (hours % 12) || 12;
    minuteSelect.value =
        String(date.getMinutes()).padStart(2, "0");
    periodSelect.value = hours >= 12 ? "PM" : "AM";
}

// Convert dropdowns into 24-hour time
function getTime() {
    let hour = Number(hourSelect.value);

    if (periodSelect.value === "PM" && hour !== 12) {
        hour += 12;
    }

    if (periodSelect.value === "AM" && hour === 12) {
        hour = 0;
    }

    return String(hour).padStart(2, "0") + ":" +
           minuteSelect.value;
}

// Choose a future default deadline
function setDefaultDeadline() {
    const now = new Date();

    // Round to the next 15-minute interval
    const next = new Date(
        Math.floor(now.getTime() / 900000) * 900000
        + 900000
    );

    dueDate.min = formatDate(now);
    dueDate.value = formatDate(next);
    setTime(next);

    updateQuickDateButtons();
}

// Select Today, Tomorrow, or Next Week
function chooseDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);

    dueDate.value = formatDate(date);

    // Today must use a future time
    if (days === 0) {
        const selected = new Date(
            `${dueDate.value}T${getTime()}`
        );

        if (selected <= new Date()) {
            setDefaultDeadline();
        }
    }

    updateQuickDateButtons();
}

document.getElementById("todayBtn").onclick = () => chooseDate(0);
document.getElementById("tomorrowBtn").onclick = () => chooseDate(1);
document.getElementById("weekBtn").onclick = () => chooseDate(7);

// Highlight selected quick-date button
function updateQuickDateButtons() {
    const today = new Date();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const dates = [
        formatDate(today),
        formatDate(tomorrow),
        formatDate(nextWeek)
    ];

    const buttons = [
        "todayBtn",
        "tomorrowBtn",
        "weekBtn"
    ];

    buttons.forEach((id, index) => {
        document.getElementById(id).classList.toggle(
            "selected",
            dueDate.value === dates[index]
        );
    });
}

dueDate.addEventListener("change", updateQuickDateButtons);

// Quick time buttons
document.querySelectorAll("[data-time]").forEach(button => {
    button.addEventListener("click", () => {
        const [hours, minutes] = button.dataset.time
            .split(":")
            .map(Number);

        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        setTime(date);

        updateQuickTimeButtons();
    });
});

function updateQuickTimeButtons() {
    document.querySelectorAll("[data-time]").forEach(button => {
        button.classList.toggle(
            "selected",
            button.dataset.time === getTime()
        );
    });
}

[hourSelect, minuteSelect, periodSelect].forEach(select => {
    select.addEventListener("change", updateQuickTimeButtons);
});

// ADD TASK
taskForm.addEventListener("submit", function(event) {
    event.preventDefault();
    formError.textContent = "";

    const name = taskName.value.trim();
    const deadline = `${dueDate.value}T${getTime()}`;
    const deadlineDate = new Date(deadline);

    if (!name || !dueDate.value) {
        formError.textContent = "Please enter a task and deadline.";
        return;
    }

    // Don't allow past dates and times
    if (
        Number.isNaN(deadlineDate.getTime()) ||
        deadlineDate <= new Date()
    ) {
        formError.textContent =
            "Please choose a future date and time.";
        return;
    }

    const task = {
        id: crypto.randomUUID(),
        name: name,
        due: deadline,
        completed: false,
        createdAt: Date.now()
    };

    tasks.push(task);

    saveTasks();
    displayTasks();

    taskName.value = "";
    setDefaultDeadline();
    updateQuickTimeButtons();
    taskName.focus();
});

// COMPLETE OR UNCOMPLETE TASK
function toggleTask(id) {
    tasks = tasks.map(task => {
        if (task.id === id) {
            return {
                ...task,
                completed: !task.completed
            };
        }

        return task;
    });

    saveTasks();
    displayTasks();
}

// DELETE TASK
function deleteTask(id) {
    tasks = tasks.filter(task => task.id !== id);

    saveTasks();
    displayTasks();
}

// CHECK DEADLINE
function getTaskStatus(task) {
    if (task.completed) {
        return {
            text: "✓ Completed",
            className: "completed"
        };
    }

    const now = new Date();
    const deadline = new Date(task.due);

    if (deadline < now) {
        return {
            text: "Overdue",
            className: "overdue"
        };
    }

    if (deadline.toDateString() === now.toDateString()) {
        return {
            text: "Due Today",
            className: "today"
        };
    }

    return {
        text: "Upcoming",
        className: "upcoming"
    };
}

// MAKE DATES EASY TO READ
function readableDate(dateString) {
    return new Date(dateString).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

// UPDATE DASHBOARD
function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;

    const percentage = total === 0
        ? 0
        : Math.round((completed / total) * 100);

    document.getElementById("totalCount").textContent = total;
    document.getElementById("pendingCount").textContent = pending;
    document.getElementById("completedCount").textContent = completed;
    document.getElementById("progressText").textContent =
        percentage + "%";
    document.getElementById("progressBar").style.width =
        percentage + "%";
}

// FILTER TASKS
document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter;

        document.querySelectorAll("[data-filter]").forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");
        displayTasks();
    });
});

// SEARCH AND SORT
searchInput.addEventListener("input", displayTasks);
sortSelect.addEventListener("change", displayTasks);

// DISPLAY TASKS
function displayTasks() {
    taskList.innerHTML = "";

    let visibleTasks = [...tasks];

    // Search task names
    const search = searchInput.value.trim().toLowerCase();

    visibleTasks = visibleTasks.filter(task =>
        task.name.toLowerCase().includes(search)
    );

    // Apply filters
    if (currentFilter === "pending") {
        visibleTasks = visibleTasks.filter(t => !t.completed);
    }

    if (currentFilter === "completed") {
        visibleTasks = visibleTasks.filter(t => t.completed);
    }

    // Sort by due date or creation date
    if (sortSelect.value === "earliest") {
        visibleTasks.sort((a, b) =>
            a.completed - b.completed ||
            new Date(a.due) - new Date(b.due)
        );
    }

    if (sortSelect.value === "latest") {
        visibleTasks.sort((a, b) =>
            a.completed - b.completed ||
            new Date(b.due) - new Date(a.due)
        );
    }

    if (sortSelect.value === "newest") {
        visibleTasks.sort((a, b) =>
            b.createdAt - a.createdAt
        );
    }

    // Empty state
    emptyState.style.display =
        visibleTasks.length === 0 ? "block" : "none";

    // Create task cards
    visibleTasks.forEach(task => {
        const card = document.createElement("div");
        card.className = "task-card";

        if (task.completed) {
            card.classList.add("finished");
        }

        // Checkbox
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "task-check";
        checkbox.checked = task.completed;
        checkbox.setAttribute(
            "aria-label",
            `Mark ${task.name} as completed`
        );

        checkbox.addEventListener("change", () => {
            toggleTask(task.id);
        });

        // Task information
        const details = document.createElement("div");
        details.className = "task-details";

        const name = document.createElement("p");
        name.className = "task-name";
        name.textContent = task.name;

        const date = document.createElement("p");
        date.className = "task-date";
        date.textContent = "🕒 " + readableDate(task.due);

        // Status indicator
        const statusInfo = getTaskStatus(task);

        const status = document.createElement("span");
        status.className = "status " + statusInfo.className;
        status.textContent = statusInfo.text;

        details.append(name, date, status);

        // Delete button
        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-btn";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute(
            "aria-label",
            `Delete ${task.name}`
        );

        deleteButton.addEventListener("click", () => {
            deleteTask(task.id);
        });

        card.append(checkbox, details, deleteButton);
        taskList.appendChild(card);
    });

    updateStats();
}

// INITIAL SETUP
setDefaultDeadline();
updateQuickTimeButtons();
displayTasks();

// Keep task statuses and minimum date updated
setInterval(() => {
    dueDate.min = formatDate(new Date());
    displayTasks();
}, 60000);
