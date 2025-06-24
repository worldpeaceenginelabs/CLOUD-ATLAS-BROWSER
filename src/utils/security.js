import sanitizeHtml from 'sanitize-html';
import validator from 'validator';

// URL validation patterns
const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:'];
const MALICIOUS_PATTERNS = [
  /javascript:/i,
  /data:text\/html/i,
  /vbscript:/i,
  /<script/i,
  /on\w+\s*=/i,
  /eval\s*\(/i,
  /document\.write/i
];

const TRUSTED_DOMAINS = [
  'github.com',
  'google.com',
  'mozilla.org',
  'wikipedia.org',
  'stackoverflow.com'
];

/**
 * Validates and sanitizes URLs for security
 * @param {string} url - URL to validate
 * @returns {string|null} - Sanitized URL or null if invalid/dangerous
 */
export function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Trim and normalize
  url = url.trim();
  
  // Handle magnet links separately
  if (url.startsWith('magnet:')) {
    return validateMagnetUri(url);
  }

  // Check for dangerous protocols
  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (url.toLowerCase().startsWith(protocol)) {
      throw new Error(`Dangerous protocol detected: ${protocol}`);
    }
  }

  // Check for malicious patterns
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(url)) {
      throw new Error('Potentially malicious content detected in URL');
    }
  }

  // Validate URL format
  try {
    // Handle relative URLs and add protocol if missing
    if (!url.includes('://')) {
      if (url.includes('.') && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        // Treat as search query
        return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      }
    }

    const urlObj = new URL(url);
    
    // Validate using validator library
    if (!validator.isURL(url, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
      allow_underscores: false,
      allow_trailing_dot: false,
      allow_protocol_relative_urls: false
    })) {
      throw new Error('Invalid URL format');
    }

    // Additional security checks
    if (urlObj.hostname.includes('..') || urlObj.hostname.includes('localhost')) {
      throw new Error('Potentially dangerous hostname');
    }

    return url;
    
  } catch (error) {
    if (error.message.includes('dangerous') || error.message.includes('malicious')) {
      throw error;
    }
    throw new Error('Invalid URL format');
  }
}

/**
 * Validates magnet URIs
 * @param {string} magnetUri - Magnet URI to validate
 * @returns {string|null} - Valid magnet URI or null
 */
export function validateMagnetUri(magnetUri) {
  if (!magnetUri || !magnetUri.startsWith('magnet:')) {
    return null;
  }

  try {
    // Basic magnet URI format validation
    const magnetRegex = /^magnet:\?xt=urn:[a-z0-9]+:[a-z0-9]{32,40}/i;
    if (!magnetRegex.test(magnetUri)) {
      throw new Error('Invalid magnet URI format');
    }

    // Check for suspicious patterns in magnet links
    if (MALICIOUS_PATTERNS.some(pattern => pattern.test(magnetUri))) {
      throw new Error('Potentially malicious magnet URI');
    }

    // Validate length (prevent extremely long magnet URIs)
    if (magnetUri.length > 2000) {
      throw new Error('Magnet URI too long');
    }

    return magnetUri;
    
  } catch (error) {
    throw new Error(`Invalid magnet URI: ${error.message}`);
  }
}

/**
 * Sanitizes user input to prevent XSS and injection attacks
 * @param {string} input - User input to sanitize
 * @returns {string} - Sanitized input
 */
export function sanitizeInput(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove potential script tags and dangerous content
  const sanitized = sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'escape'
  });

  // Additional cleanup
  return sanitized
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Validates file paths for security
 * @param {string} filePath - File path to validate
 * @returns {boolean} - Whether the path is safe
 */
export function validateFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  // Check for directory traversal attempts
  if (filePath.includes('..') || filePath.includes('~')) {
    return false;
  }

  // Check for absolute paths (should be relative or in allowed directories)
  if (filePath.startsWith('/') || /^[a-zA-Z]:/.test(filePath)) {
    return false;
  }

  // Check for suspicious file extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js'];
  const extension = filePath.toLowerCase().split('.').pop();
  
  if (dangerousExtensions.includes('.' + extension)) {
    return false;
  }

  return true;
}

/**
 * Checks if a domain is in the trusted list
 * @param {string} url - URL to check
 * @returns {boolean} - Whether the domain is trusted
 */
