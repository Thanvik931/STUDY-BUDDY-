// src/middleware/csrf.js
// CSRF protection middleware for state-changing HTTP requests (Rule 13.4).
// WHY: Blocks cross-site request forgery without session bloat by verifying
// JSON content-type, Origin header against SITE_URL, and custom header fallback.

import { env } from '../config/env.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // 1. Require Content-Type application/json (Rule 13.4)
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return res.status(415).json({
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Content-Type must be application/json'
      }
    });
  }

  // 2. Check Origin header if present
  const originHeader = req.headers['origin'];
  if (originHeader) {
    try {
      const allowedOrigin = new URL(env.SITE_URL).origin;
      const requestOrigin = new URL(originHeader).origin;

      if (requestOrigin !== allowedOrigin) {
        return res.status(403).json({
          error: {
            code: 'CSRF_ORIGIN_MISMATCH',
            message: 'Cross-origin requests are forbidden'
          }
        });
      }
    } catch (_) {
      return res.status(403).json({
        error: {
          code: 'CSRF_INVALID_ORIGIN',
          message: 'Origin header is invalid'
        }
      });
    }
  } else {
    // 3. If Origin is absent, require header X-Requested-With: study-buddy (Rule 13.4)
    const requestedWith = req.headers['x-requested-with'];
    if (requestedWith !== 'study-buddy') {
      return res.status(403).json({
        error: {
          code: 'CSRF_HEADER_MISSING',
          message: 'Requests without Origin must provide X-Requested-With: study-buddy'
        }
      });
    }
  }

  next();
}
