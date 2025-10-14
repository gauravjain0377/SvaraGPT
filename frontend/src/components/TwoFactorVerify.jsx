import React, { useState } from 'react';
import axios from 'axios';
import './TwoFactorVerify.css';

const TwoFactorVerify = ({ onVerify, onCancel }) => {
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/auth/login/verify', { 
        token: verificationCode 
      });
      
      if (response.data.success) {
        onVerify(response.data);
      } else {
        setError(response.data.message || 'Verification failed');
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to verify code');
      console.error('2FA verification error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="twofa-verify">
      <h2>Two-Factor Authentication</h2>
      <p>
        Enter the 6-digit code from your authenticator app to complete login.
      </p>
      
      {error && <div className="twofa-error">{error}</div>}
      
      <div className="twofa-input-container">
        <input
          type="text"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
          placeholder="000000"
          maxLength={6}
          autoFocus
        />
      </div>
      
      <div className="twofa-actions">
        <button 
          className="twofa-verify-button"
          onClick={handleVerify}
          disabled={isLoading || verificationCode.length !== 6}
        >
          {isLoading ? 'Verifying...' : 'Verify'}
        </button>
        
        <button 
          className="twofa-cancel-button"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </button>
      </div>
      
      <div className="twofa-help">
        <p>Lost access to your authenticator app?</p>
        <button className="twofa-backup-button">
          Use a backup code
        </button>
      </div>
    </div>
  );
};

export default TwoFactorVerify;