const TASKS = [
    { id: "summe-1-bis-n", level: "easy", title: "Sum from 1 to n", goal: "Write a program that reads a number n and prints the sum of all numbers from 1 to n.", thinking: "Think about how a loop updates a running total." },
    { id: "groesste-zahl", level: "easy", title: "Find the Largest Number", goal: "Read 5 numbers and print the largest one.", thinking: "The challenge is not syntax, but step-by-step comparison." },
    { id: "digitensumme", level: "easy", title: "Calculate Digit Sum", goal: "A number is given. Calculate the sum of its digits.", thinking: "You need to break the number down logically." },
    { id: "gerade-ungerade-folge", level: "easy", title: "Count Even and Odd Numbers", goal: "Read 10 numbers and print how many are even and how many are odd.", thinking: "The logic is simple, but counting must stay accurate." },
    { id: "kleinste-zahl", level: "easy", title: "Find the Smallest Number", goal: "Read multiple numbers and find the smallest one.", thinking: "A good initial value is important." },
    { id: "palindrom-zahl", level: "medium", title: "Palindrome Number", goal: "Check whether a number is the same forward and backward, for example 1331.", thinking: "You need a smart way to reverse or compare." },
    { id: "wechselgeld", level: "medium", title: "Make Change with Minimum Coins", goal: "An amount in cents is given. Print how many 200, 100, 50, 20, 10, 5, 2, and 1 cent coins are needed.", thinking: "This is about strategy and order, not complex syntax." },
    { id: "laengste-serie", level: "medium", title: "Longest Increasing Streak", goal: "Given multiple numbers, find the length of the longest directly consecutive increasing streak.", thinking: "Track both the current streak and the best streak at the same time." },
    { id: "zwei-summen", level: "medium", title: "Split List into Two Equal Sums", goal: "Given a list of numbers, check whether there is a split point where the left sum equals the right sum.", thinking: "The challenge is keeping both sides in mind while iterating." },
    { id: "stufenmuster", level: "medium", title: "Build a Stair Pattern", goal: "For a number n, print 1 to n stars in each line.", thinking: "The loop is easy, but the structure should be planned clearly." },
    { id: "naechste-primzahl", level: "hard", title: "Find the Next Prime", goal: "For a number n, find the smallest prime number greater than or equal to n.", thinking: "Syntax stays simple. The challenge is prime-check logic." },
    { id: "zahlenraetsel", level: "hard", title: "Number Puzzle with Constraints", goal: "Find the smallest three-digit number with digit sum 12 where the first digit is twice the last digit.", thinking: "Use structured trial and clean reasoning." },
    { id: "fahrstuhl-planung", level: "hard", title: "Elevator Planning", goal: "An elevator starts at floor 0. Given a list of target floors, calculate the total number of floors traveled.", thinking: "The challenge is carrying current state correctly." },
    { id: "beste-teilstrecke", level: "hard", title: "Find the Best Subarray", goal: "Given a list with positive and negative numbers, find the contiguous subarray with the largest sum.", thinking: "Decide when restarting is better than continuing." },
    { id: "wasserbehaelter", level: "hard", title: "Simulate a Water Tank", goal: "A tank has a maximum capacity. Given fill and drain values, determine whether it ever overflows or becomes empty.", thinking: "Keep one state stable over many steps." }
];

const TASKS_BACKEND_URL = "http://localhost:3000";
const TASKS_FALLBACK_STORAGE_KEY = "syntaxifyCompletedTasks";

function buildTaskPrompt(task) {
    const ending = "Keep the solution simple and clear. At the end, briefly explain the core algorithm idea.";
    return `${task.goal}\n\n${ending}`;
}

function readTaskToken() {
    try {
        const authState = JSON.parse(localStorage.getItem("syntaxifyAuth") || "null");
        return authState?.token || "";
    } catch (error) {
        return "";
    }
}

