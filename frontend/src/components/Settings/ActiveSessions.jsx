import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isMobile, isTablet, isDesktop, osName, browserName } from 'react-device-detect';
import { formatDistanceToNow, format } from 'date-fns';
import axios from 'axios';
import { apiUrl } from '../../utils/apiConfig';
import './ActiveSessions.css';

const ActiveSessions = () => {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deletingSession, setDeletingSession] = useState(null);

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await axios.get(apiUrl('/auth/sessions'), {
                withCredentials: true
            });
            setSessions(response.data.sessions || []);
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
            setError(err.response?.data?.error || 'Failed to load sessions');
        } finally {
            setLoading(false);
        }
    };

    const handleLogoutSession = async (sessionId) => {
        if (!window.confirm('Are you sure you want to log out this session?')) {
            return;
        }

        try {
            setDeletingSession(sessionId);
            await axios.delete(apiUrl(`/auth/sessions/${sessionId}`), {
                withCredentials: true
            });
            
            // Remove the session from the list
            setSessions(sessions.filter(s => s.id !== sessionId));
        } catch (err) {
            console.error('Failed to logout session:', err);
            alert(err.response?.data?.error || 'Failed to logout session');
        } finally {
            setDeletingSession(null);
        }
    };

    const handleLogoutAllOther = async () => {
        if (!window.confirm('Are you sure you want to log out all other sessions?')) {
            return;
        }

        try {
            setLoading(true);
            await axios.delete(apiUrl('/auth/sessions/all'), {
                withCredentials: true
            });
            
            // Refresh the sessions list
            await fetchSessions();
        } catch (err) {
            console.error('Failed to logout all sessions:', err);
            alert(err.response?.data?.error || 'Failed to logout all sessions');
        } finally {
            setLoading(false);
        }
    };

    const getDeviceIcon = (deviceType) => {
        switch (deviceType?.toLowerCase()) {
            case 'mobile':
                return '📱';
            case 'tablet':
                return '💻';
            case 'desktop':
            default:
                return '🖥️';
        }
    };

    const formatLastActive = (date) => {
        try {
            return formatDistanceToNow(new Date(date), { addSuffix: true });
        } catch {
            return 'Unknown';
        }
    };

    const formatLoginTime = (date) => {
        try {
            return format(new Date(date), 'MMM dd, yyyy');
        } catch {
            return 'Unknown';
        }
    };

    if (loading && sessions.length === 0) {
        return (
            <div className="active-sessions-container">
                <div className="sessions-header">
                    <h1>Active Sessions</h1>
                    <p>Manage devices where you're logged in</p>
                </div>
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Loading sessions...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="active-sessions-container">
                <div className="sessions-header">
                    <h1>Active Sessions</h1>
                    <p>Manage devices where you're logged in</p>
                </div>
                <div className="error-container">
                    <span className="error-icon">⚠️</span>
                    <p>{error}</p>
                    <button onClick={fetchSessions} className="retry-button">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="active-sessions-container">
            <div className="sessions-header">
                <button onClick={() => navigate('/settings/security')} className="back-button">
                    <i className="fa-solid fa-arrow-left"></i> Back to Settings
                </button>
                <h1>Active Sessions</h1>
                <p>Manage devices where you're currently logged in</p>
                {sessions.length > 1 && (
                    <button 
                        onClick={handleLogoutAllOther} 
                        className="logout-all-button"
                        disabled={loading}
                    >
                        🚪 Log Out All Other Sessions
                    </button>
                )}
            </div>

            <div className="sessions-list">
                {sessions.length === 0 ? (
                    <div className="no-sessions">
                        <span className="no-sessions-icon">🔒</span>
                        <p>No active sessions found</p>
                    </div>
                ) : (
                    sessions.map((session) => (
                        <div 
                            key={session.id} 
                            className={`session-card ${session.current ? 'current-session' : ''}`}
                        >
                            <div className="session-icon">
                                {getDeviceIcon(session.deviceType)}
                            </div>
                            
                            <div className="session-info">
                                <div className="session-main">
                                    <div className="session-device">
                                        <strong>{session.device}</strong>
                                        {session.current && (
                                            <span className="current-badge">Current</span>
                                        )}
                                    </div>
                                    <div className="session-browser">
                                        {session.browser}
                                    </div>
                                </div>

                                <div className="session-details">
                                    <div className="detail-item">
                                        <span className="detail-icon">🌍</span>
                                        <span className="detail-text">
                                            {session.flag} {session.city !== 'Unknown' 
                                                ? `${session.city}, ${session.country}` 
                                                : session.country}
                                        </span>
                                    </div>
                                    
                                    <div className="detail-item">
                                        <span className="detail-icon">📍</span>
                                        <span className="detail-text">{session.ip}</span>
                                    </div>
                                    
                                    <div className="detail-item">
                                        <span className="detail-icon">🕒</span>
                                        <span className="detail-text">
                                            Logged in {formatLoginTime(session.loginTime)}
                                        </span>
                                    </div>
                                    
                                    <div className="detail-item">
                                        <span className="detail-icon">⚡</span>
                                        <span className="detail-text">
                                            Active {formatLastActive(session.lastActive)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {!session.current && (
                                <button
                                    onClick={() => handleLogoutSession(session.id)}
                                    className="logout-session-button"
                                    disabled={deletingSession === session.id}
                                >
                                    {deletingSession === session.id ? '...' : '🚪 Log Out'}
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="sessions-footer">
                <p className="security-tip">
                    💡 <strong>Security Tip:</strong> If you see a session you don't recognize, 
                    log it out immediately and change your password.
                </p>
            </div>
        </div>
    );
};

export default ActiveSessions;
