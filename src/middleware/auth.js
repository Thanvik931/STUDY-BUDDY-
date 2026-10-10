// src/middleware/auth.js
// Session authentication, requireUser, and requireAdmin guards (Rule 13.4).
// WHY: Enforces server-side session cookies (__Host-sid in prod), rolls idle expiry,
// caps sessions to 5 per user, and ensures ownerId is ALWAYS derived from the logged-in user.

import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDB } from '../db.js';
import { env } from '../config/env.js';

export const COOKIE_NAME = env.NODE_ENV === 'production' ? '__Host-sid' : 'sid';

export function getCookieOptions() {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days absolute maximum
  };
}

export function hashSessionToken(token) {
  return crypto.createHmac('sha256', env.SESSION_SECRET).update(token).digest('hex');
}

/**
 * Creates a new cryptographically secure session document in MongoDB.
 * Caps active sessions per user to 5 by pruning oldest.
 */
export async function createSession(userId) {
  const db = getDB();
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h idle

  // Cap sessions to maximum 5 per user: prune oldest if needed
  const userSessions = await db.collection('sessions')
    .find({ userId })
    .sort({ createdAt: 1 })
    .toArray();

  if (userSessions.length >= 5) {
    const excess = userSessions.length - 4; // leave 4 so new makes 5
    const toDeleteIds = userSessions.slice(0, excess).map((s) => s._id);
    await db.collection('sessions').deleteMany({ _id: { $in: toDeleteIds } });
  }

  await db.collection('sessions').insertOne({
    tokenHash,
    userId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt
  });

  return token;
}

/**
 * Extracts and parses cookie from incoming request headers
 */
function getSessionTokenFromRequest(req) {
  const cookieHeader = req.headers['cookie'];
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const c of cookies) {
    if (c.startsWith(`${COOKIE_NAME}=`)) {
      return decodeURIComponent(c.substring(COOKIE_NAME.length + 1));
    }
  }
  return null;
}

/**
 * Middleware: requireUser
 * Requires a valid, non-expired session cookie.
 * Attaches req.user, req.ownerId, and req.session.
 */
export async function requireUser(req, res, next) {
  const token = getSessionTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    });
  }

  const tokenHash = hashSessionToken(token);
  const now = new Date();

  try {
    const db = getDB();
    const session = await db.collection('sessions').findOne({
      tokenHash,
      expiresAt: { $gt: now }
    });

    if (!session) {
      res.clearCookie(COOKIE_NAME, getCookieOptions());
      return res.status(401).json({
        error: {
          code: 'INVALID_SESSION',
          message: 'Session is invalid or has expired'
        }
      });
    }

    // Lookup user by session.userId (never selecting passwordHash)
    const user = await db.collection('users').findOne(
      { _id: session.userId },
      { projection: { passwordHash: 0 } }
    );

    if (!user) {
      res.clearCookie(COOKIE_NAME, getCookieOptions());
      return res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Associated user account not found'
        }
      });
    }

    // Roll idle expiry: 24h idle, max 7d absolute
    const absoluteLimit = new Date(session.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const newIdleExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const rolledExpiry = newIdleExpiry < absoluteLimit ? newIdleExpiry : absoluteLimit;

    await db.collection('sessions').updateOne(
      { _id: session._id },
      { $set: { lastSeenAt: now, expiresAt: rolledExpiry } }
    );

    // Attach verified user and enforce ownerId
    req.user = user;
    req.ownerId = user._id.toString();
    req.session = session;

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware: requireAdmin
 * Verifies that the authenticated user possesses the 'admin' role.
 */
export async function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN_ADMIN_REQUIRED',
        message: 'Administrator privileges are required for this action'
      }
    });
  }
  next();
}

/**
 * Logs an administrative action to admin_audit collection (90-day retention)
 */
export async function logAdminAudit(adminId, action, target, details = {}) {
  try {
    const db = getDB();
    await db.collection('admin_audit').insertOne({
      adminId,
      action,
      target,
      details,
      timestamp: new Date()
    });
  } catch (err) {
    console.warn('Failed to record admin audit log:', err.message);
  }
}
