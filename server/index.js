const express = require("express");
const cors = require("cors");
const http = require("http");
const generateRouter = require("./routes/generate");
const executeRouter = require("./routes/execute");
const authRouter = require("./routes/auth");
const historyRouter = require("./routes/history");
const tasksRouter = require("./routes/tasks");
const { setupExecutionWebSocket } = require("./runtime/liveExecutionWs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({ message: "Syntaxify backend is running." });
});

app.use("/generate", generateRouter);
app.use("/execute", executeRouter);
app.use("/auth", authRouter);
app.use("/history", historyRouter);
app.use("/tasks", tasksRouter);

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
});

const server = http.createServer(app);
setupExecutionWebSocket(server);

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
