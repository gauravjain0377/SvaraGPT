import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

const getGeminiAPIResponse = async (message) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: message,
    });

    const text = response?.text;
    return text || "No response generated";
  } catch (err) {
    console.error("Gemini API Error:", err.message);
    return "Something went wrong with Gemini API.";
  }
};

export default getGeminiAPIResponse;
