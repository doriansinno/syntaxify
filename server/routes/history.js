const express = require("express");
const {
    createHistoryEntry,
    deleteHistoryEntry,
    getHistoryEntryById,
    listHistoryEntriesByUser,
    updateHistoryEntryTitle
} = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", (req, res) => {
    const entries = listHistoryEntriesByUser(req.user.id);
    return res.json({ entries });
});

router.get("/:id", (req, res) => {
    const entryId = Number(req.params.id);
    const entry = getHistoryEntryById(req.user.id, entryId);

    if (!entry) {
        return res.status(404).json({ error: "History entry not found." });
    }

    return res.json({ entry });
});

router.post("/", (req, res) => {
    const payload = req.body || {};
    const id = createHistoryEntry(req.user.id, payload);
    const entry = getHistoryEntryById(req.user.id, id);
    return res.status(201).json({ entry });
});

router.patch("/:id", (req, res) => {
    const entryId = Number(req.params.id);
    const entry = updateHistoryEntryTitle(req.user.id, entryId, req.body?.title);

    if (!entry) {
        return res.status(404).json({ error: "History entry not found." });
    }

    return res.json({ entry });
});

router.delete("/:id", (req, res) => {
    const entryId = Number(req.params.id);
    const deleted = deleteHistoryEntry(req.user.id, entryId);

    if (!deleted) {
        return res.status(404).json({ error: "History entry not found." });
    }

    return res.json({ ok: true });
});

module.exports = router;
