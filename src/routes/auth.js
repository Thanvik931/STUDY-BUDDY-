// src/routes/auth.js
// Authentication and user sovereignty routes (Rules 13.4, 13.6).
// Handles signup with honeypot & HMAC form tokens, login with timing protection,
// logout, GDPR data export, and account deletion.

import express from 'express';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { getDB } from '../db.js';
import { env } from '../config/env.js';
import { hashPassword, verifyPassword, dummyVerifyPassword, validatePassword } from '../utils/passwords.js';
import { createSession, COOKIE_NAME, getCookieOptions, hashSessionToken, requireUser } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';

const router = express.Router();

// Helper to generate HMAC-signed form token (Rule 13.6)
function generateFormToken() {
  const ts = Date.now().toString();
  const sig = crypto.createHmac('sha256', env.SESSION_SECRET).update(ts).digest('hex');
  return `${ts}.${sig}`;
}

// Helper to verify HMAC-signed form token (Rule 13.6)
function verifyFormToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [tsStr, sig] = parts;
  const ts = parseInt(tsStr, 10);
  if (isNaN(ts)) return false;

  const expectedSig = crypto.createHmac('sha256', env.SESSION_SECRET).update(tsStr).digest('hex');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  const age = Date.now() - ts;
  // Must be at least 3 seconds old and less than 1 hour old (Rule 13.6)
  return age >= 3000 && age < 3600000;
}

// GET /api/auth/form-token - Provides anti-bot HMAC-signed timestamp token
router.get('/auth/form-token', (req, res) => {
  const token = generateFormToken();
  res.status(200).json({ formToken: token });
});

