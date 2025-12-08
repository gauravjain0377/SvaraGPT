import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiUrl } from "../../utils/apiConfig";
import "./Auth.css";

const OAuthCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
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

                if (!data.success || !data.user) {
                    throw new Error("Invalid response from server");
                }

                setStatus("success");
                
                // Store user in localStorage as a fallback
                localStorage.setItem('oauthUser', JSON.stringify(data.user));
                console.log("💾 Stored user in localStorage");
                
                // Small delay to ensure cookies are set in browser
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Redirect to chats - AuthContext will pick up the user
                console.log("🔄 Redirecting to /chats...");
                window.location.href = "/chats"; // Force full page reload to ensure cookies are available
            } catch (err) {
                console.error("❌ OAuth verification error:", err);
                setError(err.message || "Verification failed");
                setStatus("error");
                setTimeout(() => navigate("/login"), 3000);
            }
        };

        verifyOAuth();
    }, [searchParams, navigate]);

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
