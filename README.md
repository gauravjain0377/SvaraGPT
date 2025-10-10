# SvaraGPT

<div align="center">
  <img src="assets/logo.svg" alt="SvaraGPT Logo" width="180" />
  <p><em>A lightweight, full‑stack conversational AI application powered by Google's Gemini models</em></p>
  
</div>

<br>

## 📋 Table of Contents
- [Overview](#-overview)
- [Color Palette](#-color-palette)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [API Reference](#-api-reference)
- [Project Structure](#-project-structure)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

## 🔍 Overview

SvaraGPT is a modern, full-stack conversational AI platform that provides a lightweight alternative to enterprise AI solutions. It combines the power of Google's Gemini models with a clean React frontend and robust Express backend to deliver an accessible, self-hostable AI assistant.

### Core Principles

- **Accessibility**: Advanced AI without enterprise infrastructure requirements
- **Data Ownership**: Complete control over conversation data
- **Lightweight Design**: Powerful functionality with minimal resource usage
- **Extensibility**: Modular architecture for easy customization
- **Privacy-Focused**: User-controlled data storage

## 🎨 Color Palette

SvaraGPT uses a carefully selected color palette that balances professionalism with modern design:

| Color | Hex Code | Usage |
|-------|----------|-------|
| Deep Indigo | `#2D2A6A` | Primary brand color, headers |
| Electric Violet | `#7C3AED` | Accents, buttons, links |
| Teal | `#14B8A6` | Secondary accents, success states |
| Slate Gray | `#64748B` | Body text, secondary information |
| Light Gray | `#F1F5F9` | Backgrounds, containers |
| White | `#FFFFFF` | Main background, text on dark colors |

## ✨ Features

- **Intelligent Conversations**: Powered by Google's Gemini models
- **Thread Management**: Persistent conversation threads with MongoDB
- **Modern UI**: Clean React frontend with responsive design
- **REST API**: Simple endpoints for chat, threads, and projects
- **GitHub Integration**: Code-aware conversations (v3.0+)
- **Markdown Support**: Rich text rendering with syntax highlighting

## 🏗️ Architecture

SvaraGPT follows a clean, three-tier architecture:

1. **Frontend Layer**: React application with Vite for modern UI
2. **API Layer**: Express.js server handling requests and business logic
3. **Data Layer**: MongoDB for persistent storage of threads and projects

Communication between layers is handled via RESTful API endpoints, with the frontend making asynchronous requests to the backend.

## 🛠️ Tech Stack

### Backend
- **Node.js & Express**: Fast, non-blocking server architecture
- **MongoDB & Mongoose**: Flexible document database with schema validation
- **Google GenAI SDK**: Integration with Gemini models
- **dotenv**: Environment configuration management
- **CORS**: Cross-origin resource sharing support

### Frontend
- **React 19**: Component-based UI library
- **Vite 7**: Next-generation frontend tooling
- **React Markdown**: Rich text rendering
- **FontAwesome**: Comprehensive icon library
- **rehype-highlight**: Code syntax highlighting

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (tested on Node 22)
- MongoDB connection string
- Google API key with Generative Language API access

### Backend Setup

1. **Environment Configuration**:
   Create `backend/.env` with:
   ```
   GOOGLE_API_KEY=your_google_api_key_here
   MONGO_URL=your_mongodb_connection_string
   PORT=8080
   ```

2. **Installation & Launch**:
   ```bash
   # From project root
   cd backend
   npm install
   
   # Development mode with auto-restart
   npx nodemon server.js
   
   # Or production mode
   node server.js
   ```

### Frontend Setup

1. **Installation**:
   ```bash
   # From project root
   cd frontend
   npm install
   ```

2. **Development Mode**:
   ```bash
   npm run dev
   ```
   Access the application at: http://localhost:5173

3. **Production Build**:
   ```bash
   npm run build
   ```
   Output will be in the `frontend/dist` directory.

## 📡 API Reference

Base URL: `/api`

| Endpoint | Method | Description | Request Body | Response |
|----------|--------|-------------|--------------|----------|
| `/chat` | POST | Send message & get reply | `{threadId, message}` | `{reply}` |
| `/thread` | GET | List all threads | - | Array of threads |
| `/thread/:id` | GET | Get thread by ID | - | Thread with messages |
| `/thread/:id` | DELETE | Delete thread | - | Success status |
| `/project` | GET | List all projects | - | Array of projects |
| `/project/:id` | GET | Get project by ID | - | Project details |

## 📁 Project Structure

```
SvaraGPT/
├─ backend/                # Server-side code
│  ├─ models/              # MongoDB schemas
│  ├─ routes/              # API endpoints
│  ├─ utils/               # Helper functions
│  ├─ server.js            # Express application
│  └─ .env                 # Environment variables
├─ frontend/               # Client-side code
│  ├─ src/                 # React components
│  │  ├─ App.jsx           # Main application
│  │  ├─ Chat.jsx          # Chat interface
│  │  ├─ ChatWindow.jsx    # Message display
│  │  ├─ Sidebar.jsx       # Navigation
│  │  └─ MyContext.jsx     # State management
│  └─ vite.config.js       # Build configuration
└─ assets/                 # Shared resources
   └─ logo.svg             # Project logo
```

## 🗺️ Roadmap

### Version 1.0 (Released)
- Basic Express.js backend
- Google Gemini integration
- MongoDB persistence
- Thread-based conversations

### Version 2.0 (Current)
- React frontend with Vite
- Enhanced conversation threading
- Improved error handling
- Project management functionality

### Version 3.0 (Planned)
- GitHub integration
- Advanced thread management
- Customizable AI behavior
- Enhanced UI/UX
- Extended API

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<div align="center">
  <p>Built with ❤️ by the SvaraGPT Team</p>
</div>
