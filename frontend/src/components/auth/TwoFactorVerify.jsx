import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../../utils/apiConfig";
import "./Auth.css";
import "./TwoFactorVerify.css";

const TwoFactorVerify = ({ tempToken, onCancel }) => {
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [useBackupCode, setUseBackupCode] = useState(false);
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
                body: JSON.stringify({ token: code.toUpperCase(), tempToken }),
            });

            const data = await response.json();

            if (response.ok) {
                navigate("/chats");
            } else {
                setError(data.error || data.message || "Verification failed");
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
            <p>
                {useBackupCode 
                    ? "Enter one of your backup codes" 
                    : "Enter the 6-digit code from your authenticator app"}
            </p>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleSubmit} className="twofa-verify-form">
                <div className="twofa-input-group">
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => {
                            if (useBackupCode) {
                                setCode(e.target.value.toUpperCase());
                            } else {
                                setCode(e.target.value.replace(/\D/g, "").substring(0, 6));
                            }
                        }}
                        placeholder={useBackupCode ? "XXXXXXXX" : "000000"}
                        maxLength={useBackupCode ? 16 : 6}
                        required
                        autoFocus
                        className="twofa-code-input"
                    />
                </div>

                <div className="twofa-toggle">
                    <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                            setUseBackupCode(!useBackupCode);
                            setCode("");
                            setError("");
                        }}
                    >
                        {useBackupCode 
                            ? "Use authenticator code instead" 
                            : "Use backup code instead"}
                    </button>
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
                        disabled={(useBackupCode ? code.length < 6 : code.length !== 6) || loading}
                    >
                        {loading ? "Verifying..." : "Verify"}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default TwoFactorVerify;