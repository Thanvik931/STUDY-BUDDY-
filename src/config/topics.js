// src/config/topics.js
// This file defines the exact subjects and topics supported by Study Buddy.
// WHY: We lock down the allowed topics here so students and AI always use
// consistent identifiers, preventing typos or invalid questions in the database.

export const TOPICS = {
  DBMS: [
    'er-model-keys',
    'sql-joins',
    'normalization',
    'transactions-acid',
    'indexing'
  ],
  OS: [
    'process-scheduling',
    'deadlocks',
    'memory-paging',
    'synchronization',
    'file-systems'
  ]
};

// Friendly human-readable names for displaying in the user interface
export const TOPIC_LABELS = {
  'er-model-keys': 'ER Model & Keys (Primary, Foreign, Candidate)',
  'sql-joins': 'SQL Joins (INNER, LEFT, RIGHT, FULL)',
  'normalization': 'Normalization (1NF, 2NF, 3NF, BCNF)',
  'transactions-acid': 'Transactions & ACID Properties',
  'indexing': 'Database Indexing (B-Trees, Hash Indexes)',
  'process-scheduling': 'CPU Process Scheduling (FCFS, SJF, Round Robin)',
  'deadlocks': 'Deadlocks & Banker\'s Algorithm',
  'memory-paging': 'Memory Management & Paging',
  'synchronization': 'Process Synchronization & Semaphores',
  'file-systems': 'File Systems & Disk Allocation'
};

export const SUBJECTS = Object.keys(TOPICS);

// Helper function to check if a subject and topic combination is valid
export function isValidTopic(subject, topic) {
  if (!TOPICS[subject]) return false;
  return TOPICS[subject].includes(topic);
}
