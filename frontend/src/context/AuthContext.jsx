import { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { apiUrl } from "../utils/apiConfig";

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
    const [isInitialized, setIsInitialized] = useState(false);
    const [guestId, setGuestId] = useState(null);
    const location = useLocation();

    const checkAuth = async () => {
        try {
            const response = await fetch(apiUrl("/auth/me"), {
                credentials: "include",
                cache: "no-cache", // Prevent caching
            });

            if (response.ok) {
                const data = await response.json();
                // Only set user if we have valid user data
                if (data.user && (data.user.email || data.user.name)) {
                    setUser(data.user);
                } else {
                    setUser(null);
                }
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error("❌ [AUTH CONTEXT] Auth check failed:", error);
            setUser(null);
        } finally {
            setLoading(false);
            setIsInitialized(true);
        }
    };

    // Get guest usage info
    const getGuestUsage = async () => {
        try {
            const response = await fetch(apiUrl("/api/guest-usage"), {
                credentials: "include",
            });
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error("Failed to fetch guest usage:", error);
        }
        return null;
    };

    // Migrate guest data to authenticated user
    const migrateGuestData = async () => {
        try {
            const response = await fetch(apiUrl("/api/migrate/guest-data"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({}),
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log("✅ Guest data migrated:", data);
                return data;
            }
        } catch (error) {
            console.error("❌ Failed to migrate guest data:", error);
        }
        return null;
    };

    useEffect(() => {
        checkAuth();
        
        // Re-check auth when page becomes visible (e.g., after navigating back)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkAuth();
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Also check on focus
        window.addEventListener('focus', checkAuth);
        
        // Check auth after a short delay to handle OAuth redirects
        const timeoutId = setTimeout(() => {
            checkAuth();
        }, 500);
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', checkAuth);
            clearTimeout(timeoutId);
        };
    }, []);

    // Re-check auth when route changes (especially after OAuth redirects)
    useEffect(() => {
        // Add a small delay for OAuth redirects to complete
        const timeoutId = setTimeout(() => {
            checkAuth();
        }, 100);
        
        return () => clearTimeout(timeoutId);
    }, [location.pathname]);

    const login = async (email, password) => {
        const response = await fetch(apiUrl("/auth/login"), {
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
        
        // Check if 2FA is required
        if (data.requiresTwoFactor) {
            return {
                requiresTwoFactor: true,
                tempToken: data.tempToken
            };
        }
        
        // Migrate guest data automatically (backend reads from cookie)
        await migrateGuestData();
        
        // Clear any previous user's data from localStorage
        localStorage.removeItem('projects');
        localStorage.removeItem('threads');
        localStorage.removeItem('currentProject');
        localStorage.removeItem('currentThread');
        
        setUser(data.user);
        return data;
    };

    const register = async (name, email, password) => {
        const response = await fetch(apiUrl("/auth/register"), {
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
        const response = await fetch(apiUrl("/auth/verify"), {
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
        
        // Clear any previous user's data from localStorage
        localStorage.removeItem('projects');
        localStorage.removeItem('threads');
        localStorage.removeItem('currentProject');
        localStorage.removeItem('currentThread');
        
        setUser(data.user);
        return data;
    };

    const resendCode = async (email) => {
        const response = await fetch(apiUrl("/auth/resend-code"), {
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
            await fetch(apiUrl("/auth/logout"), {
                method: "POST",
                credentials: "include",
            });
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            // Clear all user-specific data from localStorage
            localStorage.removeItem('projects');
            localStorage.removeItem('threads');
            localStorage.removeItem('currentProject');
            localStorage.removeItem('currentThread');
            
            setUser(null);
            // Redirect to home page (guest mode) instead of login
            window.location.href = "/home";
        }
    };

    const loginWithGoogle = () => {
        window.location.href = apiUrl("/auth/google");
    };

    const value = {
        user,
        loading,
        isInitialized,
        login,
        register,
        verify,
        resendCode,
        logout,
        loginWithGoogle,
        checkAuth,
        getGuestUsage,
        migrateGuestData,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};