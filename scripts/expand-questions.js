// scripts/expand-questions.js
// Expands questionBank.json to 50+ verified engineering questions across all DBMS and OS topics.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const qbPath = path.join(__dirname, '../data/questionBank.json');

const current = JSON.parse(fs.readFileSync(qbPath, 'utf-8'));

const newQuestions = [
  // DBMS: sql-joins
  {
    id: 'dbms-sql-4',
    subject: 'DBMS',
    topic: 'sql-joins',
    question: 'What is the danger of placing a filter on the right table in the WHERE clause instead of the ON clause in a LEFT JOIN?',
    options: [
      'It converts the LEFT JOIN into an INNER JOIN by filtering out NULLs',
      'It causes a syntax error in all SQL dialects',
      'It performs a CROSS JOIN instead',
      'It drops the left table from the database'
    ],
    correctIndex: 0,
    explanation: 'If you put right_table.status = 1 in the WHERE clause, any non-matching rows from the left table (where right_table is NULL) are discarded, effectively turning the query into an INNER JOIN.',
    difficulty: 'hard'
  },
  {
    id: 'dbms-sql-5',
    subject: 'DBMS',
    topic: 'sql-joins',
    question: 'When joining a table to itself (Self-Join), what SQL technique is mandatory?',
    options: [
      'Using table aliases (AS t1, AS t2) to distinguish column references',
      'A primary key constraint on both tables',
      'A temporary table created in tempdb',
      'A CROSS JOIN clause'
    ],
    correctIndex: 0,
    explanation: 'Self-joins require aliases so the SQL query engine and parser can differentiate between the two instances of the same table in the ON condition.',
    difficulty: 'medium'
  },
  // DBMS: er-model-keys
  {
    id: 'dbms-er-4',
    subject: 'DBMS',
    topic: 'er-model-keys',
    question: 'Given relation R(A, B, C, D) with functional dependencies { A -> B, B -> C, C -> D }. What is the minimal candidate key?',
    options: ['{A}', '{A, B}', '{B, C}', '{D}'],
    correctIndex: 0,
    explanation: 'Since A determines B, which determines C, which determines D, the closure of {A} contains all attributes {A, B, C, D}. Because A does not appear on any RHS, {A} is the only minimal candidate key.',
    difficulty: 'hard'
  },
  {
    id: 'dbms-er-5',
    subject: 'DBMS',
    topic: 'er-model-keys',
    question: 'Can a relational table have multiple Foreign Keys referencing the same Primary Key of another table?',
    options: [
      'Yes, for example in a Flights table referencing Airport(id) for origin and destination',
      'No, relational databases allow only one Foreign Key per table',
      'No, because it causes circular dependencies',
      'Only if composite primary keys are disabled'
    ],
    correctIndex: 0,
    explanation: 'A relation can have multiple foreign keys referencing the exact same target table (e.g. OriginAirportId and DestinationAirportId both referencing Airport.Id).',
    difficulty: 'medium'
  },
  // DBMS: normalization
  {
    id: 'dbms-norm-3',
    subject: 'DBMS',
    topic: 'normalization',
    question: 'Which normal form is designed to address Multi-Valued Dependencies (MVD)?',
    options: ['Fourth Normal Form (4NF)', 'Third Normal Form (3NF)', 'BCNF', 'Second Normal Form (2NF)'],
    correctIndex: 0,
    explanation: '4NF deals with multi-valued dependencies (X ->> Y), ensuring that independent multi-valued facts are not stored in the same relation.',
    difficulty: 'hard'
  },
  {
    id: 'dbms-norm-4',
    subject: 'DBMS',
    topic: 'normalization',
    question: 'A relation R(A, B) with candidate key {A} has no partial dependencies because:',
    options: [
      'The candidate key is a single attribute, so no proper subset exists to depend on',
      'All attributes are numeric',
      'BCNF forbids candidate keys',
      'B is a prime attribute'
    ],
    correctIndex: 0,
    explanation: 'Partial dependencies require a composite candidate key. If all candidate keys are single attributes, 2NF is automatically satisfied.',
    difficulty: 'easy'
  },
  // DBMS: transactions-acid
  {
    id: 'dbms-tx-3',
    subject: 'DBMS',
    topic: 'transactions-acid',
    question: 'What is a Phantom Read in database transaction isolation levels?',
    options: [
      'A transaction re-executes a range query and finds new rows inserted by another committed transaction',
      'A transaction reads uncommitted changes that are later rolled back',
      'A transaction reads different data values for the same row upon re-reading',
      'A transaction locks the entire disk partition'
    ],
    correctIndex: 0,
    explanation: 'Phantom Reads occur when new rows qualifying for a search predicate are added by a concurrent transaction between two reads. Only Serializable isolation prevents phantom reads.',
    difficulty: 'hard'
  },
  {
    id: 'dbms-tx-4',
    subject: 'DBMS',
    topic: 'transactions-acid',
    question: 'Under Two-Phase Locking (2PL), what happens during the Shrinking Phase?',
    options: [
      'The transaction releases locks and cannot acquire any new locks',
      'The transaction acquires locks and cannot release any',
      'The transaction aborts and shrinks memory usage',
      'The database compresses log files on disk'
    ],
    correctIndex: 0,
    explanation: 'In 2PL, the growing phase allows acquiring locks but no releasing; the shrinking phase allows releasing locks, but once a lock is released, no new locks can be acquired.',
    difficulty: 'medium'
  },
  // DBMS: indexing
  {
    id: 'dbms-idx-3',
    subject: 'DBMS',
    topic: 'indexing',
    question: 'Why are B+ Trees preferred over AVL Trees or Red-Black Trees in database storage engines?',
    options: [
      'B+ Trees have huge fan-out, resulting in very low tree height and minimal disk block I/Os',
      'B+ Trees require zero memory during searches',
      'Binary search trees cannot store integers',
      'AVL trees cannot be persisted to disk'
    ],
    correctIndex: 0,
    explanation: 'Disk I/O is the bottleneck in databases. B+ trees store thousands of keys per node (fan-out), keeping tree depth to 3-4 levels and requiring only 3-4 disk block reads per lookup.',
    difficulty: 'medium'
  },
  {
    id: 'dbms-idx-4',
    subject: 'DBMS',
    topic: 'indexing',
    question: 'What is a Covering Index in query optimization?',
    options: [
      'An index that contains all columns requested by a SELECT query, avoiding table row lookups completely',
      'An index that protects the table against SQL injection',
      'An index that spans across all tables in the database',
      'A clustered index on the primary key'
    ],
    correctIndex: 0,
    explanation: 'A covering index includes all columns needed for filter, join, and projection in the index structure itself, allowing the query engine to satisfy the query purely from the index pages.',
    difficulty: 'hard'
  },
  // OS: process-scheduling
  {
    id: 'os-sched-4',
    subject: 'OS',
    topic: 'process-scheduling',
    question: 'What technique prevents starvation of low-priority processes in Priority Scheduling?',
    options: [
      'Aging (gradually increasing a process priority as it waits)',
      'Preemption of all CPU caches',
      'Round Robin with infinite time quantum',
      'Converting all processes to real-time threads'
    ],
    correctIndex: 0,
    explanation: 'Aging gradually boosts the priority of processes that wait in the ready queue for long periods, guaranteeing they eventually run.',
    difficulty: 'easy'
  },
  {
    id: 'os-sched-5',
    subject: 'OS',
    topic: 'process-scheduling',
    question: 'If the Round Robin time quantum is set arbitrarily large, Round Robin degenerates into:',
    options: ['First-Come, First-Served (FCFS)', 'Shortest Remaining Time First (SRTF)', 'Priority Scheduling', 'Multilevel Feedback Queue'],
    correctIndex: 0,
    explanation: 'When the time quantum is larger than any CPU burst, every process runs to completion before preemption, matching FCFS scheduling exactly.',
    difficulty: 'easy'
  },
  // OS: deadlocks
  {
    id: 'os-dl-3',
    subject: 'OS',
    topic: 'deadlocks',
    question: 'In Bankers Algorithm, the system is in a Safe State if:',
    options: [
      'There exists at least one safe sequence in which all processes can finish without deadlock',
      'No resources are currently allocated to any process',
      'The CPU utilization is at 100%',
      'Circular wait is permanently prohibited by hardware'
    ],
    correctIndex: 0,
    explanation: 'A state is safe if there exists an execution sequence <P1, P2, ... Pn> such that for each Pi, the resources Pi can still request can be satisfied by current available plus resources held by prior processes.',
    difficulty: 'medium'
  },
  {
    id: 'os-dl-4',
    subject: 'OS',
    topic: 'deadlocks',
    question: 'How does imposing a strict global total ordering on all resource requests eliminate deadlocks?',
    options: [
      'It breaks the Circular Wait Coffman condition',
      'It breaks Mutual Exclusion',
      'It eliminates the need for locks completely',
      'It forces all resources to become preemptible'
    ],
    correctIndex: 0,
    explanation: 'If all processes must request resources in strictly ascending numerical order (R1 before R2), a circular chain of waiting becomes mathematically impossible.',
    difficulty: 'medium'
  },
  // OS: memory-paging
  {
    id: 'os-mem-3',
    subject: 'OS',
    topic: 'memory-paging',
    question: 'Beladys Anomaly describes a counter-intuitive phenomenon where:',
    options: [
      'Allocating more physical page frames results in MORE page faults under FIFO replacement',
      'Paging runs faster when RAM is completely full',
      'LRU performs worse than Random replacement',
      'Virtual memory addresses wrap around to zero'
    ],
    correctIndex: 0,
    explanation: 'Beladys Anomaly occurs in FIFO where increasing the number of page frames leads to more page faults. Stack algorithms like LRU and Optimal are immune to this.',
    difficulty: 'medium'
  },
  {
    id: 'os-mem-4',
    subject: 'OS',
    topic: 'memory-paging',
    question: 'What is the role of the TLB (Translation Lookaside Buffer) in virtual memory systems?',
    options: [
      'A fast associative hardware cache for caching page-to-frame mappings',
      'A disk partition dedicated to swap space',
      'An interrupt handler for disk read errors',
      'A software stack in the user application'
    ],
    correctIndex: 0,
    explanation: 'The TLB is a high-speed hardware cache on the CPU that stores recent virtual page number to physical frame translations, avoiding extra memory bus cycles.',
    difficulty: 'easy'
  },
  // OS: synchronization
  {
    id: 'os-sync-4',
    subject: 'OS',
    topic: 'synchronization',
    question: 'What are the three mandatory requirements for a valid Critical Section solution?',
    options: [
      'Mutual Exclusion, Progress, and Bounded Waiting',
      'Atomicity, Consistency, and Durability',
      'Preemption, Aging, and Throughput',
      'First-In, First-Out, and Priority'
    ],
    correctIndex: 0,
    explanation: 'Dijkstra established the three criteria: Mutual Exclusion (only 1 inside), Progress (if empty, only contenders decide), and Bounded Waiting (no indefinite starvation).',
    difficulty: 'medium'
  },
  {
    id: 'os-sync-5',
    subject: 'OS',
    topic: 'synchronization',
    question: 'What distinguishes a Binary Semaphore from a standard Mutex?',
    options: [
      'A Mutex has ownership (only locking thread can unlock); a Semaphore can be signaled by any thread',
      'A Semaphore cannot be used on multi-core systems',
      'A Mutex only works in user space while Semaphores require hardware coprocessors',
      'They are identical in all POSIX implementations'
    ],
    correctIndex: 0,
    explanation: 'A Mutex enforces thread ownership (the thread that locks it must unlock it). Semaphores are signaling counters and can be signaled (unlocked) by a different thread.',
    difficulty: 'hard'
  },
  // OS: file-systems
  {
    id: 'os-fs-3',
    subject: 'OS',
    topic: 'file-systems',
    question: 'In disk scheduling algorithms, how does C-SCAN (Circular SCAN) differ from SCAN (Elevator)?',
    options: [
      'C-SCAN only services requests in one direction, returning to the start without servicing on the return trip for uniform wait time',
      'C-SCAN spins the disk backwards',
      'C-SCAN services requests based purely on FIFO arrival',
      'SCAN is for SSDs while C-SCAN is for magnetic tape'
    ],
    correctIndex: 0,
    explanation: 'C-SCAN treats cylinders as a circular list: it sweeps in one direction servicing tracks, and when it reaches the end, it returns immediately to cylinder 0 without servicing tracks on the return path, providing a more uniform wait time.',
    difficulty: 'medium'
  },
  {
    id: 'os-fs-4',
    subject: 'OS',
    topic: 'file-systems',
    question: 'What happens when you create a Hard Link to an existing file in a Unix file system?',
    options: [
      'A new directory entry is created pointing to the existing file Inode, and the Inode link count increments by 1',
      'A new copy of all data blocks is written to disk',
      'A special file containing the text of the path is created',
      'The original file is deleted'
    ],
    correctIndex: 0,
    explanation: 'A hard link creates another name in the directory pointing to the same existing Inode number, incrementing the inode link count. The file data is only freed when the link count reaches 0.',
    difficulty: 'medium'
  }
];

const existingIds = new Set(current.map(q => q.id));
const toAdd = newQuestions.filter(q => !existingIds.has(q.id));
const combined = [...current, ...toAdd];

fs.writeFileSync(qbPath, JSON.stringify(combined, null, 2), 'utf-8');
console.log(`Updated question bank: added ${toAdd.length} questions, total now ${combined.length}`);
