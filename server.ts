import express from "express";
import cors from "cors";
import ollama from "ollama";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// --- In-memory session chat history ---
const sessionMemory = new Map(); // { sessionId: [ {role, content}, ... ] }

// Max messages to keep (excluding system prompt)
const MAX_CONTEXT = 9;

// Permanent system prompt for all sessions
const SYSTEM_PROMPT = {
    role: "system",
    content: "Your name is Ava, You are a fast, direct, reliable AI assistant that gives concise, accurate answers, maintains context, avoids guessing, asks for clarification when needed, keeps explanations simple, and prioritizes correctness over creativity."
};

app.post("/stream", async (req, res) => {
    const { prompt, sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
    }

    // Initialize memory with system prompt
    if (!sessionMemory.has(sessionId)) {
        sessionMemory.set(sessionId, [SYSTEM_PROMPT]);
    }

    // Get current session history
    const history = sessionMemory.get(sessionId);

    // Add new user message
    history.push({ role: "user", content: prompt });

    // Trim everything EXCEPT system prompt
    const trimmedHistory = [
        SYSTEM_PROMPT, // Always keep this
        ...history.slice(-MAX_CONTEXT) // Trim remaining
    ];

    // Save trimmed history
    sessionMemory.set(sessionId, trimmedHistory);

    // Streaming response headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        const stream = await ollama.chat({
            model: "phi4-mini",
            messages: trimmedHistory,
            stream: true,
        });

        let fullResponse = "";

        for await (const part of stream) {
            const text = part?.message?.content ?? "";
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }

        // Store assistant's final answer
        trimmedHistory.push({
            role: "assistant",
            content: fullResponse
        });

        // Save updated memory
        sessionMemory.set(sessionId, trimmedHistory);
        console.log("sessionMemory", sessionMemory);
        

    } catch (err) {
        res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    }

    res.end();
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
