const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "syntaxify.sqlite");
const db = new DatabaseSync(dbPath);

db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS history_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL DEFAULT '',
        language TEXT NOT NULL DEFAULT 'python',
        generated_code TEXT NOT NULL DEFAULT '',
        explanation TEXT NOT NULL DEFAULT '',
        execution_output TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS completed_tasks (
        user_id INTEGER NOT NULL,
        task_id TEXT NOT NULL,
        completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, task_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
`);

function normalizeUsername(username) {
    return String(username || "").trim().toLowerCase();
}

function hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString("hex");
}

function createUser(username, password) {
    const normalizedUsername = normalizeUsername(username);
    const safePassword = String(password || "");

    if (normalizedUsername.length < 3) {
        throw new Error("Username must be at least 3 characters long.");
    }

    if (safePassword.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(safePassword, salt);
    const result = db.prepare(`
        INSERT INTO users (username, password_hash, salt)
        VALUES (?, ?, ?)
    `).run(normalizedUsername, passwordHash, salt);

    return { id: Number(result.lastInsertRowid), username: normalizedUsername };
}

function findUserByUsername(username) {
    return db.prepare(`
        SELECT id, username, password_hash, salt, created_at
        FROM users
        WHERE username = ?
    `).get(normalizeUsername(username)) || null;
}

function verifyPassword(user, password) {
    if (!user) return false;

    const incomingHash = hashPassword(String(password || ""), user.salt);
    const storedHash = Buffer.from(user.password_hash, "hex");
    const comparedHash = Buffer.from(incomingHash, "hex");

    if (storedHash.length !== comparedHash.length) return false;
    return crypto.timingSafeEqual(storedHash, comparedHash);
}

function createSession(userId) {
    const token = crypto.randomBytes(32).toString("hex");
    db.prepare(`
        INSERT INTO sessions (token, user_id)
        VALUES (?, ?)
    `).run(token, userId);
    return token;
}

function findUserBySessionToken(token) {
    return db.prepare(`
        SELECT users.id, users.username, users.created_at
        FROM sessions
        INNER JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ?
    `).get(String(token || "")) || null;
}

function deleteSession(token) {
    db.prepare(`DELETE FROM sessions WHERE token = ?`).run(String(token || ""));
}

function createHistoryEntry(userId, payload = {}) {
    const title = String(payload.title || "").trim() || "Untitled Snapshot";
    const prompt = String(payload.prompt || "");
    const language = String(payload.language || "python");
    const generatedCode = String(payload.generatedCode || "");
    const explanation = String(payload.explanation || "");
    const executionOutput = String(payload.executionOutput || "");

    const result = db.prepare(`
        INSERT INTO history_entries (
            user_id, title, prompt, language, generated_code, explanation, execution_output
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, title, prompt, language, generatedCode, explanation, executionOutput);

    return Number(result.lastInsertRowid);
}

function listHistoryEntriesByUser(userId) {
    return db.prepare(`
        SELECT id, title, prompt, language, generated_code, explanation, execution_output, created_at
        FROM history_entries
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 25
    `).all(userId);
}

function getHistoryEntryById(userId, entryId) {
    return db.prepare(`
        SELECT id, title, prompt, language, generated_code, explanation, execution_output, created_at
        FROM history_entries
        WHERE user_id = ? AND id = ?
    `).get(userId, entryId) || null;
}

function updateHistoryEntryTitle(userId, entryId, title) {
    const safeTitle = String(title || "").trim() || "Untitled Snapshot";
    db.prepare(`
        UPDATE history_entries
        SET title = ?
        WHERE user_id = ? AND id = ?
    `).run(safeTitle, userId, entryId);
    return getHistoryEntryById(userId, entryId);
}

function deleteHistoryEntry(userId, entryId) {
    const result = db.prepare(`
        DELETE FROM history_entries
        WHERE user_id = ? AND id = ?
    `).run(userId, entryId);
    return result.changes > 0;
}

function listCompletedTasksByUser(userId) {
    return db.prepare(`
        SELECT task_id, completed_at
        FROM completed_tasks
        WHERE user_id = ?
        ORDER BY completed_at DESC
    `).all(userId);
}

function setTaskCompleted(userId, taskId, completed) {
    const safeTaskId = String(taskId || "").trim();
    if (!safeTaskId) return;

    if (completed) {
        db.prepare(`
            INSERT INTO completed_tasks (user_id, task_id)
            VALUES (?, ?)
            ON CONFLICT(user_id, task_id) DO UPDATE SET completed_at = CURRENT_TIMESTAMP
        `).run(userId, safeTaskId);
        return;
    }

    db.prepare(`
        DELETE FROM completed_tasks
        WHERE user_id = ? AND task_id = ?
    `).run(userId, safeTaskId);
}

function ensureDefaultAccount() {
    const defaultUsername = "demo";
    const defaultPassword = "syntaxify123";

    if (findUserByUsername(defaultUsername)) {
        return {
            username: defaultUsername,
            password: defaultPassword,
            created: false
        };
    }

    createUser(defaultUsername, defaultPassword);
    return {
        username: defaultUsername,
        password: defaultPassword,
        created: true
    };
}

const defaultAccount = ensureDefaultAccount();
console.log(
    `Default account ready: ${defaultAccount.username} / ${defaultAccount.password}` +
    (defaultAccount.created ? " (newly created)" : " (already exists)")
);

module.exports = {
    createHistoryEntry,
    createSession,
    createUser,
    defaultAccount,
    deleteHistoryEntry,
    deleteSession,
    findUserBySessionToken,
    findUserByUsername,
    getHistoryEntryById,
    listCompletedTasksByUser,
    listHistoryEntriesByUser,
    setTaskCompleted,
    updateHistoryEntryTitle,
    verifyPassword
};
