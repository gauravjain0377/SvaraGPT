import "./Chat.css";
import React, { useContext, useState, useEffect } from "react";
import { MyContext } from "./MyContext";
import { useAuth } from "./context/AuthContext";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import logo3 from "./assets/logo3.png";


// react-markdown
// rehype-highlight

function Chat() {
    const { newChat, prevChats, reply, setPrompt, setPrevChats, setNewChat, setCurrentProject, currThreadId } = useContext(MyContext);
    const { user } = useAuth();
    const [latestReply, setLatestReply] = useState(null);
    const [editingMessageIndex, setEditingMessageIndex] = useState(null);
    const [editingContent, setEditingContent] = useState("");

    const [copiedMessage, setCopiedMessage] = useState(null);

    const copyToClipboard = async (text, messageId) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedMessage(messageId);
            setTimeout(() => setCopiedMessage(null), 1000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const handleEditMessage = (index, content) => {
        setEditingMessageIndex(index);
        setEditingContent(content);
    };

    const handleSaveEdit = (index) => {
        if (editingContent.trim()) {
            // Update the message in prevChats
            setPrevChats(prev => prev.map((chat, i) => i === index ? { ...chat, content: editingContent.trim() } : chat));
            // Resend the prompt
            window.dispatchEvent(new CustomEvent("svaragpt-send-prompt", {
                detail: { prompt: editingContent.trim(), threadId: currThreadId, editIndex: index, addUser: false }
            }));
        }
        setEditingMessageIndex(null);
        setEditingContent("");
    };

    const handleCancelEdit = () => {
        setEditingMessageIndex(null);
        setEditingContent("");
    };

    const handleRegenerate = () => {
        // Find the last user message
        const lastUserIndex = prevChats.map((chat, i) => ({ chat, i })).reverse().find(({ chat }) => chat.role === "user")?.i;
        if (lastUserIndex !== undefined) {
            window.dispatchEvent(new CustomEvent("svaragpt-send-prompt", {
                detail: { prompt: prevChats[lastUserIndex].content, threadId: currThreadId, regenerate: true, addUser: false }
            }));
        }
    };

    const markdownComponents = {
        code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeContent = String(children).replace(/\n$/, '');
            if (!inline && match) {
                return (
                    <div className="codeBlock">
                        <div className="codeHeader">
                            <span className="language">{match[1]}</span>
                            <button className="copyButton" onClick={() => copyToClipboard(codeContent)}>
                                <i className="fa-solid fa-copy"></i>
                            </button>
                        </div>
                        <pre className={className}>
                            <code {...props}>{children}</code>
                        </pre>
                    </div>
                );
            } else if (!inline) {
                return (
                    <div className="codeBlock">
                        <div className="codeHeader">
                            <button className="copyButton" onClick={() => copyToClipboard(codeContent)}>
                                <i className="fa-solid fa-copy"></i>
                            </button>
                        </div>
                        <pre className={className}>
                            <code {...props}>{children}</code>
                        </pre>
                    </div>
                );
            } else {
                return <code className={className} {...props}>{children}</code>;
            }
        }
    };

    useEffect(() => {
        if(reply === null || reply === undefined) {
            setLatestReply(null); //prevchat load
            return;
        }

        if(!prevChats?.length) return;

        setLatestReply(""); // start with empty to avoid flashing full answer

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
                        const showStreaming = isAssistant && isLast && !chat.isLoading;
                        return (
                            <div className={isUser ? "messageUser" : "messageAssistant"} key={idx}>
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
                                    <div className="messageText">
                                        {isUser && editingMessageIndex === idx && (
                                            <div className="editMode">
                                                <textarea
                                                    value={editingContent}
                                                    onChange={(e) => setEditingContent(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleSaveEdit(idx);
                                                        } else if (e.key === 'Escape') {
                                                            handleCancelEdit();
                                                        }
                                                    }}
                                                    autoFocus
                                                />
                                                <div className="editActions">
                                                    <button onClick={() => handleSaveEdit(idx)}>Save</button>
                                                    <button onClick={handleCancelEdit}>Cancel</button>
                                                </div>
                                            </div>
                                        )}
                                        {isUser && editingMessageIndex !== idx && (
                                            <div className="messageWrapper">
                                                <p onClick={() => handleEditMessage(idx, chat.content)}>{chat.content}</p>
                                                <div className="messageButtons below right">
                                                    <button className="copyButton" onClick={() => copyToClipboard(chat.content, `user-${idx}`)}>
                                                        <i className={`fa-solid ${copiedMessage === `user-${idx}` ? 'fa-check' : 'fa-copy'}`}></i>
                                                    </button>
                                                    <button className="editButton" onClick={() => handleEditMessage(idx, chat.content)}>
                                                        <i className="fa-solid fa-pen"></i>
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
                                        {isAssistant && !chat.isLoading && (
                                            <div className="messageWrapper">
                                                {!showStreaming && (
                                                    <ReactMarkdown components={markdownComponents} rehypePlugins={[rehypeHighlight]}>{chat.content}</ReactMarkdown>
                                                )}
                                                {showStreaming && (
                                                    <ReactMarkdown components={markdownComponents} rehypePlugins={[rehypeHighlight]}>{latestReply}</ReactMarkdown>
                                                )}
                                                <div className="messageButtons below left">
                                                    <button className="copyButton" onClick={() => copyToClipboard(showStreaming ? latestReply : chat.content, `assistant-${idx}`)}>
                                                        <i className={`fa-solid ${copiedMessage === `assistant-${idx}` ? 'fa-check' : 'fa-copy'}`}></i>
                                                    </button>
                                                    {isLast && (
                                                        <button className="regenerateButton" onClick={handleRegenerate}>
                                                            <i className="fa-solid fa-rotate-right"></i>
                                                        </button>
                                                    )}
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
        </div>
    )
}

export default Chat;
