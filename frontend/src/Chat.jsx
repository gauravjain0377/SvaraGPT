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
        if(reply === null) {
            setLatestReply(null); //prevchat load
            return;
        }

        if(!prevChats?.length) return;

        const content = reply.split(" "); //individual words

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
                    {
                        prevChats?.slice(0, -1).map((chat, idx) => 
                            <div className={chat.role === "user"? "messageUser" : "messageAssistant"} key={idx}>
                                <div className="messageContent">
                                    <div className="messageAvatar">
                                        {chat.role === "user" ? (
                                            <div className="userAvatar">GJ</div>
                                        ) : (
                                            <div className="assistantAvatar">⚡</div>
                                        )}
                                    </div>
                                    <div className="messageText">
                                        {
                                            chat.role === "user" ? 
                                            <p>{chat.content}</p> : 
                                            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{chat.content}</ReactMarkdown>
                                        }
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {
                        prevChats.length > 0  && (
                            <div className="messageAssistant">
                                <div className="messageContent">
                                    <div className="messageAvatar">
                                        <div className="assistantAvatar">⚡</div>
                                    </div>
                                    <div className="messageText">
                                        {
                                            latestReply === null ? (
                                                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{prevChats[prevChats.length-1].content}</ReactMarkdown>
                                            ) : (
                                                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{latestReply}</ReactMarkdown>
                                            )
                                        }
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </div>
            )}
        </div>
    )
}

export default Chat;