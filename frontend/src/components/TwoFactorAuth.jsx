import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useContext } from 'react';
import { MyContext } from '../MyContext';
import './TwoFactorAuth.css';

const TwoFactorAuth = () => {
  const { user, setUser } = useContext(MyContext);
  const [status, setStatus] = useState({ enabled: false, loading: true });
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  const fetchStatus = async () => {
    try {
      setStatus({ ...status, loading: true });
      const response = await axios.get('/api/auth/2fa/status');
      setStatus({ enabled: response.data.enabled, loading: false });
    } catch (error) {
      console.error('Error fetching 2FA status:', error);
      setStatus({ enabled: false, loading: false });
    }
  };

  useEffect(() => {
    if (user?.isVerified) {
      fetchStatus();
    }
  }, [user]);

  const handleSetup = async () => {
    try {
      setError('');
      setSuccess('');
      const response = await axios.post('/api/auth/2fa/setup');
      setSetupData(response.data);
    } catch (error) {
      setError('Failed to setup two-factor authentication');
      console.error('2FA setup error:', error);
    }
  };

  const handleVerify = async () => {
    try {
      setError('');
      setSuccess('');
      
      if (!verificationCode) {
        setError('Please enter the verification code');
        return;
      }
      
      const response = await axios.post('/api/auth/2fa/verify', { token: verificationCode });
      
      if (response.data.success) {
        setBackupCodes(response.data.backupCodes);
        setShowBackupCodes(true);
        setSuccess('Two-factor authentication enabled successfully');
        setSetupData(null);
        setVerificationCode('');
        setUser({ ...user, twoFactorEnabled: true });
        await fetchStatus();
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to verify code');
      console.error('2FA verification error:', error);
    }
  };

  const handleDisable = async () => {
    try {
      setError('');
      setSuccess('');
      
      const response = await axios.post('/api/auth/2fa/disable', { 
        token: disableCode 
      });
      
      if (response.data.success) {
        setSuccess('Two-factor authentication disabled successfully');
        setDisableCode('');
        setUser({ ...user, twoFactorEnabled: false });
        await fetchStatus();
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to disable 2FA');
      console.error('2FA disable error:', error);
    }
  };

  const handleCancel = () => {
    setSetupData(null);
    setVerificationCode('');
    setError('');
    setSuccess('');
  };

  if (!user?.isVerified) {
    return <div className="two-factor-auth">Please verify your email first.</div>;
  }

  if (status.loading) {
    return <div className="two-factor-auth">Loading...</div>;
  }

  return (
    <div className="two-factor-auth">
      <h2>Two-Factor Authentication</h2>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      {!status.enabled && !setupData && (
        <div className="setup-container">
          <p>
            Two-factor authentication adds an extra layer of security to your account.
            When enabled, you'll need to provide a verification code from your
            authenticator app in addition to your password when signing in.
          </p>
          <button className="setup-button" onClick={handleSetup}>
            Enable Two-Factor Authentication
          </button>
        </div>
      )}
      
      {setupData && (
        <div className="setup-process">
          <h3>Setup Two-Factor Authentication</h3>
          <p>
            1. Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
          </p>
          <div className="qr-container">
            <img src={setupData.qrCode} alt="QR Code" />
          </div>
          <p>
            2. Or manually enter this secret key in your authenticator app:
          </p>
          <div className="secret-key">
            {setupData.secret}
          </div>
          <p>
            3. Enter the verification code from your authenticator app:
          </p>
          <div className="verification-input">
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Enter 6-digit code"
              maxLength={6}
            />
            <div className="button-group">
              <button onClick={handleVerify}>Verify & Enable</button>
              <button className="cancel-button" onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      
      {showBackupCodes && (
        <div className="backup-codes">
          <h3>Backup Codes</h3>
          <p>
            Save these backup codes in a secure place. You can use these codes to sign in
            if you lose access to your authenticator app. Each code can only be used once.
          </p>
          <div className="codes-list">
            {backupCodes.map((code, index) => (
              <div key={index} className="backup-code">{code}</div>
            ))}
          </div>
          <button onClick={() => setShowBackupCodes(false)}>Close</button>
        </div>
      )}
      
      {status.enabled && !setupData && !showBackupCodes && (
        <div className="disable-container">
          <p>
            Two-factor authentication is currently enabled for your account.
          </p>
          <div className="disable-form">
            <input
              type="text"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              placeholder="Enter verification code to disable"
              maxLength={6}
            />
            <button className="disable-button" onClick={handleDisable}>
              Disable Two-Factor Authentication
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TwoFactorAuth;