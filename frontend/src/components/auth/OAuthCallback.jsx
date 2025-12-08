import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiUrl } from "../../utils/apiConfig";
import "./Auth.css";

const OAuthCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { checkAuth } = useAuth();
    const [status, setStatus] = useState("verifying");
    const [error, setError] = useState(null);

    useEffect(() => {
        const verifyOAuth = async () => {
            const token = searchParams.get("token");
            
            if (!token) {
                setError("Missing verification token");
                setStatus("error");
                setTimeout(() => navigate("/login"), 3000);
                return;
            }

            try {
                console.log("🔄 Verifying OAuth completion...");
                
                const response = await fetch(apiUrl("/auth/verify-oauth"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ token }),
                });

                if (!response.ok) {
                    throw new Error("OAuth verification failed");
                }

                const data = await response.json();
                console.log("✅ OAuth verification successful:", data);

                setStatus("success");
                
                // Re-check auth to update context
                await checkAuth();
                
                // Redirect to chats after successful verification
                setTimeout(() => {
                    navigate("/chats", { replace: true });
                }, 500);
            } catch (err) {
                console.error("❌ OAuth verification error:", err);
                setError(err.message || "Verification failed");
                setStatus("error");
                setTimeout(() => navigate("/login"), 3000);
            }
        };

        verifyOAuth();
    }, [searchParams, navigate, checkAuth]);

    return (
        <div className="auth-container">
            <div className="auth-content-center">
                <div className="oauth-callback-status">
                    {status === "verifying" && (
                        <>
                            <div className="spinner"></div>
                            <h2>Completing sign in...</h2>
                            <p>Please wait while we verify your authentication</p>
                        </>
                    )}
                    
                    {status === "success" && (
                        <>
                            <div className="success-icon">✓</div>
                            <h2>Sign in successful!</h2>
                            <p>Redirecting to your chats...</p>
                        </>
                    )}
                    
                    {status === "error" && (
                        <>
                            <div className="error-icon">✕</div>
                            <h2>Sign in failed</h2>
                            <p>{error || "Something went wrong. Redirecting to login..."}</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OAuthCallback;
