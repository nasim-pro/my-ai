
import express from "express";
import cors from "cors";
import ollama from "ollama";
const app = express(); app.use(cors());
app.use(express.json()); app.use(express.static("public"));
app.post("/stream", async (req, res) => {
    const { prompt } = req.body;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    try {
        const stream = await ollama.chat({ model: "phi4-mini", messages: [{ role: "user", content: prompt }], stream: true, });

        for await (const part of stream) {
            const text = part?.message?.content ?? "";
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
    }
    catch (err) {
        res.write(`"data": [Error: ${String(err)}]\n\n`);
    } res.end();
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));