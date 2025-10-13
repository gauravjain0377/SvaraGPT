import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import { MyContext } from "./MyContext.jsx";
import { useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import {ScaleLoader} from "react-spinners";
import logo3 from "./assets/logo3.png";

function ChatWindow() {
    const {
        prompt, setPrompt, reply, setReply, currThreadId, setPrevChats, setNewChat,
        currentProject, setCurrentProject, projects, setProjects, allThreads, setAllThreads, prevChats
    } = useContext(MyContext);
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [showGuestLimitModal, setShowGuestLimitModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [activeSettingsTab, setActiveSettingsTab] = useState('general');
    const [contactForm, setContactForm] = useState({ name: '', email: '', category: 'Bug Report', message: '' });
    const [contactFormStatus, setContactFormStatus] = useState({ type: '', message: '' });
    const [isSubmittingContact, setIsSubmittingContact] = useState(false);
    const [expandedFAQ, setExpandedFAQ] = useState(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
    const [twoFactorStep, setTwoFactorStep] = useState('setup'); // 'setup', 'verify', 'success'
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [qrCode, setQrCode] = useState('');
    const [backupCodes, setBackupCodes] = useState([]);
    const [showActiveSessionsModal, setShowActiveSessionsModal] = useState(false);
    const [activeSessions, setActiveSessions] = useState([]);

    // Close dropdown when user state changes
    useEffect(() => {
        setIsOpen(false);
    }, [user]);

    const queueRef = useRef([]);
    const isProcessingRef = useRef(false);

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

    const getReply = useCallback(async (overridePrompt) => {
        const activePrompt = (overridePrompt ?? prompt).trim();
        if(!activePrompt) return;
        setLoading(true);
        setNewChat(false);

        let usedPrompt = activePrompt;

        // 1) Optimistically render user's message immediately
        setPrevChats(prev => ([
            ...prev,
            { role: "user", content: usedPrompt },
            { role: "assistant", content: "", isLoading: true }
        ]));

        // 2) If this is the first message in a new chat, reflect it in the sidebar instantly
        const newThread = {
            threadId: currThreadId,
            title: usedPrompt.slice(0, 50) + (usedPrompt.length > 50 ? '...' : ''),
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

        // 3) Check guest limit before sending
        if (!user) {
            try {
                const usageResponse = await fetch("http://localhost:8080/api/guest-usage", {
                    method: "GET",
                    credentials: "include"
                });
                const usageData = await usageResponse.json();
                if (usageData.limitReached) {
                    setShowGuestLimitModal(true);
                    // Remove the loading message
                    setPrevChats(prevState => prevState.filter(chat => !(chat.role === "assistant" && chat.isLoading)));
                    setLoading(false);
                    return;
                }
            } catch (err) {
                console.error("Error checking guest usage:", err);
                // Continue if error, let backend handle
            }
        }

        // 4) Send to backend
        const options = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ message: usedPrompt, threadId: currThreadId })
        };

        const currentPrompt = usedPrompt; // capture
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
                    setPrevChats(prevState => prevState.filter(chat => !(chat.role === "assistant" && chat.isLoading)));
                    setLoading(false);
                    return;
                }
            }
            
            const res = await response.json();
            setReply(res.reply);

            // 5) Replace the temporary loader message with the real reply
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

            window.dispatchEvent(new CustomEvent("svaragpt-reply-received", {
                detail: { threadId: currThreadId }
            }));

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
    }, [prompt, setLoading, setNewChat, setPrevChats, currThreadId, currentProject, prevChats.length, setProjects, setAllThreads, setPrompt, setReply, setShowGuestLimitModal, navigate, projects, allThreads, user]);

    const processQueue = useCallback(() => {
        if (isProcessingRef.current) return;
        const next = queueRef.current.shift();
        if (!next) return;
        isProcessingRef.current = true;
        getReply(next.prompt).finally(() => {
            isProcessingRef.current = false;
            processQueue();
        });
    }, [getReply]);

    useEffect(() => {
        const handler = (event) => {
            const { prompt: queuedPrompt } = event.detail || {};
            if (!queuedPrompt) return;
            queueRef.current.push({ prompt: queuedPrompt });
            processQueue();
        };
        window.addEventListener("svaragpt-send-prompt", handler);
        return () => {
            window.removeEventListener("svaragpt-send-prompt", handler);
        };
    }, [processQueue]);

    useEffect(() => {
        const handleReplyReceived = () => {
            queueRef.current.shift();
            isProcessingRef.current = false;
            processQueue();
        };
        window.addEventListener("svaragpt-reply-received", handleReplyReceived);
        return () => window.removeEventListener("svaragpt-reply-received", handleReplyReceived);
    }, [processQueue]);

    // Remove previous append-on-reply logic to avoid duplicates; getReply now handles UI updates

    const handleProfileMouseEnter = () => {
        setIsOpen(true);
    }

    const handleProfileMouseLeave = () => {
        setIsOpen(false);
    }

    const handleSettingsClick = () => {
        setShowSettingsModal(true);
        setIsOpen(false);
    }

    const handleLogoutClick = () => {
        setShowLogoutModal(true);
        setIsOpen(false);
    }

    const confirmLogout = () => {
        logout();
        setShowLogoutModal(false);
    }

    const cancelLogout = () => {
        setShowLogoutModal(false);
    }

    const handleExportChatData = useCallback((format) => {
        const exportData = {
            exportDate: new Date().toISOString(),
            user: {
                name: user?.name,
                email: user?.email
            },
            projects: projects,
            threads: allThreads,
            currentChat: prevChats
        };

        const dateStr = new Date().toISOString().split('T')[0];
        let dataBlob, fileName, mimeType;

        if (format === 'json') {
            const dataStr = JSON.stringify(exportData, null, 2);
            dataBlob = new Blob([dataStr], { type: 'application/json' });
            fileName = `svaragpt-export-${dateStr}.json`;
        } else if (format === 'csv') {
            // Convert to CSV format
            let csvContent = "Export Date," + exportData.exportDate + "\n";
            csvContent += "User Name," + (exportData.user.name || 'N/A') + "\n";
            csvContent += "User Email," + (exportData.user.email || 'N/A') + "\n\n";
            
            csvContent += "Projects\n";
            csvContent += "Project Name,Chat Count\n";
            exportData.projects.forEach(project => {
                csvContent += `"${project.name}",${project.chats.length}\n`;
            });
            
            csvContent += "\nThreads\n";
            csvContent += "Thread ID,Title,Project ID\n";
            exportData.threads.forEach(thread => {
                csvContent += `"${thread.threadId}","${thread.title}","${thread.projectId || 'None'}"\n`;
            });
            
            csvContent += "\nCurrent Chat\n";
            csvContent += "Role,Content\n";
            exportData.currentChat.forEach(chat => {
                const content = chat.content.replace(/"/g, '""').replace(/\n/g, ' ');
                csvContent += `"${chat.role}","${content}"\n`;
            });
            
            dataBlob = new Blob([csvContent], { type: 'text/csv' });
            fileName = `svaragpt-export-${dateStr}.csv`;
        } else if (format === 'txt') {
            // Convert to plain text format
            let txtContent = `SvaraGPT Data Export\n`;
            txtContent += `Export Date: ${exportData.exportDate}\n`;
            txtContent += `User: ${exportData.user.name || 'N/A'} (${exportData.user.email || 'N/A'})\n\n`;
            
            txtContent += `=== PROJECTS (${exportData.projects.length}) ===\n`;
            exportData.projects.forEach((project, idx) => {
                txtContent += `${idx + 1}. ${project.name} - ${project.chats.length} chats\n`;
            });
            
            txtContent += `\n=== THREADS (${exportData.threads.length}) ===\n`;
            exportData.threads.forEach((thread, idx) => {
                txtContent += `${idx + 1}. ${thread.title}\n`;
                txtContent += `   Thread ID: ${thread.threadId}\n`;
                txtContent += `   Project: ${thread.projectId || 'None'}\n\n`;
            });
            
            txtContent += `\n=== CURRENT CHAT (${exportData.currentChat.length} messages) ===\n`;
            exportData.currentChat.forEach((chat, idx) => {
                txtContent += `\n[${chat.role.toUpperCase()}]:\n${chat.content}\n`;
            });
            
            dataBlob = new Blob([txtContent], { type: 'text/plain' });
            fileName = `svaragpt-export-${dateStr}.txt`;
        }

        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setShowExportModal(false);
    }, [user, projects, allThreads, prevChats]);

    const toggleFAQ = (index) => {
        setExpandedFAQ(expandedFAQ === index ? null : index);
    };

    const handleContactFormChange = (e) => {
        const { name, value } = e.target;
        setContactForm(prev => ({ ...prev, [name]: value }));
    };

    const handleContactFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmittingContact(true);
        setContactFormStatus({ type: '', message: '' });

        try {
            const response = await fetch('http://localhost:8080/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(contactForm)
            });

            const data = await response.json();

            if (response.ok) {
                setContactFormStatus({ 
                    type: 'success', 
                    message: "Your message has been sent successfully! We'll get back to you soon."
                });
                setContactForm({ name: '', email: '', category: 'Bug Report', message: '' });
                
                // Auto-dismiss success message after 5 seconds
                setTimeout(() => {
                    setContactFormStatus({ type: '', message: '' });
                }, 5000);
            } else {
                setContactFormStatus({ 
                    type: 'error', 
                    message: data.error || 'Failed to send message' 
                });
            }
        } catch (error) {
            setContactFormStatus({ 
                type: 'error', 
                message: 'Network error. Please try again.' 
            });
        } finally {
            setIsSubmittingContact(false);
        }
    }

    // Two-Factor Authentication Functions
    const handleEnable2FA = async () => {
        try {
            const response = await fetch('http://localhost:8080/api/auth/2fa/setup', {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();
            
            if (response.ok) {
                setQrCode(data.qrCode);
                setBackupCodes(data.backupCodes);
                setTwoFactorStep('verify');
                setShowTwoFactorModal(true);
            }
        } catch (error) {
            console.error('Error setting up 2FA:', error);
        }
    };

    const handleVerify2FA = async () => {
        try {
            const response = await fetch('http://localhost:8080/api/auth/2fa/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ code: twoFactorCode })
            });
            
            if (response.ok) {
                setTwoFactorEnabled(true);
                setTwoFactorStep('success');
                setTimeout(() => {
                    setShowTwoFactorModal(false);
                    setTwoFactorStep('setup');
                    setTwoFactorCode('');
                }, 3000);
            } else {
                alert('Invalid code. Please try again.');
            }
        } catch (error) {
            console.error('Error verifying 2FA:', error);
        }
    };

    const handleDisable2FA = async () => {
        if (!confirm('Are you sure you want to disable Two-Factor Authentication?')) return;
        
        try {
            const response = await fetch('http://localhost:8080/api/auth/2fa/disable', {
                method: 'POST',
                credentials: 'include',
            });
            
            if (response.ok) {
                setTwoFactorEnabled(false);
                alert('Two-Factor Authentication has been disabled.');
            }
        } catch (error) {
            console.error('Error disabling 2FA:', error);
        }
    };

    // Active Sessions Functions
    const fetchActiveSessions = async () => {
        try {
            const response = await fetch('http://localhost:8080/api/auth/sessions', {
                credentials: 'include',
            });
            const data = await response.json();
            
            if (response.ok) {
                setActiveSessions(data.sessions || []);
                setShowActiveSessionsModal(true);
            }
        } catch (error) {
            console.error('Error fetching sessions:', error);
        }
    };

    const handleLogoutSession = async (sessionId) => {
        try {
            const response = await fetch(`http://localhost:8080/api/auth/sessions/${sessionId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            
            if (response.ok) {
                setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
            }
        } catch (error) {
            console.error('Error logging out session:', error);
        }
    };

    const handleLogoutAllSessions = async () => {
        if (!confirm('This will log you out from all devices. Continue?')) return;
        
        try {
            const response = await fetch('http://localhost:8080/api/auth/sessions/all', {
                method: 'DELETE',
                credentials: 'include',
            });
            
            if (response.ok) {
                logout();
                navigate('/login');
            }
        } catch (error) {
            console.error('Error logging out all sessions:', error);
        }
    };

    // Fetch 2FA status and sessions on mount
    useEffect(() => {
        const fetch2FAStatus = async () => {
            try {
                const response = await fetch('http://localhost:8080/api/auth/2fa/status', {
                    credentials: 'include',
                });
                const data = await response.json();
                if (response.ok) {
                    setTwoFactorEnabled(data.enabled || false);
                }
            } catch (error) {
                console.error('Error fetching 2FA status:', error);
            }
        };

        if (user) {
            fetch2FAStatus();
        }
    }, [user]);

    return (
        <div className="chatWindow">
            {/* Header */}
            <div className="header">
                <div className="headerContent">
                    <div className="brandSection">
                        <img src={logo3} alt="SvaraGPT Logo" className="brandIcon" />
                        <span className="brandName">SvaraGPT</span>
                    </div>
                    <div className="headerActions">
                        {user ? (
                            <div 
                                className="userProfile" 
                                onMouseEnter={handleProfileMouseEnter}
                                onMouseLeave={handleProfileMouseLeave}
                            >
                                <div className="userAvatar">{getUserInitials()}</div>
                                
                                {/* Profile Dropdown - Only for logged in users */}
                                {isOpen && (
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
                                        <div className="dropdownItem clickable" onClick={handleSettingsClick}>
                                            <i className="fa-solid fa-gear"></i>
                                            <span>Settings</span>
                                        </div>
                                        <div className="dropdownSeparator"></div>
                                        <div className="dropdownItem clickable" onClick={handleLogoutClick}>
                                            <i className="fa-solid fa-arrow-right-from-bracket"></i>
                                            <span>Log out</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button className="loginBtn" onClick={() => navigate('/login')}>
                                Log in
                            </button>
                        )}
                    </div>
                </div>
            </div>
            
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

            {/* Settings Full Page */}
            {showSettingsModal && (
                <div className="settings-page">
                    <div className="settings-page-header">
                        <h2 className="settings-page-title">
                            <i className="fa-solid fa-gear"></i>
                            Settings
                        </h2>
                        <button 
                            className="settings-page-close" 
                            onClick={() => setShowSettingsModal(false)}
                            aria-label="Close Settings"
                        >
                            <i className="fa-solid fa-times"></i>
                            Close
                        </button>
                    </div>
                    <div className="settings-page-body">
                            <div className="settings-sidebar">
                                <div 
                                    className={`settings-tab ${activeSettingsTab === 'general' ? 'active' : ''}`}
                                    onClick={() => setActiveSettingsTab('general')}
                                >
                                    <i className="fa-solid fa-sliders"></i>
                                    <span>General</span>
                                </div>
                                <div 
                                    className={`settings-tab ${activeSettingsTab === 'faqs' ? 'active' : ''}`}
                                    onClick={() => setActiveSettingsTab('faqs')}
                                >
                                    <i className="fa-solid fa-circle-question"></i>
                                    <span>FAQs</span>
                                </div>
                                <div 
                                    className={`settings-tab ${activeSettingsTab === 'help' ? 'active' : ''}`}
                                    onClick={() => setActiveSettingsTab('help')}
                                >
                                    <i className="fa-solid fa-life-ring"></i>
                                    <span>Contact Us</span>
                                </div>
                                <div 
                                    className={`settings-tab ${activeSettingsTab === 'security' ? 'active' : ''}`}
                                    onClick={() => setActiveSettingsTab('security')}
                                >
                                    <i className="fa-solid fa-shield-halved"></i>
                                    <span>Security</span>
                                </div>
                            </div>
                            <div className="settings-content">
                                {activeSettingsTab === 'general' && (
                                    <div>
                                        <h3 className="settings-section-title">General Settings</h3>
                                        <p className="settings-section-description">
                                            Customize your SvaraGPT experience with these settings.
                                        </p>
                                        <div className="settings-item">
                                            <div className="settings-item-header">
                                                <div className="settings-item-label">
                                                    <i className="fa-solid fa-palette"></i>
                                                    Theme
                                                </div>
                                                <div className="settings-toggle-group">
                                                    <button className="settings-toggle-btn active">
                                                        <i className="fa-solid fa-moon"></i> Dark
                                                    </button>
                                                    <button className="settings-toggle-btn" disabled>
                                                        <i className="fa-solid fa-sun"></i> Light
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="settings-item-description">
                                                Currently using dark theme with Claude-inspired orange accents. Light mode coming soon!
                                            </div>
                                        </div>
                                        <div className="settings-item">
                                            <div className="settings-item-header">
                                                <div className="settings-item-label">
                                                    <i className="fa-solid fa-download"></i>
                                                    Export Chat Data
                                                </div>
                                                <button className="settings-action-btn" onClick={() => setShowExportModal(true)}>
                                                    <i className="fa-solid fa-file-export"></i> Export
                                                </button>
                                            </div>
                                            <div className="settings-item-description">
                                                Download all your chat history and projects in multiple formats (JSON, CSV, TXT).
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {activeSettingsTab === 'faqs' && (
                                    <div>
                                        <h3 className="settings-section-title">Frequently Asked Questions</h3>
                                        <p className="settings-section-description">
                                            Find answers to common questions about SvaraGPT.
                                        </p>
                                        <div className="faq-item">
                                            <div className="faq-question" onClick={() => toggleFAQ(0)}>
                                                <div className="faq-question-text">
                                                    <i className="fa-solid fa-circle-question"></i>
                                                    What is SvaraGPT?
                                                </div>
                                                <i className={`fa-solid fa-chevron-${expandedFAQ === 0 ? 'up' : 'down'} faq-toggle-icon`}></i>
                                            </div>
                                            {expandedFAQ === 0 && (
                                                <div className="faq-answer">
                                                    SvaraGPT is an AI-powered chat assistant that helps you with various tasks, from answering questions to creative writing. It uses advanced language models to provide intelligent and contextual responses.
                                                </div>
                                            )}
                                        </div>
                                        <div className="faq-item">
                                            <div className="faq-question" onClick={() => toggleFAQ(1)}>
                                                <div className="faq-question-text">
                                                    <i className="fa-solid fa-folder-tree"></i>
                                                    How do I use projects to organize my chats?
                                                </div>
                                                <i className={`fa-solid fa-chevron-${expandedFAQ === 1 ? 'up' : 'down'} faq-toggle-icon`}></i>
                                            </div>
                                            {expandedFAQ === 1 && (
                                                <div className="faq-answer">
                                                    Projects help you organize related chats together. Click the "+" button in the sidebar to create a new project, then drag and drop chats into it or use the three-dot menu on any chat to move it to a project.
                                                </div>
                                            )}
                                        </div>
                                        <div className="faq-item">
                                            <div className="faq-question" onClick={() => toggleFAQ(2)}>
                                                <div className="faq-question-text">
                                                    <i className="fa-solid fa-shield-halved"></i>
                                                    Is my data private and secure?
                                                </div>
                                                <i className={`fa-solid fa-chevron-${expandedFAQ === 2 ? 'up' : 'down'} faq-toggle-icon`}></i>
                                            </div>
                                            {expandedFAQ === 2 && (
                                                <div className="faq-answer">
                                                    Yes! Your conversations are stored securely and are only accessible to you. We use industry-standard encryption and never share your data with third parties. You can delete your chat history at any time.
                                                </div>
                                            )}
                                        </div>
                                        <div className="faq-item">
                                            <div className="faq-question" onClick={() => toggleFAQ(3)}>
                                                <div className="faq-question-text">
                                                    <i className="fa-solid fa-code"></i>
                                                    What AI models does SvaraGPT use?
                                                </div>
                                                <i className={`fa-solid fa-chevron-${expandedFAQ === 3 ? 'up' : 'down'} faq-toggle-icon`}></i>
                                            </div>
                                            {expandedFAQ === 3 && (
                                                <div className="faq-answer">
                                                    SvaraGPT uses multiple AI providers including Google Gemini and GitHub Models to ensure reliable and high-quality responses. The system automatically selects the best available model for your query.
                                                </div>
                                            )}
                                        </div>
                                        <div className="faq-item">
                                            <div className="faq-question" onClick={() => toggleFAQ(4)}>
                                                <div className="faq-question-text">
                                                    <i className="fa-solid fa-comments"></i>
                                                    Can I use SvaraGPT for free?
                                                </div>
                                                <i className={`fa-solid fa-chevron-${expandedFAQ === 4 ? 'up' : 'down'} faq-toggle-icon`}></i>
                                            </div>
                                            {expandedFAQ === 4 && (
                                                <div className="faq-answer">
                                                    Yes! SvaraGPT offers a free tier with generous usage limits. Guest users can try it out with limited messages, and registered users get more features and higher limits.
                                                </div>
                                            )}
                                        </div>
                                        <div className="faq-item">
                                            <div className="faq-question" onClick={() => toggleFAQ(5)}>
                                                <div className="faq-question-text">
                                                    <i className="fa-solid fa-trash"></i>
                                                    How do I delete my chat history?
                                                </div>
                                                <i className={`fa-solid fa-chevron-${expandedFAQ === 5 ? 'up' : 'down'} faq-toggle-icon`}></i>
                                            </div>
                                            {expandedFAQ === 5 && (
                                                <div className="faq-answer">
                                                    You can delete individual chats by clicking the three-dot menu next to any chat in the sidebar and selecting "Delete". To delete all your data, you can export it first and then contact support.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {activeSettingsTab === 'help' && (
                                    <div>
                                        <h3 className="settings-section-title">Contact Us</h3>
                                        <p className="settings-section-description">
                                            Have a question or feedback? We'd love to hear from you!
                                        </p>
                                        
                                        <div className="contact-direct-email">
                                            <i className="fa-solid fa-envelope"></i>
                                            <span>Or email us directly at: </span>
                                            <a href="mailto:gjain0229@gmail.com">gjain0229@gmail.com</a>
                                        </div>
                                        
                                        {contactFormStatus.message && (
                                            <div className={`contact-form-status ${contactFormStatus.type}`}>
                                                <i className={`fa-solid ${contactFormStatus.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                                                {contactFormStatus.message}
                                            </div>
                                        )}
                                        
                                        <form className="contact-form" onSubmit={handleContactFormSubmit}>
                                            <div className="contact-form-row">
                                                <div className="contact-form-group">
                                                    <label htmlFor="contact-name">
                                                        <i className="fa-solid fa-user"></i> Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id="contact-name"
                                                        name="name"
                                                        value={contactForm.name}
                                                        onChange={handleContactFormChange}
                                                        placeholder="Your name"
                                                        required
                                                    />
                                                </div>
                                                <div className="contact-form-group">
                                                    <label htmlFor="contact-email">
                                                        <i className="fa-solid fa-envelope"></i> Email
                                                    </label>
                                                    <input
                                                        type="email"
                                                        id="contact-email"
                                                        name="email"
                                                        value={contactForm.email}
                                                        onChange={handleContactFormChange}
                                                        placeholder="your.email@example.com"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="contact-form-group">
                                                <label htmlFor="contact-category">
                                                    <i className="fa-solid fa-tag"></i> Category
                                                </label>
                                                <select
                                                    id="contact-category"
                                                    name="category"
                                                    value={contactForm.category}
                                                    onChange={handleContactFormChange}
                                                    required
                                                >
                                                    <option value="Bug Report">Bug Report</option>
                                                    <option value="Feature Request">Feature Request</option>
                                                    <option value="Question">Question</option>
                                                    <option value="Feedback">Feedback</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <div className="contact-form-group">
                                                <label htmlFor="contact-message">
                                                    <i className="fa-solid fa-message"></i> Message
                                                </label>
                                                <textarea
                                                    id="contact-message"
                                                    name="message"
                                                    value={contactForm.message}
                                                    onChange={handleContactFormChange}
                                                    placeholder="Tell us more about your inquiry..."
                                                    rows="6"
                                                    required
                                                ></textarea>
                                            </div>
                                            <button 
                                                type="submit" 
                                                className="contact-form-submit"
                                                disabled={isSubmittingContact}
                                            >
                                                {isSubmittingContact ? (
                                                    <>
                                                        <i className="fa-solid fa-spinner fa-spin"></i>
                                                        Sending...
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fa-solid fa-paper-plane"></i>
                                                        Send Message
                                                    </>
                                                )}
                                            </button>
                                        </form>
                                    </div>
                                )}
                                {activeSettingsTab === 'security' && (
                                    <div>
                                        <h3 className="settings-section-title">Security Settings</h3>
                                        <p className="settings-section-description">
                                            Manage your account security and privacy settings.
                                        </p>
                                        
                                        {user?.provider === 'local' && (
                                            <div className="settings-item">
                                                <div className="settings-item-header">
                                                    <div className="settings-item-label">
                                                        <i className="fa-solid fa-key"></i>
                                                        Password
                                                    </div>
                                                    <button className="settings-action-btn">
                                                        <i className="fa-solid fa-pen"></i> Change
                                                    </button>
                                                </div>
                                                <div className="settings-item-description">
                                                    Change your password to keep your account secure. We recommend using a strong, unique password.
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="settings-item">
                                            <div className="settings-item-header">
                                                <div className="settings-item-label">
                                                    <i className="fa-solid fa-shield-halved"></i>
                                                    Two-Factor Authentication
                                                    {twoFactorEnabled && <span className="settings-badge enabled">Enabled</span>}
                                                </div>
                                                {twoFactorEnabled ? (
                                                    <button className="settings-action-btn danger" onClick={handleDisable2FA}>
                                                        <i className="fa-solid fa-toggle-off"></i> Disable
                                                    </button>
                                                ) : (
                                                    <button className="settings-action-btn" onClick={handleEnable2FA}>
                                                        <i className="fa-solid fa-shield-halved"></i> Enable
                                                    </button>
                                                )}
                                            </div>
                                            <div className="settings-item-description">
                                                {twoFactorEnabled 
                                                    ? 'Your account is protected with Two-Factor Authentication. You will need to enter a code from your authenticator app when logging in.'
                                                    : 'Add an extra layer of security to your account with 2FA. You will need an authenticator app like Google Authenticator or Authy.'}
                                            </div>
                                        </div>
                                        
                                        <div className="settings-item">
                                            <div className="settings-item-header">
                                                <div className="settings-item-label">
                                                    <i className="fa-solid fa-devices"></i>
                                                    Active Sessions
                                                </div>
                                                <button className="settings-action-btn" onClick={fetchActiveSessions}>
                                                    <i className="fa-solid fa-eye"></i> View All
                                                </button>
                                            </div>
                                            <div className="settings-item-description">
                                                View and manage devices where you're currently logged in. You can log out from specific devices for security.
                                            </div>
                                        </div>
                                        
                                        <div className="settings-item">
                                            <div className="settings-item-label">
                                                <i className="fa-solid fa-user-shield"></i>
                                                Data Privacy
                                            </div>
                                            <div className="settings-item-description">
                                                Your conversations are encrypted and stored securely. We never share your data with third parties. You have full control over your data and can delete it at any time.
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
            )}

            {/* Export Format Selection Modal */}
            {showExportModal && (
                <div className="export-modal-backdrop" onClick={() => setShowExportModal(false)}>
                    <div className="export-modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="export-modal-header">
                            <h2 className="export-modal-title">
                                <i className="fa-solid fa-file-export"></i>
                                Export Chat Data
                            </h2>
                            <button className="export-modal-close" onClick={() => setShowExportModal(false)}>
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>
                        <p className="export-modal-description">
                            Choose a format to export your chat history, projects, and threads.
                        </p>
                        <div className="export-format-options">
                            <button 
                                className="export-format-btn"
                                onClick={() => handleExportChatData('json')}
                            >
                                <div className="export-format-icon">
                                    <i className="fa-solid fa-file-code"></i>
                                </div>
                                <div className="export-format-info">
                                    <h3>JSON</h3>
                                    <p>Structured data format, best for developers</p>
                                </div>
                            </button>
                            <button 
                                className="export-format-btn"
                                onClick={() => handleExportChatData('csv')}
                            >
                                <div className="export-format-icon">
                                    <i className="fa-solid fa-file-csv"></i>
                                </div>
                                <div className="export-format-info">
                                    <h3>CSV</h3>
                                    <p>Spreadsheet format, open in Excel or Google Sheets</p>
                                </div>
                            </button>
                            <button 
                                className="export-format-btn"
                                onClick={() => handleExportChatData('txt')}
                            >
                                <div className="export-format-icon">
                                    <i className="fa-solid fa-file-lines"></i>
                                </div>
                                <div className="export-format-info">
                                    <h3>TXT</h3>
                                    <p>Plain text format, easy to read and share</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Logout Confirmation Modal */}
            {showLogoutModal && (
                <div className="logout-modal-backdrop" onClick={cancelLogout}>
                    <div className="logout-modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="logout-modal-icon">
                            <i className="fa-solid fa-arrow-right-from-bracket"></i>
                        </div>
                        <h2 className="logout-modal-title">Log Out?</h2>
                        <p className="logout-modal-message">
                            Are you sure you want to log out? You'll need to sign in again to access your chats and projects.
                        </p>
                        <div className="logout-modal-actions">
                            <button 
                                className="logout-modal-btn logout-modal-btn-cancel"
                                onClick={cancelLogout}
                            >
                                Cancel
                            </button>
                            <button 
                                className="logout-modal-btn logout-modal-btn-confirm"
                                onClick={confirmLogout}
                            >
                                Log Out
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Two-Factor Authentication Modal */}
            {showTwoFactorModal && (
                <div className="twofa-modal-backdrop" onClick={() => setShowTwoFactorModal(false)}>
                    <div className="twofa-modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="twofa-modal-header">
                            <h2 className="twofa-modal-title">
                                <i className="fa-solid fa-shield-halved"></i>
                                Enable Two-Factor Authentication
                            </h2>
                            <button className="twofa-modal-close" onClick={() => setShowTwoFactorModal(false)}>
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>
                        
                        {twoFactorStep === 'verify' && (
                            <div className="twofa-modal-body">
                                <div className="twofa-step">
                                    <h3>Step 1: Scan QR Code</h3>
                                    <p>Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
                                    <div className="twofa-qr-code">
                                        {qrCode && <img src={qrCode} alt="QR Code" />}
                                    </div>
                                </div>
                                
                                <div className="twofa-step">
                                    <h3>Step 2: Enter Verification Code</h3>
                                    <p>Enter the 6-digit code from your authenticator app</p>
                                    <input
                                        type="text"
                                        className="twofa-code-input"
                                        placeholder="000000"
                                        maxLength="6"
                                        value={twoFactorCode}
                                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                                    />
                                </div>
                                
                                <div className="twofa-step">
                                    <h3>Step 3: Save Backup Codes</h3>
                                    <p>Save these backup codes in a safe place. You can use them if you lose access to your authenticator app.</p>
                                    <div className="twofa-backup-codes">
                                        {backupCodes.map((code, idx) => (
                                            <div key={idx} className="backup-code">{code}</div>
                                        ))}
                                    </div>
                                </div>
                                
                                <button 
                                    className="twofa-verify-btn"
                                    onClick={handleVerify2FA}
                                    disabled={twoFactorCode.length !== 6}
                                >
                                    <i className="fa-solid fa-check"></i>
                                    Verify and Enable
                                </button>
                            </div>
                        )}
                        
                        {twoFactorStep === 'success' && (
                            <div className="twofa-modal-body twofa-success">
                                <div className="twofa-success-icon">
                                    <i className="fa-solid fa-circle-check"></i>
                                </div>
                                <h3>Two-Factor Authentication Enabled!</h3>
                                <p>Your account is now protected with 2FA.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Active Sessions Modal */}
            {showActiveSessionsModal && (
                <div className="sessions-modal-backdrop" onClick={() => setShowActiveSessionsModal(false)}>
                    <div className="sessions-modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="sessions-modal-header">
                            <h2 className="sessions-modal-title">
                                <i className="fa-solid fa-devices"></i>
                                Active Sessions
                            </h2>
                            <button className="sessions-modal-close" onClick={() => setShowActiveSessionsModal(false)}>
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>
                        
                        <div className="sessions-modal-body">
                            <p className="sessions-description">
                                These are the devices currently logged into your account. If you see any unfamiliar devices, log them out immediately.
                            </p>
                            
                            <div className="sessions-list">
                                {activeSessions.length === 0 ? (
                                    <div className="sessions-empty">
                                        <i className="fa-solid fa-circle-info"></i>
                                        <p>No active sessions found</p>
                                    </div>
                                ) : (
                                    activeSessions.map((session) => (
                                        <div key={session.id} className="session-item">
                                            <div className="session-icon">
                                                <i className={`fa-solid fa-${session.device === 'mobile' ? 'mobile-screen' : 'desktop'}`}></i>
                                            </div>
                                            <div className="session-info">
                                                <h4>{session.browser || 'Unknown Browser'}</h4>
                                                <p className="session-location">
                                                    <i className="fa-solid fa-location-dot"></i>
                                                    {session.location || 'Unknown Location'}
                                                </p>
                                                <p className="session-time">
                                                    <i className="fa-solid fa-clock"></i>
                                                    Last active: {session.lastActive || 'Just now'}
                                                </p>
                                                {session.current && (
                                                    <span className="session-badge current">Current Session</span>
                                                )}
                                            </div>
                                            {!session.current && (
                                                <button 
                                                    className="session-logout-btn"
                                                    onClick={() => handleLogoutSession(session.id)}
                                                >
                                                    <i className="fa-solid fa-right-from-bracket"></i>
                                                    Log Out
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            {activeSessions.length > 1 && (
                                <button 
                                    className="sessions-logout-all-btn"
                                    onClick={handleLogoutAllSessions}
                                >
                                    <i className="fa-solid fa-right-from-bracket"></i>
                                    Log Out All Other Sessions
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ChatWindow;