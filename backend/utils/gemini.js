import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

export async function getGeminiResponse(message, options = {}) {
	if (!process.env.GOOGLE_API_KEY) {
		throw new Error("Gemini API key not configured");
	}

	const { timeoutMs = 18000, model = "gemini-2.5-flash" } = options;

	const timeoutPromise = new Promise((_, reject) => {
		const id = setTimeout(() => {
			clearTimeout(id);
			reject(new Error("Gemini API timeout"));
		}, timeoutMs);
	});

	const callPromise = (async () => {
		const response = await ai.models.generateContent({
			model,
			contents: message,
		});
		const text = response?.text;
		return text || "No response generated";
	})();

	return await Promise.race([callPromise, timeoutPromise]);
}

export default getGeminiResponse;
