import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { apiUrl } from "../../utils/apiConfig";
import "./Auth.css";
import logo from "../../assets/logo.png";
import TwoFactorVerify from "./TwoFactorVerify";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
    const [tempToken, setTempToken] = useState("");
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [forgotPasswordStep, setForgotPasswordStep] = useState('email'); // 'email', 'code', 'success'
    const [resetEmail, setResetEmail] = useState("");
    const [resetCode, setResetCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [resetError, setResetError] = useState("");
    const [resetSuccess, setResetSuccess] = useState("");
    const [isResetting, setIsResetting] = useState(false);
    const [showResetNewPassword, setShowResetNewPassword] = useState(false);
    const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
    const { login, loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const result = await login(email, password);
            
            if (result.requiresTwoFactor) {
                setRequiresTwoFactor(true);
                setTempToken(result.tempToken);
            } else {
                navigate("/chats");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleCancelTwoFactor = () => {
        setRequiresTwoFactor(false);
        setTempToken("");
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setResetError("");
        setIsResetting(true);

        try {
            const response = await fetch(apiUrl('/auth/forgot-password'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmail })
            });

            const data = await response.json();

            if (response.ok) {
                setForgotPasswordStep('code');
                setResetSuccess('Password reset code sent to your email');
            } else {
                setResetError(data.error || 'Failed to send reset code');
            }
        } catch (err) {
            setResetError('Failed to send reset code. Please try again.');
        } finally {
            setIsResetting(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setResetError("");

        if (newPassword.length < 8) {
            setResetError('Password must be at least 8 characters');
            return;
        }

        if (newPassword !== confirmNewPassword) {
            setResetError('Passwords do not match');
            return;
        }

        setIsResetting(true);

        try {
            const response = await fetch(apiUrl('/auth/reset-password'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: resetEmail,
                    code: resetCode,
                    newPassword 
                })
            });

            const data = await response.json();

            if (response.ok) {
                setForgotPasswordStep('success');
                setResetSuccess('Password reset successfully!');
                setTimeout(() => {
                    setShowForgotPassword(false);
                    setForgotPasswordStep('email');
                    setResetEmail('');
                    setResetCode('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                    setResetError('');
                    setResetSuccess('');
                }, 2000);
            } else {
                setResetError(data.error || 'Failed to reset password');
            }
        } catch (err) {
            setResetError('Failed to reset password. Please try again.');
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="auth-container">
            <button className="close-button" onClick={() => navigate("/")}>
                &times;
            </button>
            <div className="auth-content">
                {requiresTwoFactor ? (
                    <TwoFactorVerify 
                        tempToken={tempToken} 
                        onCancel={handleCancelTwoFactor}
                        onSuccess={() => navigate("/chats")}
                    />
                ) : (
                    <>
                        <div className="auth-header">
                            <div className="auth-logo">
                                <img src={logo} alt="SvaraGPT Logo" />
                            </div>
                            <h1>Welcome Back</h1>
                            <p>Sign in to continue to SvaraGPT</p>
                        </div>

                        {error && <div className="auth-error">{error}</div>}

                        <button
                            type="button"
                            className="google-button"
                            onClick={loginWithGoogle}
                            disabled={loading}
                        >
                            <svg viewBox="0 0 24 24" width="20" height="20">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            Continue with Google
                        </button>

                        <div className="auth-divider">
                            <span>OR</span>
                        </div>

                        <form onSubmit={handleSubmit} className="auth-form">
                            <div className="form-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <div className="input-group">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        required
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        className="toggle-password"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? (
                                            <i className="fa-solid fa-eye-slash"></i>
                                        ) : (
                                            <i className="fa-solid fa-eye"></i>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="forgot-password-link">
                                <button 
                                    type="button" 
                                    className="link-button"
                                    onClick={() => {
                                        setShowForgotPassword(true);
                                        setResetEmail(email);
                                    }}
                                >
                                    Forgot password?
                                </button>
                            </div>

                            <button type="submit" className="auth-button" disabled={loading}>
                                {loading ? "Signing in..." : "Sign In"}
                            </button>
                        </form>

                        <div className="auth-footer">
                            <p>
                                Don't have an account? <Link to="/register">Sign up</Link>
                            </p>
                        </div>
                    </>  
                )}
            </div>

            {/* Forgot Password Modal */}
            {showForgotPassword && (
                <div className="auth-modal-backdrop" onClick={() => setShowForgotPassword(false)}>
                    <div className="auth-modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="auth-modal-header">
                            <h2>
                                <i className="fa-solid fa-key"></i>
                                Reset Password
                            </h2>
                            <button className="auth-modal-close" onClick={() => setShowForgotPassword(false)}>
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>

                        <div className="auth-modal-body">
                            {forgotPasswordStep === 'email' && (
                                <form onSubmit={handleForgotPassword}>
                                    <p className="auth-modal-description">
                                        Enter your email address and we'll send you a verification code to reset your password.
                                    </p>

                                    {resetError && (
                                        <div className="auth-error">
                                            <i className="fa-solid fa-circle-exclamation"></i>
                                            {resetError}
                                        </div>
                                    )}

                                    {resetSuccess && (
                                        <div className="auth-success">
                                            <i className="fa-solid fa-circle-check"></i>
                                            {resetSuccess}
                                        </div>
                                    )}

                                    <div className="form-group">
                                        <label htmlFor="resetEmail">Email Address</label>
                                        <input
                                            type="email"
                                            id="resetEmail"
                                            value={resetEmail}
                                            onChange={(e) => setResetEmail(e.target.value)}
                                            placeholder="Enter your email"
                                            required
                                            autoFocus
                                        />
                                    </div>

                                    <div className="auth-modal-actions">
                                        <button 
                                            type="button"
                                            className="auth-button-secondary"
                                            onClick={() => setShowForgotPassword(false)}
                                            disabled={isResetting}
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            type="submit"
                                            className="auth-button"
                                            disabled={isResetting}
                                        >
                                            {isResetting ? 'Sending...' : 'Send Code'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {forgotPasswordStep === 'code' && (
                                <form onSubmit={handleResetPassword}>
                                    <p className="auth-modal-description">
                                        Enter the 6-digit code sent to {resetEmail} and choose a new password.
                                    </p>

                                    {resetError && (
                                        <div className="auth-error">
                                            <i className="fa-solid fa-circle-exclamation"></i>
                                            {resetError}
                                        </div>
                                    )}

                                    <div className="form-group">
                                        <label htmlFor="resetCode">Verification Code</label>
                                        <input
                                            type="text"
                                            id="resetCode"
                                            value={resetCode}
                                            onChange={(e) => setResetCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                                            placeholder="Enter 6-digit code"
                                            maxLength={6}
                                            required
                                            autoFocus
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="newPasswordReset">New Password</label>
                                        <div className="input-group">
                                            <input
                                                type={showResetNewPassword ? "text" : "password"}
                                                id="newPasswordReset"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="Enter new password (min 8 characters)"
                                                required
                                            />
                                            <button
                                                type="button"
                                                className="toggle-password"
                                                onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                                            >
                                                <i className={`fa-solid fa-eye${showResetNewPassword ? '-slash' : ''}`}></i>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="confirmNewPasswordReset">Confirm New Password</label>
                                        <div className="input-group">
                                            <input
                                                type={showResetConfirmPassword ? "text" : "password"}
                                                id="confirmNewPasswordReset"
                                                value={confirmNewPassword}
                                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                                placeholder="Confirm your new password"
                                                required
                                            />
                                            <button
                                                type="button"
                                                className="toggle-password"
                                                onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                                            >
                                                <i className={`fa-solid fa-eye${showResetConfirmPassword ? '-slash' : ''}`}></i>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="auth-modal-actions">
                                        <button 
                                            type="button"
                                            className="auth-button-secondary"
                                            onClick={() => {
                                                setForgotPasswordStep('email');
                                                setResetCode('');
                                                setNewPassword('');
                                                setConfirmNewPassword('');
                                                setResetError('');
                                            }}
                                            disabled={isResetting}
                                        >
                                            Back
                                        </button>
                                        <button 
                                            type="submit"
                                            className="auth-button"
                                            disabled={isResetting}
                                        >
                                            {isResetting ? 'Resetting...' : 'Reset Password'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {forgotPasswordStep === 'success' && (
                                <div className="auth-modal-success">
                                    <div className="success-icon">
                                        <i className="fa-solid fa-circle-check"></i>
                                    </div>
                                    <h3>Password Reset Successfully!</h3>
                                    <p>You can now login with your new password.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login;