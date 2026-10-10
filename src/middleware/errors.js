// src/middleware/errors.js
// Central error handling middleware.
// WHY: Security & consistency:
// 1. Enforces standardized error shape { error: { code, message } }.
// 2. Never leaks database details, stack traces, or credentials to the client.

export function errorHandler(err, req, res, next) {
  // Log full error on server for debugging
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message);

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
    // Mask raw database errors to prevent information disclosure
    message = 'An unexpected server error occurred. Please try again.';
  }

  res.status(statusCode).json({
    error: {
      code,
      message
    }
  });
}

// Handler for 404 Not Found on API routes
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `API endpoint ${req.method} ${req.originalUrl} not found`
    }
  });
}
