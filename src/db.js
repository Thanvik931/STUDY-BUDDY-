// src/db.js
// This file manages our connection to MongoDB Atlas using the official MongoDB Node.js driver.
// WHY: We create a SINGLE, shared MongoClient instance rather than opening a new connection
// on every request. This is called connection pooling, and it prevents exhausting database connections.

import { MongoClient } from 'mongodb';
import { env } from './config/env.js';

let client = null;
let db = null;

// Connect to MongoDB Atlas with a 5000ms server selection timeout
export async function connectDB() {
  if (db) return db;

  try {
    client = new MongoClient(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Do not hang forever if MongoDB is unreachable
      maxPoolSize: env.MONGO_MAX_POOL, // Maintain connection pool size from config (default 20)
      maxIdleTimeMS: 60000 // Close idle connections after 60 seconds to release Atlas tier resources
    });

    await client.connect();

    // Determine database name: use study_buddy_stress in stress mode to isolate test workloads,
    // or use MONGODB_DB (defaults to study_buddy_db) in regular operation.
    const targetDbName = env.STRESS_MODE
      ? 'study_buddy_stress'
      : (env.MONGODB_DB || 'study_buddy_db');
    db = client.db(targetDbName);
    
    // Quick ping command to verify cluster health
    await db.command({ ping: 1 });
    console.log(` Connected to MongoDB Atlas database: "${db.databaseName}" (Pool: ${env.MONGO_MAX_POOL}, Stress mode: ${env.STRESS_MODE})`);
    return db;
  } catch (err) {
    console.error(' Failed to connect to MongoDB Atlas:', err.message);
    throw err;
  }
}

// Return the active database instance
export function getDB() {
  if (!db) {
    throw new Error('Database not initialized! Call connectDB() first.');
  }
  return db;
}

// Gracefully close the database connection when the server stops
export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log(' Closed MongoDB connection.');
  }
}
