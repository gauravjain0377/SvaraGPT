import './App.css';
import Sidebar from "./Sidebar.jsx";
import ChatWindow from "./ChatWindow.jsx";
import {MyContext} from "./MyContext.jsx";
import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {v1 as uuidv1} from "uuid";
import { useAuth } from "./context/AuthContext.jsx";

// Helper function to determine active section from path
function getActiveSectionFromPath(path) {
  if (path.startsWith('/chats')) return 'chats';
  if (path.startsWith('/projects')) return 'projects';
  if (path.startsWith('/settings')) return 'settings';
  return 'home';
}

// Helper function to determine active settings tab
function getActiveSettingsTab(path) {
  if (path.includes('/settings/faq')) return 'faq';
  if (path.includes('/settings/contact')) return 'contact';
  if (path.includes('/settings/security')) return 'security';
  return 'general';
}

function App() {
  const params = useParams();
  const location = useLocation();
  const { user, isInitialized } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState(null);
  const [currThreadId, setCurrThreadId] = useState(params.chatId || uuidv1());
  const [prevChats, setPrevChats] = useState([]); //stores all chats of curr threads
  const [newChat, setNewChat] = useState(!params.chatId);
  const [allThreads, setAllThreads] = useState([]);
  const [activeSection, setActiveSection] = useState(getActiveSectionFromPath(location.pathname));
  const [activeSettingsTab, setActiveSettingsTab] = useState(getActiveSettingsTab(location.pathname));

  // Project Management State - Initialize empty, will be loaded by Sidebar
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null); // Current project context for new chats
  const [selectedProject, setSelectedProject] = useState(params.projectId || null); // Selected project in UI
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null); // {type: 'project'/'chat', id, currentName}
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [moveTarget, setMoveTarget] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null); // Track which three-dots menu is open
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // {type: 'chat'/'project', id, name}
  const [activeFeedback, setActiveFeedback] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar state

  // Clear projects when user logs out
  useEffect(() => {
    if (!user && isInitialized) {
      setProjects([]);
      setAllThreads([]);
      setCurrentProject(null);
      setSelectedProject(null);
      // Clear localStorage
      localStorage.removeItem('projects');
    }
  }, [user, isInitialized]);

  // Update state based on URL changes
  useEffect(() => {
    setActiveSection(getActiveSectionFromPath(location.pathname));
    setActiveSettingsTab(getActiveSettingsTab(location.pathname));
    
    // Handle chat ID from URL
    if (params.chatId && params.chatId !== currThreadId) {
      setCurrThreadId(params.chatId);
      setNewChat(false);
    }
    
    // Handle project ID from URL
    if (params.projectId) {
      setSelectedProject(params.projectId);
      
      // If we have both project ID and chat ID in the URL
      if (params.chatId) {
        setCurrThreadId(params.chatId);
        setNewChat(false);
      }
    }
  }, [location.pathname, params.chatId, params.projectId]);

  // Auto-collapse sidebar on small screens to avoid overlap
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 950) {
        setIsSidebarOpen(false);
      }
    };
    // Run once on mount
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handler for copying user message
  const handleCopyMessage = (chat) => {
    if (chat && chat.content) {
      navigator.clipboard.writeText(chat.content)
        .then(() => console.log('Message copied to clipboard'))
        .catch(err => console.error('Failed to copy message: ', err));
    }
  };

  // Handler for editing user message
  const handleEditMessage = (chat, content) => {
    setPrevChats(prev => prev.map(c => 
      c === chat ? { ...c, isEditing: true, pendingContent: content } : c
    ));
  };

  // Handler for confirming edit
  const handleConfirmEdit = (chat) => {
    if (!chat.pendingContent || chat.pendingContent.trim() === '') return;
    
    // Update the message locally
    setPrevChats(prev => prev.map(c => 
      c === chat ? { ...c, content: chat.pendingContent, isEditing: false, edited: true } : c
    ));
  };

  // Handler for copying assistant message
  const handleCopyAssistant = (chat) => {
    if (chat && chat.content) {
      navigator.clipboard.writeText(chat.content)
        .then(() => console.log('Assistant message copied to clipboard'))
        .catch(err => console.error('Failed to copy assistant message: ', err));
    }
  };

  // Handler for regenerating assistant response
  const handleRegenerate = (chat) => {
    // Find the user message that preceded this assistant message
    const chatIndex = prevChats.findIndex(c => c === chat);
    if (chatIndex > 0 && prevChats[chatIndex - 1].role === 'user') {
      const userMessage = prevChats[chatIndex - 1].content;
      
      // Remove this assistant message and all subsequent messages
      setPrevChats(prev => prev.slice(0, chatIndex));
      
      // Set the prompt to trigger a new response
      setPrompt(userMessage);
    }
  };

  // Handler for feedback (thumbs up/down)
  const handleFeedbackToggle = (chat, feedbackType) => {
    if (!chat.messageId) {
      // Generate a messageId if it doesn't exist
      const messageId = `msg_${Date.now()}`;
      setPrevChats(prev => prev.map(c => 
        c === chat ? { ...c, messageId } : c
      ));
      
      setActiveFeedback(prev => ({
        ...prev,
        [messageId]: prev[messageId] === feedbackType ? null : feedbackType
      }));
      
      console.log(`Feedback ${feedbackType} for message ${messageId}`);
    } else {
      setActiveFeedback(prev => ({
        ...prev,
        [chat.messageId]: prev[chat.messageId] === feedbackType ? null : feedbackType
      }));
      
      console.log(`Feedback ${feedbackType} for message ${chat.messageId}`);
    }
  };

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
    deleteTarget, setDeleteTarget,
    
    // Navigation
    activeSection, setActiveSection,
    
    // Generation state
    isGenerating, setIsGenerating,
    isTyping, setIsTyping,
    
    // Mobile menu state
    isSidebarOpen, setIsSidebarOpen,
    
    // Chat button handlers
    handleCopyMessage,
    handleEditMessage,
    handleConfirmEdit,
    handleCopyAssistant,
    handleRegenerate,
    handleFeedbackToggle,
    activeFeedback
  };

  return (
    <div className='app'>
      <MyContext.Provider value={providerValues}>
          {/* Mobile overlay to close sidebar when clicking outside */}
          {isSidebarOpen && (
            <div 
              className="sidebar-overlay" 
              onClick={() => setIsSidebarOpen(false)}
            ></div>
          )}
          <Sidebar></Sidebar>
          <ChatWindow></ChatWindow>
        </MyContext.Provider>
    </div>
  )
}

export default App