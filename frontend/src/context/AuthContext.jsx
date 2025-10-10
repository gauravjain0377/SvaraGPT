import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const checkAuthStatus = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setLoading(false);
        return;
      }
      
      try {
        // Set default headers for all requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Get current user
        const res = await axios.get('http://localhost:8080/api/auth/me');
        
        setCurrentUser(res.data.user);
        setIsAuthenticated(true);
      } catch (err) {
        // Clear token if invalid
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
      } finally {
        setLoading(false);
      }
    };
    
    checkAuthStatus();
  }, []);

  // Login user
  const login = async (email, password) => {
    const res = await axios.post('http://localhost:8080/api/auth/login', { email, password });
    
    // Save token to localStorage
    localStorage.setItem('token', res.data.token);
    
    // Set default headers
    axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    
    // Set user data from login response
    setCurrentUser(res.data.user);
    setIsAuthenticated(true);
    
    return res.data.user;
  };

  // Logout user
  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        loading,
        login,
        logout,
        setCurrentUser,
        setIsAuthenticated
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;