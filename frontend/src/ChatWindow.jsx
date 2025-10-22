import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import { MyContext } from "./MyContext.jsx";
import { useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import {ScaleLoader} from "react-spinners";
import logo3 from "./assets/logo3.png";
import { apiUrl } from "./utils/apiConfig";

function ChatWindow() {
    // We'll provide these handler functions through context
    const [activeFeedback, setActiveFeedback] = useState({});
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareData, setShareData] = useState(null);
    
    const {
        prompt, setPrompt, reply, setReply, currThreadId, setPrevChats, setNewChat,
        currentProject, setCurrentProject, projects, setProjects, allThreads, setAllThreads, prevChats
    } = useContext(MyContext);
    const { user, logout, loading: authLoading, isInitialized } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
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
    const [showDisable2FAModal, setShowDisable2FAModal] = useState(false);
    const [disable2FACode, setDisable2FACode] = useState('');
    const [disable2FAError, setDisable2FAError] = useState('');
    const [isDisabling2FA, setIsDisabling2FA] = useState(false);
    const [disable2FASuccess, setDisable2FASuccess] = useState('');
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [copyToast, setCopyToast] = useState(false);
    const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
    const [viewedBackupCodes, setViewedBackupCodes] = useState([]);
    const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

    // Close dropdown when user state changes
    useEffect(() => {
        setIsOpen(false);
    }, [user]);

    const queueRef = useRef([]);
    const isProcessingRef = useRef(false);
    
    // Handler for copying user message
    const handleCopyMessage = (chat) => {
        if (chat && chat.content) {
            navigator.clipboard.writeText(chat.content)
                .then(() => {
                    console.log('Message copied to clipboard');
                })
                .catch(err => {
                    console.error('Failed to copy message: ', err);
                });
        }
    };

    // Handler for editing user message
    const handleEditMessage = (chat, content) => {
        setPrevChats(prev => prev.map(c => 
            c === chat ? { ...c, isEditing: true, pendingContent: content } : c
        ));
    };

    // Handler for confirming edit
    const handleConfirmEdit = (chat) => {
        if (!chat.pendingContent || chat.pendingContent.trim() === '') return;
        
        // Update the message locally
        setPrevChats(prev => prev.map(c => 
            c === chat ? { ...c, content: chat.pendingContent, isEditing: false, edited: true } : c
        ));
        
        // TODO: If needed, update the message on the server
    };

    // Handler for copying assistant message
    const handleCopyAssistant = (chat) => {
        if (chat && chat.content) {
            navigator.clipboard.writeText(chat.content)
                .then(() => {
                    console.log('Assistant message copied to clipboard');
                })
                .catch(err => {
                    console.error('Failed to copy assistant message: ', err);
                });
        }
    };

    // Handler for regenerating assistant response
    const handleRegenerate = (chat) => {
        // Find the user message that preceded this assistant message
        const chatIndex = prevChats.findIndex(c => c === chat);
        if (chatIndex > 0 && prevChats[chatIndex - 1].role === 'user') {
            const userMessage = prevChats[chatIndex - 1].content;
            
            // Remove this assistant message and all subsequent messages
            setPrevChats(prev => prev.slice(0, chatIndex));
            
            // Trigger a new response
            getReply(userMessage);
        }
    };

    // Handler for feedback (thumbs up/down)
    const handleFeedbackToggle = (chat, feedbackType) => {
        if (!chat.messageId) {
            // Generate a messageId if it doesn't exist
            const messageId = `msg_${Date.now()}`;
            setPrevChats(prev => prev.map(c => 
                c === chat ? { ...c, messageId } : c
            ));
            
            setActiveFeedback(prev => ({
                ...prev,
                [messageId]: prev[messageId] === feedbackType ? null : feedbackType
            }));
            
            // TODO: Send feedback to server
            console.log(`Feedback ${feedbackType} for message ${messageId}`);
        } else {
            setActiveFeedback(prev => ({
                ...prev,
                [chat.messageId]: prev[chat.messageId] === feedbackType ? null : feedbackType
            }));
            
            // TODO: Send feedback to server
            console.log(`Feedback ${feedbackType} for message ${chat.messageId}`);
        }
    };

    // Handler for sharing thread
    const shareThread = async (chat) => {
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
                fetch(apiUrl(`/api/projects/${currentProject}/chats`), {
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
                const usageResponse = await fetch(apiUrl("/api/guest-usage"), {
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
            const response = await fetch(apiUrl("/api/chat"), options);
            
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
        navigate('/settings/general');
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
        const userSafeProjects = (projects || []).map(p => ({
            name: p.name,
            chats: (p.chats || []).map(c => ({ title: c.title }))
        }));

        const projectIdToName = new Map((projects || []).map(p => [p.id, p.name]));
        const userSafeThreads = (allThreads || []).map(t => ({
            title: t.title,
            project: t.projectId ? (projectIdToName.get(t.projectId) || 'Project') : 'None'
        }));

        const userSafeCurrentChat = (prevChats || []).map(m => ({ role: m.role, content: m.content }));

        const exportData = {
            exportedAt: new Date().toISOString(),
            user: {
                name: user?.name || null,
                email: user?.email || null
            },
            projects: userSafeProjects,
            chats: userSafeThreads,
            currentConversation: userSafeCurrentChat
        };

        const dateStr = new Date().toISOString().split('T')[0];
        let dataBlob, fileName, mimeType;

        if (format === 'json') {
            const dataStr = JSON.stringify(exportData, null, 2);
            dataBlob = new Blob([dataStr], { type: 'application/json' });
            fileName = `svaragpt-export-${dateStr}.json`;
        } else if (format === 'csv') {
            // Convert to CSV format
            let csvContent = "Exported At," + exportData.exportedAt + "\n";
            csvContent += "User Name," + (exportData.user.name || 'N/A') + "\n";
            csvContent += "User Email," + (exportData.user.email || 'N/A') + "\n\n";
            
            csvContent += "Projects\n";
            csvContent += "Project Name,Chat Count\n";
            exportData.projects.forEach(project => {
                csvContent += `"${project.name}",${project.chats.length}\n`;
            });
            
            csvContent += "\nChats\n";
            csvContent += "Title,Project\n";
            exportData.chats.forEach(thread => {
                csvContent += `"${thread.title}","${thread.project}"\n`;
            });
            
            csvContent += "\nCurrent Conversation\n";
            csvContent += "Role,Content\n";
            exportData.currentConversation.forEach(chat => {
                const content = chat.content.replace(/"/g, '""').replace(/\n/g, ' ');
                csvContent += `"${chat.role}","${content}"\n`;
            });
            
            dataBlob = new Blob([csvContent], { type: 'text/csv' });
            fileName = `svaragpt-export-${dateStr}.csv`;
        } else if (format === 'txt') {
            // Convert to plain text format
            let txtContent = `SvaraGPT Data Export\n`;
            txtContent += `Exported At: ${exportData.exportedAt}\n`;
            txtContent += `User: ${exportData.user.name || 'N/A'} (${exportData.user.email || 'N/A'})\n\n`;
            
            txtContent += `=== PROJECTS (${exportData.projects.length}) ===\n`;
            exportData.projects.forEach((project, idx) => {
                txtContent += `${idx + 1}. ${project.name} - ${project.chats.length} chats\n`;
            });
            
            txtContent += `\n=== CHATS (${exportData.chats.length}) ===\n`;
            exportData.chats.forEach((thread, idx) => {
                txtContent += `${idx + 1}. ${thread.title}\n`;
                txtContent += `   Project: ${thread.project}\n\n`;
            });
            
            txtContent += `\n=== CURRENT CONVERSATION (${exportData.currentConversation.length} messages) ===\n`;
            exportData.currentConversation.forEach((chat, idx) => {
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
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const response = await fetch(apiUrl('/api/contact'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(contactForm),
                signal: controller.signal
            });
            clearTimeout(timeout);

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
            const response = await fetch(apiUrl('/auth/2fa/setup'), {
                method: 'POST',
                credentials: 'include',
            });
            
            const data = await response.json();
            
            if (response.ok) {
                setQrCode(data.qrCode);
                setBackupCodes([]); // Clear any previous backup codes
                setTwoFactorStep('verify');
                setShowTwoFactorModal(true);
            }
        } catch (error) {
            console.error('Error setting up 2FA:', error);
        }
    };

    const handleVerify2FA = async () => {
        try {
            const response = await fetch(apiUrl('/auth/2fa/verify'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token: twoFactorCode })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Store the backup codes from the response
                setBackupCodes(data.backupCodes || []);
                setTwoFactorEnabled(true);
                setTwoFactorStep('codes'); // New step to show backup codes
                // Don't auto-close, let user see and save backup codes
            } else {
                alert(data.error || 'Invalid code. Please try again.');
            }
        } catch (error) {
            console.error('Error verifying 2FA:', error);
            alert('Error verifying 2FA. Please try again.');
        }
    };

    const handleComplete2FASetup = () => {
        setShowTwoFactorModal(false);
        setTwoFactorStep('setup');
        setTwoFactorCode('');
        setBackupCodes([]);
    };

    // View existing backup codes
    const handleViewBackupCodes = async () => {
        try {
            const response = await fetch(apiUrl('/auth/2fa/backup-codes'), {
                credentials: 'include',
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                setViewedBackupCodes(data.backupCodes || []);
                setShowBackupCodesModal(true);
                setShowRegenerateConfirm(false);
            } else {
                alert(data.error || 'Failed to retrieve backup codes');
            }
        } catch (error) {
            console.error('Error fetching backup codes:', error);
            alert('Failed to retrieve backup codes');
        }
    };

    // Regenerate backup codes
    const handleRegenerateBackupCodes = async () => {
        try {
            const response = await fetch(apiUrl('/auth/2fa/regenerate-backup-codes'), {
                method: 'POST',
                credentials: 'include',
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                setViewedBackupCodes(data.backupCodes || []);
                setShowBackupCodesModal(true);
                setShowRegenerateConfirm(false);
                setCopyToast(false);
            } else {
                alert(data.error || 'Failed to regenerate backup codes');
            }
        } catch (error) {
            console.error('Error regenerating backup codes:', error);
            alert('Failed to regenerate backup codes');
        }
    };

    const handleDisable2FA = () => {
        setShowDisable2FAModal(true);
        setDisable2FACode('');
        setDisable2FAError('');
    };

    const confirmDisable2FA = async () => {
        if (!disable2FACode || disable2FACode.length !== 6) {
            setDisable2FAError('Please enter a valid 6-digit code');
            return;
        }

        setIsDisabling2FA(true);
        setDisable2FAError('');
        
        try {
            const response = await fetch(apiUrl('/auth/2fa/disable'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token: disable2FACode })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                setTwoFactorEnabled(false);
                setDisable2FASuccess('Two-Factor Authentication has been disabled successfully.');
                setDisable2FACode('');
                setDisable2FAError('');
                
                // Auto-close modal after 2 seconds
                setTimeout(() => {
                    setShowDisable2FAModal(false);
                    setDisable2FASuccess('');
                }, 2000);
            } else {
                setDisable2FAError(data.message || 'Invalid verification code');
            }
        } catch (error) {
            console.error('Error disabling 2FA:', error);
            setDisable2FAError('Failed to disable 2FA. Please try again.');
        } finally {
            setIsDisabling2FA(false);
        }
    };

    // Change Password Functions
    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        const { currentPassword, newPassword, confirmPassword } = passwordForm;

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError('All fields are required');
            return;
        }

        if (newPassword.length < 8) {
            setPasswordError('New password must be at least 8 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }

        if (newPassword === currentPassword) {
            setPasswordError('New password must be different from current password');
            return;
        }

        setIsChangingPassword(true);

        try {
            const response = await fetch(apiUrl('/auth/change-password'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();

            if (response.ok) {
                setPasswordSuccess('Password changed successfully!');
                setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setTimeout(() => {
                    setShowChangePasswordModal(false);
                    setPasswordSuccess('');
                }, 2000);
            } else {
                setPasswordError(data.error || 'Failed to change password');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            setPasswordError('Failed to change password. Please try again.');
        } finally {
            setIsChangingPassword(false);
        }
    };

    // Active Sessions Functions
    const fetchActiveSessions = async () => {
        try {
            const response = await fetch(apiUrl('/auth/sessions'), {
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
        if (!confirm('Are you sure you want to log out this session?')) return;
        
        try {
            const response = await fetch(apiUrl(`/auth/sessions/${sessionId}`), {
                method: 'DELETE',
                credentials: 'include',
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
                alert('Session logged out successfully');
            } else {
                alert(data.message || 'Failed to logout session');
            }
        } catch (error) {
            console.error('Error logging out session:', error);
            alert('Failed to logout session. Please try again.');
        }
    };

    const handleLogoutAllSessions = async () => {
        if (!confirm('This will log you out from all other devices except this one. Continue?')) return;
        
        try {
            const response = await fetch(apiUrl('/auth/sessions/all'), {
                method: 'DELETE',
                credentials: 'include',
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Refresh the sessions list
                await fetchActiveSessions();
                alert('All other sessions logged out successfully');
            } else {
                alert(data.message || 'Failed to logout all sessions');
            }
        } catch (error) {
            console.error('Error logging out all sessions:', error);
            alert('Failed to logout all sessions. Please try again.');
        }
    };

    // Fetch 2FA status and sessions on mount
    useEffect(() => {
        const fetch2FAStatus = async () => {
            try {
                const response = await fetch(apiUrl('/auth/2fa/status'), {
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

    // Open/close settings modal based on route and sync active tab
    useEffect(() => {
        const path = location.pathname || '';
        if (path.startsWith('/settings')) {
            setShowSettingsModal(true);
            if (path.includes('/settings/faq')) {
                setActiveSettingsTab('faqs');
            } else if (path.includes('/settings/contact')) {
                setActiveSettingsTab('help');
            } else if (path.includes('/settings/security')) {
                setActiveSettingsTab('security');
            } else {
                setActiveSettingsTab('general');
            }
        } else {
            setShowSettingsModal(false);
        }
    }, [location.pathname]);

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
                            !authLoading && isInitialized && (
                                <button className="loginBtn" onClick={() => navigate('/login')}>
                                    Log in
                                </button>
                            )
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
                            onClick={() => { setShowSettingsModal(false); navigate('/chats'); }}
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
                                    onClick={() => navigate('/settings/general')}
                                >
                                    <i className="fa-solid fa-sliders"></i>
                                    <span>General</span>
                                </div>
                                <div 
                                    className={`settings-tab ${activeSettingsTab === 'faqs' ? 'active' : ''}`}
                                    onClick={() => navigate('/settings/faq')}
                                >
                                    <i className="fa-solid fa-circle-question"></i>
                                    <span>FAQs</span>
                                </div>
                                <div 
                                    className={`settings-tab ${activeSettingsTab === 'help' ? 'active' : ''}`}
                                    onClick={() => navigate('/settings/contact')}
                                >
                                    <i className="fa-solid fa-life-ring"></i>
                                    <span>Contact Us</span>
                                </div>
                                <div 
                                    className={`settings-tab ${activeSettingsTab === 'security' ? 'active' : ''}`}
                                    onClick={() => navigate('/settings/security')}
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
                                                    <button className="settings-action-btn" onClick={() => setShowChangePasswordModal(true)}>
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
                                            
                                            {twoFactorEnabled && (
                                                <div className="settings-backup-codes-section">
                                                    <div className="settings-item-label">
                                                        <i className="fa-solid fa-key"></i>
                                                        Backup Codes
                                                    </div>
                                                    <div className="settings-item-description" style={{marginBottom: '12px'}}>
                                                        Backup codes let you access your account if you lose your authenticator device. Each code can only be used once.
                                                    </div>
                                                    <div className="settings-backup-actions">
                                                        <button className="settings-action-btn" onClick={handleViewBackupCodes}>
                                                            <i className="fa-solid fa-eye"></i> View Backup Codes
                                                        </button>
                                                        <button className="settings-action-btn" onClick={() => setShowRegenerateConfirm(true)}>
                                                            <i className="fa-solid fa-rotate"></i> Regenerate Codes
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="settings-item">
                                            <div className="settings-item-header">
                                                <div className="settings-item-label">
                                                    <i className="fa-solid fa-devices"></i>
                                                    Active Sessions
                                                </div>
                                                <button className="settings-action-btn" onClick={() => navigate('/settings/sessions')}>
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
                                        autoFocus
                                    />
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
                        
                        {twoFactorStep === 'codes' && (
                            <div className="twofa-modal-body">
                                <div className="twofa-success-icon">
                                    <i className="fa-solid fa-circle-check"></i>
                                </div>
                                <h3>Two-Factor Authentication Enabled!</h3>
                                <p className="twofa-success-text">Your account is now protected with 2FA.</p>
                                
                                <div className="twofa-step">
                                    <h3>Save Your Backup Codes</h3>
                                    <p className="twofa-warning-text">
                                        <i className="fa-solid fa-triangle-exclamation"></i>
                                        Save these backup codes in a secure place. Each code can only be used once.
                                    </p>
                                    <div className="twofa-backup-codes">
                                        {backupCodes && backupCodes.length > 0 ? (
                                            backupCodes.map((code, idx) => (
                                                <div key={idx} className="backup-code">
                                                    <i className="fa-solid fa-key"></i> {code}
                                                </div>
                                            ))
                                        ) : (
                                            <p className="no-codes">No backup codes available</p>
                                        )}
                                    </div>
                                    <div className="twofa-codes-actions">
                                        <button 
                                            className="twofa-copy-btn"
                                            onClick={() => {
                                                const codesText = backupCodes.join('\n');
                                                navigator.clipboard.writeText(codesText).then(() => {
                                                    setCopyToast(true);
                                                    setTimeout(() => setCopyToast(false), 2000);
                                                });
                                            }}
                                            disabled={!backupCodes || backupCodes.length === 0}
                                        >
                                            <i className="fa-solid fa-copy"></i>
                                            Copy All Codes
                                        </button>
                                        <button 
                                            className="twofa-download-btn"
                                            onClick={() => {
                                                const codesText = backupCodes.join('\n');
                                                const blob = new Blob(
                                                    [`SvaraGPT 2FA Backup Codes

Generated: ${new Date().toLocaleString()}

${codesText}

Keep these codes safe. Each code can only be used once.`], 
                                                    { type: 'text/plain' }
                                                );
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `svaragpt-backup-codes-${Date.now()}.txt`;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                            disabled={!backupCodes || backupCodes.length === 0}
                                        >
                                            <i className="fa-solid fa-download"></i>
                                            Download Codes
                                        </button>
                                    </div>
                                </div>
                                
                                <button 
                                    className="twofa-done-btn"
                                    onClick={handleComplete2FASetup}
                                >
                                    <i className="fa-solid fa-check"></i>
                                    Done
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

            {/* Disable 2FA Modal */}
            {showDisable2FAModal && (
                <div className="twofa-modal-backdrop" onClick={() => setShowDisable2FAModal(false)}>
                    <div className="twofa-modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="twofa-modal-header">
                            <h2 className="twofa-modal-title">
                                <i className="fa-solid fa-shield-xmark"></i>
                                Disable Two-Factor Authentication
                            </h2>
                            <button className="twofa-modal-close" onClick={() => setShowDisable2FAModal(false)}>
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>
                        
                        <div className="twofa-modal-body">
                            <div className="twofa-warning">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                                <p>Disabling 2FA will make your account less secure. You will only need your password to log in.</p>
                            </div>
                            
                            {disable2FASuccess && (
                                <div className="twofa-success-message">
                                    <i className="fa-solid fa-circle-check"></i>
                                    {disable2FASuccess}
                                </div>
                            )}
                            
                            <div className="twofa-step">
                                <h3>Enter Verification Code</h3>
                                <p>Enter the 6-digit code from your authenticator app or use a backup code to confirm.</p>
                                
                                {disable2FAError && (
                                    <div className="twofa-error">
                                        <i className="fa-solid fa-circle-exclamation"></i>
                                        {disable2FAError}
                                    </div>
                                )}
                                
                                <div className="twofa-code-inputs">
                                    <input
                                        type="text"
                                        className="twofa-code-input"
                                        value={disable2FACode}
                                        onChange={(e) => setDisable2FACode(e.target.value.replace(/[^0-9A-Za-z]/g, '').slice(0, 8))}
                                        placeholder="Enter code"
                                        maxLength={8}
                                        autoFocus
                                    />
                                </div>
                            </div>
                            
                            <div className="twofa-modal-actions">
                                <button 
                                    className="twofa-cancel-btn"
                                    onClick={() => setShowDisable2FAModal(false)}
                                    disabled={isDisabling2FA}
                                >
                                    Cancel
                                </button>
                                <button 
                                    className="twofa-disable-btn"
                                    onClick={confirmDisable2FA}
                                    disabled={!disable2FACode || isDisabling2FA}
                                >
                                    {isDisabling2FA ? (
                                        <>
                                            <i className="fa-solid fa-spinner fa-spin"></i>
                                            Disabling...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-toggle-off"></i>
                                            Disable 2FA
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Password Modal */}
            {showChangePasswordModal && (
                <div className="twofa-modal-backdrop" onClick={() => setShowChangePasswordModal(false)}>
                    <div className="twofa-modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="twofa-modal-header">
                            <h2 className="twofa-modal-title">
                                <i className="fa-solid fa-key"></i>
                                Change Password
                            </h2>
                            <button className="twofa-modal-close" onClick={() => setShowChangePasswordModal(false)}>
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>
                        
                        <div className="twofa-modal-body">
                            <form onSubmit={handleChangePassword}>
                                {passwordError && (
                                    <div className="twofa-error">
                                        <i className="fa-solid fa-circle-exclamation"></i>
                                        {passwordError}
                                    </div>
                                )}
                                
                                {passwordSuccess && (
                                    <div className="twofa-success-message">
                                        <i className="fa-solid fa-circle-check"></i>
                                        {passwordSuccess}
                                    </div>
                                )}
                                
                                <div className="password-form-group">
                                    <label htmlFor="currentPassword">Current Password</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showCurrentPassword ? "text" : "password"}
                                            id="currentPassword"
                                            value={passwordForm.currentPassword}
                                            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                            placeholder="Enter your current password"
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="password-toggle-btn"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        >
                                            <i className={`fa-solid fa-eye${showCurrentPassword ? '-slash' : ''}`}></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="password-form-group">
                                    <label htmlFor="newPassword">New Password</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showNewPassword ? "text" : "password"}
                                            id="newPassword"
                                            value={passwordForm.newPassword}
                                            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                            placeholder="Enter new password (min 8 characters)"
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="password-toggle-btn"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                        >
                                            <i className={`fa-solid fa-eye${showNewPassword ? '-slash' : ''}`}></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="password-form-group">
                                    <label htmlFor="confirmPassword">Confirm New Password</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showConfirmPassword ? "text" : "password"}
                                            id="confirmPassword"
                                            value={passwordForm.confirmPassword}
                                            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                            placeholder="Confirm your new password"
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="password-toggle-btn"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                            <i className={`fa-solid fa-eye${showConfirmPassword ? '-slash' : ''}`}></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="twofa-modal-actions">
                                    <button 
                                        type="button"
                                        className="twofa-cancel-btn"
                                        onClick={() => {
                                            setShowChangePasswordModal(false);
                                            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                            setPasswordError('');
                                            setPasswordSuccess('');
                                        }}
                                        disabled={isChangingPassword}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        className="twofa-verify-btn"
                                        disabled={isChangingPassword}
                                    >
                                        {isChangingPassword ? (
                                            <>
                                                <i className="fa-solid fa-spinner fa-spin"></i>
                                                Changing...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fa-solid fa-check"></i>
                                                Change Password
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* View Backup Codes Modal */}
            {showBackupCodesModal && (
                <div className="twofa-modal-backdrop" onClick={() => setShowBackupCodesModal(false)}>
                    <div className="twofa-modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="twofa-modal-header">
                            <h2 className="twofa-modal-title">
                                <i className="fa-solid fa-shield-halved"></i>
                                Backup Codes
                            </h2>
                            <button className="twofa-modal-close" onClick={() => setShowBackupCodesModal(false)}>
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>
                        
                        <div className="twofa-modal-body">
                            <div className="twofa-step">
                                <p className="twofa-warning-text">
                                    <i className="fa-solid fa-triangle-exclamation"></i>
                                    Save these backup codes in a secure place. Each code can only be used once.
                                </p>
                                <p className="codes-remaining">
                                    <strong>{viewedBackupCodes.length}</strong> code(s) remaining
                                </p>
                                <div className="twofa-backup-codes">
                                    {viewedBackupCodes && viewedBackupCodes.length > 0 ? (
                                        viewedBackupCodes.map((code, idx) => (
                                            <div key={idx} className="backup-code">
                                                <i className="fa-solid fa-key"></i> {code}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="no-codes">No backup codes available. Please regenerate new codes.</p>
                                    )}
                                </div>
                                <div className="twofa-codes-actions">
                                    <button 
                                        className="twofa-copy-btn"
                                        onClick={() => {
                                            const codesText = viewedBackupCodes.join('\n');
                                            navigator.clipboard.writeText(codesText).then(() => {
                                                setCopyToast(true);
                                                setTimeout(() => setCopyToast(false), 2000);
                                            });
                                        }}
                                        disabled={!viewedBackupCodes || viewedBackupCodes.length === 0}
                                    >
                                        <i className="fa-solid fa-copy"></i>
                                        Copy All Codes
                                    </button>
                                    <button 
                                        className="twofa-download-btn"
                                        onClick={() => {
                                            const codesText = viewedBackupCodes.join('\n');
                                            const blob = new Blob(
                                                [`SvaraGPT 2FA Backup Codes

Generated: ${new Date().toLocaleString()}

${codesText}

Keep these codes safe. Each code can only be used once.`], 
                                                { type: 'text/plain' }
                                            );
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `svaragpt-backup-codes-${Date.now()}.txt`;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        }}
                                        disabled={!viewedBackupCodes || viewedBackupCodes.length === 0}
                                    >
                                        <i className="fa-solid fa-download"></i>
                                        Download Codes
                                    </button>
                                </div>
                            </div>
                            
                            <button 
                                className="twofa-done-btn"
                                onClick={() => setShowBackupCodesModal(false)}
                            >
                                <i className="fa-solid fa-times"></i>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Regenerate Backup Codes Confirmation Modal */}
            {showRegenerateConfirm && (
                <div className="twofa-modal-backdrop" onClick={() => setShowRegenerateConfirm(false)}>
                    <div className="twofa-modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="twofa-modal-header">
                            <h2 className="twofa-modal-title">
                                <i className="fa-solid fa-rotate"></i>
                                Regenerate Backup Codes
                            </h2>
                            <button className="twofa-modal-close" onClick={() => setShowRegenerateConfirm(false)}>
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>
                        
                        <div className="twofa-modal-body">
                            <div className="twofa-warning">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                                <p>This will invalidate all your existing backup codes. Any unused codes will no longer work. Are you sure you want to continue?</p>
                            </div>
                            
                            <div className="twofa-modal-actions">
                                <button 
                                    className="twofa-cancel-btn"
                                    onClick={() => setShowRegenerateConfirm(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    className="twofa-verify-btn"
                                    onClick={handleRegenerateBackupCodes}
                                >
                                    <i className="fa-solid fa-rotate"></i>
                                    Yes, Regenerate
                                </button>
                            </div>
                        </div>
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
                            
                            <div className="sessions-table-container">
                                {activeSessions.length === 0 ? (
                                    <div className="sessions-empty">
                                        <i className="fa-solid fa-circle-info"></i>
                                        <p>No active sessions found</p>
                                    </div>
                                ) : (
                                    <table className="sessions-table">
                                        <thead>
                                            <tr>
                                                <th>Device</th>
                                                <th>Browser</th>
                                                <th>Country</th>
                                                <th>IP Address</th>
                                                <th>Login Time</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeSessions.map((session) => (
                                                <tr key={session.id} className={session.current ? 'current-session' : ''}>
                                                    <td>
                                                        <div className="session-device">
                                                            <i className={`fa-solid fa-${
                                                                session.deviceType === 'mobile' ? 'mobile-screen' : 
                                                                session.deviceType === 'tablet' ? 'tablet-screen-button' : 
                                                                'desktop'
                                                            }`}></i>
                                                            <span>{session.device}</span>
                                                        </div>
                                                    </td>
                                                    <td>{session.browser}</td>
                                                    <td>
                                                        <div className="session-country">
                                                            <i className="fa-solid fa-location-dot"></i>
                                                            {session.country}
                                                        </div>
                                                    </td>
                                                    <td><code className="session-ip">{session.ip}</code></td>
                                                    <td>
                                                        <div className="session-login-time">
                                                            <div>{session.loginTime}</div>
                                                            <small>Last active: {session.lastActive}</small>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {session.current ? (
                                                            <span className="session-badge current">Current</span>
                                                        ) : (
                                                            <button 
                                                                className="session-logout-btn"
                                                                onClick={() => handleLogoutSession(session.id)}
                                                            >
                                                                <i className="fa-solid fa-right-from-bracket"></i>
                                                                Logout
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
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
                                                alert('Link copied to clipboard!');
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
            
            {/* Copy Toast Notification */}
            {copyToast && (
                <div className="copy-toast">
                    <i className="fa-solid fa-check-circle"></i>
                    Copied to clipboard!
                </div>
            )}
        </div>
    )
}

export default ChatWindow;