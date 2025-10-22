import React, { useState, useEffect } from 'react';
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
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

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
        // Auto-hide success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to disable 2FA');
      console.error('2FA disable error:', error);
    }
  };

  const handleViewBackupCodes = async () => {
    try {
      setError('');
      setSuccess('');
      
      const response = await axios.get('/api/auth/2fa/backup-codes');
      
      if (response.data.success) {
        setBackupCodes(response.data.backupCodes);
        setShowBackupCodes(true);
        setShowRegenerateConfirm(false);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to retrieve backup codes');
      console.error('Get backup codes error:', error);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    try {
      setError('');
      setSuccess('');
      
      const response = await axios.post('/api/auth/2fa/regenerate-backup-codes');
      
      if (response.data.success) {
        setBackupCodes(response.data.backupCodes);
        setShowBackupCodes(true);
        setShowRegenerateConfirm(false);
        setSuccess('Backup codes regenerated successfully. Please save them securely.');
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to regenerate backup codes');
      console.error('Regenerate backup codes error:', error);
    }
  };

  const handleCopyBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    navigator.clipboard.writeText(codesText).then(() => {
      setSuccess('Backup codes copied to clipboard!');
      setTimeout(() => setSuccess(''), 2000);
    }).catch(() => {
      setError('Failed to copy backup codes');
    });
  };

  const handleDownloadBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    const blob = new Blob([`SvaraGPT 2FA Backup Codes

Generated: ${new Date().toLocaleString()}

${codesText}

Keep these codes safe. Each code can only be used once.`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `svaragpt-backup-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
          <h3>
            <i className="fa-solid fa-shield-halved"></i> Backup Codes
          </h3>
          <div className="backup-codes-info">
            <p className="info-text">
              <i className="fa-solid fa-info-circle"></i>
              Save these backup codes in a secure place. You can use these codes to sign in
              if you lose access to your authenticator app. Each code can only be used once.
            </p>
            <p className="codes-remaining">
              <strong>{backupCodes.length}</strong> code(s) remaining
            </p>
          </div>
          <div className="codes-list">
            {backupCodes.length > 0 ? (
              backupCodes.map((code, index) => (
                <div key={index} className="backup-code">
                  <i className="fa-solid fa-key"></i> {code}
                </div>
              ))
            ) : (
              <div className="no-codes">
                <i className="fa-solid fa-exclamation-circle"></i>
                <p>No backup codes available. Please regenerate new codes.</p>
              </div>
            )}
          </div>
          <div className="backup-codes-actions">
            <button className="copy-button" onClick={handleCopyBackupCodes} disabled={backupCodes.length === 0}>
              <i className="fa-solid fa-copy"></i> Copy All
            </button>
            <button className="download-button" onClick={handleDownloadBackupCodes} disabled={backupCodes.length === 0}>
              <i className="fa-solid fa-download"></i> Download
            </button>
            <button className="close-button" onClick={() => setShowBackupCodes(false)}>
              <i className="fa-solid fa-times"></i> Close
            </button>
          </div>
        </div>
      )}
      
      {status.enabled && !setupData && !showBackupCodes && (
        <div className="disable-container">
          <p>
            Two-factor authentication is currently enabled for your account.
          </p>
          
          <div className="backup-codes-section">
            <h3>Backup Codes</h3>
            <p>
              Backup codes let you access your account if you lose your authenticator device.
              Each code can only be used once.
            </p>
            <div className="backup-codes-buttons">
              <button className="view-codes-button" onClick={handleViewBackupCodes}>
                <i className="fa-solid fa-eye"></i> View Backup Codes
              </button>
              <button className="regenerate-codes-button" onClick={() => setShowRegenerateConfirm(true)}>
                <i className="fa-solid fa-rotate"></i> Regenerate Codes
              </button>
            </div>
            {showRegenerateConfirm && (
              <div className="regenerate-confirm">
                <p className="warning-text">
                  <i className="fa-solid fa-exclamation-triangle"></i>
                  This will invalidate all your existing backup codes. Are you sure?
                </p>
                <div className="button-group">
                  <button onClick={handleRegenerateBackupCodes}>Yes, Regenerate</button>
                  <button className="cancel-button" onClick={() => setShowRegenerateConfirm(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
          
          <div className="disable-form">
            <h3>Disable Two-Factor Authentication</h3>
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