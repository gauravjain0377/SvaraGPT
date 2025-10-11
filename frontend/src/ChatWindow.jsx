import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import { MyContext } from "./MyContext.jsx";
import { useContext, useState, useEffect } from "react";
import {ScaleLoader} from "react-spinners";

function ChatWindow() {
    const {
        prompt, setPrompt, reply, setReply, currThreadId, setPrevChats, setNewChat,
        currentProject, projects, setProjects, allThreads, setAllThreads, prevChats
    } = useContext(MyContext);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

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
                        
                        <div className="userProfile" onClick={handleProfileClick}>
                            <div className="userAvatar">GJ</div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Profile Dropdown */}
            {
                isOpen && 
                <div className="profileDropdown">
                    <div className="dropdownItem">
                        <i className="fa-solid fa-user"></i>
                        <span>Gaurav Jain</span>
                    </div>
                    <div className="dropdownSeparator"></div>
                    <div className="dropdownItem">
                        <i className="fa-solid fa-gear"></i>
                        <span>Settings</span>
                    </div>
                    <div className="dropdownSeparator"></div>
                    <div className="dropdownItem">
                        <i className="fa-solid fa-arrow-right-from-bracket"></i>
                        <span>Log out</span>
                    </div>
                </div>
            }
            
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
        </div>
    )
}

export default ChatWindow;