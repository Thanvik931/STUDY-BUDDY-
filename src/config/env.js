// src/config/env.js
// This file reads our environment variables (.env file) and checks that they are valid.
// WHY: If the server starts with a missing or misspelled configuration, we want it to tell us
// immediately in plain English, rather than crashing mysteriously in the middle of a user request.

import dotenv from 'dotenv';
import { z } from 'zod';

// Load variables from the .env file into process.env
dotenv.config();

// Schema describing every environment variable we accept
const envSchema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required to connect to MongoDB Atlas'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  EMBEDDING_PROVIDER: z.string().default('local'),
  EMBEDDING_MODEL: z.string().default('local-sentence-embedding'),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),
  EMBEDDING_API_KEY: z.string().optional().default(''),
  AI_MODEL: z.string().default('claude-3-5-haiku-20241022'),
  PORT: z.coerce.number().default(3000),
  DEMO_MODE: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(true)),

  // Stress Testing & Resilience Flags
  STRESS_MODE: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(false)),
  FAIL_EMBEDDING: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(false)),
  FAIL_AI: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(false)),
  DELAY_AI_MS: z.coerce.number().default(0),
  MONGODB_DB: z.string().default('study_buddy_db'),
  MONGO_MAX_POOL: z.coerce.number().default(20),
  STRESS_TARGET: z.string().default(''),
  STRESS_DB_TIER: z.string().default('Atlas M0')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Configuration error in .env file:');
  for (const issue of parsed.error.issues) {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
