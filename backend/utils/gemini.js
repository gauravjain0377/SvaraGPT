import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

export async function getGeminiResponse(message, options = {}) {
	if (!process.env.GOOGLE_API_KEY) {
		throw new Error("Gemini API key not configured");
	}

	const { timeoutMs = 30000, model = "gemini-2.0-flash-exp" } = options;

	const timeoutPromise = new Promise((_, reject) => {
		const id = setTimeout(() => {
			clearTimeout(id);
			reject(new Error("Gemini API timeout"));
		}, timeoutMs);
	});

	const callPromise = (async () => {
		// Ensure content is provided in the expected structured format
		const response = await ai.models.generateContent({
			model,
			contents: [
				{
					role: "user",
					parts: [{ text: String(message) }]
				}
			]
		});

		// Handle the SDK's response formats (text getter or candidates)
		if (typeof response?.text === "function") {
			const text = response.text();
			if (text) return text;
		}

		const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
		for (const candidate of candidates) {
			const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
			for (const part of parts) {
				if (typeof part?.text === "string" && part.text.trim()) {
					return part.text.trim();
				}
			}
		}

		return "No response generated";
	})();

	return await Promise.race([callPromise, timeoutPromise]);
}

export default getGeminiResponse;
