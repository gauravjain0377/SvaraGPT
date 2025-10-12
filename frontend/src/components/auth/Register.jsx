import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import "./Auth.css";
import logo3 from "../../assets/logo3.png";

const Register = () => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showVerification, setShowVerification] = useState(false);
    const [verificationCode, setVerificationCode] = useState("");
    const { register, verify, resendCode, loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }

        setLoading(true);

        try {
            await register(name, email, password);
            setShowVerification(true);
        } catch (err) {
            console.error("❌ [FRONTEND] Registration error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerification = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await verify(email, verificationCode);
            navigate("/home");
        } catch (err) {
            console.error("❌ [FRONTEND] Verification error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        setError("");
        setLoading(true);

        try {
            await resendCode(email);
            setError(""); // Clear any previous errors
            alert("Verification code resent successfully!");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (showVerification) {
        return (
            <div className="auth-container">
                <button className="close-button" onClick={() => navigate("/")}>
                    &times;
                </button>
                <div className="auth-content">
                    <div className="auth-header">
                        <div className="auth-logo">
                            <img src={logo3} alt="SvaraGPT Logo" />
                        </div>
                        <h1>Verify Your Email</h1>
                        <p>We've sent a 6-digit code to {email}</p>
                    </div>

                    {error && <div className="auth-error">{error}</div>}

                    <form onSubmit={handleVerification} className="auth-form">
                        <div className="form-group">
                            <label htmlFor="code">Verification Code</label>
                            <input
                                type="text"
                                id="code"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                                placeholder="Enter 6-digit code"
                                maxLength="6"
                                required
                                disabled={loading}
                                className="verification-input"
                            />
                        </div>

                        <button type="submit" className="auth-button" disabled={loading}>
                            {loading ? "Verifying..." : "Verify Email"}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <p>
                            Didn't receive the code?{" "}
                            <button
                                type="button"
                                onClick={handleResendCode}
                                disabled={loading}
                                className="link-button"
                            >
                                Resend
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-container">
            <button className="close-button" onClick={() => navigate("/")}>
                &times;
            </button>
            <div className="auth-content">
                <div className="auth-header">
                    <div className="auth-logo">
                        <img src={logo3} alt="SvaraGPT Logo" />
                    </div>
                    <h1>Create Account</h1>
                    <p>Sign up to get started with SvaraGPT</p>
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
                        <label htmlFor="name">Full Name</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your full name"
                            required
                            disabled={loading}
                        />
                    </div>

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
                        <label htmlFor="password">Password (min. 8 characters)</label>
                        <div className="input-group">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Create a password"
                                required
                                disabled={loading}
                                minLength="8"
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

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <div className="input-group">
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                id="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm your password"
                                required
                                disabled={loading}
                            />
                            <button
                                type="button"
                                className="toggle-password"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                                {showConfirmPassword ? (
                                    <i className="fa-solid fa-eye-slash"></i>
                                ) : (
                                    <i className="fa-solid fa-eye"></i>
                                )}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="auth-button" disabled={loading}>
                        {loading ? "Creating account..." : "Sign Up"}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        Already have an account? <Link to="/login">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;