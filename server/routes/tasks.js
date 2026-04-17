const express = require("express");
const { listCompletedTasksByUser, setTaskCompleted } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/completed", (req, res) => {
    const tasks = listCompletedTasksByUser(req.user.id);
    return res.json({ tasks });
});

router.post("/completed", (req, res) => {
    const taskId = String(req.body?.taskId || "");
    const completed = Boolean(req.body?.completed);

    if (!taskId) {
        return res.status(400).json({ error: "Task ID is missing." });
    }

    setTaskCompleted(req.user.id, taskId, completed);
    return res.json({ ok: true });
});

module.exports = router;
