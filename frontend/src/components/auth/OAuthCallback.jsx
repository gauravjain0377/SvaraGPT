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
                console.log("🔄 Token:", token);
                
                const response = await fetch(apiUrl("/auth/verify-oauth"), {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    credentials: "include",
                    body: JSON.stringify({ token }),
                });

                console.log("📡 Response status:", response.status);
                console.log("📡 Response headers:", Object.fromEntries(response.headers.entries()));

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error("❌ OAuth verification failed:", errorData);
                    throw new Error(errorData.error || "OAuth verification failed");
                }

                const data = await response.json();
                console.log("✅ OAuth verification successful:", data);

                if (!data.success || !data.user) {
                    throw new Error("Invalid response from server");
                }

                setStatus("success");
                
                // Store user in localStorage as a fallback (critical for production)
                localStorage.setItem('oauthUser', JSON.stringify(data.user));
                console.log("💾 Stored user in localStorage");
                console.log("🍪 Cookies set:", data.cookiesSet);
                console.log("🔄 Reissued:", data.reissued);
                
                // Longer delay to ensure cookies are properly set in browser
                // This is critical for cross-origin cookie handling
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Redirect to chats - AuthContext will pick up the user
                console.log("🔄 Redirecting to /chats...");
                window.location.href = "/chats"; // Force full page reload to ensure cookies are available
            } catch (err) {
                console.error("❌ OAuth verification error:", err);
                console.error("❌ Error stack:", err.stack);
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
