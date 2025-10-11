import './App.css';
import Sidebar from "./Sidebar.jsx";
import ChatWindow from "./ChatWindow.jsx";
import {MyContext} from "./MyContext.jsx";
import { useState } from 'react';
import {v1 as uuidv1} from "uuid";

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

  return (
    <div className='app'>
      <MyContext.Provider value={providerValues}>
          <Sidebar></Sidebar>
          <ChatWindow></ChatWindow>
        </MyContext.Provider>
    </div>
  )
}

export default App