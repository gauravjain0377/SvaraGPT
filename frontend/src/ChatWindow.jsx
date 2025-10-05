import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import { MyContext } from "./MyContext.jsx";
import { useContext, useState, useEffect } from "react";
import {ScaleLoader} from "react-spinners";

function ChatWindow() {
    const {
        prompt, setPrompt, reply, setReply, currThreadId, setPrevChats, setNewChat,
        currentProject, projects, setProjects, allThreads, setAllThreads
    } = useContext(MyContext);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const getReply = async () => {
        setLoading(true);
        setNewChat(false);

        console.log("message ", prompt, " threadId ", currThreadId);
        const options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: prompt,
                threadId: currThreadId
            })
        };

        try {
            const response = await fetch("http://localhost:8080/api/chat", options);
            const res = await response.json();
            console.log(res);
            setReply(res.reply);
        } catch(err) {
            console.log(err);
        }
        setLoading(false);
    }

    //Append new chat to prevChats and handle project assignment
    useEffect(() => {
        if(prompt && reply) {
            setPrevChats(prevChats => {
                const newChats = [...prevChats, {
                    role: "user",
                    content: prompt
                },{
                    role: "assistant",
                    content: reply
                }];
                
                // If this is the first message in a new chat, add it to the appropriate location
                if (newChats.length === 2) {
                    const newThread = {
                        threadId: currThreadId,
                        title: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
                        projectId: currentProject
                    };
                    
                    if (currentProject) {
                        // Add to the current project
                        setProjects(prev => prev.map(project => 
                            project.id === currentProject 
                                ? {...project, chats: [...project.chats, newThread]}
                                : project
                        ));
                    } else {
                        // Add to main threads
                        setAllThreads(prev => [...prev, newThread]);
                    }
                }
                
                return newChats;
            });
        }

        setPrompt("");
    }, [reply, currThreadId, currentProject]);


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
                
                {loading && (
                    <div className="loadingContainer">
                        <ScaleLoader color="#ff6b35" loading={loading} />
                    </div>
                )}
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