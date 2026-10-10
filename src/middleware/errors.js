// src/middleware/errors.js
// Centralized error handling middleware (Rules 13.2, 13.5).
// WHY: Security & privacy: logs full error server-side with requestId, masks internal stack traces,
// and guarantees standard response shape { error: { code, message, requestId } }.

import crypto from 'crypto';
import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  const requestId = req.id || crypto.randomUUID();

  // Log full error server-side with requestId (Rule 13.2)
  logger.error(`Unhandled error [${requestId}] on ${req.method} ${req.originalUrl}:`, {
    message: err.message,
    name: err.name,
    code: err.code,
    stack: err.stack
  });

  let statusCode = err.status || err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected server error occurred.';

  // Handle specific known error types
  if (err.name === 'ZodError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = err.issues?.[0]?.message || 'Input validation failed.';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    code = 'REQUEST_TOO_LARGE';
    message = 'Request payload exceeds the 10kb limit.';
  } else if (statusCode === 500) {
    // Mask raw database errors to prevent internal details disclosure
    code = 'INTERNAL_SERVER_ERROR';
    message = 'An unexpected server error occurred. Please try again.';
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      requestId
    }
  });
}

// Handler for 404 Not Found on API routes (Rule 13.5)
export function notFoundHandler(req, res) {
  const requestId = req.id || crypto.randomUUID();
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `API endpoint ${req.method} ${req.originalUrl} not found`,
      requestId
    }
  });
}
