import express from "express";
import path from "path";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import * as dotenv from "dotenv";
import nodemailer from "nodemailer";

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

// Memory store for OTPs (Email -> { otp, expires })
const otpStore = new Map<string, { otp: string; expires: number }>();

// API: Send OTP
app.post("/api/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Valid for 10 minutes
    otpStore.set(email.toLowerCase().trim(), { otp, expires: Date.now() + 10 * 60 * 1000 });

    let viewUrl: string | null = null;
    let isEthereal = false;
    let mailSuccess = false;

    // Determine secure connection configurations
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      console.log(`[SMTP] Attempting to send live email to ${email} using SMTP user ${process.env.SMTP_USER}`);
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Secure DocAI Gateway" <no-reply@docai-secure.com>`,
        to: email,
        subject: "Your Cloud Verification OTP Code",
        text: `Hello,\n\nTo verify your email address, please use the following 6-digit one-time password (OTP):\n\n${otp}\n\nThis security code will expire in 10 minutes.\n\nBest regards,\nSecure Document AI Team`,
        html: `
          <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 32px; border: 1px solid #f0f0f0; border-radius: 20px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 24px; font-weight: 900; color: #ea580c; letter-spacing: -0.025em; text-transform: uppercase; font-style: italic;">SECURE DOCAI</span>
            </div>
            <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">Hello,</p>
            <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">You have requested to verify your email address to access or create your cloud document archive. Please input the following 6-digit token in the verification interface:</p>
            <div style="text-align: center; margin: 32px 0;">
              <span style="font-size: 32px; font-weight: 900; letter-spacing: 0.3em; color: #ea580c; background-color: #fff7ed; padding: 16px 28px; border: 1px dashed #fdba74; border-radius: 16px; display: inline-block;">${otp}</span>
            </div>
            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 24px;">This key expires strictly after 10 minutes and is only usable once.</p>
            <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
            <p style="font-size: 10px; color: #9ca3af; text-align: center; line-height: 1.5;">Designed under Zero-Knowledge principles. If you did not make this registration request, please ignore this communication safely.</p>
          </div>
        `
      });
      mailSuccess = true;
    } else {
      console.log(`[SMTP Sandbox] No credentials found. Initializing a temporary Ethereal SMTP test account...`);
      isEthereal = true;
      try {
        const testAccount = await nodemailer.createTestAccount();
        const transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });

        const info = await transporter.sendMail({
          from: '"Secure DocAI Gateway" <no-reply@docai-secure.com>',
          to: email,
          subject: "Your Cloud Verification OTP Code",
          text: `Hello,\n\nTo verify your email address, please use the following 6-digit one-time password (OTP):\n\n${otp}\n\nThis security code will expire in 10 minutes.\n\nBest regards,\nSecure Document AI Team`,
          html: `
            <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 32px; border: 1px solid #f0f0f0; border-radius: 20px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.032);">
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="font-size: 24px; font-weight: 900; color: #ea580c; letter-spacing: -0.025em; text-transform: uppercase; font-style: italic;">SECURE DOCAI</span>
              </div>
              <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">Hello,</p>
              <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">You have requested to verify your email address to access or create your cloud document archive. Please input the following 6-digit token in the verification interface:</p>
              <div style="text-align: center; margin: 32px 0;">
                <span style="font-size: 32px; font-weight: 900; letter-spacing: 0.3em; color: #ea580c; background-color: #fff7ed; padding: 16px 28px; border: 1px dashed #fdba74; border-radius: 16px; display: inline-block;">${otp}</span>
              </div>
              <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 24px;">This key expires strictly after 10 minutes and is only usable once.</p>
              <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
              <p style="font-size: 10px; color: #9ca3af; text-align: center; line-height: 1.5;">Designed under Zero-Knowledge principles. If you did not make this registration request, please ignore this communication safely.</p>
            </div>
          `
        });

        viewUrl = nodemailer.getTestMessageUrl(info) || null;
        console.log(`[SMTP Sandbox] Mail sent to test mailbox! View preview at: ${viewUrl}`);
        mailSuccess = true;
      } catch (err) {
        console.error("Failed to initialize Ethereal test inbox:", err);
      }
    }

    res.json({
      success: true,
      isEthereal,
      etherealUrl: viewUrl,
      // Fallback code if SMTP routing failed so developer can still evaluate
      simulationCode: !mailSuccess ? otp : null
    });
  } catch (error: any) {
    console.error("Error sending OTP email:", error);
    res.status(500).json({ error: "Failed to dispatch verification email. Please try again." });
  }
});

// API: Verify OTP
app.post("/api/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: "Email address and OTP code are required fields." });
    }

    const key = email.toLowerCase().trim();
    const record = otpStore.get(key);

    if (!record) {
      return res.status(400).json({ error: "No verification request registered for this email address. Please request a new OTP." });
    }

    if (Date.now() > record.expires) {
      otpStore.delete(key);
      return res.status(400).json({ error: "This OTP code has expired. Please request a new one." });
    }

    if (record.otp !== otp.trim()) {
      return res.status(400).json({ error: "Incorrect 6-digit code. Please verify the numbers sent." });
    }

    // Success! Clear otp
    otpStore.delete(key);
    res.json({ success: true, message: "Code verified successfully." });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to process security verification request." });
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
