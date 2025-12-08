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

    const AUTH_USER_KEY = "authUser";

    const loadStoredUser = () => {
        try {
            const stored = localStorage.getItem(AUTH_USER_KEY);
            if (!stored) return null;
            return JSON.parse(stored);
        } catch (e) {
            console.error("❌ [AUTH CONTEXT] Failed to load stored user:", e);
            return null;
        }
    };

    const persistUser = (userData) => {
        try {
            if (userData) {
                localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
            } else {
                localStorage.removeItem(AUTH_USER_KEY);
            }
        } catch (e) {
            console.error("❌ [AUTH CONTEXT] Failed to persist user:", e);
        }
    };

    const checkAuth = async () => {
        try {
            // First, check if there's a temporary OAuth user in localStorage
            const oauthUser = localStorage.getItem('oauthUser');
            if (oauthUser) {
                try {
                    const userData = JSON.parse(oauthUser);
                    console.log("✅ [AUTH CONTEXT] Found OAuth user in localStorage:", userData.email);
                    setUser(userData);
                    persistUser(userData);
                    localStorage.removeItem('oauthUser'); // Clear it after use
                    setLoading(false);
                    setIsInitialized(true);
                    
                    // Verify in background that cookies are working with retry logic
                    const verifyWithRetry = async (retries = 3, delay = 1000) => {
                        for (let i = 0; i < retries; i++) {
                            try {
                                console.log(`🔄 [AUTH CONTEXT] Verification attempt ${i + 1}/${retries}`);
                                
                                const response = await fetch(apiUrl("/auth/me"), {
                                    credentials: "include",
                                    cache: "no-cache",
                                    headers: {
                                        'Accept': 'application/json',
                                        'Content-Type': 'application/json'
                                    }
                                });
                                
                                if (response.ok) {
                                    const data = await response.json();
                                    if (data.user) {
                                        console.log("✅ [AUTH CONTEXT] Cookies verified successfully on attempt", i + 1);
                                        setUser(data.user); // Update with fresh data
                                        persistUser(data.user);
                                        return;
                                } else {
                                    console.warn(`⚠️ [AUTH CONTEXT] Verification attempt ${i + 1} failed with status:`, response.status);
                                }
                                
                                // Wait before retrying (except on last attempt)
                                if (i < retries - 1) {
                                    await new Promise(resolve => setTimeout(resolve, delay));
                                }
                            } catch (err) {
                                console.warn(`⚠️ [AUTH CONTEXT] Verification attempt ${i + 1} error:`, err);
                                if (i < retries - 1) {
                                    await new Promise(resolve => setTimeout(resolve, delay));
                                }
                            }
                        }
                        
                        console.error("❌ [AUTH CONTEXT] All verification attempts failed - cookies may not be working in production");
                        console.error("❌ [AUTH CONTEXT] User will remain authenticated via localStorage fallback");
                    };
                    
                    verifyWithRetry();
                    
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
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.user && (data.user.email || data.user.name)) {
                    console.log("✅ [AUTH CONTEXT] User authenticated via cookies:", data.user.email);
                    setUser(data.user);
                    persistUser(data.user);
                } else {
                    console.warn("⚠️ [AUTH CONTEXT] No valid user data in response");
                    persistUser(null);
                    setUser(null);
                }
            } else {
                console.warn("⚠️ [AUTH CONTEXT] Auth check failed with status:", response.status);
                // If we already have a stored user (e.g., OAuth in environments where cookies don't work),
                // keep that user instead of forcing logout.
                const storedUser = loadStoredUser();
                if (storedUser) {
                    console.warn("⚠️ [AUTH CONTEXT] Using stored user fallback after auth failure");
                    setUser(storedUser);
                } else {
                    setUser(null);
                }
            }
        } catch (error) {
            console.error("❌ [AUTH CONTEXT] Auth check failed:", error);
            const storedUser = loadStoredUser();
            if (storedUser) {
                console.warn("⚠️ [AUTH CONTEXT] Using stored user fallback after auth error");
                setUser(storedUser);
            } else {
                setUser(null);
            }
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
            localStorage.removeItem(AUTH_USER_KEY);
            
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