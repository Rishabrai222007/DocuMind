import express from "express";
import path from "path";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Configure Multer
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// Helper for Gemini API with retries
async function generateWithRetry(contentParams: any, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        ...contentParams
      });
    } catch (error: any) {
      const errorStr = JSON.stringify(error);
      const isTransient = errorStr.includes("503") || errorStr.includes("high demand") || error.status === 503;
      if (isTransient && i < retries - 1) {
        console.log(`Gemini API busy (503), retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }
      throw error;
    }
  }
}

// API: Process Document (Summary)
app.post("/api/process-document", upload.array("files", 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const { language = "English", tone = "Professional" } = req.body;
    
    const fileParts = files.map(file => ({
      inlineData: {
        mimeType: file.mimetype,
        data: file.buffer.toString("base64")
      }
    }));

    const prompt = `Analyze the provided document(s). 
    
    Output Language: ${language}
    Output Tone: ${tone}

    Tasks:
    1. Provide a comprehensive summary across all provided content.
    2. Explain the core purpose of these documents to a beginner.
    3. Extract 5-10 "Key Takeaways" from the combined information.
    4. Suggest 3 relevant follow-up questions.
    
    Use a step-by-step clear format with headings. Output in Markdown.`;

    const response = await generateWithRetry({
      contents: [{
        role: "user",
        parts: [
          ...fileParts,
          { text: prompt }
        ]
      }],
      config: {
        temperature: 0.7,
      }
    });

    res.json({ result: response?.text || "" });
  } catch (error: any) {
    console.error("Error processing document:", error);
    const errorStr = JSON.stringify(error);
    const message = errorStr.includes("503") 
      ? "AI service is currently experiencing high demand. Please try again in 10-20 seconds." 
      : (error.message || "Failed to process documents");
    res.status(500).json({ error: message });
  }
});

// API: Extract Action Items
app.post("/api/extract-actions", upload.array("files", 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: "No files" });
    
    const fileParts = files.map(file => ({
      inlineData: {
        mimeType: file.mimetype,
        data: file.buffer.toString("base64")
      }
    }));

    const prompt = "Identify all action items, tasks, deadlines, or future obligations mentioned across these documents. Present them as a clear, unified checklist. If none are found, state that no clear action items were detected.";

    const response = await generateWithRetry({
      contents: [{
        role: "user",
        parts: [
          ...fileParts,
          { text: prompt }
        ]
      }],
    });

    res.json({ result: response?.text || "" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to extract actions. The service may be busy, please try again shortly." });
  }
});

// API: Chat / Q&A
app.post("/api/chat", upload.array("files", 10), async (req, res) => {
  try {
    const { question, language = "English", tone = "Professional" } = req.body;
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
       return res.status(400).json({ error: "Document context missing" });
    }

    const fileParts = files.map(file => ({
      inlineData: {
        mimeType: file.mimetype,
        data: file.buffer.toString("base64")
      }
    }));

    const prompt = `User Question: ${question}
    Language: ${language}
    Tone: ${tone}
    
    Context: The user is asking about the following document(s). 
    Instructions:
    - Provide a step-by-step, easy-to-learn answer based on all provided documents.
    - Be clear and very thorough.
    - If the user asks something not in the documents, clarify that.
    - Use Markdown for formatting.`;

    const response = await generateWithRetry({
      contents: [{
        role: "user",
        parts: [
          ...fileParts,
          { text: prompt }
        ]
      }],
    });

    res.json({ result: response?.text || "" });
  } catch (error: any) {
    console.error("Error in chat:", error);
    res.status(500).json({ error: "Deep reasoning engine is busy. Please retry in a moment." });
  }
});

// API: Synthesize documents into a "Book" format
app.post("/api/synthesize-book", upload.array("files", 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: "No files" });
    
    const { language = "English" } = req.body;

    const fileParts = files.map(file => ({
      inlineData: {
        mimeType: file.mimetype,
        data: file.buffer.toString("base64")
      }
    }));

    const prompt = `You are a professional editor. Please synthesize the information from all these provided documents into a single, cohesive, and well-structured digital book/manual format.
    
    Structure the output in ${language} as follows:
    1. Title: Create a compelling title for this combined knowledge base.
    2. Executive Preface: A high-level view of why these documents are combined.
    3. Organized Chapters: Group related information from DIFFERENT documents into thematic chapters.
    4. Consolidated Conclusion.
    5. Glossary of unique terms used across the documents.

    Guidelines:
    - Eliminate redundant information found across multiple documents.
    - Create logical flow even if the documents are from different sources.
    - Use Markdown with clear headings and hierarchy.`;

    const response = await generateWithRetry({
      contents: [{
        role: "user",
        parts: [
          ...fileParts,
          { text: prompt }
        ]
      }],
      config: {
        temperature: 0.4, // Lower temperature for more structured synthesis
      }
    });

    res.json({ result: response?.text || "" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to synthesize book. Please try again." });
  }
});

// Vite Setup
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupVite();
