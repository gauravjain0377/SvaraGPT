# SvaraGPT Repository Overview

## Project Structure
- **frontend/**: Vite-powered React application deployed on Vercel.
- **backend/**: Express server deployed on Render.
- **.zencoder/**: Automation and assistant configuration files.

## Key Frontend Details
- **Entry**: `src/main.jsx`
- **Primary Components**: `ChatWindow.jsx`, `Sidebar.jsx`, `MyContext.jsx`
- **API Utilities**: `src/utils/apiConfig.js` exports `apiUrl(path)` to generate backend URLs.
- **Environment Variables**: Managed by Vercel; critical key is `VITE_API_BASE_URL` pointing to the Render backend URL.

## Key Backend Details
- **Entry**: `server.js`
- **Routes**:
  - `routes/auth.js`: Google OAuth and auth sessions.
  - `routes/chat.js`: Chat thread operations.
  - `routes/project.js`: Project and chat grouping.
- **Utilities**: Mailer, Gemini, GitHub model integrations located in `backend/utils/`.
- **Environment Variables**: Loaded from Render dashboard; `.env` holds local development defaults.

## Common Workflows
1. **Local Setup**:
   - Install dependencies: `npm install` in both `frontend/` and `backend/`.
   - Start backend: `npm run dev` in `backend/`.
   - Start frontend: `npm run dev` in `frontend/` (uses Vite).
2. **Deployment**:
   - Backend (Render): Redeploy after updating API logic or environment variables.
   - Frontend (Vercel): Redeploy after frontend changes. Ensure `VITE_API_BASE_URL` matches deployed backend URL.

## Troubleshooting Notes
- **ReferenceError: apiUrl is not defined**: Ensure `import { apiUrl } from "./utils/apiConfig";` is present where helper is used.
- **Failed to Fetch / CORS**: Confirm backend `FRONTEND_URL` env matches deployed frontend origin.
- **Authentication Issues**: Verify Render session secrets and Vercel cookies configuration, including `credentials: "include"` on fetch calls.