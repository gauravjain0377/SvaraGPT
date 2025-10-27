import "./Chat.css";
import React, { useContext, useState, useEffect } from "react";
import { MyContext } from "./MyContext";
import { useAuth } from "./context/AuthContext";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import logo3 from "./assets/logo3.png";
import { apiUrl } from "./utils/apiConfig";


function Chat() {
    const {
        newChat,
        prevChats,
        reply,
        setPrompt,
        setPrevChats,
        setNewChat,
        setCurrentProject,
        currThreadId,
        handleCopyMessage,
        handleEditMessage,
        handleConfirmEdit,
        handleCopyAssistant,
        handleRegenerate,
        handleFeedbackToggle,
        activeFeedback,
        shareThread
    } = useContext(MyContext);
    const { user } = useAuth();
    const [latestReply, setLatestReply] = useState(null);
    const [showCopyToast, setShowCopyToast] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareData, setShareData] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);

    // Handler for starting edit
    const handleStartEdit = (chat) => {
        setEditingMessage({ ...chat, editContent: chat.content });
    };

    // Handler for updating edit content
    const handleEditChange = (content) => {
        setEditingMessage(prev => ({ ...prev, editContent: content }));
    };

    // Handler for confirming edit and sending new request
    const handleConfirmEditAndRegenerate = async () => {
        if (!editingMessage || !editingMessage.editContent || editingMessage.editContent.trim() === '') return;
        
        const newContent = editingMessage.editContent.trim();
        const messageIndex = prevChats.findIndex(c => c === editingMessage || c.content === editingMessage.content);
        
        if (messageIndex === -1) return;
        
        // Update the user message with edited content
        const updatedChats = [...prevChats];
        updatedChats[messageIndex] = { 
            ...updatedChats[messageIndex], 
            content: newContent, 
            edited: true 
        };
        
        // Remove all messages after the edited one (including the old assistant response)
        const newChats = updatedChats.slice(0, messageIndex + 1);
        setPrevChats(newChats);
        setEditingMessage(null);
        
        // Trigger new response with edited prompt
        window.dispatchEvent(new CustomEvent("svaragpt-send-prompt", {
            detail: { prompt: newContent, threadId: currThreadId }
        }));
    };

    // Handler for canceling edit
    const handleCancelEdit = () => {
        setEditingMessage(null);
    };

    // Handler for regenerating response
    const handleRegenerateResponse = (chat) => {
        const chatIndex = prevChats.findIndex(c => c === chat);
        if (chatIndex > 0 && prevChats[chatIndex - 1].role === 'user') {
            const userMessage = prevChats[chatIndex - 1].content;
            
            // Remove this assistant message and all subsequent messages
            setPrevChats(prev => prev.slice(0, chatIndex));
            
            // Trigger a new response
            window.dispatchEvent(new CustomEvent("svaragpt-send-prompt", {
                detail: { prompt: userMessage, threadId: currThreadId }
            }));
        }
    };

    // Handler for sharing thread
    const handleShareThread = async () => {
        try {
            const response = await fetch(apiUrl('/api/share'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ threadId: currThreadId })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                setShareData(data);
                setShowShareModal(true);
            } else {
                console.error('Error sharing thread:', data.error);
            }
        } catch (error) {
            console.error('Error sharing thread:', error);
        }
    };

    useEffect(() => {
        if(reply === null || reply === undefined) {
            setLatestReply(null); //prevchat load
            return;
        }

        if(!prevChats?.length) return;

        const content = reply?.split(" ") || []; // individual words for simple typewriter

        let idx = 0;
        const interval = setInterval(() => {
            setLatestReply(content.slice(0, idx+1).join(" "));

            idx++;
            if(idx >= content.length) clearInterval(interval);
        }, 40);

        return () => clearInterval(interval);

    }, [prevChats, reply]);

    const suggestedPrompts = [
        {
            title: "Help me write a Java function.",

        },
        {
            title: "Explain quantum computing",

        },
        {
            title: "Create a marketing strategy",

        },
        {
            title: "Debug my JavaScript code",

        }
    ];

    const handleSuggestedPromptClick = (promptText) => {
        // Clear current project context for standalone chats
        setCurrentProject?.(null);
        
        // Set the prompt in the input field and trigger send via ChatWindow's getReply
        setPrompt(promptText);
        
        // Dispatch event to trigger the send - ChatWindow will handle all UI updates
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("svaragpt-send-prompt", {
                detail: { prompt: promptText, threadId: currThreadId }
            }));
        }
    };

    return (
        <div className="chatContainer">
            {/* Copy Toast Notification */}
            {showCopyToast && (
                <div className="copyToast">
                    <i className="fa-solid fa-check"></i>
                    <span>Copied!</span>
                </div>
            )}
            
            {newChat && prevChats.length === 0 ? (
                <div className="welcomeScreen">
                    <div className="welcomeContent">
                        <div className="welcomeHeader">
                            <div className="welcomeIcon">
                                <img src={logo3} alt="SvaraGPT Logo" />
                            </div>
                            <h1 className="welcomeTitle">SvaraGPT</h1>
                            <p className="welcomeSubtitle">How can I help you today?</p>
                        </div>
                        
                        <div className="suggestedPrompts">
                            {suggestedPrompts.map((prompt, idx) => (
                                <button
                                    key={idx}
                                    className="promptCard"
                                    type="button"
                                    onClick={() => handleSuggestedPromptClick(prompt.title)}
                                >
                                    <div className="promptCardIcon" style={{ background: prompt.color }}>
                                        <i className={`fa-solid ${prompt.icon}`}></i>
                                    </div>
                                    <div className="promptCardTexts">
                                        <span className="promptCardTitle">{prompt.title}</span>
                                        <span className="promptCardSubtitle">{prompt.subtitle}</span>
                                    </div>
                                  
                                </button>
                            ))}
                        </div>

                        
                    </div>
                </div>
            ) : (
                <div className="chats">
                    {prevChats?.map((chat, idx) => {
                        const isUser = chat.role === "user";
                        const isAssistant = chat.role === "assistant";
                        const isLast = idx === prevChats.length - 1;
                        const showStreaming = isAssistant && isLast && latestReply !== null && !chat.isLoading;
                        return (
                            <div className={isUser ? "messageUser" : "messageAssistant"} key={chat.messageId || idx}>
                                <div className="messageContent">
                                    <div className="messageAvatar">
                                        {isUser ? (
                                            <div className="userAvatar">
                                                {user ? (
                                                    (() => {
                                                        if (user.name) {
                                                            const names = user.name.split(" ");
                                                            if (names.length >= 2) {
                                                                return names[0].charAt(0).toUpperCase() + names[1].charAt(0).toUpperCase();
                                                            }
                                                            return user.name.charAt(0).toUpperCase();
                                                        }
                                                        return user.email ? user.email.charAt(0).toUpperCase() : "";
                                                    })()
                                                ) : (
                                                    <i className="fa-solid fa-user"></i>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="assistantAvatar">
                                                <img src={logo3} alt="SvaraGPT Logo" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="messageBody">
                                        <div className="messageHeader">
                                            {isUser && chat.edited && <span className="messageBadge">Edited</span>}
                                        </div>
                                        <div className="messageText">
                                            {isUser && (!editingMessage || editingMessage.content !== chat.content) && (
                                                <div className="userMessageWrapper">
                                                    <div className="userMessageBox">
                                                        <p>{chat.content}</p>
                                                    </div>
                                                    <div className="messageActionsHover">
                                                        <button
                                                            type="button"
                                                            className="messageActionIcon"
                                                            onClick={() => {
                                                                handleCopyMessage?.(chat);
                                                                setShowCopyToast(true);
                                                                setTimeout(() => setShowCopyToast(false), 2000);
                                                            }}
                                                            aria-label="Copy message"
                                                        >
                                                            <i className="fa-solid fa-copy"></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="messageActionIcon"
                                                            onClick={() => handleStartEdit(chat)}
                                                            aria-label="Edit message"
                                                        >
                                                            <i className="fa-solid fa-pen-to-square"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            {isUser && editingMessage && editingMessage.content === chat.content && (
                                                <div className="messageEditContainer">
                                                    <textarea
                                                        className="messageEditInput"
                                                        value={editingMessage.editContent}
                                                        onChange={(e) => handleEditChange(e.target.value)}
                                                        aria-label="Edit message"
                                                        autoFocus
                                                    />
                                                    <div className="editActions">
                                                        <button
                                                            type="button"
                                                            className="editActionBtn cancelBtn"
                                                            onClick={handleCancelEdit}
                                                            aria-label="Cancel edit"
                                                        >
                                                            <i className="fa-solid fa-times"></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="editActionBtn confirmBtn"
                                                            onClick={handleConfirmEditAndRegenerate}
                                                            aria-label="Confirm edit and regenerate"
                                                        >
                                                            <i className="fa-solid fa-check"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            {isAssistant && chat.isLoading && (
                                                <div className="typingDots" aria-label="Assistant is typing">
                                                    <span className="dot"></span>
                                                    <span className="dot"></span>
                                                    <span className="dot"></span>
                                                </div>
                                            )}
                                            {isAssistant && !chat.isLoading && showStreaming && (
                                                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                                                    {latestReply || ""}
                                                </ReactMarkdown>
                                            )}
                                            {isAssistant && !chat.isLoading && !showStreaming && (
                                                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                                                    {chat.content}
                                                </ReactMarkdown>
                                            )}
                                        </div>
                                        {isAssistant && !chat.isLoading && (
                                            <div className="messageActions">
                                                <div className="messageActionsInner messageActionsAssistant">
                                                    <button
                                                        type="button"
                                                        className="messageActionBtn"
                                                        onClick={() => {
                                                            handleCopyAssistant?.(chat);
                                                            setShowCopyToast(true);
                                                            setTimeout(() => setShowCopyToast(false), 2000);
                                                        }}
                                                        aria-label="Copy assistant reply"
                                                    >
                                                        <i className="fa-solid fa-copy"></i>
                                                        <span>Copy</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="messageActionBtn"
                                                        onClick={() => handleRegenerateResponse(chat)}
                                                        aria-label="Regenerate reply"
                                                    >
                                                        <i className="fa-solid fa-repeat"></i>
                                                        <span>Regenerate</span>
                                                    </button>
                                                    <div className="feedbackGroup" role="group" aria-label="Rate response">
                                                        <button
                                                            type="button"
                                                            className={`messageActionBtn ${activeFeedback?.[chat.messageId] === "good" ? "active" : ""}`}
                                                            onClick={() => handleFeedbackToggle?.(chat, "good")}
                                                            aria-label="Mark response good"
                                                        >
                                                            <i className="fa-solid fa-thumbs-up"></i>
                                                            <span>Good</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`messageActionBtn ${activeFeedback?.[chat.messageId] === "bad" ? "active" : ""}`}
                                                            onClick={() => handleFeedbackToggle?.(chat, "bad")}
                                                            aria-label="Mark response bad"
                                                        >
                                                            <i className="fa-solid fa-thumbs-down"></i>
                                                            <span>Bad</span>
                                                        </button>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="messageActionBtn"
                                                        onClick={handleShareThread}
                                                        aria-label="Share thread"
                                                    >
                                                        <i className="fa-solid fa-share-nodes"></i>
                                                        <span>Share</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            
            {/* Share Modal */}
            {showShareModal && (
                <div className="share-modal-backdrop" onClick={() => setShowShareModal(false)}>
                    <div className="share-modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="share-modal-header">
                            <h2 className="share-modal-title">
                                <i className="fa-solid fa-share-nodes"></i>
                                Share Conversation
                            </h2>
                            <button className="share-modal-close" onClick={() => setShowShareModal(false)}>
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>
                        
                        <div className="share-modal-body">
                            {shareData ? (
                                <>
                                    <p className="share-description">
                                        Share this link with others to let them view this conversation:
                                    </p>
                                    <div className="share-link-container">
                                        <input 
                                            type="text" 
                                            className="share-link-input" 
                                            value={`${window.location.origin}/shared/${shareData.shareId}`} 
                                            readOnly 
                                        />
                                        <button 
                                            className="share-link-copy" 
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${window.location.origin}/shared/${shareData.shareId}`);
                                                setShowCopyToast(true);
                                                setTimeout(() => setShowCopyToast(false), 2000);
                                            }}
                                        >
                                            <i className="fa-solid fa-copy"></i>
                                            Copy
                                        </button>
                                    </div>
                                    <div className="share-options">
                                        <p className="share-expiry">
                                            <i className="fa-solid fa-clock"></i>
                                            This link will expire in 7 days
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <p className="share-loading">Generating share link...</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Chat;
