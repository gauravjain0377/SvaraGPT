import React, { useContext, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import './UserProfile.css';

const UserProfile = () => {
  const { currentUser, logout } = useContext(AuthContext);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Get user initials for avatar
  const getInitials = () => {
    if (!currentUser || !currentUser.name) return 'U';
    return currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="user-profile" ref={dropdownRef}>
      <button 
        className="profile-button" 
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-label="User profile"
      >
        {currentUser?.profilePicture ? (
          <img 
            src={currentUser.profilePicture} 
            alt={currentUser.name || 'User'} 
            className="profile-image" 
          />
        ) : (
          <div className="profile-avatar">
            {getInitials()}
          </div>
        )}
      </button>

      {dropdownOpen && (
        <div className="profile-dropdown">
          <div className="dropdown-header">
            <div className="user-info">
              <p className="user-name">{currentUser?.name || 'User'}</p>
              <p className="user-email">{currentUser?.email}</p>
            </div>
          </div>
          <div className="dropdown-divider"></div>
          <ul className="dropdown-menu">
            <li>
              <button onClick={() => navigate('/settings')}>
                Settings
              </button>
            </li>
            <li>
              <button onClick={handleLogout}>
                Log out
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default UserProfile;