// POST /api/auth/signup - Register a new student user
router.post('/auth/signup', csrfProtection, async (req, res, next) => {
  try {
    const { username, displayName, password, acceptTerms, website, formToken, turnstileToken } = req.body;

    // 1. Bot & Spam Checks (Rule 13.6)
    // Honeypot field must be empty
    if (website && website.trim().length > 0) {
      return res.status(400).json({
        error: { code: 'REGISTRATION_FAILED', message: 'Unable to process registration' }
      });
    }

    // Form token must be valid (at least 3 seconds old, less than 1 hour old)
    if (!verifyFormToken(formToken)) {
      return res.status(400).json({
        error: { code: 'REGISTRATION_FAILED', message: 'Registration session expired or invalid. Please refresh the page.' }
      });
    }

    // Optional Turnstile verification if configured
    if (env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY) {
      if (!turnstileToken) {
        return res.status(400).json({
          error: { code: 'REGISTRATION_FAILED', message: 'Captcha verification is required' }
        });
      }
      try {
        const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `secret=${encodeURIComponent(env.TURNSTILE_SECRET_KEY)}&response=${encodeURIComponent(turnstileToken)}`
        });
        const turnstileData = await turnstileRes.json();
        if (!turnstileData.success) {
          return res.status(400).json({
            error: { code: 'REGISTRATION_FAILED', message: 'Captcha verification failed' }
          });
        }
      } catch (_) {
        return res.status(400).json({
          error: { code: 'REGISTRATION_FAILED', message: 'Captcha verification unavailable' }
        });
      }
    }

    // 2. Input Validation (Rule 13.4)
    if (!username || typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Username must be 3 to 30 characters containing only letters, numbers, and underscores'
        }
      });
    }

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length < 1 || displayName.length > 50) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Display name must be between 1 and 50 characters'
        }
      });
    }

    if (acceptTerms !== true) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'You must accept the Terms and Privacy Policy to create an account'
        }
      });
    }

    // 3. Password Policy Validation
    const passCheck = validatePassword(password, { username, displayName });
    if (!passCheck.valid) {
      return res.status(400).json({
        error: {
          code: 'WEAK_PASSWORD',
          message: passCheck.message
        }
      });
    }

    const db = getDB();
    const usernameLower = username.toLowerCase();

    // Check uniqueness on usernameLower
    const existing = await db.collection('users').findOne({ usernameLower });
    if (existing) {
      return res.status(409).json({
        error: {
          code: 'USERNAME_TAKEN',
          message: 'That username is already taken. Please choose another.'
        }
      });
    }

    // 4. Hash Password & Persist
    const passwordHash = await hashPassword(password);
    const now = new Date();
    const newUser = {
      _id: new ObjectId(),
      username,
      usernameLower,
      displayName: displayName.trim(),
      passwordHash,
      role: 'student',
      acceptedTermsVersion: '1.0',
      acceptedTermsAt: now,
      createdAt: now,
      lastLoginAt: now
    };

    await db.collection('users').insertOne(newUser);

    // 5. Establish Session & Set Cookie
    const token = await createSession(newUser._id);
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        _id: newUser._id.toString(),
        username: newUser.username,
        displayName: newUser.displayName,
        role: newUser.role
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/quick-login - Instant demo student login for seamless local testing
router.post('/auth/quick-login', async (req, res, next) => {
  try {
    const db = getDB();
    const demoUsername = 'student_ravi';
    const usernameLower = demoUsername.toLowerCase();
    let user = await db.collection('users').findOne({ usernameLower });

    const now = new Date();
    if (!user) {
      const passwordHash = await hashPassword('correct horse battery staple');
      user = {
        _id: new ObjectId(),
        username: demoUsername,
        usernameLower,
        displayName: 'Ravi Kumar',
        passwordHash,
        role: 'student',
        acceptedTermsVersion: '1.0',
        acceptedTermsAt: now,
        createdAt: now,
        lastLoginAt: now
      };
      await db.collection('users').insertOne(user);
    } else {
      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { lastLoginAt: now, displayName: 'Ravi Kumar' } }
      );
    }

    const token = await createSession(user._id);
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    res.status(200).json({
      message: 'Logged in successfully as demo student',
      user: {
        _id: user._id.toString(),
        username: user.username,
        displayName: user.displayName,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login - Authenticate student with timing attack mitigation
router.post('/auth/login', csrfProtection, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect username or password' }
      });
    }

    const db = getDB();
    const usernameLower = username.toLowerCase();
    const user = await db.collection('users').findOne({ usernameLower });

    if (!user) {
      // Dummy verification ensures consistent timing when user does not exist (Rule 13.4)
      await dummyVerifyPassword();
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect username or password' }
      });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect username or password' }
      });
    }

    // Login successful: create new session, set cookie, and update lastLoginAt
    const now = new Date();
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: now } }
    );

    const token = await createSession(user._id);
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    res.status(200).json({
      message: 'Login successful',
      user: {
        _id: user._id.toString(),
        username: user.username,
        displayName: user.displayName,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout - Terminate active server session and clear cookie
router.post('/auth/logout', csrfProtection, async (req, res, next) => {
  try {
    const cookieHeader = req.headers['cookie'];
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map((c) => c.trim());
      for (const c of cookies) {
        if (c.startsWith(`${COOKIE_NAME}=`)) {
          const token = decodeURIComponent(c.substring(COOKIE_NAME.length + 1));
          const tokenHash = hashSessionToken(token);
          const db = getDB();
          await db.collection('sessions').deleteOne({ tokenHash });
          break;
        }
      }
    }

    res.clearCookie(COOKIE_NAME, getCookieOptions());
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me - Retrieve current authenticated user profile
router.get('/auth/me', requireUser, (req, res) => {
  res.status(200).json({
    user: {
      _id: req.user._id.toString(),
      username: req.user.username,
      displayName: req.user.displayName,
      role: req.user.role
    }
  });
});

// GET /api/account/export - Export all user data as JSON (Rule 13.4, GDPR/Privacy rights)
router.get('/account/export', requireUser, async (req, res, next) => {
  try {
    const db = getDB();
    const userId = req.user._id;
    const ownerId = req.ownerId;

    // Fetch user memories without embeddings
    const memories = await db.collection('memories')
      .find({ ownerId }, { projection: { embedding: 0 } })
      .toArray();

    // Fetch user quiz attempts
    const attempts = await db.collection('attempts')
      .find({ ownerId })
      .toArray();

    // Fetch topic stats
    const topicStats = await db.collection('topic_stats')
      .find({ ownerId })
      .toArray();

    // Fetch user sessions without token hashes
    const sessions = await db.collection('sessions')
      .find({ userId }, { projection: { tokenHash: 0 } })
      .toArray();

    res.setHeader('Content-Disposition', `attachment; filename="study-buddy-export-${req.user.username}.json"`);
    res.status(200).json({
      exportedAt: new Date().toISOString(),
      user: {
        _id: req.user._id.toString(),
        username: req.user.username,
        displayName: req.user.displayName,
        role: req.user.role,
        createdAt: req.user.createdAt,
        lastLoginAt: req.user.lastLoginAt
      },
      memories,
      attempts,
      topicStats,
      sessions
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/account - Delete user account and all cognitive memories (Rule 13.4)
router.delete('/account', requireUser, csrfProtection, async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        error: { code: 'PASSWORD_REQUIRED', message: 'Current password is required to delete your account' }
      });
    }

    const db = getDB();
    const user = await db.collection('users').findOne({ _id: req.user._id });
    if (!user) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    // Verify password before destructive deletion
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        error: { code: 'INVALID_PASSWORD', message: 'Incorrect password' }
      });
    }

    const userId = user._id;
    const ownerId = req.ownerId;

    // Purge user and all related data across collections
    await Promise.all([
      db.collection('users').deleteOne({ _id: userId }),
      db.collection('sessions').deleteMany({ userId }),
      db.collection('memories').deleteMany({ ownerId }),
      db.collection('attempts').deleteMany({ ownerId }),
      db.collection('topic_stats').deleteMany({ ownerId }),
      db.collection('questions').deleteMany({ ownerId })
    ]);

    res.clearCookie(COOKIE_NAME, getCookieOptions());
    res.status(200).json({
      message: 'Account and all associated cognitive memory data successfully deleted'
    });
  } catch (err) {
    next(err);
  }
});

export default router;
