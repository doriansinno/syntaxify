const express = require("express");
const OpenAI = require("openai");

const router = express.Router();

function buildGenerationPrompt(prompt, language) {
    const base = `Create ${language} code for this request: ${prompt}. Keep code simple for beginners and explain it in English.`;

    if (String(language).toLowerCase() === "python") {
        return `${base} The Python code will run in Pyodide (browser). Use only standard library and browser-safe code. Do NOT use keyboard, pynput, tkinter, subprocess, os.system, or files. Use input() and print() only for interaction.`;
    }

    return base;
}

router.post("/", async (req, res) => {
    const { prompt, language } = req.body;

    if (!prompt || !language) {
        return res.status(400).json({ error: "prompt and language are required" });
    }

    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: "OPENAI_API_KEY is missing" });
    }

    try {
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const response = await client.responses.create({
            model: "gpt-4.1-mini",
            input: [
                {
                    role: "system",
                    content: "Return valid JSON only with two fields: code (string) and explanation (string). No markdown."
                },
                {
                    role: "user",
                    content: buildGenerationPrompt(prompt, language)
                }
            ]
        });

        const rawText = response.output_text?.trim();

        if (!rawText) {
            return res.status(500).json({ error: "No response received from OpenAI" });
        }

        let parsed = null;

        try {
            parsed = JSON.parse(rawText);
        } catch (parseError) {
            console.warn("JSON parse warning, using fallback:", parseError.message);
        }

        if (parsed && parsed.code) {
            return res.json({
                code: String(parsed.code),
                explanation: String(parsed.explanation || "No explanation received.")
            });
        }

        return res.json({
            code: rawText,
            explanation: "Automatic explanation could not be generated."
        });
    } catch (error) {
        console.error("OpenAI error:", error);
        return res.status(500).json({ error: "Error while generating code" });
    }
});

module.exports = router;
