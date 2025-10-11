import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = async () => {
        try {
            const response = await fetch("http://localhost:8080/auth/me", {
                credentials: "include",
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error("❌ [AUTH CONTEXT] Auth check failed:", error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    const login = async (email, password) => {
        const response = await fetch("http://localhost:8080/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Login failed");
        }

        const data = await response.json();
        setUser(data.user);
        return data;
    };

    const register = async (name, email, password) => {
        const response = await fetch("http://localhost:8080/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ name, email, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            
            // Handle validation errors
            if (error.errors && Array.isArray(error.errors)) {
                const errorMessages = error.errors.map(err => err.msg).join(", ");
                throw new Error(errorMessages);
            }
            
            throw new Error(error.error || error.message || "Registration failed");
        }

        const data = await response.json();
        return data;
    };

    const verify = async (email, code) => {
        const response = await fetch("http://localhost:8080/auth/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, code }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Verification failed");
        }

        const data = await response.json();
        setUser(data.user);
        return data;
    };

    const resendCode = async (email) => {
        const response = await fetch("http://localhost:8080/auth/resend-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to resend code");
        }

        return await response.json();
    };

    const logout = async () => {
        try {
            await fetch("http://localhost:8080/auth/logout", {
                method: "POST",
                credentials: "include",
            });
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            setUser(null);
            window.location.href = "/login";
        }
    };

    const loginWithGoogle = () => {
        window.location.href = "http://localhost:8080/auth/google";
    };

    const value = {
        user,
        loading,
        login,
        register,
        verify,
        resendCode,
        logout,
        loginWithGoogle,
        checkAuth,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};