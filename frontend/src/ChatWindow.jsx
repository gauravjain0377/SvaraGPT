import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import { MyContext } from "./MyContext.jsx";
import { useContext, useState, useEffect } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import {ScaleLoader} from "react-spinners";

function ChatWindow() {
    const {
        prompt, setPrompt, reply, setReply, currThreadId, setPrevChats, setNewChat,
        currentProject, projects, setProjects, allThreads, setAllThreads, prevChats
    } = useContext(MyContext);
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [showGuestLimitModal, setShowGuestLimitModal] = useState(false);

    // Close dropdown when user state changes
    useEffect(() => {
        setIsOpen(false);
    }, [user]);

    // Get user initials for avatar
    const getUserInitials = () => {
        if (!user) return "";
        if (!user.email && !user.name) return ""; // Extra safety check
        if (user.name) {
            const names = user.name.split(" ");
            if (names.length >= 2) {
                return names[0].charAt(0).toUpperCase() + names[1].charAt(0).toUpperCase();
            }
            return user.name.charAt(0).toUpperCase();
        }
        return user.email ? user.email.charAt(0).toUpperCase() : "";
    };

    const getReply = async () => {
        if(!prompt.trim()) return;
        setLoading(true);
        setNewChat(false);

        // 1) Optimistically render user's message immediately
        setPrevChats(prev => ([
            ...prev,
            { role: "user", content: prompt },
            { role: "assistant", content: "", isLoading: true }
        ]));

        // 2) If this is the first message in a new chat, reflect it in the sidebar instantly
        const newThread = {
            threadId: currThreadId,
            title: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
            projectId: currentProject
        };
        if (prevChats.length === 0) {
            if (currentProject) {
                setProjects(prev => prev.map(project =>
                    project.id === currentProject
                        ? { ...project, chats: project.chats.some(c => c.threadId === newThread.threadId) ? project.chats : [...project.chats, newThread] }
                        : project
                ));
                // Persist to backend project (fire-and-forget)
                fetch(`http://localhost:8080/api/projects/${currentProject}/chats`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ threadId: newThread.threadId, title: newThread.title })
                }).catch(err => console.log(err));
            } else {
                setAllThreads(prev => prev.some(t => t.threadId === newThread.threadId) ? prev : [...prev, newThread]);
            }
        }

        // 3) Send to backend
        const options = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ message: prompt, threadId: currThreadId })
        };

        const currentPrompt = prompt; // capture
        setPrompt("");

        try {
            const response = await fetch("http://localhost:8080/api/chat", options);
            
            // Check if guest limit reached
            if (response.status === 403) {
                const errorData = await response.json();
                if (errorData.error && errorData.error.includes("Guest limit")) {
                    // Show modal
                    setShowGuestLimitModal(true);
                    // Remove the loading message
                    setPrevChats(prev => prev.slice(0, -2));
                    setLoading(false);
                    return;
                }
            }
            
            const res = await response.json();
            setReply(res.reply);

            // 4) Replace the temporary loader message with the real reply
            setPrevChats(prev => {
                const updated = [...prev];
                // Find last assistant placeholder
                for (let i = updated.length - 1; i >= 0; i--) {
                    if (updated[i].role === "assistant" && updated[i].isLoading) {
                        updated[i] = { role: "assistant", content: res.reply };
                        break;
                    }
                }
                return updated;
            });

            // For consistency, ensure sidebar entry title is set (if backend might set different)
            if (currentProject) {
                setProjects(prev => prev.map(project =>
                    project.id === currentProject
                        ? { ...project, chats: project.chats.map(c => c.threadId === newThread.threadId ? { ...c, title: newThread.title } : c) }
                        : project
                ));
            } else {
                setAllThreads(prev => prev.map(t => t.threadId === newThread.threadId ? { ...t, title: newThread.title } : t));
            }
        } catch (err) {
            console.log(err);
            // Replace loader with an error message
            setPrevChats(prev => {
                const updated = [...prev];
                for (let i = updated.length - 1; i >= 0; i--) {
                    if (updated[i].role === "assistant" && updated[i].isLoading) {
                        updated[i] = { role: "assistant", content: "Sorry, something went wrong. Please try again." };
                        break;
                    }
                }
                return updated;
            });
        }
        setLoading(false);
    }

    // Remove previous append-on-reply logic to avoid duplicates; getReply now handles UI updates


    const handleProfileClick = () => {
        setIsOpen(!isOpen);
    }

    return (
        <div className="chatWindow">
            {/* Header */}
            <div className="header">
                <div className="headerContent">
                    <div className="brandSection">
                        <div className="brandIcon">⚡</div>
                        <span className="brandName">SvaraGPT</span>
                    </div>
                    <div className="headerActions">
                        {user ? (
                            <div className="userProfile" onClick={handleProfileClick}>
                                <div className="userAvatar">{getUserInitials()}</div>
                            </div>
                        ) : (
                            <button className="loginBtn" onClick={() => navigate('/login')}>
                                Log in
                            </button>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Profile Dropdown - Only for logged in users */}
            {isOpen && user && (
                <div className="profileDropdown">
                    <div className="dropdownItem">
                        <i className="fa-solid fa-user"></i>
                        <span>{user.name || user.email}</span>
                    </div>
                    {user.email && user.name && (
                        <div className="dropdownItem secondary">
                            <span>{user.email}</span>
                        </div>
                    )}
                    <div className="dropdownSeparator"></div>
                    <div className="dropdownItem clickable">
                        <i className="fa-solid fa-gear"></i>
                        <span>Settings</span>
                    </div>
                    <div className="dropdownSeparator"></div>
                    <div className="dropdownItem clickable" onClick={logout}>
                        <i className="fa-solid fa-arrow-right-from-bracket"></i>
                        <span>Log out</span>
                    </div>
                </div>
            )}
            
            {/* Main Content */}
            <div className="mainContent">
                <Chat></Chat>
            </div>
            
            {/* Input Section */}
            <div className="inputSection">
                <div className="inputContainer">
                    <div className="inputWrapper">
                        <div className="inputActions">
                            <button className="actionBtn" title="Attach file">
                                <i className="fa-solid fa-paperclip"></i>
                            </button>
                        </div>
                        <input 
                            className="chatInput"
                            placeholder="How can I help you today?"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey ? getReply() : ''}
                        />
                        <button 
                            className={`sendBtn ${prompt.trim() ? 'active' : ''}`} 
                            onClick={getReply}
                            disabled={!prompt.trim()}
                        >
                            <i className="fa-solid fa-arrow-up"></i>
                        </button>
                    </div>
                </div>
                <div className="disclaimer">
                    SvaraGPT can make mistakes. Check important info.
                </div>
            </div>

            {/* Guest Limit Modal */}
            {showGuestLimitModal && (
                <div className="limit-modal-backdrop" onClick={() => setShowGuestLimitModal(false)}>
                    <div className="limit-modal-container" onClick={(e) => e.stopPropagation()}>
                        {/* Close Button */}
                        <button 
                            className="limit-modal-close" 
                            onClick={() => setShowGuestLimitModal(false)}
                            aria-label="Close"
                        >
                            ×
                        </button>
                        
                        {/* Icon */}
                        <div className="limit-modal-icon">
                            <i className="fa-solid fa-lock"></i>
                        </div>
                        
                        {/* Title */}
                        <h2 className="limit-modal-title">
                            You've reached your limit
                        </h2>
                        
                        {/* Description */}
                        <p className="limit-modal-description">
                            You've used all 3 free messages. Sign up for a free account to continue chatting and unlock more features!
                        </p>
                        
                        {/* Buttons */}
                        <div className="limit-modal-buttons">
                            <button 
                                className="limit-modal-btn-primary"
                                onClick={() => navigate('/register')}
                            >
                                <span>Sign Up Free</span>
                                <i className="fa-solid fa-arrow-right"></i>
                            </button>
                            <button 
                                className="limit-modal-btn-secondary"
                                onClick={() => navigate('/login')}
                            >
                                Already have an account? Log in
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ChatWindow;