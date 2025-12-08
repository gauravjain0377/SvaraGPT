import { useAuth } from "../../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import "./Auth.css";
import logo from "../../assets/logo.png";

const Auth = () => {
    const { loginWithGoogle } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [errorMessage, setErrorMessage] = useState(null);
    const [errorDetails, setErrorDetails] = useState(null);

    useEffect(() => {
        const error = searchParams.get("error");
        const details = searchParams.get("details");
        
        if (error) {
            console.error("❌ [LOGIN] OAuth error:", error, details);
            
            const errorMessages = {
                google_auth_failed: "Google sign-in failed. Please try again.",
                google_denied: "Google sign-in was cancelled. Please try again.",
                auth_error: "Authentication error occurred. Please try again.",
                no_user_created: "Failed to create user account. Please try again.",
                user_lost: "Session lost during authentication. Please try again.",
                server_error: "Server error occurred. Please try again later.",
                no_user: "User not found after authentication. Please try again.",
                internal_server_error: "Internal server error. Please try again later."
            };
            
            setErrorMessage(errorMessages[error] || "An error occurred during sign-in. Please try again.");
            if (details) {
                setErrorDetails(decodeURIComponent(details));
            }
        }
    }, [searchParams]);

    const handleLogin = () => {
        // Clear any existing error messages
        setErrorMessage(null);
        setErrorDetails(null);
        loginWithGoogle();
    };

    return (
        <div className="auth-container">
            <button className="close-button" onClick={() => navigate("/")}>
                &times;
            </button>
            <div className="auth-content-center">
                <div className="auth-header-center">
                    <div className="auth-logo-large">
                        <img src={logo} alt="SvaraGPT Logo" />
                    </div>
                    <h1 className="auth-title-large">Welcome to SvaraGPT</h1>
                    <p className="auth-subtitle-large">Sign in with your Google account to continue</p>
                </div>

                {errorMessage && (
                    <div className="auth-error-banner">
                        <div className="auth-error-icon">⚠️</div>
                        <div className="auth-error-content">
                            <p className="auth-error-message">{errorMessage}</p>
                            {errorDetails && (
                                <p className="auth-error-details">Details: {errorDetails}</p>
                            )}
                        </div>
                    </div>
                )}

                <button
                    type="button"
                    className="google-button-large"
                    onClick={handleLogin}
                >
                    <svg viewBox="0 0 24 24" width="24" height="24">
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

                <div className="auth-features">
                    <div className="auth-feature-item">
                        <i className="fa-solid fa-shield-halved"></i>
                        <span>Secure & Private</span>
                    </div>
                    <div className="auth-feature-item">
                        <i className="fa-solid fa-bolt"></i>
                        <span>Fast & Easy</span>
                    </div>
                    <div className="auth-feature-item">
                        <i className="fa-solid fa-lock"></i>
                        <span>Encrypted</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Auth;