// src/setupIndexes.js
// This script initializes our MongoDB collections, strict $jsonSchema validators,
// and all required performance, TTL, and Vector Search indexes.
// WHY: Running this once via 'npm run setup' ensures the database is fully prepared,
// validated, and indexed before the application takes its first request.

import { connectDB, closeDB } from './db.js';
import { env } from './config/env.js';
import { memoriesSchema, attemptsSchema } from './logic/validators.js';

async function applyCollectionValidator(db, collectionName, validatorDoc) {
  try {
    const collections = await db.listCollections({ name: collectionName }).toArray();
    if (collections.length === 0) {
      await db.createCollection(collectionName, {
        validator: validatorDoc,
        validationLevel: 'strict'
      });
      console.log(`✅ Created collection "${collectionName}" with strict $jsonSchema validation.`);
    } else {
      await db.command({
        collMod: collectionName,
        validator: validatorDoc,
        validationLevel: 'strict'
      });
      console.log(`✅ Updated collection "${collectionName}" with strict $jsonSchema validation.`);
    }
  } catch (err) {
    console.warn(`⚠️ Warning setting validator on "${collectionName}": ${err.message}`);
  }
}

export async function setupAll() {
  console.log('🚀 Running MongoDB setup for Study Buddy...');
  const db = await connectDB();

  try {
    // 1. Ensure other collections exist
    const requiredCollections = ['students', 'memories', 'attempts', 'questions', 'topic_stats'];
    const existing = await db.listCollections().toArray();
    const existingNames = new Set(existing.map((c) => c.name));

    for (const name of requiredCollections) {
      if (!existingNames.has(name)) {
        if (name === 'memories') {
          await applyCollectionValidator(db, 'memories', memoriesSchema);
        } else if (name === 'attempts') {
          await applyCollectionValidator(db, 'attempts', attemptsSchema);
        } else {
          await db.createCollection(name);
          console.log(`✅ Created collection "${name}".`);
        }
      } else {
        if (name === 'memories') {
          await applyCollectionValidator(db, 'memories', memoriesSchema);
        } else if (name === 'attempts') {
          await applyCollectionValidator(db, 'attempts', attemptsSchema);
        }
      }
    }

    // 2. Indexes for 'memories' collection
    console.log('⚡ Creating indexes on "memories"...');
    // Compound index for instant student-scoped queries
    await db.collection('memories').createIndex(
      { ownerId: 1, status: 1, subject: 1, topic: 1 },
      { name: 'memories_owner_status_subject_topic_idx' }
    );
    // TTL index: auto-deletes expired memories when expiresAt date is reached
    await db.collection('memories').createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: 'memories_ttl_idx' }
    );

    // 3. Indexes for 'topic_stats' collection
    console.log('⚡ Creating indexes on "topic_stats"...');
    // Unique compound index: one stats document per student per topic
    await db.collection('topic_stats').createIndex(
      { ownerId: 1, subject: 1, topic: 1 },
      { unique: true, name: 'topic_stats_unique_owner_topic_idx' }
    );

    // 4. Indexes for 'attempts' collection
    console.log('⚡ Creating indexes on "attempts"...');
    // Fast chronological history of student quiz attempts
    await db.collection('attempts').createIndex(
      { ownerId: 1, createdAt: -1 },
      { name: 'attempts_owner_created_idx' }
    );

    // 5. Indexes for 'questions' collection
    console.log('⚡ Creating indexes on "questions"...');
    // TTL index: un-answered generated questions auto-expire after 24 hours (86400 seconds)
    await db.collection('questions').createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 86400, name: 'questions_24h_ttl_idx' }
    );

    // 6. Atlas Vector Search index on 'memories'
    console.log('🔍 Setting up Atlas Vector Search index ("memory_vector_index")...');
    const vectorIndexDefinition = {
      name: 'memory_vector_index',
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            numDimensions: env.EMBEDDING_DIMENSIONS,
            similarity: 'cosine'
          },
          { type: 'filter', path: 'ownerId' },
          { type: 'filter', path: 'status' },
          { type: 'filter', path: 'type' },
          { type: 'filter', path: 'subject' }
        ]
      }
    };

    try {
      if (typeof db.collection('memories').createSearchIndex === 'function') {
        await db.collection('memories').createSearchIndex(vectorIndexDefinition);
        console.log('✅ Atlas Vector Search index "memory_vector_index" created successfully via driver API.');
      } else {
        throw new Error('createSearchIndex method not available on this driver/cluster version.');
      }
    } catch (vectorErr) {
      console.log('ℹ️ Note on Atlas Vector Search index creation:');
      console.log(`   ${vectorErr.message}`);
      console.log('\n--- MANUAL ATLAS DASHBOARD STEPS (IF NOT CREATED) ---');
      console.log('1. Go to your MongoDB Atlas dashboard -> Database -> Atlas Search.');
      console.log('2. Click "Create Search Index" -> Select "JSON Editor".');
      console.log('3. Target collection: "study_buddy_db.memories".');
      console.log('4. Paste this exact JSON configuration:');
      console.log(JSON.stringify(vectorIndexDefinition.definition, null, 2));
      console.log('-----------------------------------------------------\n');
    }

    console.log('🎉 MongoDB setup completed successfully!');
  } finally {
    await closeDB();
  }
}

// If run directly via command line
if (process.argv[1]?.endsWith('setupIndexes.js')) {
  setupAll()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal setup error:', err);
      process.exit(1);
    });
}
