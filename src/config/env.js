// src/config/env.js
// Strict environment variable validation and runtime configuration (Rule 13.2).
// WHY: Fails fast at startup with clear messages that never print secret values.

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test'], {
    errorMap: () => ({ message: 'NODE_ENV must be "development", "production", or "test"' })
  }).default('development'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required to connect to MongoDB Atlas'),
  MONGODB_DB: z.string().min(1, 'MONGODB_DB is required').default('study_buddy_db'),

  ANTHROPIC_API_KEY: z.string().optional().default(''),
  EMBEDDING_API_KEY: z.string().optional().default(''),

  SESSION_SECRET: z.string().min(64, 'SESSION_SECRET must be at least 32 random bytes represented as hex (at least 64 hex characters)').refine((val) => {
    if (!/^[0-9a-fA-F]+$/.test(val)) return false;
    const lower = val.toLowerCase();
    const bannedPlaceholders = ['changeme', 'secret', 'password', '12345678', 'session_secret'];
    return !bannedPlaceholders.some((b) => lower.includes(b));
  }, {
    message: 'SESSION_SECRET must be valid hex and cannot contain common placeholder words'
  }),

  SITE_URL: z.string().url('SITE_URL must be a valid URL'),

  CONTACT_EMAIL: z.string().email('CONTACT_EMAIL must be a valid email address'),

  // Server & Pooling
  PORT: z.coerce.number().int().positive().default(3000),
  MONGO_MAX_POOL: z.coerce.number().int().positive().default(50),

  // Embedding & AI Model Settings
  EMBEDDING_PROVIDER: z.string().default('local'),
  EMBEDDING_MODEL: z.string().default('local-sentence-embedding'),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  AI_MODEL: z.string().default('claude-3-5-haiku-20241022'),

  // Testing & Development Tools (Must be strictly false in production)
  DEMO_MODE: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(false)),
  STRESS_MODE: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(false)),
  FAIL_EMBEDDING: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(false)),
  FAIL_AI: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(false)),
  DELAY_AI_MS: z.coerce.number().int().nonnegative().default(0),
  STRESS_TARGET: z.string().default(''),
  STRESS_DB_TIER: z.string().default('Atlas M0'),

  // Optional Launch & Admin Settings
  ALLOWED_ORIGINS: z.string().optional().default(''),
  ADMIN_ROUTES_ENABLED: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(false)),
  ANALYTICS_PROVIDER: z.enum(['none', 'plausible', 'umami', 'goatcounter']).default('none'),
  ANALYTICS_SRC: z.string().optional().default(''),
  ANALYTICS_SITE_ID: z.string().optional().default(''),
  TURNSTILE_SITE_KEY: z.string().optional().default(''),
  TURNSTILE_SECRET_KEY: z.string().optional().default('')
}).superRefine((data, ctx) => {
  // In production, SITE_URL must start with https://
  if (data.NODE_ENV === 'production') {
    if (!data.SITE_URL.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SITE_URL'],
        message: 'SITE_URL must start with https:// in production'
      });
    }

    // Server must refuse to start if NODE_ENV=production and STRESS_MODE or DEMO_MODE is true
    if (data.STRESS_MODE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STRESS_MODE'],
        message: 'STRESS_MODE cannot be enabled in production environment'
      });
    }

    if (data.DEMO_MODE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DEMO_MODE'],
        message: 'DEMO_MODE cannot be enabled in production environment'
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Configuration error in environment:');
  for (const issue of parsed.error.issues) {
    // Redaction invariant: NEVER print actual values!
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

// Runtime stress testing flags (Active ONLY when STRESS_MODE=true and NODE_ENV is not production)
let runtimeStressFlags = {
  failEmbedding: env.FAIL_EMBEDDING,
  failAi: env.FAIL_AI,
  delayAiMs: env.DELAY_AI_MS
};

export function getStressFlags() {
  if (!env.STRESS_MODE || env.NODE_ENV === 'production') {
    return {
      failEmbedding: false,
      failAi: false,
      delayAiMs: 0
    };
  }
  return { ...runtimeStressFlags };
}

export function setStressFlags(newFlags) {
  if (!env.STRESS_MODE || env.NODE_ENV === 'production') {
    throw new Error('Cannot set stress flags: STRESS_MODE is disabled or NODE_ENV is production');
  }
  runtimeStressFlags = {
    ...runtimeStressFlags,
    ...newFlags
  };
  return { ...runtimeStressFlags };
}

export function resetStressFlags() {
  runtimeStressFlags = {
    failEmbedding: env.FAIL_EMBEDDING,
    failAi: env.FAIL_AI,
    delayAiMs: env.DELAY_AI_MS
  };
  return { ...runtimeStressFlags };
}
