const AUTH_BACKEND_URL = "http://localhost:3000";
const AUTH_STORAGE_KEY = "syntaxifyAuth";
const OFFLINE_PREVIEW_ACCOUNT = {
    token: "offline-preview-token",
    user: { username: "offline-preview" },
    offlinePreview: true
};

function readAuthState() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
    } catch (error) {
        return null;
    }
}

function writeAuthState(authState) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState));
}

function clearAuthState() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
}

async function authRequest(path, options = {}) {
    const authState = readAuthState();
    const headers = { ...(options.headers || {}) };

    if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    if (authState && authState.token) {
        headers.Authorization = `Bearer ${authState.token}`;
    }

    const response = await fetch(`${AUTH_BACKEND_URL}${path}`, {
        ...options,
        headers
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || "Request failed.");
    }

    return data;
}

function createOfflinePreviewSession() {
    writeAuthState(OFFLINE_PREVIEW_ACCOUNT);
    return OFFLINE_PREVIEW_ACCOUNT;
}

function isOfflinePreview(authState) {
    return Boolean(authState && authState.offlinePreview);
}

function isBackendUnavailable(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return message.includes("failed to fetch") || message.includes("networkerror") || message.includes("load failed");
}

function toggleAuthButtons(isLoggedIn, username = "") {
    document.querySelectorAll("[data-auth='guest']").forEach(btn => {
        btn.classList.toggle("d-none", isLoggedIn);
    });

    document.querySelectorAll("[data-auth='logout']").forEach(btn => {
        btn.classList.toggle("d-none", !isLoggedIn);
    });

    document.querySelectorAll("[data-auth='profile-name']").forEach(label => {
        label.textContent = isLoggedIn ? `Profile: ${username}` : "My Profile";
    });

    document.querySelectorAll("[data-auth-start]").forEach(link => {
        link.setAttribute("href", isLoggedIn ? "hauptmenue.html" : "#");
    });
}

function updateAuthFeedback(targetId, message, isError = false) {
    const element = document.getElementById(targetId);
    if (!element) return;

    element.textContent = message || "";
    element.className = isError ? "small text-danger mt-2" : "small text-success mt-2";
}

function openModal(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;

    modalEl.hidden = false;
    modalEl.setAttribute("aria-hidden", "false");
    modalEl.classList.add("is-open");
    document.body.classList.add("auth-modal-open");
}

function closeModal(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;

    modalEl.classList.remove("is-open");
    modalEl.setAttribute("aria-hidden", "true");
    modalEl.hidden = true;

    if (!document.querySelector(".auth-modal.is-open")) {
        document.body.classList.remove("auth-modal-open");
    }
}

function setupAuthModals() {
    document.querySelectorAll("[data-open-auth-modal]").forEach(button => {
        button.addEventListener("click", event => {
            event.preventDefault();
            openModal(button.dataset.openAuthModal);
        });
    });

    document.querySelectorAll("[data-close-auth-modal]").forEach(button => {
        button.addEventListener("click", () => {
            closeModal(button.dataset.closeAuthModal);
        });
    });

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;

        const openModalEl = document.querySelector(".auth-modal.is-open");
        if (openModalEl) {
            closeModal(openModalEl.id);
        }
    });
}

async function handleRegisterSubmit(event) {
    event.preventDefault();

    const username = document.getElementById("registerUsername")?.value || "";
    const password = document.getElementById("registerPassword")?.value || "";

    try {
        const data = await authRequest("/auth/register", {
            method: "POST",
            body: JSON.stringify({ username, password })
        });

        writeAuthState(data);
        toggleAuthButtons(true, data.user.username);
        updateAuthFeedback("registerFeedback", "Registration successful. You are now logged in.");
        closeModal("registerModal");
        window.location.href = "hauptmenue.html";
    } catch (error) {
        if (isBackendUnavailable(error)) {
            const offlineSession = createOfflinePreviewSession();
            toggleAuthButtons(true, offlineSession.user.username);
            updateAuthFeedback("registerFeedback", "Backend unavailable. Offline preview started.");
            closeModal("registerModal");
            window.location.href = "hauptmenue.html";
            return;
        }

        updateAuthFeedback("registerFeedback", error.message, true);
    }
}

async function handleLoginSubmit(event) {
    event.preventDefault();

    const username = document.getElementById("loginUsername")?.value || "";
    const password = document.getElementById("loginPassword")?.value || "";

    try {
        const data = await authRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({ username, password })
        });

        writeAuthState(data);
        toggleAuthButtons(true, data.user.username);
        updateAuthFeedback("loginFeedback", "Login successful.");
        closeModal("loginModal");
        window.location.href = "hauptmenue.html";
    } catch (error) {
        if (isBackendUnavailable(error)) {
            const offlineSession = createOfflinePreviewSession();
            toggleAuthButtons(true, offlineSession.user.username);
            updateAuthFeedback("loginFeedback", "Backend unavailable. Offline preview started.");
            closeModal("loginModal");
            window.location.href = "hauptmenue.html";
            return;
        }

        updateAuthFeedback("loginFeedback", error.message, true);
    }
}

async function handleLogout() {
    try {
        await authRequest("/auth/logout", { method: "POST" });
    } catch (error) {
        // Local logout should still work.
    }

    clearAuthState();
    toggleAuthButtons(false);

    if (document.body.dataset.requireAuth) {
        window.location.replace("startseite.html");
    }
}

function setupProtectedLinks() {
    document.querySelectorAll("[data-auth-start]").forEach(link => {
        link.addEventListener("click", event => {
            const authState = readAuthState();
            if (authState && authState.token) {
                event.preventDefault();
                window.location.href = "hauptmenue.html";
                return;
            }

            event.preventDefault();
            if (!navigator.onLine) {
                createOfflinePreviewSession();
                window.location.href = "hauptmenue.html";
                return;
            }

            openModal("loginModal");
        });
    });
}

async function ensureAuthenticatedPage() {
    if (!document.body.dataset.requireAuth) return;

    const authState = readAuthState();
    if (isOfflinePreview(authState)) {
        toggleAuthButtons(true, authState.user.username);
        return;
    }

    if (!authState || !authState.token) {
        createOfflinePreviewSession();
        toggleAuthButtons(true, OFFLINE_PREVIEW_ACCOUNT.user.username);
        return;
    }

    try {
        const data = await authRequest("/auth/me", { method: "GET" });
        writeAuthState({ ...authState, user: data.user });
        toggleAuthButtons(true, data.user.username);
    } catch (error) {
        if (isBackendUnavailable(error)) {
            const offlineSession = createOfflinePreviewSession();
            toggleAuthButtons(true, offlineSession.user.username);
            return;
        }

        clearAuthState();
        window.location.replace("startseite.html");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const authState = readAuthState();
    toggleAuthButtons(Boolean(authState && authState.token), authState?.user?.username || "");

    document.getElementById("registerForm")?.addEventListener("submit", handleRegisterSubmit);
    document.getElementById("loginForm")?.addEventListener("submit", handleLoginSubmit);

    document.querySelectorAll("[data-auth='logout']").forEach(btn => {
        btn.addEventListener("click", handleLogout);
    });

    setupAuthModals();
    setupProtectedLinks();
    await ensureAuthenticatedPage();
});
