import "dotenv/config";

// Calls GitHub Models API (OpenAI-compatible endpoint)
// GitHub Models provides access to various AI models through an OpenAI-compatible API
export async function getGitHubModelsResponse(message, options = {}) {
	const token = process.env.GITHUB_MODELS_TOKEN;
	if (!token) {
		throw new Error("GITHUB_MODELS_TOKEN not configured");
	}

	const controller = new AbortController();
	const { timeoutMs = 30000, model = "gpt-4o-mini" } = options;
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${token}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model,
				messages: [
					{
						role: "user",
						content: String(message)
					}
				],
				temperature: 0.7,
				max_tokens: 4096
			}),
			signal: controller.signal
		});

		if (!res.ok) {
			const errTxt = await safeReadText(res);
			throw new Error(`GitHub Models API error ${res.status}: ${errTxt}`);
		}

		const data = await res.json();
		const text = extractTextFromGitHubResponse(data);
		return text || "No response generated";
	} catch (err) {
		if (err.name === "AbortError") {
			throw new Error("GitHub Models API timeout");
		}
		throw err;
	} finally {
		clearTimeout(timeout);
	}
}

function extractTextFromGitHubResponse(data) {
	// Try multiple known shapes from Responses API and OpenAI-compatible endpoints
	if (!data || typeof data !== "object") return "";

	// 1) responses API may include top-level output_text
	if (typeof data.output_text === "string" && data.output_text.trim()) {
		return data.output_text.trim();
	}

	// 2) Nested response.output_text
	if (data.response && typeof data.response.output_text === "string" && data.response.output_text.trim()) {
		return data.response.output_text.trim();
	}

	// 3) responses API: output[].content[].text
	try {
		const pieces = [];
		const output = Array.isArray(data.output) ? data.output : (data.response && Array.isArray(data.response.output) ? data.response.output : []);
		for (const msg of output) {
			const content = Array.isArray(msg?.content) ? msg.content : [];
			for (const part of content) {
				if (typeof part?.text === "string") pieces.push(part.text);
			}
		}
		if (pieces.length) return pieces.join("\n").trim();
	} catch (_) {}

	// 4) OpenAI-compatible: choices[0].message.content
	if (Array.isArray(data.choices) && data.choices[0]?.message?.content) {
		return String(data.choices[0].message.content).trim();
	}

	// 5) Fallback: content[0].text
	try {
		const content = data.content || data.response?.content;
		if (Array.isArray(content) && typeof content[0]?.text === "string") {
			return content[0].text.trim();
		}
	} catch (_) {}

	return "";
}

async function safeReadText(res) {
	try { return await res.text(); } catch { return ""; }
}

export default getGitHubModelsResponse;
