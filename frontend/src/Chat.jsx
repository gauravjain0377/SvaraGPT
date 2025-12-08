import "./Chat.css";
import React, { useContext, useState, useEffect, useRef } from "react";
import { MyContext } from "./MyContext";
import { useAuth } from "./context/AuthContext";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import logo from "./assets/logo.png";
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
        isGenerating,
        setIsTyping
    } = useContext(MyContext);
    const { user } = useAuth();
    const [latestReply, setLatestReply] = useState(null);
    const [showCopyToast, setShowCopyToast] = useState(false);
    const [editingMessage, setEditingMessage] = useState(null);
    const [regeneratingIndices, setRegeneratingIndices] = useState(new Set());
    const editTextareaRef = useRef(null);

    // Handler for starting edit
    const handleStartEdit = (chat, index) => {
        setEditingMessage({ 
            ...chat, 
            editContent: chat.content,
            editIndex: index 
        });
        // Auto-resize textarea after it's rendered
        setTimeout(() => {
            if (editTextareaRef.current) {
                editTextareaRef.current.style.height = 'auto';
                editTextareaRef.current.style.height = Math.min(editTextareaRef.current.scrollHeight, 200) + 'px';
            }
        }, 0);
    };

    // Handler for updating edit content
    const handleEditChange = (content) => {
        setEditingMessage(prev => ({ ...prev, editContent: content }));
    };

    // Handler for confirming edit and sending new request
    const handleConfirmEditAndRegenerate = async () => {
        if (!editingMessage || !editingMessage.editContent || editingMessage.editContent.trim() === '') return;
        
        const newContent = editingMessage.editContent.trim();
        const messageIndex = editingMessage.editIndex;
        
        if (messageIndex === undefined || messageIndex === -1) return;
        
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
            
            // Mark only this specific message as regenerating
            setRegeneratingIndices(prev => new Set([...prev, chatIndex]));
            
            // Wait for fade-out animation before regenerating
            setTimeout(() => {
                // Keep all messages, just mark the assistant message for update
                // Don't remove it, let regenerateResponse handle the update
                setRegeneratingIndices(new Set());
                
                // Trigger regeneration without duplicating user message or removing subsequent messages
                window.dispatchEvent(new CustomEvent("svaragpt-regenerate-prompt", {
                    detail: { 
                        prompt: userMessage, 
                        regenerateIndex: chatIndex - 1, // The index of the user message
                        threadId: currThreadId 
                    }
                }));
            }, 300);
        }
    };


    // Handle when reply is cleared (generation stopped)
    useEffect(() => {
        if(reply === "" && latestReply) {
            // Generation was stopped, preserve the partial content
            setPrevChats(prev => {
                const updated = [...prev];
                const lastAssistant = updated.length - 1;
                if (updated[lastAssistant] && updated[lastAssistant].role === "assistant") {
                    if (updated[lastAssistant].isLoading) {
                        updated[lastAssistant] = { role: "assistant", content: latestReply };
                    }
                }
                return updated;
            });
            setLatestReply(null);
        }
    }, [reply, latestReply, setPrevChats]);

    useEffect(() => {
        if(reply === null || reply === undefined || reply === "") {
            if(reply === "") {
                // Generation was stopped, handled by the effect above
                return;
            }
            setLatestReply(null);
            setIsTyping(false);
            return;
        }

        if(!prevChats?.length) return;

        const content = reply?.split(" ") || []; // individual words for simple typewriter
        
        setIsTyping(true);
        let idx = 0;
        const interval = setInterval(() => {
            const partialContent = content.slice(0, idx+1).join(" ");
            setLatestReply(partialContent);

            idx++;
            if(idx >= content.length) {
                clearInterval(interval);
                setIsTyping(false);
            }
        }, 40);

        return () => {
            clearInterval(interval);
            setIsTyping(false);
        };

    }, [reply, prevChats]);

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
                                <img src={logo} alt="SvaraGPT Logo" />
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
                        const isStreamingComplete = isAssistant && isLast && !isGenerating && chat.content && !chat.isLoading;
                        const messageId = chat.messageId || chat.id || idx;
                        const isRegenerating = regeneratingIndices.has(idx);
                        
                        return (
                            <div 
                                className={isUser ? "messageUser" : `messageAssistant ${isRegenerating ? "regenerating" : ""}`} 
                                key={messageId}
                            >
                                {isUser && editingMessage && editingMessage.editIndex === idx ? (
                                    <div className="messageEditContainerFull">
                                        <div className="messageEditWrapper">
                                            <textarea
                                                ref={editTextareaRef}
                                                className="messageEditInput"
                                                value={editingMessage.editContent}
                                                onChange={(e) => {
                                                    handleEditChange(e.target.value);
                                                    // Auto-resize textarea
                                                    e.target.style.height = 'auto';
                                                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleConfirmEditAndRegenerate();
                                                    } else if (e.key === 'Escape') {
                                                        handleCancelEdit();
                                                    }
                                                }}
                                                aria-label="Edit message"
                                                autoFocus
                                                rows={1}
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
                                                    <i className="fa-solid fa-arrow-up"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
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
                                                    <img src={logo} alt="SvaraGPT Logo" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="messageBody">
                                            <div className="messageHeader">
                                                {isUser && chat.edited && <span className="messageBadge">Edited</span>}
                                            </div>
                                            <div className="messageText">
                                                {isUser && (
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
                                                                onClick={() => handleStartEdit(chat, idx)}
                                                                aria-label="Edit message"
                                                            >
                                                                <i className="fa-solid fa-pen-to-square"></i>
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
                                        {isAssistant && ((!chat.isLoading && !showStreaming) || isStreamingComplete) && (
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
                                                </div>
                                            </div>
                                        )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default Chat;
