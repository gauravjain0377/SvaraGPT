# SvaraGPT

A lightweight, full‑stack conversational AI server that powers GPT‑style chats. It uses Google’s Gemini models for responses and MongoDB for persistent threads, wrapped in an Express API.

<p align="center">
  <img src="assets/logo.svg" alt="SvaraGPT Logo" width="160" />
</p>

- Fast chat backend with Node.js/Express
- Persistent threads with MongoDB via Mongoose
- Google GenAI (@google/genai) with gemini-2.5-flash
- Simple REST API: create chats, retrieve threads, delete threads
- Ready for a web or mobile frontend

## Tech Stack
- Node.js + Express
- MongoDB + Mongoose
- Google GenAI SDK: `@google/genai`
- Runtime config with `dotenv`

## Project Structure
```text path=null start=null
SvaraGPT/
└─ backend/
   ├─ server.js            # Express app bootstrap
   ├─ routes/
   │  └─ chat.js          # Chat + threads API
   ├─ models/
   │  └─ Thread.js        # Mongoose schema for threads/messages
   ├─ utils/
   │  └─ gemini.js        # GenAI helper
   ├─ package.json
   └─ .env                # Env vars (not committed)
└─ assets/
   └─ logo.svg            # Vector logo for the project
```

## Getting Started

### Prerequisites
- Node.js 18+ (tested on Node 22)
- MongoDB connection string
- Google API key with Generative Language API access

### Environment
Create `backend/.env` with:
```bash path=null start=null
GOOGLE_API_KEY=your_google_api_key_here
MONGO_URL=your_mongodb_connection_string
PORT=8080
```

### Install
```bash path=null start=null
# From project root
cd backend
npm install
```

### Run (Development)
```bash path=null start=null
# Using nodemon (auto-restart on changes)
npx nodemon server.js

# Or plain node
node server.js
```

Server boots at: http://localhost:8080

## API
Base path: `/api`

### POST /api/chat
Send a message and receive the assistant reply. Also persists the conversation under a thread.

Request body:
```json path=null start=null
{
  "threadId": "string",   
  "message": "string"     
}
```

Response body:
```json path=null start=null
{
  "reply": "assistant response text"
}
```

Example:
```bash path=null start=null
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"threadId":"demo-1","message":"Explain how AI works in a few words"}'
```

### GET /api/thread
Returns all threads (most recent first):
```bash path=null start=null
curl http://localhost:8080/api/thread
```

### GET /api/thread/:threadId
Returns messages for a specific thread:
```bash path=null start=null
curl http://localhost:8080/api/thread/demo-1
```

### DELETE /api/thread/:threadId
Deletes a specific thread:
```bash path=null start=null
curl -X DELETE http://localhost:8080/api/thread/demo-1
```

## How it works (high level)
- The server exposes REST endpoints in `routes/chat.js`.
- Incoming user messages are forwarded to Google Gemini via `@google/genai`.
- Replies are returned and stored in MongoDB in `Thread` documents.

## Troubleshooting
- Model 404 or not supported:
  - Ensure `@google/genai` is installed and model is set to `gemini-2.5-flash`.
  - Confirm your key has access; re‑generate if needed.
- API key not configured:
  - Ensure `GOOGLE_API_KEY` is present in `backend/.env`.
- Mongo connection fails:
  - Double‑check `MONGO_URL`, network access, and that MongoDB is reachable.

## Production Notes
- Use a process manager (PM2, systemd, or container) rather than nodemon.
- Set proper CORS and rate‑limits when exposing publicly.
- Consider adding request logs, tracing, and auth in front of `/api`.

## SvaraGPT System Prompt (drop‑in)
Use this to configure the assistant persona in your UI/backend:
```text path=null start=null
You are SvaraGPT, a helpful, fast, and factual AI assistant. Goals:
- Provide concise, correct answers; ask for clarification when needed.
- Show step‑by‑step thinking only when explicitly requested to explain (otherwise, summarize).
- Be safe: refuse harmful or unethical requests.
- Keep a friendly, professional tone.

Tools/context:
- You can answer general knowledge, programming, and troubleshooting questions.
- If a question depends on unavailable context (secrets, files, or network), state that clearly and ask for details.

Constraints:
- Never fabricate API keys, credentials, or personal data.
- Prefer short, direct answers with optional follow‑ups.

Output format:
- Default to plain text. Use bullet points for lists.
- Provide code blocks for code or terminal commands.
```

## Logo Brief & Prompts
Use the prompts below with your favorite image model (Midjourney, SDXL, Firefly, DALL·E). The delivered vector logo lives at `assets/logo.svg`.

Brand direction:
- Name: SvaraGPT (Svara = “voice/sound”) → cue: sound waves + chat bubble
- Style: modern, clean, geometric; tech‑friendly; high contrast
- Colors: Deep indigo (#2D2A6A), Electric violet (#7C3AED), Teal accent (#14B8A6), on white/dark backgrounds

General prompt:
```text path=null start=null
Design a modern vector logo for “SvaraGPT”, an AI chat assistant. Incorporate a minimal speech bubble and stylized sound waves forming an “S”. Flat, geometric shapes, smooth curves, and balanced negative space. Use a deep indigo base with electric violet and subtle teal accents. Produce a crisp, scalable vector suitable for app icon and wordmark lockups.
```

Midjourney‑style prompt:
```text path=null start=null
SvaraGPT logo, minimal speech bubble + waveform forming an S, geometric, flat design, tech brand, negative space mastery, deep indigo #2D2A6A, electric violet #7C3AED accents, subtle teal #14B8A6 highlight, clean vector, simple iconic mark, high contrast, centered composition, white background, no gradients, no 3D, SVG style --v 6 --style raw
```

Stable Diffusion XL prompt:
```text path=null start=null
<lora:vector_logo:1> Minimal vector logo for “SvaraGPT” featuring a speech bubble and stylized S‑shaped sound waves. Flat geometric style, deep indigo with violet accents, crisp lines, high contrast, SVG look, no text, white background.
```

## License
MIT

## Acknowledgements
- Google Generative AI
- MongoDB + Mongoose
- Express.js
