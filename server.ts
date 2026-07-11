import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper to map old models to new ones
  const getValidModel = (requestedModel?: string) => {
    if (!requestedModel) return "gemini-3.1-flash-lite";
    // Many free users don't have access to 3.1-pro-preview, map older models to flash-lite
    if (requestedModel.includes("1.5") || requestedModel.includes("gemini-pro")) return "gemini-3.1-flash-lite";
    return requestedModel;
  };

  // API Routes
  app.post("/api/ai/brainstorm", async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
         throw new Error("GEMINI_API_KEY is missing from environment variables");
      }
      const { prompt, context, model, temperature } = req.body;
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: getValidModel(model),
        contents: `You are an expert screenwriter assistant. Based on this context: "${context}", Brainstorm ideas for: ${prompt}. Return a concise, structured response.`,
        config: temperature !== undefined ? { temperature } : undefined,
      });
      res.json({ result: response.text });
    } catch (error: any) {
      console.error("BRAINSTORM ERROR:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.post("/api/ai/rewrite", async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
         throw new Error("GEMINI_API_KEY is missing from environment variables");
      }
      const { text, instructions, context, model, temperature } = req.body;
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: getValidModel(model),
        contents: `You are an expert screenwriter assistant. Context: "${context}". Rewrite this dialogue or action: "${text}". Instructions: ${instructions}. Return just the rewritten text directly.`,
        config: temperature !== undefined ? { temperature } : undefined,
      });
      res.json({ result: response.text });
    } catch (error: any) {
      console.error("REWRITE ERROR:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.post("/api/ai/improve", async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
         throw new Error("GEMINI_API_KEY is missing from environment variables");
      }
      const { text, model, temperature } = req.body;
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: getValidModel(model),
        contents: `Critique and improve this screenplay text. Focus on pacing, subtext, and clarity: \n\n${text}`,
        config: temperature !== undefined ? { temperature } : undefined,
      });
      res.json({ result: response.text });
    } catch (error: any) {
      console.error("IMPROVE ERROR:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.post("/api/ai/generate-image", async (req, res) => {
    try {
      const { prompt } = req.body;
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const interaction = await ai.interactions.create({
        model: 'gemini-3.1-flash-image',
        input: prompt,
        response_modalities: ['image', 'text'],
        generation_config: {
          image_config: {
            aspect_ratio: "16:9",
            image_size: "1K"
          },
        },
      });

      let base64Image = null;
      let mimeType = 'image/png';

      for (const step of interaction.steps) {
        if (step.type === 'model_output') {
          const imageContent = step.content?.find(c => c.type === 'image');
          if (imageContent && imageContent.data) {
            base64Image = imageContent.data;
            mimeType = imageContent.mime_type || 'image/png';
          }
        }
      }

      if (base64Image) {
        res.json({ imageUrl: `data:${mimeType};base64,${base64Image}` });
      } else {
        res.status(500).json({ error: "Failed to generate image" });
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
