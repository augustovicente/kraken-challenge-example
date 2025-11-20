import { Logger } from '@nestjs/common';

/**
 * Sensitive patterns to redact from logs
 * Includes tokens, passwords, keys, and other sensitive data
 */
const SENSITIVE_PATTERNS = [
  // GitHub tokens
  /ghp_[a-zA-Z0-9]{36}/g,
  /gho_[a-zA-Z0-9]{36}/g,
  /ghu_[a-zA-Z0-9]{36}/g,
  /ghs_[a-zA-Z0-9]{36}/g,
  /ghr_[a-zA-Z0-9]{36}/g,

  // Generic bearer tokens
  /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,

  // API keys (common patterns)
  /['"](api[_-]?key|apikey)['"]\s*[:=]\s*['"][^'"]+['"]/gi,
  /['"](secret|password|passwd|pwd)['"]\s*[:=]\s*['"][^'"]+['"]/gi,

  // URLs with embedded tokens
  /https?:\/\/[^:@\s]+:[^@\s]+@[^\s]+/g,
  /x-access-token:[a-zA-Z0-9\-._~+/]+=*@/g,

  // Environment variable assignments
  /(GITHUB_TOKEN|AI_CLI_KEY|API_KEY|SECRET|PASSWORD)=[^\s]+/gi,

  // JWT tokens
  /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,

  // AWS keys
  /AKIA[0-9A-Z]{16}/g,

  // Private keys
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
];

/**
 * Redact sensitive information from a string
 */
function redactSensitiveData(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let redacted = text;

  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, match => {
      // For URLs, preserve the structure but hide the credentials
      if (match.includes('@')) {
        const parts = match.split('@');
        return '[REDACTED]@' + parts[parts.length - 1];
      }

      // For key=value patterns, preserve the key name
      if (match.includes('=')) {
        const [key] = match.split('=');
        return `${key}=[REDACTED]`;
      }

      // For quoted strings, preserve the key name if present
      if (match.includes(':') || match.includes('=')) {
        const colonIndex = Math.max(match.indexOf(':'), match.indexOf('='));
        return match.substring(0, colonIndex + 1) + ' "[REDACTED]"';
      }

      // Default: replace entire match
      return '[REDACTED]';
    });
  }

  return redacted;
}

/**
 * Recursively redact sensitive data from objects.
 */

function redactObject(obj: object): string | object {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return redactSensitiveData(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item));
  }

  if (typeof obj === 'object') {
    const redacted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Redact known sensitive keys entirely
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        (lowerKey.includes('key') && !lowerKey.includes('keyname')) ||
        lowerKey.includes('auth')
      ) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactObject(value);
      }
    }
    return redacted;
  }

  return obj;
}

/**
 * Secure logger that automatically redacts sensitive information
 */
export class SecureLogger extends Logger {
  private redactionEnabled: boolean;

  constructor(context?: string) {
    super(context);
    // Check if redaction is enabled via environment variable
    this.redactionEnabled = process.env.REDACT_SENSITIVE_LOGS !== 'false';
  }

  /**
   * Log with automatic redaction
   */
  log(message: any, context?: string): void {
    super.log(this.redact(message), context);
  }

  /**
   * Error log with automatic redaction
   */
  error(message: any, trace?: string, context?: string): void {
    super.error(this.redact(message), this.redact(trace), context);
  }

  /**
   * Warn log with automatic redaction
   */
  warn(message: any, context?: string): void {
    super.warn(this.redact(message), context);
  }

  /**
   * Debug log with automatic redaction
   */
  debug(message: any, context?: string): void {
    super.debug(this.redact(message), context);
  }

  /**
   * Verbose log with automatic redaction
   */
  verbose(message: any, context?: string): void {
    super.verbose(this.redact(message), context);
  }

  /**
   * Redact sensitive data if redaction is enabled
   */
  private redact(data: any): any {
    if (!this.redactionEnabled) {
      return data;
    }

    if (data instanceof Error) {
      return {
        name: data.name,
        message: redactSensitiveData(data.message),
        stack: data.stack ? redactSensitiveData(data.stack) : undefined,
      };
    }

    if (typeof data === 'string') {
      return redactSensitiveData(data);
    }

    if (typeof data === 'object') {
      return redactObject(data);
    }

    return data;
  }
}

/**
 * Create a secure logger instance
 */
export function createSecureLogger(context?: string): SecureLogger {
  return new SecureLogger(context);
}

/**
 * Utility function to manually redact sensitive data
 * Useful for scenarios where you need to redact before logging
 */
export function redact(data: any): any {
  if (typeof data === 'string') {
    return redactSensitiveData(data);
  }
  return redactObject(data);
}
