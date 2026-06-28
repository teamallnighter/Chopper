// License Management Module
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const LICENSE_FILE = path.join(app.getPath('userData'), '.license');
const GUMROAD_PRODUCT_ID = 'D55Ux_w-Oca1X7Qzr9MYVA==';
const GUMROAD_PERMALINK = 'https://bassdaddy.gumroad.com/l/chopper';

// Free tier limits
const FREE_LIMITS = {
  maxSamples: 100,
  maxFileSizeMB: 25,
  processingDelayMs: 50 // Delay per chunk to slow down processing
};

class LicenseManager {
  constructor() {
    this.license = null;
    this.sessionSampleCount = 0;
    this.loadLicense();
  }

  // Load license from disk
  loadLicense() {
    try {
      if (fs.existsSync(LICENSE_FILE)) {
        const encrypted = fs.readFileSync(LICENSE_FILE, 'utf8');
        this.license = this.decrypt(encrypted);
      }
    } catch (error) {
      console.error('Error loading license:', error);
      this.license = null;
    }
  }

  // Save license to disk (encrypted)
  saveLicense(licenseData) {
    try {
      const encrypted = this.encrypt(JSON.stringify(licenseData));
      fs.writeFileSync(LICENSE_FILE, encrypted, 'utf8');
      this.license = licenseData;
      return true;
    } catch (error) {
      console.error('Error saving license:', error);
      return false;
    }
  }

  // Simple encryption (good enough for license storage)
  encrypt(text) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(app.getName(), 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(text) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(app.getName(), 'salt', 32);
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  // Check if user has valid license
  isPro() {
    return this.license && this.license.valid === true;
  }

  // Get license status
  getStatus() {
    return {
      isPro: this.isPro(),
      licenseKey: this.license?.licenseKey || null,
      sessionSampleCount: this.sessionSampleCount,
      limits: FREE_LIMITS
    };
  }

  // Verify license with Gumroad API
  async verifyLicense(licenseKey) {
    try {
      const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_id: GUMROAD_PRODUCT_ID,
          license_key: licenseKey,
          increment_uses_count: false
        })
      });

      const data = await response.json();

      if (data.success && data.purchase) {
        const licenseData = {
          valid: true,
          licenseKey: licenseKey,
          email: data.purchase.email,
          productId: data.purchase.product_id,
          verifiedAt: new Date().toISOString()
        };

        this.saveLicense(licenseData);
        return { success: true, data: licenseData };
      } else {
        return { success: false, error: 'Invalid license key' };
      }
    } catch (error) {
      console.error('License verification error:', error);
      return { success: false, error: error.message };
    }
  }

  // Increment sample count for session
  incrementSampleCount(count) {
    this.sessionSampleCount += count;
  }

  // Check if file size is within limits
  canProcessFile(fileSizeBytes) {
    if (this.isPro()) return { allowed: true };

    const fileSizeMB = fileSizeBytes / (1024 * 1024);
    if (fileSizeMB > FREE_LIMITS.maxFileSizeMB) {
      return {
        allowed: false,
        reason: `File size (${fileSizeMB.toFixed(1)}MB) exceeds free tier limit of ${FREE_LIMITS.maxFileSizeMB}MB`
      };
    }

    return { allowed: true };
  }

  // Get processing delay (0 for pro, delay for free)
  getProcessingDelay() {
    return this.isPro() ? 0 : FREE_LIMITS.processingDelayMs;
  }

  // Get Gumroad permalink for purchase
  getGumroadPermalink() {
    return GUMROAD_PERMALINK;
  }

  // Remove license (for testing or user logout)
  removeLicense() {
    try {
      if (fs.existsSync(LICENSE_FILE)) {
        fs.unlinkSync(LICENSE_FILE);
      }
      this.license = null;
      return true;
    } catch (error) {
      console.error('Error removing license:', error);
      return false;
    }
  }
}

module.exports = new LicenseManager();
