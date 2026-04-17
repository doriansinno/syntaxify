const express = require("express");
const {
    createSession,
    createUser,
    deleteSession,
    findUserByUsername,
    verifyPassword
} = require("../db");
const { readBearerToken } = require("../middleware/auth");

const router = express.Router();

router.post("/register", (req, res) => {
    try {
        const { username, password } = req.body || {};

        if (findUserByUsername(username)) {
            return res.status(409).json({ error: "Username is already taken." });
        }

        const user = createUser(username, password);
        const token = createSession(user.id);

        return res.status(201).json({
            message: "Registration successful.",
            token,
            user: { id: user.id, username: user.username }
        });
    } catch (error) {
        if (error && error.code === "ERR_SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({ error: "Username is already taken." });
        }

        return res.status(400).json({ error: error.message || "Registration failed." });
    }
});

router.post("/login", (req, res) => {
    const { username, password } = req.body || {};
    const user = findUserByUsername(username);

    if (!user || !verifyPassword(user, password)) {
        return res.status(401).json({ error: "Username or password is incorrect." });
    }

    const token = createSession(user.id);
    return res.json({
        message: "Login successful.",
        token,
        user: { id: user.id, username: user.username }
    });
});

router.get("/me", (req, res) => {
    const token = readBearerToken(req);
    const { findUserBySessionToken } = require("../db");
    const user = findUserBySessionToken(token);

    if (!user) {
        return res.status(401).json({ error: "Not logged in." });
    }

    return res.json({ user });
});

router.post("/logout", (req, res) => {
    const token = readBearerToken(req);
    if (token) deleteSession(token);
    return res.json({ message: "Logout successful." });
});

module.exports = router;
