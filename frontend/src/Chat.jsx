import "./Chat.css";
import React, { useContext, useState, useEffect } from "react";
import { MyContext } from "./MyContext";
import { useAuth } from "./context/AuthContext";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import logo3 from "./assets/logo3.png";


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

    }, [prevChats, reply])

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
                                            {isUser && !chat.isEditing && <p>{chat.content}</p>}
                                            {isUser && chat.isEditing && (
                                                <div className="messageEditRow">
                                                    <textarea
                                                        className="messageEditInput"
                                                        defaultValue={chat.pendingContent ?? chat.content}
                                                        onChange={(event) => handleEditMessage?.(chat, event.target.value)}
                                                        aria-label="Edit message"
                                                    />
                                                    <button
                                                        type="button"
                                                        className="messageActionIcon confirmEdit"
                                                        onClick={() => handleConfirmEdit?.(chat)}
                                                        aria-label="Confirm edit"
                                                    >
                                                        <i className="fa-solid fa-check"></i>
                                                    </button>
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
                                        <div className="messageActions">
                                            {isUser ? (
                                                <div className="messageActionsInner messageActionsUser">
                                                    <button
                                                        type="button"
                                                        className="messageActionIcon"
                                                        onClick={() => handleCopyMessage?.(chat)}
                                                        aria-label="Copy message"
                                                    >
                                                        <i className="fa-solid fa-copy"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="messageActionIcon"
                                                        onClick={() => handleEditMessage?.(chat, chat.content)}
                                                        aria-label="Edit message"
                                                    >
                                                        <i className="fa-solid fa-pen-to-square"></i>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="messageActionsInner messageActionsAssistant">
                                                    <button
                                                        type="button"
                                                        className="messageActionBtn"
                                                        onClick={() => handleCopyAssistant?.(chat)}
                                                        aria-label="Copy assistant reply"
                                                    >
                                                        <i className="fa-solid fa-copy"></i>
                                                        <span>Copy</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="messageActionBtn"
                                                        onClick={() => handleRegenerate?.(chat)}
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
                                                        onClick={() => shareThread?.(chat)}
                                                        aria-label="Share thread"
                                                    >
                                                        <i className="fa-solid fa-share-nodes"></i>
                                                        <span>Share</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default Chat;
