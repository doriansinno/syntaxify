const BACKEND_URL = "http://localhost:3000";

const textarea = document.getElementById("Eingabe");
const linesDiv = document.getElementById("lines");
const outputText = document.getElementById("outputText");
const outputCount = document.getElementById("outputCount");
const executionOutput = document.getElementById("executionOutput");
const codeExplanationText = document.getElementById("codeExplanationText");

const translateButton = document.getElementById("translateButton");
const executeButton = document.getElementById("executeButton");
const inputControls = document.getElementById("inputControls");
const stdinInputLine = document.getElementById("stdinInputLine");
const sendInputButton = document.getElementById("sendInputButton");
const executionStatus = document.getElementById("executionStatus");
const saveHistoryButton = document.getElementById("saveHistoryButton");
const saveFeedback = document.getElementById("saveFeedback");
const jsPreviewFrame = document.getElementById("jsPreviewFrame");

const dropdown = document.getElementById("languageDropdown");
const selected = dropdown ? dropdown.querySelector(".dropdown-selected") : null;
const items = dropdown ? dropdown.querySelectorAll(".dropdown-item") : [];

const toggleBtn = document.getElementById("toggleOutputExplanation");
const panel = document.getElementById("outputExplanationPanel");
const navbar = document.querySelector("nav.navbar");

let pyodideReadyPromise = null;