function tasksHeaders(includeJson = false) {
    const headers = {};
    const token = readTaskToken();
    if (includeJson) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

function readOfflineCompletedTasks() {
    try {
        return JSON.parse(localStorage.getItem(TASKS_FALLBACK_STORAGE_KEY) || "[]");
    } catch (error) {
        return [];
    }
}

function writeOfflineCompletedTasks(taskIds) {
    localStorage.setItem(TASKS_FALLBACK_STORAGE_KEY, JSON.stringify(taskIds));
}

async function fetchCompletedTaskIds() {
    try {
        const res = await fetch(`${TASKS_BACKEND_URL}/tasks/completed`, {
            headers: tasksHeaders()
        });
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Task status could not be loaded.");
        }

        return new Set((data.tasks || []).map(task => task.task_id));
    } catch (error) {
        return new Set(readOfflineCompletedTasks());
    }
}

async function persistCompletedTask(taskId, completed) {
    try {
        const res = await fetch(`${TASKS_BACKEND_URL}/tasks/completed`, {
            method: "POST",
            headers: tasksHeaders(true),
            body: JSON.stringify({ taskId, completed })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || "Saving failed.");
        }
    } catch (error) {
        const current = new Set(readOfflineCompletedTasks());
        if (completed) current.add(taskId);
        else current.delete(taskId);
        writeOfflineCompletedTasks(Array.from(current));
    }
}

function levelLabel(level) {
    if (level === "easy") return "Easy";
    if (level === "medium") return "Medium";
    return "Hard";
}

function filterMatches(task, filter) {
    if (filter === "all") return true;
    return task.level === filter;
}

function updateProgress(completedTaskIds) {
    const progress = document.getElementById("taskProgress");
    if (!progress) return;
    progress.textContent = `${completedTaskIds.size} of ${TASKS.length} completed`;
}

function renderTasks(filter = "all", completedTaskIds = new Set()) {
    const board = document.getElementById("taskBoard");
    if (!board) return;

    const visibleTasks = TASKS.filter(task => filterMatches(task, filter));

    board.innerHTML = visibleTasks.map(task => `
        <article class="divfarbe rounded-4 shadow p-4 text-white task-card ${completedTaskIds.has(task.id) ? "task-card-done" : ""}">
            <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                    <h3 class="h5 mb-2">${task.title}</h3>
                    <span class="task-badge task-${task.level}">${levelLabel(task.level)}</span>
                </div>
                <label class="task-check">
                    <input type="checkbox" data-task-check="${task.id}" ${completedTaskIds.has(task.id) ? "checked" : ""}>
                    <span>Completed</span>
                </label>
            </div>
            <p class="mb-3">${task.goal}</p>
            <p class="text-secondary small mb-4">${task.thinking}</p>
            <button class="btn btn-bb" data-task-id="${task.id}">Open in Editor</button>
        </article>
    `).join("");

    board.querySelectorAll("[data-task-id]").forEach(button => {
        button.addEventListener("click", () => {
            const task = TASKS.find(entry => entry.id === button.dataset.taskId);
            if (!task) return;

            localStorage.setItem("syntaxifySelectedTask", JSON.stringify({
                title: task.title,
                prompt: buildTaskPrompt(task)
            }));
            window.location.href = "hauptmenue.html";
        });
    });

    board.querySelectorAll("[data-task-check]").forEach(input => {
        input.addEventListener("change", async () => {
            const taskId = input.dataset.taskCheck;
            if (!taskId) return;

            if (input.checked) completedTaskIds.add(taskId);
            else completedTaskIds.delete(taskId);

            updateProgress(completedTaskIds);
            await persistCompletedTask(taskId, input.checked);
            renderTasks(filter, completedTaskIds);
        });
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const filter = document.getElementById("difficultyFilter");
    const completedTaskIds = await fetchCompletedTaskIds();

    updateProgress(completedTaskIds);
    renderTasks("all", completedTaskIds);

    filter?.addEventListener("change", () => {
        renderTasks(filter.value, completedTaskIds);
    });
});