export function isTrustedDomain(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    return TRUSTED_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

/**
 * Generates a Content Security Policy header value
 * @param {Object} options - CSP options
 * @returns {string} - CSP header value
 */
export function generateCSP(options = {}) {
  const defaultCSP = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'connect-src': ["'self'", 'wss:', 'https:'],
    'font-src': ["'self'"],
    'object-src': ["'none'"],
    'media-src': ["'self'", 'blob:', 'data:'],
    'frame-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"]
  };

  const csp = { ...defaultCSP, ...options };
  
  return Object.entries(csp)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

/**
 * Rate limiting for navigation attempts
 */
class RateLimiter {
  constructor(maxAttempts = 10, windowMs = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.attempts = [];
  }

  isAllowed() {
    const now = Date.now();
    
    // Remove old attempts outside the window
    this.attempts = this.attempts.filter(timestamp => 
      now - timestamp < this.windowMs
    );

    // Check if under the limit
    if (this.attempts.length >= this.maxAttempts) {
      return false;
    }

    // Record this attempt
    this.attempts.push(now);
    return true;
  }

  reset() {
    this.attempts = [];
  }
}

export const navigationLimiter = new RateLimiter();

/**
 * Detects suspicious activity patterns
 * @param {Object} activity - Activity data to analyze
 * @returns {Object} - Threat assessment
 */
export function detectSuspiciousActivity(activity) {
  const threats = [];
  
  if (!activity) {
    return { level: 'none', threats: [] };
  }

  // Check for rapid navigation attempts
  if (activity.navigationAttempts > 20) {
    threats.push({
      type: 'rapid_navigation',
      message: 'Unusually high number of navigation attempts detected',
      severity: 'medium'
    });
  }

  // Check for malicious URL patterns
  if (activity.url && MALICIOUS_PATTERNS.some(pattern => pattern.test(activity.url))) {
    threats.push({
      type: 'malicious_url',
      message: 'Potentially malicious URL pattern detected',
      severity: 'high'
    });
  }

  // Check for suspicious file downloads
  if (activity.fileDownloads && activity.fileDownloads > 10) {
    threats.push({
      type: 'excessive_downloads',
      message: 'High number of file downloads detected',
      severity: 'medium'
    });
  }

  // Determine overall threat level
  let level = 'none';
  if (threats.some(t => t.severity === 'high')) {
    level = 'high';
  } else if (threats.some(t => t.severity === 'medium')) {
    level = 'medium';
  } else if (threats.length > 0) {
    level = 'low';
  }

  return { level, threats };
}

/**
 * Validates and sanitizes torrent file names
 * @param {string} fileName - File name to validate
 * @returns {string} - Sanitized file name
 */
export function sanitizeFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return 'unknown-file';
  }

  // Remove dangerous characters
  return fileName
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/^\./, '_')
    .trim()
    .substring(0, 255); // Limit length
}

/**
 * Checks if a file type is safe to download/stream
 * @param {string} fileName - File name to check
 * @returns {boolean} - Whether the file type is safe
 */
export function isSafeFileType(fileName) {
  if (!fileName) return false;
  
  const safeExtensions = [
    // Media files
    '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm',
    '.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac',
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp',
    
    // Documents
    '.pdf', '.txt', '.md', '.rtf',
    
    // Archives (with caution)
    '.zip', '.rar', '.7z', '.tar', '.gz'
  ];
  
  const extension = fileName.toLowerCase().split('.').pop();
  return safeExtensions.includes('.' + extension);
}

/**
 * Logs security events for monitoring
 * @param {string} event - Event type
 * @param {Object} details - Event details
 */
export function logSecurityEvent(event, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    details: {
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...details
    }
  };

  // In a real implementation, this would send to a security monitoring service
  console.warn('Security Event:', logEntry);
  
  // Store locally for development
  if (typeof localStorage !== 'undefined') {
    try {
      const existingLogs = JSON.parse(localStorage.getItem('securityLogs') || '[]');
      existingLogs.push(logEntry);
      
      // Keep only last 100 entries
      if (existingLogs.length > 100) {
        existingLogs.splice(0, existingLogs.length - 100);
      }
      
      localStorage.setItem('securityLogs', JSON.stringify(existingLogs));
    } catch (error) {
      console.error('Failed to store security log:', error);
    }
  }
}