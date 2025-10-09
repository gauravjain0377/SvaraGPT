import "./Chat.css";
import React, { useContext, useState, useEffect } from "react";
import { MyContext } from "./MyContext";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";


// react-markdown
// rehype-highlight

function Chat() {
    const {newChat, prevChats, reply} = useContext(MyContext);
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
        "Help me write a Python function",
        "Explain quantum computing",
        "Create a marketing strategy",
        "Debug my JavaScript code"
    ];

    return (
        <div className="chatContainer">
            {newChat && prevChats.length === 0 ? (
                <div className="welcomeScreen">
                    <div className="welcomeContent">
                        <div className="welcomeHeader">
                            <div className="welcomeIcon">⚡</div>
                            <h1 className="welcomeTitle">SvaraGPT</h1>
                            <p className="welcomeSubtitle">How can I help you today?</p>
                        </div>
                        
                        <div className="suggestedPrompts">
                            {suggestedPrompts.map((prompt, idx) => (
                                <div key={idx} className="promptCard" onClick={() => {
                                    // You can add functionality here to set the prompt and send it
                                    console.log('Clicked prompt:', prompt);
                                }}>
                                    <span>{prompt}</span>
                                    <i className="fa-solid fa-arrow-up-right"></i>
                                </div>
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
                                            <div className="assistantAvatar">⚡</div>
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
