const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const runtimeDir = path.join(__dirname, "..", "runtime");

router.post("/", async (req, res) => {
    const { code, language, input } = req.body;

    if (!code || !language) {
        return res.status(400).json({ error: "code and language are required" });
    }

    if (language !== "c") {
        return res.status(400).json({ error: "This endpoint currently supports only language='c'" });
    }

    try {
        if (!fs.existsSync(runtimeDir)) {
            fs.mkdirSync(runtimeDir, { recursive: true });
        }

        const id = Date.now();
        const sourceFile = path.join(runtimeDir, `temp_${id}.c`);
        const outFile = path.join(runtimeDir, `temp_${id}.out`);

        fs.writeFileSync(sourceFile, code, "utf8");

        const compileAndRun = `gcc "${sourceFile}" -o "${outFile}" && "${outFile}"`;

        const child = exec(compileAndRun, { timeout: 5000 }, (error, stdout, stderr) => {
            try {
                if (fs.existsSync(sourceFile)) fs.unlinkSync(sourceFile);
                if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
            } catch (cleanupError) {
                console.warn("Cleanup warning:", cleanupError.message);
            }

            if (error) {
                const message = (stderr || error.message || "Execution error").trim();
                return res.status(500).json({ error: message });
            }

            const output = `${stdout || ""}${stderr || ""}`.trim() || "Program finished with no output.";
            return res.json({ output });
        });

        if (typeof input === "string" && child.stdin) {
            child.stdin.write(input);
            if (!input.endsWith("\n")) {
                child.stdin.write("\n");
            }
            child.stdin.end();
        }
    } catch (error) {
        console.error("C execution error:", error);
        return res.status(500).json({ error: "Error while executing C code" });
    }
});

module.exports = router;