const DEFAULT_PREVIEW_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 24px;
      font-family: Arial, sans-serif;
      background: linear-gradient(180deg, #fffdf7, #f4f6ff);
      color: #1f1f1f;
    }
    .card {
      max-width: 720px;
      margin: 0 auto;
      padding: 24px;
      border-radius: 24px;
      background: white;
      box-shadow: 0 18px 48px rgba(30, 30, 30, 0.12);
      border: 1px solid rgba(0,0,0,0.06);
    }
    h1 {
      margin-top: 0;
      font-size: 2rem;
    }
    p {
      line-height: 1.6;
    }
    button {
      margin-top: 16px;
      border: none;
      border-radius: 999px;
      padding: 12px 18px;
      background: #1f1f1f;
      color: white;
      cursor: pointer;
    }
    .box {
      margin-top: 18px;
      padding: 18px;
      border-radius: 18px;
      background: #f3f0ff;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1 id="preview-title">Preview Area</h1>
    <p id="preview-text">If your JavaScript changes elements, swaps colors, or starts animations, it only happens in this preview.</p>
    <button id="preview-button">Test Button</button>
    <div class="box" id="preview-box">Use this box for styles, motion, and DOM updates.</div>
  </div>
</body>
</html>`;

const interactiveState = {
    active: false,
    waitingForInput: false,
    language: "",
    code: "",
    inputs: [],
    shownOutput: "",
    inputStartIndex: -1
};

function getLineHeight(el) {
    const cs = window.getComputedStyle(el);
    let lh = parseFloat(cs.lineHeight);
    if (isNaN(lh)) {
        const fs = parseFloat(cs.fontSize) || 14;
        lh = fs * 1.2;
    }
    return lh;
}

function setupLineNumbers(targetTextarea, targetLinesDiv) {
    if (!targetTextarea || !targetLinesDiv) return null;

    const mirror = document.createElement("div");
    mirror.style.position = "absolute";
    mirror.style.top = "-9999px";
    mirror.style.left = "-9999px";
    mirror.style.visibility = "hidden";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordWrap = "break-word";
    mirror.style.boxSizing = "border-box";
    document.body.appendChild(mirror);

    function updateLines() {
        const taStyle = window.getComputedStyle(targetTextarea);
        mirror.style.width = targetTextarea.clientWidth + "px";
        mirror.style.whiteSpace = taStyle.whiteSpace || "pre-wrap";
        mirror.style.font = taStyle.font;
        mirror.style.fontSize = taStyle.fontSize;
        mirror.style.fontFamily = taStyle.fontFamily;
        mirror.style.lineHeight = taStyle.lineHeight;
        mirror.style.padding = taStyle.padding;
        mirror.style.border = taStyle.border;
        mirror.style.letterSpacing = taStyle.letterSpacing;

        mirror.textContent = targetTextarea.value || " ";
        const lineHeight = getLineHeight(targetTextarea);
        const visualLines = Math.max(1, Math.round(mirror.clientHeight / lineHeight));

        let lines = "";
        for (let i = 1; i <= visualLines; i++) {
            lines += i + "<br>";
        }

        targetLinesDiv.innerHTML = lines;
        targetLinesDiv.style.height = targetTextarea.clientHeight + "px";
    }

    function syncScroll() {
        const taScroll = targetTextarea.scrollTop;
        const taScrollable = targetTextarea.scrollHeight - targetTextarea.clientHeight;
        const lnScrollable = targetLinesDiv.scrollHeight - targetLinesDiv.clientHeight;

        targetLinesDiv.scrollTop = taScrollable > 0 && lnScrollable > 0
            ? taScroll * (lnScrollable / taScrollable)
            : taScroll;
    }

    targetTextarea.addEventListener("input", () => {
        updateLines();
        syncScroll();
    });

    targetTextarea.addEventListener("scroll", syncScroll);
    window.addEventListener("resize", () => {
        updateLines();
        syncScroll();
    });

    updateLines();
    syncScroll();

    return { updateLines, syncScroll };
}

const outputLineHelpers = setupLineNumbers(outputText, outputCount);
const inputLineHelpers = setupLineNumbers(textarea, linesDiv);

function getAuthToken() {
    try {
        const authState = JSON.parse(localStorage.getItem("syntaxifyAuth") || "null");
        return authState?.token || "";
    } catch (error) {
        return "";
    }
}

function getAuthHeaders(includeJson = false) {
    const headers = {};
    const token = getAuthToken();

    if (includeJson) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

function setSaveFeedbackText(text, isError = false) {
    if (!saveFeedback) return;
    saveFeedback.textContent = text || "";
    saveFeedback.className = isError ? "text-danger mt-2 mb-0" : "text-secondary mt-2 mb-0";
}

function resetJavaScriptPreview() {
    if (!jsPreviewFrame) return;

    if (jsPreviewFrame.contentWindow?.document) {
        const doc = jsPreviewFrame.contentWindow.document;
        doc.open();
        doc.write(DEFAULT_PREVIEW_HTML);
        doc.close();
        return;
    }

    jsPreviewFrame.srcdoc = DEFAULT_PREVIEW_HTML;
}

function formatHistoryDate(rawDate) {
    if (!rawDate) return "";
    const normalized = rawDate.includes("T") ? rawDate : rawDate.replace(" ", "T");
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return rawDate;
    return parsed.toLocaleString("en-US");
}

function buildHistoryTitle() {
    const prompt = textarea?.value.trim() || "";
    const firstLine = prompt.split("\n").find(line => line.trim()) || "";
    return firstLine.slice(0, 60) || "Saved Snapshot";
}

function applyHistoryEntry(entry) {
    if (!entry) return;

    if (textarea) {
        textarea.value = entry.prompt || "";
        inputLineHelpers?.updateLines();
    }

    if (selected) {
        const label = Array.from(items).find(item => item.dataset.value === entry.language);
        selected.dataset.value = entry.language || "python";
        selected.textContent = label?.textContent || entry.language || "Python";
    }

    if (outputText) {
        outputText.value = entry.generated_code || "";
        outputLineHelpers?.updateLines();
    }

    setCodeExplanation(entry.explanation || "");
    setExecutionOutput(entry.execution_output || "");
    setExecutionStatus("ready");
    setSaveFeedbackText(`Snapshot "${entry.title}" loaded.`);
}

async function saveCurrentStateToHistory(reason = "manual") {
    const prompt = textarea?.value || "";
    const generatedCode = outputText?.value || "";
    const explanation = codeExplanationText?.value || "";
    const executionOutputText = executionOutput?.value || "";

    if (!prompt.trim() && !generatedCode.trim()) {
        if (reason === "manual") {
            setSaveFeedbackText("Nothing to save yet.", true);
        }
        return;
    }

    try {
        const res = await fetch(`${BACKEND_URL}/history`, {
            method: "POST",
            headers: getAuthHeaders(true),
            body: JSON.stringify({
                title: buildHistoryTitle(),
                prompt,
                language: getSelectedLanguage(),
                generatedCode,
                explanation,
                executionOutput: executionOutputText
            })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || "Saving to history failed.");
        }

        if (reason === "manual") {
            setSaveFeedbackText(`Snapshot "${data.entry.title}" saved.`);
        }
    } catch (error) {
        console.error(error);
        if (reason === "manual") {
            setSaveFeedbackText(error.message || "Saving failed.", true);
        }
    }
}

function applySelectedTaskFromStorage() {
    try {
        const raw = localStorage.getItem("syntaxifySelectedTask");
        if (!raw || !textarea) return;

        const task = JSON.parse(raw);
        textarea.value = task.prompt || "";
        inputLineHelpers?.updateLines();
        localStorage.removeItem("syntaxifySelectedTask");
        setSaveFeedbackText(`Task "${task.title}" loaded into the editor.`);
    } catch (error) {
        localStorage.removeItem("syntaxifySelectedTask");
    }
}

function applyHistoryEntryFromStorage() {
    try {
        const raw = localStorage.getItem("syntaxifyLoadHistoryEntry");
        if (!raw) return;
        const entry = JSON.parse(raw);
        localStorage.removeItem("syntaxifyLoadHistoryEntry");
        applyHistoryEntry(entry);
    } catch (error) {
        localStorage.removeItem("syntaxifyLoadHistoryEntry");
    }
}

if (dropdown && selected && items.length > 0) {
    selected.addEventListener("click", () => {
        dropdown.classList.toggle("active");
    });

    items.forEach(item => {
        item.addEventListener("click", () => {
            selected.textContent = item.textContent;
            selected.dataset.value = item.dataset.value;
            dropdown.classList.remove("active");
        });
    });

    document.addEventListener("click", e => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove("active");
        }
    });
}

function getPanelWidth() {
    if (!panel) return 700;
    return panel.getBoundingClientRect().width || 700;
}

function setToggleClosedPosition() {
    if (!toggleBtn) return;
    toggleBtn.style.right = "0px";
}

function setToggleOpenPosition() {
    if (toggleBtn) {
        const width = Math.max(46, getPanelWidth());
        toggleBtn.style.right = `${width}px`;
    }
}

function updatePanelPosition() {
    if (!panel || !navbar) return;
    const navbarHeight = navbar.offsetHeight;
    panel.style.top = navbarHeight + "px";
    panel.style.height = `calc(100vh - ${navbarHeight}px)`;

    if (panel.classList.contains("active")) {
        setToggleOpenPosition();
    }
}

function initializeExplanationPanel() {
    if (!toggleBtn || !panel) return;
    updatePanelPosition();
    panel.classList.remove("active");
    setToggleClosedPosition();
    toggleBtn.textContent = "<";
}

if (toggleBtn && panel) {
    window.addEventListener("load", initializeExplanationPanel);
    window.addEventListener("resize", updatePanelPosition);

    toggleBtn.addEventListener("click", () => {
        panel.classList.toggle("active");

        if (panel.classList.contains("active")) {
            setToggleOpenPosition();
            toggleBtn.textContent = ">";
        } else {
            setToggleClosedPosition();
            toggleBtn.textContent = "<";
        }
    });
}

function setExecutionStatus(text) {
    if (executionStatus) executionStatus.textContent = `Status: ${text}`;
}

function showInputControls(show) {
    if (inputControls) {
        inputControls.style.display = "none";
    }

    if (show) {
        enableConsoleInputMode();
    } else {
        disableConsoleInputMode();
    }
}

function setExecutionOutput(text) {
    if (!executionOutput) return;
    executionOutput.value = text;
}

function appendExecutionOutput(text) {
    if (!executionOutput || !text) return;
    executionOutput.value += text;
    executionOutput.scrollTop = executionOutput.scrollHeight;
}

function setCodeExplanation(text) {
    if (codeExplanationText) codeExplanationText.value = text;
}

function getSelectedLanguage() {
    if (!selected) return "python";
    return selected.dataset.value || "python";
}

function sanitizeGeneratedCode(rawCode, language) {
    if (!rawCode) return "";
    const trimmed = rawCode.trim();
    const blockRegex = /```([a-zA-Z0-9#+-]*)\n([\s\S]*?)```/g;
    let match = null;
    let fallbackCode = null;

    while ((match = blockRegex.exec(trimmed)) !== null) {
        const blockLang = (match[1] || "").toLowerCase();
        const blockCode = (match[2] || "").trim();
        if (!fallbackCode) fallbackCode = blockCode;
        if (blockLang.includes(language.toLowerCase())) {
            return blockCode;
        }
    }

    if (fallbackCode) return fallbackCode;
    return trimmed.replace(/^```[\s\S]*?\n/, "").replace(/```$/, "").trim();
}

async function generateCode(prompt, language) {
    const res = await fetch(`${BACKEND_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, language })
    });

    return await res.json();
}

async function executeCOnBackend(code, input) {
    const res = await fetch(`${BACKEND_URL}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language: "c", input })
    });

    return await res.json();
}

