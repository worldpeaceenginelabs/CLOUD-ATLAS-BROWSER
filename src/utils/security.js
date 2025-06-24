import validator from 'validator';
import sanitizeHtml from 'sanitize-html';

// Security: URL validation and sanitization
export function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Remove dangerous characters
  const cleaned = url.trim();
  
  // Handle magnet links
  if (cleaned.startsWith('magnet:')) {
    return validateMagnetUri(cleaned);
  }

  // Handle regular URLs
  try {
    const urlObj = new URL(cleaned.startsWith('http') ? cleaned : `https://${cleaned}`);
    
    // Block dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'ftp:'];
    if (dangerousProtocols.includes(urlObj.protocol)) {
      throw new Error('Dangerous protocol detected');
    }

    // Block localhost and private IPs in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = urlObj.hostname.toLowerCase();
      
      const privateDomains = [
        'localhost', '127.0.0.1', '0.0.0.0',
        '10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.',
        '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.',
        '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.'
      ];
      
      if (privateDomains.some(domain => hostname.includes(domain))) {
        throw new Error('Private network access blocked');
      }
    }

    // Validate domain
    if (!validator.isFQDN(urlObj.hostname) && !validator.isIP(urlObj.hostname)) {
      throw new Error('Invalid domain name');
    }

    return urlObj.toString();
  } catch (error) {
    console.warn('URL validation failed:', error.message);
    return null;
  }
}

export function validateMagnetUri(magnetUri) {
  if (!magnetUri || !magnetUri.startsWith('magnet:')) {
    return null;
  }

  try {
    const url = new URL(magnetUri);
    
    // Check for required xt parameter (exact topic)
    const xt = url.searchParams.get('xt');
    if (!xt || !xt.startsWith('urn:btih:')) {
      throw new Error('Invalid magnet URI: missing or invalid xt parameter');
    }

    // Validate info hash
    const hash = xt.replace('urn:btih:', '');
    if (!/^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$/.test(hash)) {
      throw new Error('Invalid magnet URI: invalid info hash');
    }

    // Check URI length (prevent excessively long URIs)
    if (magnetUri.length > 2000) {
      throw new Error('Magnet URI too long');
    }

    return magnetUri;
  } catch (error) {
    console.warn('Magnet URI validation failed:', error.message);
    return null;
  }
}

// Security: Input sanitization
export function sanitizeInput(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Basic sanitization
  let sanitized = input.trim();
  
  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Limit length
  if (sanitized.length > 2048) {
    sanitized = sanitized.substring(0, 2048);
  }

  return sanitized;
}

export function sanitizeHtmlContent(html) {
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'code', 'pre'
    ],
    allowedAttributes: {},
    allowedSchemes: ['https'],
    disallowedTagsMode: 'discard'
  });
}

// Security: File validation
export function validateFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return false;
  }

  // Check for dangerous file extensions
  const dangerousExtensions = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js',
    '.jar', '.app', '.deb', '.pkg', '.dmg', '.sh', '.ps1'
  ];

  const lowerFileName = fileName.toLowerCase();
  if (dangerousExtensions.some(ext => lowerFileName.endsWith(ext))) {
    return false;
  }

  // Check for path traversal attempts
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return false;
  }

  // Check length
  if (fileName.length > 255) {
    return false;
  }

  return true;
}

export function validateFileSize(size) {
  // Maximum file size: 10GB
  const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024;
  return typeof size === 'number' && size > 0 && size <= MAX_FILE_SIZE;
}

// Security: Rate limiting
export class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  isAllowed() {
    const now = Date.now();
    
    // Remove old requests
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.windowMs
    );

    // Check if limit exceeded
    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    this.requests.push(now);
    return true;
  }

  getRemainingRequests() {
    const now = Date.now();
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.windowMs
    );
    return Math.max(0, this.maxRequests - this.requests.length);
  }
}

// Security: Content Security Policy helpers
export function generateCSP() {
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'media-src': ["'self'", 'data:', 'blob:', 'https:'],
    'connect-src': ["'self'", 'wss:', 'ws:', 'https:', 'http:'],
    'font-src': ["'self'", 'data:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': []
  };

  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

// Security: Detect suspicious patterns
export function detectSuspiciousActivity(logs) {
  const patterns = {
    rapidRequests: {
      threshold: 20,
      timeWindow: 60000,
      severity: 'high'
    },
    failedNavigations: {
      threshold: 5,
      timeWindow: 300000,
      severity: 'medium'
    },
    maliciousUrls: {
      patterns: [
        /javascript:/i,
        /data:text\/html/i,
        /vbscript:/i,
        /<script/i
      ],
      severity: 'high'
    }
  };

  const now = Date.now();
  const recentLogs = logs.filter(log => 
    now - new Date(log.timestamp).getTime() < patterns.rapidRequests.timeWindow
  );

  const warnings = [];

  // Check for rapid requests
  if (recentLogs.length > patterns.rapidRequests.threshold) {
    warnings.push({
      type: 'rapid_requests',
      message: 'Unusually high number of requests detected',
      severity: patterns.rapidRequests.severity,
      count: recentLogs.length
    });
  }

  // Check for failed navigations
  const failedNavigations = recentLogs.filter(log => 
    log.message.includes('error') || log.message.includes('failed')
  );
  
  if (failedNavigations.length > patterns.failedNavigations.threshold) {
    warnings.push({
      type: 'failed_navigations',
      message: 'Multiple navigation failures detected',
      severity: patterns.failedNavigations.severity,
      count: failedNavigations.length
    });
  }

  // Check for malicious URLs in logs
  recentLogs.forEach(log => {
    patterns.maliciousUrls.patterns.forEach(pattern => {
      if (pattern.test(log.message)) {
        warnings.push({
          type: 'malicious_url',
          message: 'Potentially malicious URL pattern detected',
          severity: patterns.maliciousUrls.severity,
          details: log.message
        });
      }
    });
  });

  return warnings;
}

// Security: Hash verification
export async function verifyFileHash(file, expectedHash) {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex === expectedHash;
  } catch (error) {
    console.error('Hash verification failed:', error);
    return false;
  }
}

// Security: Safe JSON parsing
export function safeJsonParse(jsonString, fallback = null) {
  try {
    const parsed = JSON.parse(jsonString);
    
    // Prevent prototype pollution
    if (parsed && typeof parsed === 'object') {
      delete parsed.__proto__;
      delete parsed.constructor;
      delete parsed.prototype;
    }
    
    return parsed;
  } catch (error) {
    console.warn('JSON parsing failed:', error);
    return fallback;
  }
}

// Security: Environment detection
export function isSecureContext() {
  return window.isSecureContext && (
    location.protocol === 'https:' || 
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1'
  );
}

export function isElectronContext() {
  return typeof window !== 'undefined' && 
         typeof window.electronAPI !== 'undefined';
}

// Security: Memory cleanup
export function secureCleanup(obj) {
  if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'string' && obj[key].length > 100) {
        obj[key] = null;
      } else if (typeof obj[key] === 'object') {
        secureCleanup(obj[key]);
      }
    });
  }
}

// Export rate limiter instances for common use cases
export const navigationLimiter = new RateLimiter(20, 60000); // 20 navigations per minute
export const downloadLimiter = new RateLimiter(5, 30000);   // 5 downloads per 30 seconds
export const seedingLimiter = new RateLimiter(3, 60000);    // 3 seeding operations per minute