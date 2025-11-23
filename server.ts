import express from "express";
import cors from "cors";
import ollama from "ollama";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// --- In-memory session chat history ---
const sessionMemory = new Map(); // { sessionId: [ {role, content}, ... ] }

// Max messages to keep
const MAX_CONTEXT = 15;

app.post("/stream", async (req, res) => {
    const { prompt, sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
    }

    // Initialize memory if not exists
    if (!sessionMemory.has(sessionId)) {
        sessionMemory.set(sessionId, []);
    }

    // Get current session history
    const history = sessionMemory.get(sessionId);

    // Add current user message to history
    history.push({ role: "user", content: prompt });

    // Trim to last MAX_CONTEXT messages
    const trimmedHistory = history.slice(-MAX_CONTEXT);

    // Save trimmed version back
    sessionMemory.set(sessionId, trimmedHistory);

    // Streaming response setup
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

        // Store assistant's final answer in history
        trimmedHistory.push({ role: "assistant", content: fullResponse });

        // Save updated memory
        sessionMemory.set(sessionId, trimmedHistory);
        console.log("sessionMemory", sessionMemory);
        
    }
    catch (err) {
        res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    }

    res.end();
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
