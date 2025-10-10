import './App.css';
import Sidebar from "./Sidebar.jsx";
import ChatWindow from "./ChatWindow.jsx";
import {MyContext} from "./MyContext.jsx";
import { useState, useEffect } from 'react';
import {v1 as uuidv1} from "uuid";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import VerifyEmail from './components/auth/VerifyEmail';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useContext } from 'react';
import axios from 'axios';

function App() {
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState(null);
  const [currThreadId, setCurrThreadId] = useState(uuidv1());
  const [prevChats, setPrevChats] = useState([]); //stores all chats of curr threads
  const [newChat, setNewChat] = useState(true);
  const [allThreads, setAllThreads] = useState([]);
  
  // Project Management State
  const [projects, setProjects] = useState([]); // [{id, name, chats: []}]
  const [currentProject, setCurrentProject] = useState(null); // Current project context for new chats
  const [selectedProject, setSelectedProject] = useState(null); // Selected project in UI
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null); // {type: 'project'/'chat', id, currentName}
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [moveTarget, setMoveTarget] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null); // Track which three-dots menu is open
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // {type: 'chat'/'project', id, name}

  const providerValues = {    // passing values
    prompt, setPrompt,
    reply, setReply,
    currThreadId, setCurrThreadId,
    newChat, setNewChat,
    prevChats, setPrevChats,
    allThreads, setAllThreads,
    // Project management
    projects, setProjects,
    currentProject, setCurrentProject,
    selectedProject, setSelectedProject,
    showCreateProject, setShowCreateProject,
    showRenameModal, setShowRenameModal,
    renameTarget, setRenameTarget,
    expandedProjects, setExpandedProjects,
    showMoveMenu, setShowMoveMenu,
    moveTarget, setMoveTarget,
    activeDropdown, setActiveDropdown,
    showDeleteConfirm, setShowDeleteConfirm,
    deleteTarget, setDeleteTarget
  };

  // Token handler component to process tokens from URL
  const TokenHandler = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { setCurrentUser, setIsAuthenticated } = useContext(AuthContext);
    
    useEffect(() => {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');
      
      if (token) {
        // Save token to localStorage
        localStorage.setItem('token', token);
        
        // Set default headers
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Get user data
        const fetchUser = async () => {
          try {
            const res = await axios.get('http://localhost:8080/api/auth/me');
            setCurrentUser(res.data.user);
            setIsAuthenticated(true);
          } catch (err) {
            console.error('Error fetching user data:', err);
          }
        };
        
        fetchUser();
        
        // Remove token from URL
        navigate('/', { replace: true });
      }
    }, [location, navigate, setCurrentUser, setIsAuthenticated]);
    
    return null;
  };

  // Main application component with chat interface
  const MainApp = () => (
    <div className='app'>
      <MyContext.Provider value={providerValues}>
        <Sidebar />
        <ChatWindow />
      </MyContext.Provider>
    </div>
  );

  return (
    <AuthProvider>
      <Router>
        <TokenHandler />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/auth/callback" element={<Navigate to="/" />} />
          <Route path="/" element={
            <ProtectedRoute>
              <MainApp />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;