async function getPyodideInstance() {
    if (!pyodideReadyPromise) {
        if (!window.loadPyodide) {
            throw new Error("Pyodide could not be loaded.");
        }

        pyodideReadyPromise = window.loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.2/full/"
        });
    }

    return pyodideReadyPromise;
}

function resetInteractiveState() {
    interactiveState.active = false;
    interactiveState.waitingForInput = false;
    interactiveState.language = "";
    interactiveState.code = "";
    interactiveState.inputs = [];
    interactiveState.shownOutput = "";
    interactiveState.inputStartIndex = -1;
    showInputControls(false);
}

function focusExecutionOutputToEnd() {
    if (!executionOutput) return;
    const end = executionOutput.value.length;
    executionOutput.focus();
    executionOutput.setSelectionRange(end, end);
    executionOutput.scrollTop = executionOutput.scrollHeight;
}

function enableConsoleInputMode() {
    if (!executionOutput) return;

    const needsNewLine = executionOutput.value && !executionOutput.value.endsWith("\n");
    executionOutput.readOnly = false;
    executionOutput.classList.add("console-awaiting-input");
    executionOutput.value += `${needsNewLine ? "\n" : ""}> `;
    interactiveState.inputStartIndex = executionOutput.value.length;
    focusExecutionOutputToEnd();
}

