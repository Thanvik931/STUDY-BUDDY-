// src/config/topics.js
// This file defines the exact subjects and topics supported by Study Buddy.
// Supported subjects: DBMS, OS, DSA (Coding), NETWORKING, SYSTEM_DESIGN.

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
  ],
  DSA: [
    'arrays-strings',
    'trees-graphs',
    'dynamic-programming',
    'sorting-searching',
    'recursion-backtracking'
  ],
  NETWORKING: [
    'osi-tcp-ip',
    'transport-protocols',
    'dns-http',
    'routing-ip',
    'network-security'
  ],
  SYSTEM_DESIGN: [
    'rest-graphql',
    'caching-redis',
    'load-balancing',
    'event-driven',
    'microservices-security'
  ]
};

// Friendly human-readable names for displaying in the user interface
export const TOPIC_LABELS = {
  // DBMS
  'er-model-keys': 'ER Model & Keys (Primary, Foreign, Candidate)',
  'sql-joins': 'SQL Joins (INNER, LEFT, RIGHT, FULL)',
  'normalization': 'Normalization (1NF, 2NF, 3NF, BCNF)',
  'transactions-acid': 'Transactions & ACID Properties',
  'indexing': 'Database Indexing (B-Trees, Hash Indexes)',
  // OS
  'process-scheduling': 'CPU Process Scheduling (FCFS, SJF, Round Robin)',
  'deadlocks': 'Deadlocks & Banker\'s Algorithm',
  'memory-paging': 'Memory Management & Paging',
  'synchronization': 'Process Synchronization & Semaphores',
  'file-systems': 'File Systems & Disk Allocation',
  // DSA / Coding
  'arrays-strings': 'Arrays, Two Pointers & Sliding Window',
  'trees-graphs': 'Binary Trees & Graph Traversals (BFS/DFS)',
  'dynamic-programming': 'Dynamic Programming & Memoization',
  'sorting-searching': 'Binary Search & Sorting Invariants',
  'recursion-backtracking': 'Recursion, Backtracking & Permutations',
  // NETWORKING
  'osi-tcp-ip': 'OSI Model & TCP/IP Protocol Stack',
  'transport-protocols': 'TCP Flow/Congestion Control vs UDP',
  'dns-http': 'DNS, HTTP/1.1, HTTP/2 & HTTPS Handshake',
  'routing-ip': 'IP Addressing, Subnetting & Routing (BGP/OSPF)',
  'network-security': 'Firewalls, TLS/SSL & Cryptography',
  // SYSTEM DESIGN
  'rest-graphql': 'REST APIs vs GraphQL Architecture',
  'caching-redis': 'Caching Strategies (LRU, Write-Through) & Redis',
  'load-balancing': 'Load Balancing, Horizontal Scaling & Sharding',
  'event-driven': 'Message Queues (Kafka, RabbitMQ) & Events',
  'microservices-security': 'Microservices, JWT Authentication & Rate Limiting'
};

export const SUBJECTS = Object.keys(TOPICS);

// Helper function to check if a subject and topic combination is valid
export function isValidTopic(subject, topic) {
  if (!TOPICS[subject]) return false;
  return TOPICS[subject].includes(topic);
}
