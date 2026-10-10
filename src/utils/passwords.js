// src/utils/passwords.js
// Cryptographically secure password hashing and policy enforcement (Rule 13.4).
// WHY: Enforces modern Argon2id hashing with scrypt fallback, dummy timing equalization,
// and rejects the top 200 common passwords.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

let argon2 = null;
try {
  argon2 = await import('argon2');
} catch (_) {
  argon2 = null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const passwordsFile = path.join(__dirname, '../../data/common-passwords.txt');

// Load common passwords list into memory
const commonPasswords = new Set();
try {
  if (fs.existsSync(passwordsFile)) {
    const lines = fs.readFileSync(passwordsFile, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed) commonPasswords.add(trimmed);
    }
  }
} catch (err) {
  console.warn('️ Could not load data/common-passwords.txt:', err.message);
}

// Scrypt configuration fallback (Rule 13.4)
const SCRYPT_CONFIG = {
  N: 131072,
  r: 8,
  p: 1,
  keyLen: 64,
  maxmem: 256 * 1024 * 1024
};

// Pre-computed dummy hash for timing-safe failed lookups
const DUMMY_HASH = argon2
  ? await argon2.hash('dummy_timing_protection_password', { memoryCost: 19456, timeCost: 2, parallelism: 1 })
  : '$scrypt$N=131072,r=8,p=1$1234567890abcdef$1234567890abcdef';

/**
 * Validates password against the strict policy:
 * - 10 to 128 characters
 * - Any characters allowed (no archaic composition rules)
 * - Reject if equal to username or display name
 * - Reject if in data/common-passwords.txt
 */
export function validatePassword(password, { username = '', displayName = '' } = {}) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }

  if (password.length < 10) {
    return { valid: false, message: 'Password must be at least 10 characters long' };
  }

  if (password.length > 128) {
    return { valid: false, message: 'Password must not exceed 128 characters' };
  }

  const cleanPass = password.toLowerCase();
  if (username && cleanPass === username.toLowerCase()) {
    return { valid: false, message: 'Password cannot be the same as your username' };
  }

  if (displayName && cleanPass === displayName.toLowerCase()) {
    return { valid: false, message: 'Password cannot be the same as your display name' };
  }

  if (commonPasswords.has(cleanPass)) {
    return { valid: false, message: 'Password is too common and easily guessed. Please choose a more unique passphrase.' };
  }

  return { valid: true };
}

/**
 * Hashes a plaintext password using Argon2id (or scrypt fallback)
 */
export async function hashPassword(password) {
  if (argon2) {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1
    });
  }

  // Scrypt fallback
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_CONFIG.keyLen, {
      N: SCRYPT_CONFIG.N,
      r: SCRYPT_CONFIG.r,
      p: SCRYPT_CONFIG.p,
      maxmem: SCRYPT_CONFIG.maxmem
    }, (err, derivedKey) => {
      if (err) return reject(err);
      const hashStr = `$scrypt$N=${SCRYPT_CONFIG.N},r=${SCRYPT_CONFIG.r},p=${SCRYPT_CONFIG.p}$${salt}$${derivedKey.toString('hex')}`;
      resolve(hashStr);
    });
  });
}

/**
 * Verifies a plaintext password against a stored hash string
 */
export async function verifyPassword(password, hash) {
  if (!hash || typeof hash !== 'string') return false;

  if (hash.startsWith('$argon2') && argon2) {
    try {
      return await argon2.verify(hash, password);
    } catch (_) {
      return false;
    }
  }

  if (hash.startsWith('$scrypt$')) {
    try {
      const parts = hash.split('$');
      // Format: ['', 'scrypt', 'N=131072,r=8,p=1', salt, hashHex]
      const salt = parts[3];
      const storedHex = parts[4];
      return new Promise((resolve) => {
        crypto.scrypt(password, salt, SCRYPT_CONFIG.keyLen, {
          N: SCRYPT_CONFIG.N,
          r: SCRYPT_CONFIG.r,
          p: SCRYPT_CONFIG.p,
          maxmem: SCRYPT_CONFIG.maxmem
        }, (err, derivedKey) => {
          if (err) return resolve(false);
          const bufA = Buffer.from(storedHex, 'hex');
          const bufB = derivedKey;
          if (bufA.length !== bufB.length) return resolve(false);
          resolve(crypto.timingSafeEqual(bufA, bufB));
        });
      });
    } catch (_) {
      return false;
    }
  }

  return false;
}

/**
 * Runs a dummy verification when a username does not exist to equalize timing
 */
export async function dummyVerifyPassword() {
  if (argon2) {
    try {
      await argon2.verify(DUMMY_HASH, 'incorrect_dummy_guess');
    } catch (_) {}
  }
}