function disableConsoleInputMode() {
    if (!executionOutput) return;
    executionOutput.readOnly = true;
    executionOutput.classList.remove("console-awaiting-input");
    interactiveState.inputStartIndex = -1;
}

function appendOutputDelta(fullOutput) {
    const current = String(fullOutput || "");

    if (!interactiveState.shownOutput) {
        setExecutionOutput(current);
        interactiveState.shownOutput = current;
        return;
    }

    if (current.startsWith(interactiveState.shownOutput)) {
        const delta = current.slice(interactiveState.shownOutput.length);
        appendExecutionOutput(delta);
    } else {
        setExecutionOutput(current);
    }

    interactiveState.shownOutput = current;
}

async function runJavaScriptAttempt(code, inputs) {
    const logs = [];
    let index = 0;
    resetJavaScriptPreview();

    const previewWindow = jsPreviewFrame?.contentWindow;
    const previewDocument = previewWindow?.document;

    const sandboxConsole = {
        log: (...args) => logs.push(args.map(arg => String(arg)).join(" ")),
        error: (...args) => logs.push(args.map(arg => String(arg)).join(" "))
    };

    function promptFn(question = "") {
        if (question) logs.push(String(question));

        if (index < inputs.length) {
            const value = String(inputs[index]);
            index += 1;
            logs.push(value);
            return value;
        }

        throw new Error("__SYNTAXIFY_INPUT_REQUIRED__");
    }

    try {
        if (!previewWindow || !previewDocument) {
            throw new Error("JavaScript preview could not be loaded.");
        }

        const result = Function(
            "prompt",
            "console",
            "document",
            "window",
            "setTimeout",
            "clearTimeout",
            "setInterval",
            "clearInterval",
            "requestAnimationFrame",
            "cancelAnimationFrame",
            `"use strict";\n${code}`
        )(
            promptFn,
            sandboxConsole,
            previewDocument,
            previewWindow,
            previewWindow.setTimeout.bind(previewWindow),
            previewWindow.clearTimeout.bind(previewWindow),
            previewWindow.setInterval.bind(previewWindow),
            previewWindow.clearInterval.bind(previewWindow),
            previewWindow.requestAnimationFrame.bind(previewWindow),
            previewWindow.cancelAnimationFrame.bind(previewWindow)
        );

        if (typeof result !== "undefined") {
            logs.push(String(result));
        }

        return { needsInput: false, output: logs.join("\n") };
    } catch (error) {
        const message = String(error?.message || error || "");
        if (message.includes("__SYNTAXIFY_INPUT_REQUIRED__")) {
            return { needsInput: true, output: logs.join("\n") };
        }
        throw error;
    }
}

