import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Login from './components/auth/Login.jsx'
import Register from './components/auth/Register.jsx'
import ActiveSessions from './components/Settings/ActiveSessions.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/settings/sessions" element={<ActiveSessions />} />
          <Route path="/home" element={<Navigate to="/chats" replace />} />
          <Route path="/chats" element={<App />} />
          <Route path="/chats/:chatId" element={<App />} />
          <Route path="/projects" element={<App />} />
          <Route path="/projects/:projectId" element={<App />} />
          <Route path="/projects/:projectId/chats/:chatId" element={<App />} />
          <Route path="/settings/general" element={<App />} />
          <Route path="/settings/faq" element={<App />} />
          <Route path="/settings/contact" element={<App />} />
          <Route path="/settings/security" element={<App />} />
          <Route path="/settings" element={<Navigate to="/settings/general" replace />} />
          <Route path="/" element={<Navigate to="/chats" replace />} />
          <Route path="*" element={<Navigate to="/chats" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
