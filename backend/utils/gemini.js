import "dotenv/config";

// Cache for available models to avoid repeated API calls
let cachedAvailableModels = null;
let modelCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * List available models from Gemini API
 */
export async function listAvailableModels() {
	if (!process.env.GOOGLE_API_KEY) {
		throw new Error("Gemini API key not configured");
	}

	// Return cached models if still valid
	if (cachedAvailableModels && Date.now() - modelCacheTime < CACHE_DURATION) {
		return cachedAvailableModels;
	}

	const apiKey = process.env.GOOGLE_API_KEY;
	const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;

	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to list models: ${response.statusText}`);
		}
		const data = await response.json();
		const models = data.models || [];
		
		// Cache the results
		cachedAvailableModels = models;
		modelCacheTime = Date.now();
		
		return models;
	} catch (err) {
		console.error("❌ Failed to list models:", err.message);
		return [];
	}
}

/**
 * Get the first available model that supports generateContent
 */
async function getAvailableModel() {
	try {
		const models = await listAvailableModels();
		
		// Filter models that support generateContent and are gemini models
		const supportedModels = models.filter(model => {
			const name = model.name || "";
			const supportedMethods = model.supportedGenerationMethods || [];
			return name.includes("gemini") && supportedMethods.includes("generateContent");
		});

		if (supportedModels.length > 0) {
			// Extract just the model name (remove "models/" prefix if present)
			const modelName = supportedModels[0].name.replace(/^models\//, "");
			console.log(`✅ Found available model: ${modelName}`);
			return modelName;
		}

		// If no models found, try common model names
		console.log("⚠️  No models found via API, trying common names...");
		return null;
	} catch (err) {
		console.error("❌ Error getting available models:", err.message);
		return null;
	}
}

export async function getGeminiResponse(message, options = {}) {
	if (!process.env.GOOGLE_API_KEY) {
		throw new Error("Gemini API key not configured");
	}

	const { timeoutMs = 30000, model: requestedModel } = options;
	const apiKey = process.env.GOOGLE_API_KEY;

	// Get the model to use - either from options or discover available one
	let model = requestedModel;
	if (!model) {
		// Try to discover available model
		const availableModel = await getAvailableModel();
		if (availableModel) {
			model = availableModel;
		} else {
			// Fallback to trying common model names
			const commonModels = ["gemini-pro", "gemini-1.5-flash", "gemini-1.5-pro"];
			console.log(`⚠️  No model specified, will try: ${commonModels.join(", ")}`);
			model = commonModels[0]; // Start with first one
		}
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		// Use v1 API endpoint (stable)
		const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
		
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				contents: [
					{
						parts: [
							{
								text: String(message)
							}
						]
					}
				]
			}),
			signal: controller.signal
		});

		clearTimeout(timeout);

		if (!response.ok) {
			const errorText = await response.text();
			let errorData;
			try {
				errorData = JSON.parse(errorText);
			} catch {
				errorData = { message: errorText };
			}

			// If model not found (404), try to discover and use available model
			if (response.status === 404) {
				console.error(`❌ Model ${model} not found (404)`);
				
				// Try to get available model and retry
				const availableModel = await getAvailableModel();
				if (availableModel && availableModel !== model) {
					console.log(`🔄 Retrying with available model: ${availableModel}`);
					return await getGeminiResponse(message, { ...options, model: availableModel, timeoutMs });
				}
				
				// If still no model, get list for error message
				try {
					const availableModels = await listAvailableModels();
					const modelNames = availableModels
						.map(m => m.name?.replace(/^models\//, "") || m.name)
						.filter(n => n && n.includes('gemini'))
						.slice(0, 5);
					
					if (modelNames.length > 0) {
						console.error(`💡 Available Gemini models: ${modelNames.join(", ")}`);
						throw new Error(`Gemini API error: Model ${model} not found. Available models: ${modelNames.join(", ")}. Please use one of these models.`);
					}
				} catch (listErr) {
					// If listing fails, just throw the original error
				}
				
				throw new Error(`Gemini API error: Model ${model} not found. Please verify your GOOGLE_API_KEY has access to this model. Error: ${JSON.stringify(errorData)}`);
			}

			throw new Error(`Gemini API error: ${JSON.stringify(errorData)}`);
		}

		const data = await response.json();

		// Extract text from response
		if (data?.candidates && Array.isArray(data.candidates) && data.candidates.length > 0) {
			const candidate = data.candidates[0];
			if (candidate?.content?.parts && Array.isArray(candidate.content.parts)) {
				for (const part of candidate.content.parts) {
					if (part?.text && typeof part.text === "string" && part.text.trim()) {
						return part.text.trim();
					}
				}
			}
		}

		// Check for error in response
		if (data?.error) {
			throw new Error(`Gemini API error: ${JSON.stringify(data.error)}`);
		}

		throw new Error("No response text found in Gemini API response");
	} catch (err) {
		clearTimeout(timeout);
		
		if (err.name === "AbortError") {
			throw new Error("Gemini API timeout");
		}

		// Log the error for debugging
		console.error(`❌ Gemini API call failed (model: ${model}):`, err.message);
		throw err;
	}
}

export default getGeminiResponse;