async function runPythonAttempt(code, inputs) {
    const forbiddenModules = ["keyboard", "pynput", "tkinter", "subprocess", "pyautogui"];

    for (const moduleName of forbiddenModules) {
        const importRegex = new RegExp(`(^|\\n)\\s*(import|from)\\s+${moduleName}(\\s|\\.|$)`, "i");
        if (importRegex.test(code)) {
            throw new Error(`Module '${moduleName}' is not supported in the browser (Pyodide).`);
        }
    }

    const pyodide = await getPyodideInstance();
    let stdout = "";
    let stderr = "";

    pyodide.setStdout({
        batched: text => {
            stdout += text + "\n";
        }
    });

    pyodide.setStderr({
        batched: text => {
            stderr += text + "\n";
        }
    });

    const prelude = `
from collections import deque
import builtins as __builtins_module

__syntaxify_inputs = deque(${JSON.stringify(inputs)})

def __syntaxify_input(prompt=""):
    if prompt:
        print(prompt, end="")
    if __syntaxify_inputs:
        value = __syntaxify_inputs.popleft()
        print(value)
        return value
    raise EOFError("__SYNTAXIFY_INPUT_REQUIRED__")

__builtins_module.input = __syntaxify_input
`;

    try {
        await pyodide.runPythonAsync(`${prelude}\n${code}`);
        return { needsInput: false, output: `${stdout}${stderr}` };
    } catch (error) {
        const message = String(error?.message || error || "");
        if (message.includes("__SYNTAXIFY_INPUT_REQUIRED__")) {
            return { needsInput: true, output: `${stdout}${stderr}` };
        }
        if (message.includes("No module named")) {
            throw new Error(`Python module not found in Pyodide. ${message}`);
        }
        throw error;
    }
}

async function continueInteractiveExecution() {
    const language = interactiveState.language;
    const code = interactiveState.code;

    let result;

    if (language === "python") {
        result = await runPythonAttempt(code, interactiveState.inputs);
    } else if (language === "javascript") {
        result = await runJavaScriptAttempt(code, interactiveState.inputs);
    } else {
        throw new Error("Interactive execution is only available for Python and JavaScript.");
    }

    appendOutputDelta(result.output || "");

    if (result.needsInput) {
        interactiveState.waitingForInput = true;
        showInputControls(true);
        setExecutionStatus("waiting for input...");
        return;
    }

    interactiveState.waitingForInput = false;
    showInputControls(false);
    setExecutionStatus("finished");

    if (executeButton) executeButton.disabled = false;
    interactiveState.active = false;
    await saveCurrentStateToHistory("auto");
}

function submitInteractiveInput(valueOverride = null) {
    if (!interactiveState.active || !interactiveState.waitingForInput) {
        setExecutionStatus("no input expected");
        return;
    }

    const value = valueOverride ?? (stdinInputLine ? stdinInputLine.value : "");
    interactiveState.inputs.push(String(value));
    if (stdinInputLine) stdinInputLine.value = "";
    if (executionOutput) {
        executionOutput.value += "\n";
    }

    interactiveState.waitingForInput = false;
    disableConsoleInputMode();
    setExecutionStatus("running...");

    continueInteractiveExecution().catch(error => {
        console.error(error);
        appendExecutionOutput(`\n[Error] ${error.message || "Execution failed."}\n`);
        setExecutionStatus("error");
        if (executeButton) executeButton.disabled = false;
        resetInteractiveState();
    });
}

