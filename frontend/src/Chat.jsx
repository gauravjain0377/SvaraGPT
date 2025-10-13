import "./Chat.css";
import React, { useContext, useState, useEffect } from "react";
import { MyContext } from "./MyContext";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import logo3 from "./assets/logo3.png";


// react-markdown
// rehype-highlight

function Chat() {
    const { newChat, prevChats, reply, setPrompt, setPrevChats, setNewChat, setCurrentProject, currThreadId } = useContext(MyContext);
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
                            <div className={isUser ? "messageUser" : "messageAssistant"} key={idx}>
                                <div className="messageContent">
                                    <div className="messageAvatar">
                                        {isUser ? (
                                            <div className="userAvatar">GJ</div>
                                        ) : (
                                            <div className="assistantAvatar">
                                                <img src={logo3} alt="SvaraGPT Logo" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="messageText">
                                        {isUser && <p>{chat.content}</p>}
                                        {isAssistant && chat.isLoading && (
                                            <div className="typingDots" aria-label="Assistant is typing">
                                                <span className="dot"></span>
                                                <span className="dot"></span>
                                                <span className="dot"></span>
                                            </div>
                                        )}
                                        {isAssistant && !chat.isLoading && !showStreaming && (
                                            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{chat.content}</ReactMarkdown>
                                        )}
                                        {isAssistant && showStreaming && (
                                            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{latestReply}</ReactMarkdown>
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
