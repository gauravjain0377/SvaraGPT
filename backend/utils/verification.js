export function generateVerificationCode() {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    return { code, expiresAt };
}

export function getVerificationExpiry() {
    return new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
}