async function handleGenerate() {
    if (!textarea || !outputText) return;

    const prompt = textarea.value.trim();
    const language = getSelectedLanguage();

    if (!prompt) {
        outputText.value = "Please enter a prompt first.";
        if (outputLineHelpers) outputLineHelpers.updateLines();
        return;
    }

    if (translateButton) translateButton.disabled = true;
    outputText.value = "Generating...";
    setCodeExplanation("Loading code explanation...");
    if (outputLineHelpers) outputLineHelpers.updateLines();

    try {
        const data = await generateCode(prompt, language);

        if (data.error) {
            outputText.value = `Error: ${data.error}`;
            setCodeExplanation(`Error: ${data.error}`);
        } else {
            const generatedCode = data.code || "No code response received.";
            outputText.value = sanitizeGeneratedCode(generatedCode, language);
            setCodeExplanation(data.explanation || "No explanation received from backend.");
            await saveCurrentStateToHistory("auto");
        }
    } catch (error) {
        console.error(error);
        outputText.value = "Error while requesting the backend.";
        setCodeExplanation("Error while requesting the backend.");
    } finally {
        if (translateButton) translateButton.disabled = false;
        if (outputLineHelpers) outputLineHelpers.updateLines();
    }
}

async function handleExecute() {
    if (!outputText) return;

    const language = getSelectedLanguage();
    const code = sanitizeGeneratedCode(outputText.value, language);

    if (!code.trim()) {
        setExecutionOutput("Please generate or enter code first.");
        return;
    }

    resetInteractiveState();
    setExecutionOutput("");

    if (executeButton) executeButton.disabled = true;

    try {
        if (language === "python" || language === "javascript") {
            interactiveState.active = true;
            interactiveState.language = language;
            interactiveState.code = code;
            interactiveState.inputs = [];
            interactiveState.shownOutput = "";

            setExecutionStatus("running...");
            await continueInteractiveExecution();
            return;
        }

        if (language === "c") {
            setExecutionStatus("running...");

            // C stays one-shot on the backend (no interactive C live runner here).
            const data = await executeCOnBackend(code, "");

            if (data.error) {
                setExecutionOutput(`[Error] ${data.error}`);
                setExecutionStatus("error");
            } else {
                setExecutionOutput(data.output || "No output.");
                setExecutionStatus("finished");
                await saveCurrentStateToHistory("auto");
            }
            return;
        }

        setExecutionOutput("Unsupported language.");
        setExecutionStatus("error");
    } catch (error) {
        console.error(error);
        setExecutionOutput(`[Error] ${error.message || "Execution failed."}`);
        setExecutionStatus("error");
    } finally {
        if (!interactiveState.active && executeButton) executeButton.disabled = false;
    }
}

if (translateButton) {
    translateButton.addEventListener("click", handleGenerate);
}

if (executeButton) {
    executeButton.addEventListener("click", handleExecute);
}

if (sendInputButton) {
    sendInputButton.addEventListener("click", submitInteractiveInput);
}

if (stdinInputLine) {
    stdinInputLine.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            submitInteractiveInput();
        }
    });
}

if (executionOutput) {
    executionOutput.addEventListener("keydown", e => {
        if (!interactiveState.waitingForInput) return;

        const start = interactiveState.inputStartIndex;
        const selectionStart = executionOutput.selectionStart;
        const selectionEnd = executionOutput.selectionEnd;

        if (e.key === "Enter") {
            e.preventDefault();
            submitInteractiveInput(executionOutput.value.slice(start));
            return;
        }

        if (selectionStart < start || selectionEnd < start) {
            if (["Backspace", "Delete", "ArrowLeft", "ArrowUp", "PageUp", "Home"].includes(e.key)) {
                e.preventDefault();
                focusExecutionOutputToEnd();
            }
        }
    });

    executionOutput.addEventListener("click", () => {
        if (interactiveState.waitingForInput) {
            focusExecutionOutputToEnd();
        }
    });

    executionOutput.addEventListener("focus", () => {
        if (interactiveState.waitingForInput) {
            focusExecutionOutputToEnd();
        }
    });
}

if (saveHistoryButton) {
    saveHistoryButton.addEventListener("click", () => {
        saveCurrentStateToHistory("manual");
    });
}

document.addEventListener("DOMContentLoaded", () => {
    applySelectedTaskFromStorage();
    applyHistoryEntryFromStorage();
    resetJavaScriptPreview();
    initializeExplanationPanel();
});
