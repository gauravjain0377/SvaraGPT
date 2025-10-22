import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../../utils/apiConfig";
import "./Auth.css";
import "./TwoFactorVerify.css";

const TwoFactorVerify = ({ tempToken, onCancel }) => {
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await fetch(apiUrl("/auth/login/verify"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ token: code, tempToken }),
            });

            const data = await response.json();

            if (response.ok) {
                navigate("/chats");
            } else {
                setError(data.error || "Verification failed");
            }
        } catch (err) {
            setError("An error occurred during verification");
            console.error("2FA verification error:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="twofa-verify-container">
            <h2>Two-Factor Authentication</h2>
            <p>Enter the 6-digit code from your authenticator app</p>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleSubmit} className="twofa-verify-form">
                <div className="twofa-input-group">
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").substring(0, 6))}
                        placeholder="000000"
                        maxLength="6"
                        required
                        autoFocus
                        className="twofa-code-input"
                    />
                </div>

                <div className="twofa-button-group">
                    <button 
                        type="button" 
                        className="twofa-cancel-button" 
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        className="twofa-verify-button" 
                        disabled={code.length !== 6 || loading}
                    >
                        {loading ? "Verifying..." : "Verify"}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default TwoFactorVerify;