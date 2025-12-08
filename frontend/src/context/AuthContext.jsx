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
            // First, check if there's a temporary OAuth user in localStorage
            const oauthUser = localStorage.getItem('oauthUser');
            if (oauthUser) {
                try {
                    const userData = JSON.parse(oauthUser);
                    console.log("✅ [AUTH CONTEXT] Found OAuth user in localStorage:", userData.email);
                    setUser(userData);
                    localStorage.removeItem('oauthUser'); // Clear it after use
                    setLoading(false);
                    setIsInitialized(true);
                    
                    // Verify in background that cookies are working
                    fetch(apiUrl("/auth/me"), {
                        credentials: "include",
                        cache: "no-cache",
                    }).then(async (response) => {
                        if (response.ok) {
                            const data = await response.json();
                            if (data.user) {
                                console.log("✅ [AUTH CONTEXT] Verified cookies are working");
                                setUser(data.user); // Update with fresh data
                            }
                        }
                    }).catch((err) => {
                        console.warn("⚠️ [AUTH CONTEXT] Background verification failed:", err);
                    });
                    
                    return; // Exit early with OAuth user
                } catch (e) {
                    console.error("❌ [AUTH CONTEXT] Failed to parse OAuth user:", e);
                    localStorage.removeItem('oauthUser');
                }
            }
            
            // Normal auth check via cookies
            const response = await fetch(apiUrl("/auth/me"), {
                credentials: "include",
                cache: "no-cache",
            });

            if (response.ok) {
                const data = await response.json();
                if (data.user && (data.user.email || data.user.name)) {
                    console.log("✅ [AUTH CONTEXT] User authenticated via cookies:", data.user.email);
                    setUser(data.user);
                } else {
                    console.warn("⚠️ [AUTH CONTEXT] No valid user data in response");
                    setUser(null);
                }
            } else {
                console.warn("⚠️ [AUTH CONTEXT] Auth check failed with status:", response.status);
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
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', checkAuth);
        };
    }, []);

    // Re-check auth when route changes
    useEffect(() => {
        checkAuth();
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
        const googleAuthUrl = apiUrl("/auth/google");
        
        // Add error handling for CSP violations
        try {
            // Create a form and submit it to avoid potential browser security restrictions
            const form = document.createElement('form');
            form.method = 'GET';
            form.action = googleAuthUrl;
            form.style.display = 'none';
            
            document.body.appendChild(form);
            form.submit();
        } catch (error) {
            console.error('❌ Error initiating Google OAuth:', error);
            // Fallback to direct navigation
            window.location.href = googleAuthUrl;
        }
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