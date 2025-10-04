import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


const getGeminiAPIResponse = async (message) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Generate content
    const result = await model.generateContent(message);
    const text = result?.response?.text?.();

    return text || "No response generated";
  } catch (err) {
    console.error("Gemini API Error:", err.message);
    return "Something went wrong with Gemini API.";
  }
};

export default getGeminiAPIResponse;
