const { WebSocketServer } = require("ws");
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const runtimeDir = path.join(__dirname);

function send(ws, payload) {
    if (ws.readyState === 1) {
        ws.send(JSON.stringify(payload));
    }
}

function makeBaseName() {
    const rand = Math.random().toString(36).slice(2, 8);
    return `run_${Date.now()}_${rand}`;
}

function cleanupFiles(paths) {
    for (const file of paths) {
        try {
            if (file && fs.existsSync(file)) fs.unlinkSync(file);
        } catch (err) {
            console.warn("Cleanup warning:", err.message);
        }
    }
}

function wireProcess(proc, ws, state, tempFiles) {
    state.proc = proc;
    state.tempFiles = tempFiles;

    send(ws, { type: "started" });

    const timeout = setTimeout(() => {
        send(ws, { type: "error", message: "Time limit reached (30s)." });
        if (state.proc) state.proc.kill("SIGKILL");
    }, 30000);

    proc.stdout.on("data", data => {
        send(ws, { type: "output", stream: "stdout", data: data.toString("utf8") });
    });

    proc.stderr.on("data", data => {
        send(ws, { type: "output", stream: "stderr", data: data.toString("utf8") });
    });

    proc.on("close", (code, signal) => {
        clearTimeout(timeout);
        send(ws, { type: "exit", code, signal });
        cleanupFiles(state.tempFiles);
        state.proc = null;
        state.tempFiles = [];
    });

    proc.on("error", err => {
        clearTimeout(timeout);
        send(ws, { type: "error", message: err.message });
        cleanupFiles(state.tempFiles);
        state.proc = null;
        state.tempFiles = [];
    });
}

function startJavaScript(code, ws, state) {
    const base = makeBaseName();
    const sourceFile = path.join(runtimeDir, `${base}.js`);
    fs.writeFileSync(sourceFile, code, "utf8");

    const proc = spawn("node", [sourceFile], { stdio: ["pipe", "pipe", "pipe"] });
    wireProcess(proc, ws, state, [sourceFile]);
}

function startPython(code, ws, state) {
    const base = makeBaseName();
    const sourceFile = path.join(runtimeDir, `${base}.py`);
    fs.writeFileSync(sourceFile, code, "utf8");

    const pythonCandidates = [
        { cmd: "python3", args: [] },
        { cmd: "py", args: ["-3"] },
        { cmd: "python", args: [] }
    ];

    let selected = null;

    for (const candidate of pythonCandidates) {
        const probe = spawnSync(candidate.cmd, [...candidate.args, "--version"], {
            encoding: "utf8",
            timeout: 3000
        });

        const combinedOutput = `${probe.stdout || ""}${probe.stderr || ""}`.toLowerCase();
        const looksLikeStoreAlias = combinedOutput.includes("microsoft store") || combinedOutput.includes("was not found");

        if (probe.error) continue;
        if (probe.status !== 0) continue;
        if (looksLikeStoreAlias) continue;

        selected = candidate;
        break;
    }

    if (!selected) {
        cleanupFiles([sourceFile]);
        send(ws, {
            type: "error",
            message: "Python was not found on the server. Install Python 3 or enable the 'py' launcher."
        });
        return;
    }

    const proc = spawn(selected.cmd, [...selected.args, sourceFile], { stdio: ["pipe", "pipe", "pipe"] });
    wireProcess(proc, ws, state, [sourceFile]);
}

function startC(code, ws, state) {
    const base = makeBaseName();
    const sourceFile = path.join(runtimeDir, `${base}.c`);
    const binaryFile = path.join(runtimeDir, process.platform === "win32" ? `${base}.exe` : `${base}.out`);

    fs.writeFileSync(sourceFile, code, "utf8");

    const compiler = spawn("gcc", [sourceFile, "-o", binaryFile], { stdio: ["ignore", "pipe", "pipe"] });
    let compileOutput = "";

    compiler.stdout.on("data", data => {
        compileOutput += data.toString("utf8");
    });

    compiler.stderr.on("data", data => {
        compileOutput += data.toString("utf8");
    });

    compiler.on("error", err => {
        cleanupFiles([sourceFile, binaryFile]);
        send(ws, { type: "error", message: `gcc error: ${err.message}` });
    });

    compiler.on("close", codeExit => {
        if (codeExit !== 0) {
            cleanupFiles([sourceFile, binaryFile]);
            send(ws, { type: "error", message: (compileOutput || "Compilation failed").trim() });
            return;
        }

        const proc = spawn(binaryFile, [], { stdio: ["pipe", "pipe", "pipe"] });
        wireProcess(proc, ws, state, [sourceFile, binaryFile]);
    });
}

function setupExecutionWebSocket(server) {
    const wss = new WebSocketServer({ server, path: "/ws/execute" });

    wss.on("connection", ws => {
        const state = {
            proc: null,
            tempFiles: []
        };

        ws.on("message", raw => {
            let msg;
            try {
                msg = JSON.parse(raw.toString("utf8"));
            } catch {
                send(ws, { type: "error", message: "Invalid JSON." });
                return;
            }

            if (msg.type === "start") {
                if (state.proc) {
                    send(ws, { type: "error", message: "An execution is already running." });
                    return;
                }

                const language = String(msg.language || "").toLowerCase();
                const code = String(msg.code || "");

                if (!code.trim()) {
                    send(ws, { type: "error", message: "No code provided." });
                    return;
                }

                if (language === "javascript") {
                    startJavaScript(code, ws, state);
                    return;
                }

                if (language === "python") {
                    startPython(code, ws, state);
                    return;
                }

                if (language === "c") {
                    startC(code, ws, state);
                    return;
                }

                send(ws, { type: "error", message: "Unsupported language." });
                return;
            }

            if (msg.type === "input") {
                if (!state.proc || !state.proc.stdin) {
                    send(ws, { type: "error", message: "No active execution for input." });
                    return;
                }

                const data = String(msg.data || "");
                state.proc.stdin.write(data);
                return;
            }

            if (msg.type === "stop") {
                if (state.proc) {
                    state.proc.kill("SIGKILL");
                }
                return;
            }

            send(ws, { type: "error", message: "Unknown message type." });
        });

        ws.on("close", () => {
            if (state.proc) {
                state.proc.kill("SIGKILL");
            }
            cleanupFiles(state.tempFiles);
        });
    });
}

module.exports = { setupExecutionWebSocket };
