// src/utils/logger.js
// Structured redacting logger for server-side logging (Rule 13.2).
// WHY: Guarantees secrets, auth tokens, passwords, cookies, and keys are NEVER printed to logs.

const SENSITIVE_KEY_REGEX = /password|token|authorization|cookie|apikey|secret/i;

export function redactSensitiveData(obj, seen = new WeakSet()) {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Redact Anthropic keys
    let sanitized = obj.replace(/sk-ant-[a-zA-Z0-9_\-]+/g, 'sk-ant-****');
    // Redact MongoDB connection strings with credentials
    sanitized = sanitized.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/g, '$1****$3');
    // Redact Bearer tokens
    sanitized = sanitized.replace(/(Bearer\s+)[a-zA-Z0-9_\-\.]+/gi, '$1****');
    return sanitized;
  }

  if (typeof obj !== 'object') return obj;

  if (seen.has(obj)) return '[Circular]';
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item, seen));
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      result[key] = '****';
    } else {
      result[key] = redactSensitiveData(value, seen);
    }
  }
  return result;
}

export const logger = {
  info: (msg, meta) => {
    const sanitizedMeta = meta ? redactSensitiveData(meta) : '';
    console.log(`[INFO] ${msg}`, sanitizedMeta || '');
  },
  warn: (msg, meta) => {
    const sanitizedMeta = meta ? redactSensitiveData(meta) : '';
    console.warn(`[WARN] ${msg}`, sanitizedMeta || '');
  },
  error: (msg, meta) => {
    const sanitizedMeta = meta ? redactSensitiveData(meta) : '';
    console.error(`[ERROR] ${msg}`, sanitizedMeta || '');
  }
};
