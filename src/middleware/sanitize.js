// src/middleware/sanitize.js
// Input sanitization and NoSQL operator-injection prevention middleware (Rule 13.5).
// WHY: Rejects MongoDB operators ($ne, $where, etc.) and dot-notation paths in JSON keys,
// normalizes Unicode (NFC), and strips malicious control characters.

export function sanitizeInputs(req, res, next) {
  function checkObject(obj, isKeyCheckOnly = false) {
    if (!obj || typeof obj !== 'object') return true;

    for (const [key, val] of Object.entries(obj)) {
      // Reject any key starting with $ or containing . (Rule 13.5)
      if (key.startsWith('$') || key.includes('.')) {
        return false;
      }

      if (val && typeof val === 'object') {
        if (!checkObject(val)) return false;
      }
    }
    return true;
  }

  // Check req.query for operator injection
  if (req.query && !checkObject(req.query)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_INPUT_KEY',
        message: 'Object keys must not contain MongoDB operators ($) or dot notation (.)'
      }
    });
  }

  // Check req.body for operator injection
  if (req.body && !checkObject(req.body)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_INPUT_KEY',
        message: 'Object keys must not contain MongoDB operators ($) or dot notation (.)'
      }
    });
  }

  // Helper to sanitize strings: trim, NFC normalize, and strip control characters
  function sanitizeValue(val) {
    if (typeof val === 'string') {
      return val
        .normalize('NFC')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }
    if (Array.isArray(val)) {
      return val.map(sanitizeValue);
    }
    if (val && typeof val === 'object') {
      const sanitized = {};
      for (const [k, v] of Object.entries(val)) {
        sanitized[k] = sanitizeValue(v);
      }
      return sanitized;
    }
    return val;
  }

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }

  next();
}
