const HISTORY_BACKEND_URL = "http://localhost:3000";

function readHistoryAuthToken() {
    try {
        const authState = JSON.parse(localStorage.getItem("syntaxifyAuth") || "null");
        return authState?.token || "";
    } catch (error) {
        return "";
    }
}

function historyHeaders(includeJson = false) {
    const headers = {};
    const token = readHistoryAuthToken();

    if (includeJson) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

function historyPreviewText(entry) {
    return (entry.prompt || entry.generated_code || "No content").slice(0, 180);
}

function formatHistoryTimestamp(rawDate) {
    if (!rawDate) return "";
    const parsed = new Date(rawDate.includes("T") ? rawDate : rawDate.replace(" ", "T"));
    if (Number.isNaN(parsed.getTime())) return rawDate;
    return parsed.toLocaleString("en-US");
}

async function loadEntryIntoEditor(entryId) {
    const res = await fetch(`${HISTORY_BACKEND_URL}/history/${entryId}`, {
        headers: historyHeaders()
    });
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || "Entry could not be loaded.");
    }

    localStorage.setItem("syntaxifyLoadHistoryEntry", JSON.stringify(data.entry));
    window.location.href = "hauptmenue.html";
}

async function renameEntry(entryId, currentTitle) {
    const nextTitle = window.prompt("New name for this snapshot:", currentTitle);
    if (nextTitle === null) return;

    const res = await fetch(`${HISTORY_BACKEND_URL}/history/${entryId}`, {
        method: "PATCH",
        headers: historyHeaders(true),
        body: JSON.stringify({ title: nextTitle })
    });
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || "Rename failed.");
    }
}

async function removeEntry(entryId) {
    const confirmed = window.confirm("Delete this history entry?");
    if (!confirmed) return;

    const res = await fetch(`${HISTORY_BACKEND_URL}/history/${entryId}`, {
        method: "DELETE",
        headers: historyHeaders()
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.error || "Delete failed.");
    }
}

async function renderHistoryPage() {
    const list = document.getElementById("historyPageList");
    const status = document.getElementById("historyPageStatus");
    if (!list || !status) return;

    status.textContent = "loading...";

    try {
        const res = await fetch(`${HISTORY_BACKEND_URL}/history`, {
            headers: historyHeaders()
        });
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "History unavailable.");
        }

        const entries = data.entries || [];
        status.textContent = `${entries.length}`;

        if (!entries.length) {
            list.innerHTML = `<article class="history-item"><div class="history-item-title">Nothing saved yet</div><div class="history-item-preview">Save a snapshot in the editor first, then it will appear here.</div></article>`;
            return;
        }

        list.innerHTML = entries.map(entry => `
            <article class="history-item history-page-card">
                <div class="history-item-title">${entry.title}</div>
                <div class="history-item-meta">${entry.language} - ${formatHistoryTimestamp(entry.created_at)}</div>
                <div class="history-item-preview">${historyPreviewText(entry)}</div>
                <div class="d-flex flex-wrap gap-2">
                    <button class="btn btn-bb btn-sm" data-load-id="${entry.id}">Load in Editor</button>
                    <button class="btn btn-outline-light btn-sm" data-rename-id="${entry.id}" data-title="${entry.title}">Rename</button>
                    <button class="btn btn-outline-danger btn-sm" data-delete-id="${entry.id}">Delete</button>
                </div>
            </article>
        `).join("");

        list.querySelectorAll("[data-load-id]").forEach(button => {
            button.addEventListener("click", async () => {
                await loadEntryIntoEditor(button.dataset.loadId);
            });
        });

        list.querySelectorAll("[data-rename-id]").forEach(button => {
            button.addEventListener("click", async () => {
                try {
                    await renameEntry(button.dataset.renameId, button.dataset.title);
                    await renderHistoryPage();
                } catch (error) {
                    window.alert(error.message || "Rename failed.");
                }
            });
        });

        list.querySelectorAll("[data-delete-id]").forEach(button => {
            button.addEventListener("click", async () => {
                try {
                    await removeEntry(button.dataset.deleteId);
                    await renderHistoryPage();
                } catch (error) {
                    window.alert(error.message || "Delete failed.");
                }
            });
        });
    } catch (error) {
        status.textContent = "error";
        list.innerHTML = `<article class="history-item"><div class="history-item-title">History unavailable</div><div class="history-item-preview">${error.message || "History unavailable"}</div></article>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    renderHistoryPage();
});
