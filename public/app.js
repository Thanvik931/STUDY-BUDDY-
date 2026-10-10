// public/app.js
// Client-side application controller for Study Buddy AI Tutor.
// Strictly uses textContent and safe DOM node creation (NEVER innerHTML with user input),
// preventing XSS. Implements Home Page landing with proper Sign In & Registration,
// 1-on-1 Socratic AI Tutor, 10-Question Adaptive Quiz, Concept Lessons with live pass/fail memory,
// Active Recall Flashcards with spaced repetition, Timed Mock Exam with letter grade cards,
// AI Study Planner & Readiness Roadmap, Cheat Sheets, Cognitive Memory, and 4 Chart.js analytics visualizations.

import { api } from './api.js';

// Supported subjects and topics across all 5 engineering domains
const TOPICS = {
  DBMS: [
    { id: 'sql-joins', label: 'SQL Joins (INNER, LEFT, RIGHT, FULL)' },
    { id: 'er-model-keys', label: 'ER Model & Keys (Primary, Foreign, Candidate)' },
    { id: 'normalization', label: 'Normalization (1NF, 2NF, 3NF, BCNF)' },
    { id: 'transactions-acid', label: 'Transactions & ACID Properties' },
    { id: 'indexing', label: 'Database Indexing (B+ Trees, Hash Indexes)' }
  ],
  OS: [
    { id: 'process-scheduling', label: 'CPU Process Scheduling (FCFS, SJF, Round Robin)' },
    { id: 'deadlocks', label: 'Deadlocks & Banker\'s Algorithm' },
    { id: 'memory-paging', label: 'Virtual Memory & Paging (TLB, Page Faults)' },
    { id: 'synchronization', label: 'Process Synchronization & Semaphores' },
    { id: 'file-systems', label: 'File Systems & Disk Allocation' }
  ],
  DSA: [
    { id: 'arrays-strings', label: 'Arrays, Two Pointers & Sliding Window' },
    { id: 'trees-graphs', label: 'Binary Trees & Graph Traversals (BFS/DFS)' },
    { id: 'dynamic-programming', label: 'Dynamic Programming & Memoization' },
    { id: 'sorting-searching', label: 'Binary Search & Sorting Invariants' },
    { id: 'recursion-backtracking', label: 'Recursion, Backtracking & Permutations' }
  ],
  NETWORKING: [
    { id: 'osi-tcp-ip', label: 'OSI Model & TCP/IP Protocol Stack' },
    { id: 'transport-protocols', label: 'TCP Flow/Congestion Control vs UDP' },
    { id: 'dns-http', label: 'DNS, HTTP/1.1, HTTP/2 & HTTPS Handshake' },
    { id: 'routing-ip', label: 'IP Addressing, Subnetting & Routing (BGP/OSPF)' },
    { id: 'network-security', label: 'Firewalls, TLS/SSL & Cryptography' }
  ],
  SYSTEM_DESIGN: [
    { id: 'rest-graphql', label: 'REST APIs vs GraphQL Architecture' },
    { id: 'caching-redis', label: 'Caching Strategies (LRU, Write-Through) & Redis' },
    { id: 'load-balancing', label: 'Load Balancing, Horizontal Scaling & Sharding' },
    { id: 'event-driven', label: 'Message Queues (Kafka, RabbitMQ) & Events' },
    { id: 'microservices-security', label: 'Microservices, JWT Authentication & Rate Limiting' }
  ]
};

// Distinct Tutor Personas with unique voices, greetings, and curated quick prompts
const TUTOR_PERSONAS = {
  socratic: {
    title: 'Socratic Mentor',
    greeting: 'Welcome! I am your Socratic Mentor. I will guide you with probing questions, step-by-step hints, and thought experiments rather than spoon-feeding direct answers. What engineering puzzle, concurrency trap, or algorithm would you like to explore together?',
    quickPrompts: [
      'Why does B+ Tree have higher fanout than B-Tree?',
      'How does Banker\'s Algorithm prove a state is safe?',
      'Why does strict 2PL prevent cascading aborts?',
      'Why is Dijkstra not guaranteed to work with negative edge weights?'
    ]
  },
  eli5: {
    title: 'Explain Like I\'m 5',
    greeting: 'ELI5 Tutor activated! Forget dense academic jargon. I explain database indexing, virtual memory paging, sliding windows, and distributed load balancers using intuitive real-world analogies (like filing cabinets, pizza kitchens, and highway toll booths). What concept shall we demystify today?',
    quickPrompts: [
      'Explain B+ Tree indexing like an organized library catalogue',
      'Explain CPU Scheduling like a restaurant head chef managing orders',
      'Explain Sliding Window algorithm like a train window on tracks',
      'Explain TCP 3-way handshake like two walkie-talkie operators'
    ]
  },
  deepdive: {
    title: 'Exam Deep Dive & Proofs',
    greeting: 'Exam Deep Dive & Proofs Mode activated. Here we break down formal proofs, invariant equations, mathematical boundary conditions, and university examination edge cases across DBMS, OS, DSA, Networks, and System Design. What theorem or algorithm shall we rigorously dissect?',
    quickPrompts: [
      'Prove that Strict 2PL guarantees conflict serializability',
      'Derive the asymptotic complexity proof for Banker\'s safety check: O(M * N^2)',
      'Explain Master Theorem cases with recursion tree derivations',
      'Prove why TCP slow start increases cwnd exponentially per RTT'
    ]
  },
  debug: {
    title: 'Code & SQL Debugger',
    greeting: 'Code & SQL Debugger Mode active! Bring me your complex SQL queries, C++/Python algorithms, race conditions, or cache invalidation logic. I analyze edge cases, time/space trade-offs, concurrency bugs, and output clean, optimized code. What code or query are we debugging?',
    quickPrompts: [
      'Debug SQL query: Why is my LEFT JOIN producing duplicate rows?',
      'Optimize code: Two-pointer vs sliding window for maximum subarray sum',
      'Trace race condition: Mutex deadlock in dining philosophers problem',
      'Analyze LRU Cache implementation with O(1) get and put using HashMap & DLL'
    ]
  }
};

// Application State
let currentUser = null;
let currentTutorMode = 'socratic';
let lastTutorReplyText = '';

// Quiz State
let activeQuizQuestions = [];
let currentQuizIndex = 0;
let quizScore = 0;
let selectedOptionIndex = null;

// Flashcards State
let activeFlashcards = [];
let currentFlashcardIndex = 0;
let isFlashcardFlipped = false;

// Mock Exam State
let mockExamQuestions = [];
let mockExamCurrentIdx = 0;
let mockExamSubmissions = {};
let mockExamTimerInterval = null;
let examSecondsRemaining = 900;
let examStartTime = null;

// Memory & Chart State
let memoryToCorrectId = null;
let chartTopicMasteryInstance = null;
let chartSubjectCompareInstance = null;
let chartMemoryDistInstance = null;
let chartTimelineInstance = null;

// DOM View Containers
const viewLanding = document.getElementById('view-landing');
const viewApp = document.getElementById('view-app');

// Landing Auth Elements
const authTabLogin = document.getElementById('auth-tab-login');
const authTabSignup = document.getElementById('auth-tab-signup');
const formLoginContainer = document.getElementById('form-login-container');
const formSignupContainer = document.getElementById('form-signup-container');
const loginAlert = document.getElementById('login-alert');
const signupAlert = document.getElementById('signup-alert');
const loginForm = document.getElementById('login-form');
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const signupForm = document.getElementById('signup-form');
const signupUsernameInput = document.getElementById('signup-username');
const signupDisplayNameInput = document.getElementById('signup-displayname');
const signupPasswordInput = document.getElementById('signup-password');
const signupTermsCheckbox = document.getElementById('signup-terms');
const signupSubmitBtn = document.getElementById('signup-submit-btn');
const landingQuickDemoBtn = document.getElementById('landing-quick-demo-btn');
const quickDemoBtn = document.getElementById('quick-demo-btn');

// App Header Elements
const studentBadge = document.getElementById('current-student-badge');
const logoutBtn = document.getElementById('logout-btn');
const exportDataBtn = document.getElementById('export-data-btn');
const deleteAccountBtn = document.getElementById('delete-account-btn');

// Navigation Tabs
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

// Tab 0: AI Tutor Chat Elements
const tutorChatMessages = document.getElementById('tutor-chat-messages');
const tutorChatForm = document.getElementById('tutor-chat-form');
const tutorChatInput = document.getElementById('tutor-chat-input');
const tutorChatSubmit = document.getElementById('tutor-chat-submit');
const tutorModeButtons = document.querySelectorAll('.tutor-mode-btn');
const tutorReadAloudBtn = document.getElementById('tutor-read-aloud-btn');
const quickPromptButtons = document.querySelectorAll('.quick-prompt-btn');

// Tab 1: Quiz Elements
const openerBanner = document.getElementById('opener-banner');
const selectSubject = document.getElementById('select-subject');
const selectTopic = document.getElementById('select-topic');
const startBatchQuizBtn = document.getElementById('start-batch-quiz-btn');
const fetchSingleQuestionBtn = document.getElementById('fetch-single-question-btn');
const questionCard = document.getElementById('question-card');
const quizProgressHeader = document.getElementById('quiz-progress-header');
const quizStepIndicator = document.getElementById('quiz-step-indicator');
const quizScoreIndicator = document.getElementById('quiz-score-indicator');
const quizProgressFill = document.getElementById('quiz-progress-fill');
const questionDifficultyBadge = document.getElementById('question-difficulty-badge');
const questionTopicBadge = document.getElementById('question-topic-badge');
const degradedNotice = document.getElementById('degraded-notice');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const nextQuestionBtn = document.getElementById('next-question-btn');
const feedbackBox = document.getElementById('feedback-box');
const whyBox = document.getElementById('why-box');
const whyText = document.getElementById('why-text');
const whyBreakdown = document.getElementById('why-breakdown');
const quizSummaryCard = document.getElementById('quiz-summary-card');
const summaryScoreValue = document.getElementById('summary-score-value');
const summaryMemoryImpact = document.getElementById('summary-memory-impact');
const teachWeaknessBtn = document.getElementById('teach-weakness-btn');
const restartQuizBtn = document.getElementById('restart-quiz-btn');

// Tab 2: Lessons Elements
const recommendedChips = document.getElementById('recommended-chips');
const lessonSubject = document.getElementById('lesson-subject');
const lessonTopic = document.getElementById('lesson-topic');
const loadLessonBtn = document.getElementById('load-lesson-btn');
const teachPriorityBtn = document.getElementById('teach-priority-btn');
const lessonCardView = document.getElementById('lesson-card-view');
const lessonStatsBanner = document.getElementById('lesson-stats-banner');
const lessonStatAttempts = document.getElementById('lesson-stat-attempts');
const lessonStatPassed = document.getElementById('lesson-stat-passed');
const lessonStatFailed = document.getElementById('lesson-stat-failed');
const lessonStatRate = document.getElementById('lesson-stat-rate');
const lessonAiBadge = document.getElementById('lesson-ai-badge');
const lessonVoiceBtn = document.getElementById('lesson-voice-btn');
const lessonDiagnosisBox = document.getElementById('lesson-diagnosis-box');
const lessonTitle = document.getElementById('lesson-title');
const lessonSummary = document.getElementById('lesson-summary');
const lessonAnalogy = document.getElementById('lesson-analogy');
const lessonMechanics = document.getElementById('lesson-mechanics');
const lessonPitfalls = document.getElementById('lesson-pitfalls');
const lessonCode = document.getElementById('lesson-code');
const lessonTakeaways = document.getElementById('lesson-takeaways');
const quizFromLessonBtn = document.getElementById('quiz-from-lesson-btn');

// Sidebar & Navigation Controls
const sidebarStudentName = document.getElementById('sidebar-student-name');
const sidebarMobileToggle = document.getElementById('sidebar-mobile-toggle');
const sidebarCollapseBtn = document.getElementById('sidebar-collapse-btn');
const appSidebar = document.getElementById('app-sidebar');
const topHeaderTitle = document.getElementById('top-header-title');
const sidebarExportBtn = document.getElementById('sidebar-export-btn');
const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
const sidebarDeleteBtn = document.getElementById('sidebar-delete-btn');
const quickPromptsContainer = document.getElementById('quick-prompts-container');

// Tab 3: Flashcards Elements
const flashcardCounterBadge = document.getElementById('flashcard-counter-badge');
const fcSearchInput = document.getElementById('fc-search-input');
const fcViewGridBtn = document.getElementById('fc-view-grid-btn');
const fcViewDeckBtn = document.getElementById('fc-view-deck-btn');
const fcFlipAllBtn = document.getElementById('fc-flip-all-btn');
const fcFilterAll = document.getElementById('fc-filter-all');
const fcFilterDbms = document.getElementById('fc-filter-dbms');
const fcFilterOs = document.getElementById('fc-filter-os');
const fcFilterDsa = document.getElementById('fc-filter-dsa');
const fcFilterNetworking = document.getElementById('fc-filter-networking');
const fcFilterSystemDesign = document.getElementById('fc-filter-system_design');
const fcGridView = document.getElementById('fc-grid-view');
const fcDeckView = document.getElementById('fc-deck-view');
const fcCardsGrid = document.getElementById('fc-cards-grid');

const fcDeckStepText = document.getElementById('fc-deck-step-text');
const fcDeckPercentText = document.getElementById('fc-deck-percent-text');
const fcDeckProgressFill = document.getElementById('fc-deck-progress-fill');
const flashcardElement = document.getElementById('flashcard-element');
const fcSideLabel = document.getElementById('fc-side-label');
const fcTopicLabel = document.getElementById('fc-topic-label');
const fcMainText = document.getElementById('fc-main-text');
const fcExtraBox = document.getElementById('fc-extra-box');
const fcFormulaText = document.getElementById('fc-formula-text');
const fcTrapBox = document.getElementById('fc-trap-box');
const fcTrapText = document.getElementById('fc-trap-text');
const fcRatingContainer = document.getElementById('fc-rating-container');
const fcVoiceBtn = document.getElementById('fc-voice-btn');
const fcPrevBtn = document.getElementById('fc-prev-btn');
const fcFlipBtn = document.getElementById('fc-flip-btn');
const fcNextBtn = document.getElementById('fc-next-btn');
const fcShuffleBtn = document.getElementById('fc-shuffle-btn');

// Tab 4: Mock Exam Elements
const mockexamIntroCard = document.getElementById('mockexam-intro-card');
const startMockexamBtn = document.getElementById('start-mockexam-btn');
const mockexamActiveCard = document.getElementById('mockexam-active-card');
const mockexamTimer = document.getElementById('mockexam-timer');
const examQIndicator = document.getElementById('exam-q-indicator');
const examTopicBadge = document.getElementById('exam-topic-badge');
const examQText = document.getElementById('exam-q-text');
const examOptionsContainer = document.getElementById('exam-options-container');
const examPrevBtn = document.getElementById('exam-prev-btn');
const examNextBtn = document.getElementById('exam-next-btn');
const examSubmitBtn = document.getElementById('exam-submit-btn');
const mockexamReportCard = document.getElementById('mockexam-report-card');
const reportGradeCircle = document.getElementById('report-grade-circle');
const reportScoreText = document.getElementById('report-score-text');
const reportAdviceText = document.getElementById('report-advice-text');
const reportReviewList = document.getElementById('report-review-list');
const retakeMockexamBtn = document.getElementById('retake-mockexam-btn');

// Tab 5: Study Planner Elements
const refreshStudyplanBtn = document.getElementById('refresh-studyplan-btn');
const spReadinessScore = document.getElementById('sp-readiness-score');
const spCoveragePill = document.getElementById('sp-coverage-pill');
const spAccuracyPill = document.getElementById('sp-accuracy-pill');
const spChecklistContainer = document.getElementById('sp-checklist-container');
const spCriticalContainer = document.getElementById('sp-critical-container');
const spReinforceContainer = document.getElementById('sp-reinforce-container');
const spMasteredContainer = document.getElementById('sp-mastered-container');

// Tab 6: Cheat Sheets Elements
const csSubjDbmsBtn = document.getElementById('cs-subj-dbms-btn');
const csSubjOsBtn = document.getElementById('cs-subj-os-btn');
const csSubjDsaBtn = document.getElementById('cs-subj-dsa-btn');
const csSubjNetworkingBtn = document.getElementById('cs-subj-networking-btn');
const csSubjSystemDesignBtn = document.getElementById('cs-subj-system_design-btn');
const csTitle = document.getElementById('cs-title');
const csSummary = document.getElementById('cs-summary');
const csSectionsGrid = document.getElementById('cs-sections-grid');

// Tab 7: Memories Elements
const memoriesContainer = document.getElementById('memories-container');
const refreshMemoriesBtn = document.getElementById('refresh-memories-btn');
const correctModal = document.getElementById('correct-modal');
const correctContentInput = document.getElementById('correct-content');
const correctSubmitBtn = document.getElementById('correct-submit-btn');
const correctCancelBtn = document.getElementById('correct-cancel-btn');

// Tab 8: Progress Elements
const statAccuracy = document.getElementById('stat-accuracy');
const statAttempts = document.getElementById('stat-attempts');
const statCorrect = document.getElementById('stat-correct');
const statWeaknesses = document.getElementById('stat-weaknesses');

// Hackathon Rubric Evaluation Matrix Elements
const judgeMatrixBtn = document.getElementById('judge-matrix-btn');
const judgeMatrixModal = document.getElementById('judge-matrix-modal');
const judgeMatrixCloseBtn = document.getElementById('judge-matrix-close-btn');
const judgeMatrixCloseTopBtn = document.getElementById('judge-matrix-close-top-btn');
const matrixJumpButtons = document.querySelectorAll('.matrix-jump-btn');

// Cookie consent
const cookieDismissBtn = document.getElementById('cookie-dismiss-btn');
if (cookieDismissBtn) {
  cookieDismissBtn.addEventListener('click', () => {
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.style.display = 'none';
  });
}

// --- AUDIO TEXT-TO-SPEECH HELPER ---
function speakText(text) {
  if (!('speechSynthesis' in window)) {
    alert('Audio text-to-speech is not supported by your browser.');
    return;
  }
  window.speechSynthesis.cancel();
  if (!text) return;
  const clean = text.replace(/[*_#`]/g, '');
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 1.0;
  utterance.pitch = 1.05;
  window.speechSynthesis.speak(utterance);
}

// --- INITIALIZATION ---

async function init() {
  populateTopics(selectSubject.value, selectTopic);
  populateTopics(lessonSubject.value, lessonTopic);
  setupEventListeners();

  try {
    const authData = await api.getMe();
    if (authData?.user) {
      setUser(authData.user);
      return;
    }
  } catch (_) {}

  showLandingView();
}

function showLandingView() {
  currentUser = null;
  viewLanding.style.display = 'block';
  viewApp.style.display = 'none';
}

function setUser(user) {
  currentUser = user;
  viewLanding.style.display = 'none';
  viewApp.style.display = 'flex';

  studentBadge.textContent = `${user.displayName || user.username} (${user.role || 'Student'})`;
  if (sidebarStudentName) {
    sidebarStudentName.textContent = user.displayName || user.username;
  }
  loadSessionOpener();
  loadRecommendedLessons();
  loadTutorChatHistory();
  loadFlashcards();
  loadStudyPlan();
  loadCheatSheet('DBMS');
  loadMemories();
  loadProgress();
}

function populateTopics(subject, targetSelect) {
  targetSelect.innerHTML = '';

  if (targetSelect === selectTopic) {
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = `All Topics in ${subject} (10-Question Master Quiz)`;
    targetSelect.appendChild(allOpt);
  }

  const list = TOPICS[subject] || [];
  list.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.label;
    targetSelect.appendChild(opt);
  });
}

function setupEventListeners() {
  // Landing Auth Tabs
  authTabLogin.addEventListener('click', () => {
    authTabLogin.classList.add('active');
    authTabSignup.classList.remove('active');
    formLoginContainer.style.display = 'block';
    formSignupContainer.style.display = 'none';
    loginAlert.style.display = 'none';
  });

  authTabSignup.addEventListener('click', () => {
    authTabSignup.classList.add('active');
    authTabLogin.classList.remove('active');
    formSignupContainer.style.display = 'block';
    formLoginContainer.style.display = 'none';
    signupAlert.style.display = 'none';
  });

  loginForm.addEventListener('submit', handleLoginFormSubmit);
  signupForm.addEventListener('submit', handleSignupFormSubmit);

  if (landingQuickDemoBtn) landingQuickDemoBtn.addEventListener('click', handleDemoLogin);
  if (quickDemoBtn) quickDemoBtn.addEventListener('click', handleDemoLogin);

  logoutBtn.addEventListener('click', handleLogout);

  // App Tabs Navigation
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Tab 0: AI Tutor Chat
  tutorChatForm.addEventListener('submit', handleTutorChatSubmit);
  tutorModeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      switchTutorMode(btn.dataset.mode, true);
    });
  });
  tutorReadAloudBtn.addEventListener('click', () => speakText(lastTutorReplyText));
  switchTutorMode('socratic', false);

  // Tab 1: Quiz
  selectSubject.addEventListener('change', () => populateTopics(selectSubject.value, selectTopic));
  lessonSubject.addEventListener('change', () => populateTopics(lessonSubject.value, lessonTopic));
  startBatchQuizBtn.addEventListener('click', () => start10QuestionQuiz());
  fetchSingleQuestionBtn.addEventListener('click', () => startSingleQuestion());
  submitAnswerBtn.addEventListener('click', () => submitAnswer());
  nextQuestionBtn.addEventListener('click', () => nextQuestion());
  teachWeaknessBtn.addEventListener('click', () => teachWeakestTopic());
  restartQuizBtn.addEventListener('click', () => start10QuestionQuiz());

  // Tab 2: Lessons
  loadLessonBtn.addEventListener('click', () => loadSelectedLesson());
  teachPriorityBtn.addEventListener('click', () => teachWeakestTopic());
  quizFromLessonBtn.addEventListener('click', () => quizTopicFromLesson());
  lessonVoiceBtn.addEventListener('click', () => {
    const textToSpeak = `${lessonTitle.textContent}. ${lessonSummary.textContent}. ${lessonAnalogy.textContent}. ${lessonMechanics.textContent}`;
    speakText(textToSpeak);
  });

  // Tab 3: Flashcards Dual-View & Controls
  if (fcViewGridBtn) {
    fcViewGridBtn.addEventListener('click', () => {
      fcViewGridBtn.className = 'btn-primary';
      fcViewDeckBtn.className = 'btn-outline';
      fcGridView.style.display = 'block';
      fcDeckView.style.display = 'none';
    });
  }
  if (fcViewDeckBtn) {
    fcViewDeckBtn.addEventListener('click', () => {
      fcViewDeckBtn.className = 'btn-primary';
      fcViewGridBtn.className = 'btn-outline';
      fcDeckView.style.display = 'block';
      fcGridView.style.display = 'none';
      renderCurrentFlashcard();
    });
  }
  if (fcFlipAllBtn) {
    fcFlipAllBtn.addEventListener('click', toggleFlipAllCards);
  }
  if (fcFilterAll) {
    fcFilterAll.addEventListener('click', () => filterFlashcardsBySubject('ALL'));
  }
  if (fcFilterDbms) {
    fcFilterDbms.addEventListener('click', () => filterFlashcardsBySubject('DBMS'));
  }
  if (fcFilterOs) {
    fcFilterOs.addEventListener('click', () => filterFlashcardsBySubject('OS'));
  }
  if (fcFilterDsa) {
    fcFilterDsa.addEventListener('click', () => filterFlashcardsBySubject('DSA'));
  }
  if (fcFilterNetworking) {
    fcFilterNetworking.addEventListener('click', () => filterFlashcardsBySubject('NETWORKING'));
  }
  if (fcFilterSystemDesign) {
    fcFilterSystemDesign.addEventListener('click', () => filterFlashcardsBySubject('SYSTEM_DESIGN'));
  }

  if (flashcardElement) flashcardElement.addEventListener('click', toggleFlashcardFlip);
  if (fcPrevBtn) fcPrevBtn.addEventListener('click', prevFlashcard);
  if (fcNextBtn) fcNextBtn.addEventListener('click', nextFlashcard);
  if (fcVoiceBtn) {
    fcVoiceBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speakText(fcMainText.textContent);
    });
  }
  document.querySelectorAll('#fc-rating-container .rate-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleRateFlashcard(btn.dataset.rating);
    });
  });

  // Tab 4: Mock Exam
  startMockexamBtn.addEventListener('click', startMockExam);
  examNextBtn.addEventListener('click', nextMockExamQuestion);
  examPrevBtn.addEventListener('click', prevMockExamQuestion);
  examSubmitBtn.addEventListener('click', submitMockExamFinal);
  retakeMockexamBtn.addEventListener('click', () => {
    mockexamReportCard.style.display = 'none';
    mockexamIntroCard.style.display = 'block';
  });

  // Tab 5: Study Planner
  refreshStudyplanBtn.addEventListener('click', loadStudyPlan);

  // Tab 6: Cheat Sheets
  const csButtons = [
    { btn: csSubjDbmsBtn, subject: 'DBMS' },
    { btn: csSubjOsBtn, subject: 'OS' },
    { btn: csSubjDsaBtn, subject: 'DSA' },
    { btn: csSubjNetworkingBtn, subject: 'NETWORKING' },
    { btn: csSubjSystemDesignBtn, subject: 'SYSTEM_DESIGN' }
  ];

  csButtons.forEach(({ btn, subject }) => {
    if (btn) {
      btn.addEventListener('click', () => {
        csButtons.forEach((item) => {
          if (item.btn) item.btn.className = 'btn-outline';
        });
        btn.className = 'btn-primary';
        loadCheatSheet(subject);
      });
    }
  });

  // Tab 7: Memories
  refreshMemoriesBtn.addEventListener('click', () => loadMemories());
  correctCancelBtn.addEventListener('click', () => closeCorrectModal());
  correctSubmitBtn.addEventListener('click', () => submitMemoryCorrection());

  // Sidebar Toggle (Desktop Collapse & Mobile Drawer via 3-Layer Button)
  const toggleAppSidebar = () => {
    if (!appSidebar) return;
    if (window.innerWidth > 900) {
      appSidebar.classList.toggle('collapsed');
    } else {
      appSidebar.classList.toggle('open');
    }
  };

  if (sidebarMobileToggle) {
    sidebarMobileToggle.addEventListener('click', toggleAppSidebar);
  }
  if (sidebarCollapseBtn) {
    sidebarCollapseBtn.addEventListener('click', toggleAppSidebar);
  }
  if (sidebarExportBtn) sidebarExportBtn.addEventListener('click', () => exportUserData());
  if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', () => handleLogout());
  if (sidebarDeleteBtn) sidebarDeleteBtn.addEventListener('click', () => deleteUserAccount());

  // Tab 3: Flashcards Extras (Search, Flip, Shuffle)
  if (fcSearchInput) {
    fcSearchInput.addEventListener('input', handleFlashcardSearch);
  }
  if (fcFlipBtn) {
    fcFlipBtn.addEventListener('click', toggleFlashcardFlip);
  }
  if (fcShuffleBtn) {
    fcShuffleBtn.addEventListener('click', shuffleFlashcards);
  }

  // Keyboard Shortcuts for Flashcards
  document.addEventListener('keydown', (e) => {
    const activeBtn = document.querySelector('.sidebar-nav-item.tab-btn.active');
    if (!activeBtn || activeBtn.dataset.tab !== 'flashcards') return;
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

    if (e.code === 'Space') {
      e.preventDefault();
      toggleFlashcardFlip();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      nextFlashcard();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      prevFlashcard();
    } else if (['1', '2', '3', '4'].includes(e.key)) {
      const map = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
      handleRateFlashcard(map[e.key]);
    }
  });

  // GDPR Sovereignty
  exportDataBtn.addEventListener('click', () => exportUserData());
  deleteAccountBtn.addEventListener('click', () => deleteUserAccount());

  // Rubric Evaluation Matrix Modal
  if (judgeMatrixBtn && judgeMatrixModal) {
    judgeMatrixBtn.addEventListener('click', () => {
      judgeMatrixModal.classList.add('active');
    });
  }
  if (judgeMatrixCloseBtn && judgeMatrixModal) {
    judgeMatrixCloseBtn.addEventListener('click', () => {
      judgeMatrixModal.classList.remove('active');
    });
  }
  if (judgeMatrixCloseTopBtn && judgeMatrixModal) {
    judgeMatrixCloseTopBtn.addEventListener('click', () => {
      judgeMatrixModal.classList.remove('active');
    });
  }
  if (judgeMatrixModal) {
    judgeMatrixModal.addEventListener('click', (e) => {
      if (e.target === judgeMatrixModal) {
        judgeMatrixModal.classList.remove('active');
      }
    });
  }
  matrixJumpButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (judgeMatrixModal) judgeMatrixModal.classList.remove('active');
      const targetTab = btn.dataset.tab;
      if (targetTab) switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === tabId));
  tabPanels.forEach((p) => p.classList.toggle('active', p.id === `tab-${tabId}`));

  const sectionTitles = {
    tutor: '1-on-1 Socratic AI Tutor',
    quiz: 'Adaptive Quiz (10-Question Master Set)',
    lessons: 'Concept Lessons & Engineering Deep Dives',
    flashcards: 'Spaced Repetition & Active Recall Flashcards',
    mockexam: 'Timed Mock Exam Simulator (15 Questions)',
    studyplan: 'AI Study Planner & Readiness Roadmap',
    cheatsheet: 'High-Yield Revision Cheat Sheets',
    memories: 'MongoDB Cognitive Memory Inspector',
    progress: 'Real-Time Analytics & Radar Insights'
  };
  if (topHeaderTitle && sectionTitles[tabId]) {
    topHeaderTitle.textContent = sectionTitles[tabId];
  }

  if (appSidebar) {
    appSidebar.classList.remove('open');
  }

  if (tabId === 'tutor') {
    loadTutorChatHistory();
    switchTutorMode(currentTutorMode, false);
  }
  if (tabId === 'flashcards') loadFlashcards();
  if (tabId === 'studyplan') loadStudyPlan();
  if (tabId === 'memories') loadMemories();
  if (tabId === 'progress') loadProgress();
  if (tabId === 'lessons') loadRecommendedLessons();
  if (tabId === 'cheatsheet') loadCheatSheet('DBMS');
}

// --- AUTH HANDLERS ---

async function handleLoginFormSubmit(e) {
  e.preventDefault();
  const username = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value;

  if (!username || !password) {
    showFormAlert(loginAlert, 'Username and password are required.');
    return;
  }

  loginSubmitBtn.disabled = true;
  loginSubmitBtn.textContent = 'Authenticating...';
  loginAlert.style.display = 'none';

  try {
    const res = await api.login(username, password);
    setUser(res.user);
  } catch (err) {
    showFormAlert(loginAlert, err.message || 'Incorrect username or password');
  } finally {
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = 'Sign In to Study Buddy';
  }
}

async function handleSignupFormSubmit(e) {
  e.preventDefault();
  const username = signupUsernameInput.value.trim();
  const displayName = signupDisplayNameInput.value.trim();
  const password = signupPasswordInput.value;
  const termsAccepted = signupTermsCheckbox.checked;

  if (!username || !displayName || !password) {
    showFormAlert(signupAlert, 'All fields are required.');
    return;
  }

  if (!termsAccepted) {
    showFormAlert(signupAlert, 'You must accept the Terms and Privacy Policy.');
    return;
  }

  signupSubmitBtn.disabled = true;
  signupSubmitBtn.textContent = 'Securing account (verifying human session)...';
  signupAlert.style.display = 'none';

  try {
    const res = await api.signup(username, displayName, password);
    setUser(res.user);
  } catch (err) {
    showFormAlert(signupAlert, err.message || 'Registration failed');
  } finally {
    signupSubmitBtn.disabled = false;
    signupSubmitBtn.textContent = 'Create Student Account';
  }
}

async function handleDemoLogin() {
  try {
    if (quickDemoBtn) quickDemoBtn.disabled = true;
    if (landingQuickDemoBtn) landingQuickDemoBtn.disabled = true;
    const res = await api.quickLogin();
    setUser(res.user);
  } catch (err) {
    alert(`Demo login error: ${err.message}`);
  } finally {
    if (quickDemoBtn) quickDemoBtn.disabled = false;
    if (landingQuickDemoBtn) landingQuickDemoBtn.disabled = false;
  }
}

async function handleLogout() {
  try {
    await api.logout();
  } catch (_) {}
  showLandingView();
}

function showFormAlert(alertEl, msg) {
  alertEl.textContent = msg;
  alertEl.style.display = 'block';
}

// --- 1-ON-1 AI TUTOR CHAT ENGINE ---

function switchTutorMode(mode, appendGreeting = true) {
  if (!TUTOR_PERSONAS[mode]) return;
  currentTutorMode = mode;
  const persona = TUTOR_PERSONAS[mode];

  tutorModeButtons.forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });

  // Dynamically render the quick prompts for this persona
  if (quickPromptsContainer) {
    quickPromptsContainer.innerHTML = '';
    const label = document.createElement('span');
    label.style.fontSize = '0.78rem';
    label.style.fontWeight = '600';
    label.style.color = 'var(--text-muted)';
    label.style.alignSelf = 'center';
    label.textContent = `Quick Prompts (${persona.title}):`;
    quickPromptsContainer.appendChild(label);

    persona.quickPrompts.forEach((promptText) => {
      const chip = document.createElement('button');
      chip.className = 'lesson-chip quick-prompt-btn';
      chip.textContent = promptText;
      chip.addEventListener('click', () => {
        tutorChatInput.value = promptText;
        handleTutorChatSubmit(new Event('submit'));
      });
      quickPromptsContainer.appendChild(chip);
    });
  }

  if (appendGreeting) {
    appendChatBubble('tutor', persona.greeting);
    lastTutorReplyText = persona.greeting;
  }
}

async function handleTutorChatSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const msg = tutorChatInput.value.trim();
  if (!msg) return;

  // Append user bubble
  appendChatBubble('user', msg);
  tutorChatInput.value = '';
  tutorChatSubmit.disabled = true;

  try {
    const res = await api.tutorChat(msg, currentTutorMode);
    lastTutorReplyText = res.reply;
    appendChatBubble('tutor', res.reply, res.followUp);
  } catch (err) {
    appendChatBubble('tutor', `Error: ${err.message}`);
  } finally {
    tutorChatSubmit.disabled = false;
  }
}

function appendChatBubble(role, text, followUp = null) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  bubble.textContent = text;

  if (followUp && role === 'tutor') {
    const fuBox = document.createElement('div');
    fuBox.className = 'follow-up-callout';
    fuBox.textContent = `Socratic Question for you: ${followUp}`;
    bubble.appendChild(fuBox);
  }

  tutorChatMessages.appendChild(bubble);
  tutorChatMessages.scrollTop = tutorChatMessages.scrollHeight;
}

async function loadTutorChatHistory() {
  try {
    const data = await api.getTutorChatHistory();
    if (data.messages && data.messages.length > 0) {
      tutorChatMessages.innerHTML = '';
      data.messages.forEach((m) => {
        appendChatBubble(m.role, m.content, m.followUp);
      });
      const lastTutorMsg = [...data.messages].reverse().find((m) => m.role === 'assistant');
      if (lastTutorMsg) lastTutorReplyText = lastTutorMsg.content;
    }
  } catch (_) {}
}

// --- SESSION OPENER ---

async function loadSessionOpener() {
  try {
    const data = await api.startSession();
    if (data.opener) {
      openerBanner.textContent = data.opener;
    }
  } catch (err) {
    openerBanner.textContent = 'Welcome! Ready to practice your engineering concepts?';
  }
}

// --- 10-QUESTION ADAPTIVE QUIZ RUNNER ---

async function start10QuestionQuiz() {
  if (!currentUser) return showLandingView();

  const subject = selectSubject.value;
  const topic = selectTopic.value;

  startBatchQuizBtn.disabled = true;
  startBatchQuizBtn.textContent = 'Generating 10 Questions...';

  try {
    const data = await api.generateQuizSet(subject, topic, 10);
    activeQuizQuestions = data.questions || [];
    currentQuizIndex = 0;
    quizScore = 0;

    if (activeQuizQuestions.length === 0) {
      alert('No questions could be generated. Please try again.');
      return;
    }

    quizSummaryCard.style.display = 'none';
    quizProgressHeader.style.display = 'block';
    renderQuizQuestion(activeQuizQuestions[0]);
  } catch (err) {
    alert(`Failed to generate quiz: ${err.message}`);
  } finally {
    startBatchQuizBtn.disabled = false;
    startBatchQuizBtn.textContent = 'Start 10-Question Quiz';
  }
}

async function startSingleQuestion() {
  if (!currentUser) return showLandingView();

  const subject = selectSubject.value;
  const topic = selectTopic.value === 'all' ? TOPICS[subject][0].id : selectTopic.value;

  fetchSingleQuestionBtn.disabled = true;
  fetchSingleQuestionBtn.textContent = 'Loading...';

  try {
    const q = await api.getQuestion(subject, topic);
    activeQuizQuestions = [q];
    currentQuizIndex = 0;
    quizScore = 0;

    quizSummaryCard.style.display = 'none';
    quizProgressHeader.style.display = 'none';
    renderQuizQuestion(q);
  } catch (err) {
    alert(`Failed to fetch question: ${err.message}`);
  } finally {
    fetchSingleQuestionBtn.disabled = false;
    fetchSingleQuestionBtn.textContent = 'Single Question';
  }
}

function renderQuizQuestion(q) {
  selectedOptionIndex = null;
  submitAnswerBtn.disabled = true;
  submitAnswerBtn.style.display = 'inline-block';
  nextQuestionBtn.style.display = 'none';
  feedbackBox.style.display = 'none';
  whyBox.style.display = 'none';

  questionCard.style.display = 'block';
  questionCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const total = activeQuizQuestions.length;
  if (total > 1) {
    quizProgressHeader.style.display = 'block';
    quizStepIndicator.textContent = `Question ${currentQuizIndex + 1} of ${total}`;
    quizScoreIndicator.textContent = `Score: ${quizScore}/${currentQuizIndex}`;
    const percent = Math.round(((currentQuizIndex) / total) * 100);
    quizProgressFill.style.width = `${percent}%`;
  } else {
    quizProgressHeader.style.display = 'none';
  }

  questionText.textContent = q.question;
  questionDifficultyBadge.textContent = (q.difficulty || 'medium').toUpperCase();
  questionDifficultyBadge.className = `badge badge-${(q.difficulty || 'medium').toLowerCase()}`;
  questionTopicBadge.textContent = q.topic || selectTopic.value;

  degradedNotice.style.display = q.degraded ? 'inline-block' : 'none';

  optionsContainer.innerHTML = '';
  (q.options || []).forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.dataset.index = idx;

    const letterSpan = document.createElement('span');
    letterSpan.className = 'option-letter';
    letterSpan.textContent = String.fromCharCode(65 + idx);

    const textSpan = document.createElement('span');
    textSpan.textContent = opt;

    btn.appendChild(letterSpan);
    btn.appendChild(textSpan);

    btn.addEventListener('click', () => {
      document.querySelectorAll('#options-container .option-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedOptionIndex = idx;
      submitAnswerBtn.disabled = false;
    });

    optionsContainer.appendChild(btn);
  });

  if (q.whyThisQuestion) {
    whyBox.style.display = 'block';
    whyText.textContent = q.whyThisQuestion.reason || 'Selected based on cognitive memory.';
    whyBreakdown.innerHTML = '';
    if (q.whyThisQuestion.factors) {
      const factorsDiv = document.createElement('div');
      factorsDiv.textContent = `Factors: ${JSON.stringify(q.whyThisQuestion.factors)}`;
      whyBreakdown.appendChild(factorsDiv);
    }
  }
}

async function submitAnswer() {
  if (selectedOptionIndex === null) return;

  const currentQ = activeQuizQuestions[currentQuizIndex];
  submitAnswerBtn.disabled = true;

  try {
    const result = await api.submitAnswer(currentQ.questionId, selectedOptionIndex);

    const optButtons = optionsContainer.querySelectorAll('.option-btn');
    optButtons.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === result.correctIndex) {
        btn.classList.add('correct');
      } else if (idx === selectedOptionIndex && !result.correct) {
        btn.classList.add('incorrect');
      }
    });

    feedbackBox.style.display = 'block';
    feedbackBox.className = `feedback-box ${result.correct ? 'correct' : 'incorrect'}`;
    feedbackBox.innerHTML = '';

    const titleEl = document.createElement('strong');
    titleEl.textContent = result.correct ? 'Correct! ' : 'Incorrect. ';
    feedbackBox.appendChild(titleEl);

    const explEl = document.createElement('p');
    explEl.textContent = result.explanation;
    explEl.style.marginTop = '0.35rem';
    feedbackBox.appendChild(explEl);

    if (result.correct) {
      quizScore += 1;
    }

    submitAnswerBtn.style.display = 'none';

    if (currentQuizIndex + 1 < activeQuizQuestions.length) {
      nextQuestionBtn.style.display = 'inline-block';
    } else {
      showQuizSummary();
    }
  } catch (err) {
    alert(`Error submitting answer: ${err.message}`);
    submitAnswerBtn.disabled = false;
  }
}

function nextQuestion() {
  currentQuizIndex += 1;
  if (currentQuizIndex < activeQuizQuestions.length) {
    renderQuizQuestion(activeQuizQuestions[currentQuizIndex]);
  }
}

function showQuizSummary() {
  const total = activeQuizQuestions.length;
  quizProgressFill.style.width = '100%';
  quizScoreIndicator.textContent = `Final Score: ${quizScore}/${total}`;

  questionCard.style.display = 'none';
  quizSummaryCard.style.display = 'block';
  quizSummaryCard.scrollIntoView({ behavior: 'smooth' });

  const pct = Math.round((quizScore / total) * 100);
  summaryScoreValue.textContent = `${quizScore} / ${total} (${pct}%)`;

  if (pct >= 80) {
    summaryMemoryImpact.textContent = 'Outstanding performance! Your demonstrated mastery has been stored as Strength memories in MongoDB Atlas.';
  } else if (pct >= 50) {
    summaryMemoryImpact.textContent = 'Solid attempt. Weaknesses on missed topics were diagnosed into MongoDB Agentic Memory to guide future learning.';
  } else {
    summaryMemoryImpact.textContent = 'Tricky concepts identified. Cognitive memory has recorded active weaknesses so the AI Tutor can teach you these topics!';
  }
}

// --- CONCEPT TEACHING ENGINE ---

async function loadRecommendedLessons() {
  try {
    const data = await api.getRecommendedLessons();
    recommendedChips.innerHTML = '';

    if (!data.recommended || data.recommended.length === 0) {
      recommendedChips.textContent = 'No specific weaknesses recorded yet. Select any concept to learn!';
      return;
    }

    data.recommended.forEach((rec) => {
      const chip = document.createElement('button');
      chip.className = 'lesson-chip';
      const statsSnippet = rec.stats ? ` [${rec.stats}]` : '';
      chip.textContent = `${rec.title}${statsSnippet}`;
      chip.title = rec.reason;

      chip.addEventListener('click', () => {
        lessonSubject.value = rec.subject;
        populateTopics(rec.subject, lessonTopic);
        lessonTopic.value = rec.topic;
        teachConcept(rec.subject, rec.topic);
      });

      recommendedChips.appendChild(chip);
    });
  } catch (err) {
    recommendedChips.textContent = 'Select a concept below to begin your lesson.';
  }
}

async function loadSelectedLesson() {
  const subject = lessonSubject.value;
  const topic = lessonTopic.value;
  await teachConcept(subject, topic);
}

async function teachWeakestTopic() {
  switchTab('lessons');
  try {
    const recData = await api.getRecommendedLessons();
    if (recData.recommended && recData.recommended.length > 0) {
      const weakest = recData.recommended[0];
      lessonSubject.value = weakest.subject;
      populateTopics(weakest.subject, lessonTopic);
      lessonTopic.value = weakest.topic;
      await teachConcept(weakest.subject, weakest.topic);
      return;
    }
  } catch (_) {}

  await teachConcept(lessonSubject.value, lessonTopic.value);
}

async function teachConcept(subject, topic) {
  loadLessonBtn.disabled = true;
  loadLessonBtn.textContent = 'Generating Gemini Lesson...';

  try {
    const data = await api.teachLesson(subject, topic);
    const lesson = data.lesson;

    lessonCardView.style.display = 'block';
    lessonCardView.scrollIntoView({ behavior: 'smooth' });

    const stats = lesson.studentStats || { totalAttempts: 0, passedCount: 0, failedCount: 0, accuracyPercent: 0 };
    lessonStatAttempts.textContent = `${stats.totalAttempts} Attempted`;
    lessonStatPassed.textContent = `${stats.passedCount} Passed`;
    lessonStatFailed.textContent = `${stats.failedCount} Failed`;
    lessonStatRate.textContent = `${stats.accuracyPercent}% Accuracy`;

    if (lesson.aiProvider === 'gemini') {
      lessonAiBadge.textContent = 'Gemini 2.5 AI Engine (Live)';
      lessonAiBadge.style.backgroundColor = '#DCFCE7';
      lessonAiBadge.style.color = '#166534';
      lessonAiBadge.style.borderColor = '#86EFAC';
    } else {
      lessonAiBadge.textContent = 'Gemini AI (Adaptive Cognitive Engine)';
      lessonAiBadge.style.backgroundColor = '#F3E8FF';
      lessonAiBadge.style.color = '#6B21A8';
      lessonAiBadge.style.borderColor = '#D8B4FE';
    }

    if (lesson.diagnosis || lesson.studentDiagnosis) {
      lessonDiagnosisBox.style.display = 'block';
      lessonDiagnosisBox.textContent = `${lesson.diagnosis || lesson.studentDiagnosis}`;
    } else {
      lessonDiagnosisBox.style.display = 'none';
    }

    lessonTitle.textContent = lesson.topicLabel || lesson.title;
    lessonSummary.textContent = lesson.summary;
    lessonAnalogy.textContent = lesson.analogy;
    lessonMechanics.textContent = lesson.coreMechanics;
    lessonPitfalls.textContent = lesson.pitfalls || lesson.commonPitfalls;
    lessonCode.textContent = lesson.codeOrDiagram || '-- Code / Architecture example';

    lessonTakeaways.innerHTML = '';
    (lesson.keyTakeaways || []).forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      lessonTakeaways.appendChild(li);
    });

    quizFromLessonBtn.onclick = () => {
      switchTab('quiz');
      selectSubject.value = subject;
      populateTopics(subject, selectTopic);
      selectTopic.value = topic;
      start10QuestionQuiz();
    };
  } catch (err) {
    alert(`Failed to load concept lesson: ${err.message}`);
  } finally {
    loadLessonBtn.disabled = false;
    loadLessonBtn.textContent = 'Teach This Concept';
  }
}

function quizTopicFromLesson() {
  switchTab('quiz');
  selectSubject.value = lessonSubject.value;
  populateTopics(lessonSubject.value, selectTopic);
  selectTopic.value = lessonTopic.value;
  start10QuestionQuiz();
}

// --- ACTIVE RECALL FLASHCARDS ENGINE ---

const DEFAULT_FLASHCARDS = [
  {
    id: "fc-dbms-1",
    subject: "DBMS",
    topic: "sql-joins",
    front: "What is the key functional difference between a LEFT JOIN and a FULL OUTER JOIN?",
    back: "A LEFT JOIN preserves all tuples from the left relation and replaces unmatched right attributes with NULL.\nA FULL OUTER JOIN preserves all tuples from BOTH relations, filling NULLs whenever either side has no match in the join predicate.",
    keyFormula: "LEFT JOIN = (R ⋈ S) ∪ (R - π_R(R ⋈ S)) × {NULL}",
    examTip: "Common trap: If you filter attributes of the right table in a WHERE clause rather than the ON clause of a LEFT JOIN, it accidentally behaves as an INNER JOIN!"
  },
  {
    id: "fc-dbms-2",
    subject: "DBMS",
    topic: "er-model-keys",
    front: "What defines a Candidate Key versus a Super Key?",
    back: "A Super Key is any set of attributes that uniquely identifies each tuple in a relation.\nA Candidate Key is a MINIMAL Super Key — no proper subset of its attributes can uniquely identify the relation.",
    keyFormula: "Candidate Key K ⊆ Super Key S; ∀ A ∈ K, (K - {A}) is NOT a Super Key",
    examTip: "Primary Key is simply one chosen Candidate Key. Candidate keys that are not selected become Alternate Keys."
  },
  {
    id: "fc-dbms-3",
    subject: "DBMS",
    topic: "normalization",
    front: "State the strict difference between 3NF and BCNF.",
    back: "Both require 2NF. For every non-trivial functional dependency X → Y:\n- 3NF allows: X is a Super Key OR Y is a Prime Attribute (part of some candidate key).\n- BCNF strictly demands: X MUST be a Super Key (no prime attribute exception allowed!).",
    keyFormula: "BCNF: ∀ (X → Y), X is Super Key. 3NF: ∀ (X → Y), X is Super Key ∨ Y is Prime.",
    examTip: "Every BCNF relation is in 3NF, but a 3NF relation with overlapping candidate keys might violate BCNF. BCNF may not always preserve dependencies upon decomposition!"
  },
  {
    id: "fc-dbms-4",
    subject: "DBMS",
    topic: "transactions-acid",
    front: "What are the 3 classic Concurrency Read Phenomena prevented by SQL Isolation Levels?",
    back: "1. Dirty Read: Transaction reads uncommitted data written by concurrent Tx (prevented by READ COMMITTED).\n2. Non-Repeatable Read: Tx re-reads a row and finds modified values (prevented by REPEATABLE READ).\n3. Phantom Read: Tx re-executes a range query and discovers newly inserted rows (prevented by SERIALIZABLE).",
    keyFormula: "Isolation Hierarchy: Read Uncommitted < Read Committed < Repeatable Read < Serializable",
    examTip: "Strict 2-Phase Locking (S2PL) holds all exclusive locks until commit/abort, guaranteeing conflict serializability and strict recoverable executions."
  },
  {
    id: "fc-dbms-5",
    subject: "DBMS",
    topic: "indexing",
    front: "Why are B+ Trees universally preferred over standard B-Trees for database disk indexing?",
    back: "1. All record pointers/data are stored exclusively at leaf nodes; internal nodes only store navigation keys, yielding high fanout and shallow tree height (typically 3-4 I/O seeks).\n2. Leaf nodes form a doubly linked list, enabling O(log N) point lookup followed by high-speed sequential disk scans for range queries.",
    keyFormula: "Tree Height h ≤ ⌈log_{⌈m/2⌉}(N)⌉; Leaf scan is O(K) sequential read.",
    examTip: "Clustered indexes dictate the physical sort order of data pages (only 1 per table); Secondary/Non-clustered indexes contain pointers to row IDs or clustered keys."
  },
  {
    id: "fc-os-1",
    subject: "OS",
    topic: "process-scheduling",
    front: "What causes the Convoy Effect in FCFS and how does Round Robin solve it?",
    back: "In FCFS (First-Come, First-Served), a single long CPU-bound process blocks all short I/O-bound processes behind it, devastating average waiting time.\nRound Robin (RR) preempts the running process after a fixed time quantum q, interleaving execution and bounding maximum wait time to (N - 1) * q.",
    keyFormula: "If quantum q → ∞, RR degrades to FCFS. If q → 0, context switch overhead dominates.",
    examTip: "Rule of thumb: Choose quantum q such that 80% of CPU bursts are shorter than q to balance responsiveness with context switch overhead."
  },
  {
    id: "fc-os-2",
    subject: "OS",
    topic: "deadlocks",
    front: "What are Coffman's 4 Necessary Conditions for Deadlock and how does Banker's Algorithm prevent it?",
    back: "1. Mutual Exclusion: Resources non-shareable.\n2. Hold and Wait: Process holds one resource while awaiting another.\n3. No Preemption: Resources cannot be forcibly taken.\n4. Circular Wait: P0 waits for P1 ... Pn waits for P0.\nBanker's Algorithm simulates resource allocation to check if a Safe Sequence exists where Need_i ≤ Available for all processes.",
    keyFormula: "Need[i][j] = Max[i][j] - Allocation[i][j]. Safe state guarantee: ∃ safe sequence <P_1, ..., P_n>",
    examTip: "Deadlock Prevention invalidates at least one of the 4 conditions at design time. Deadlock Avoidance (Banker's) checks requests dynamically at runtime."
  },
  {
    id: "fc-os-3",
    subject: "OS",
    topic: "memory-paging",
    front: "Explain the TLB (Translation Lookaside Buffer) mechanism and Effective Memory Access Time (EMAT).",
    back: "TLB is an on-chip associative cache storing recent Virtual Page Number (VPN) → Physical Frame Number (PFN) translations.\n- TLB Hit: Translation in 1 cycle, memory read in t_m → Total = t_TLB + t_m.\n- TLB Miss: Multi-level page table walk requires (k * t_m) additional memory accesses before accessing the target data.",
    keyFormula: "EMAT = Hit_Ratio * (t_{TLB} + t_m) + (1 - Hit_Ratio) * (t_{TLB} + (k + 1) * t_m)",
    examTip: "Page Fault occurs when the valid/invalid bit in the page table entry is 0 (page not in RAM, must fetch from disk swap space via hardware interrupt)."
  },
  {
    id: "fc-os-4",
    subject: "OS",
    topic: "synchronization",
    front: "What is the difference between a Mutex and a Counting Semaphore?",
    back: "A Mutex is an ownership-locking mechanism with binary states (0/1); ONLY the thread that acquired the mutex can unlock it.\nA Semaphore is a signaling integer counter that can be incremented (signal/V) or decremented (wait/P) by ANY thread to manage resource pools or coordinate execution order.",
    keyFormula: "Wait(S): while (S <= 0); S--; | Signal(S): S++;",
    examTip: "Priority Inversion occurs when a high-priority task is blocked by a low-priority task holding a mutex. It is solved via Priority Inheritance Protocol."
  },
  {
    id: "fc-os-5",
    subject: "OS",
    topic: "file-systems",
    front: "How does an Unix Inode structure map file blocks?",
    back: "An Inode contains metadata (size, permissions, timestamps) and direct/indirect block pointers:\n- 12 Direct Pointers: Point directly to disk data blocks.\n- 1 Singly Indirect: Points to a block filled with data block pointers.\n- 1 Doubly Indirect: Points to a block of indirect pointer blocks.\n- 1 Triply Indirect: Enables huge multi-terabyte file addressing.",
    keyFormula: "Max Blocks = 12 + (B/4) + (B/4)^2 + (B/4)^3 where B is block size in bytes (4-byte pointers).",
    examTip: "Hard links share the same inode number (cannot cross filesystems); Soft (Symbolic) links have their own inode containing the path string of the target."
  },
  {
    id: "fc-dsa-1",
    subject: "DSA",
    topic: "arrays-strings",
    front: "When is the Two-Pointer pattern applicable and what is its primary efficiency benefit?",
    back: "Applicable on monotonic or sorted sequences (or two sequences moving synchronously).\nIt eliminates nested loops, reducing time complexity from O(N^2) to O(N) with O(1) extra space.",
    keyFormula: "Time: O(N), Space: O(1) via while (left < right)",
    examTip: "Always watch out for array bounds and off-by-one errors when advancing indices."
  },
  {
    id: "fc-dsa-2",
    subject: "DSA",
    topic: "dynamic-programming",
    front: "What is the key difference between Top-Down Memoization and Bottom-Up Tabulation in Dynamic Programming?",
    back: "Top-Down (Memoization) uses recursion with a lookup cache, evaluating only reachable subproblems.\nBottom-Up (Tabulation) iteratively fills an array/table from smallest base cases upward, avoiding recursion stack overhead and enabling space optimization.",
    keyFormula: "Tabulation: dp[i] = min/max/sum(dp[i - k]) + cost",
    examTip: "If state dp[i] depends only on dp[i-1] and dp[i-2], you can optimize auxiliary space from O(N) to O(1) using two variables!"
  },
  {
    id: "fc-net-1",
    subject: "NETWORKING",
    topic: "transport-protocols",
    front: "Explain the TCP 3-Way Handshake and why a 2-Way Handshake is insufficient.",
    back: "1. Client -> Server: SYN (seq = x)\n2. Server -> Client: SYN-ACK (seq = y, ack = x + 1)\n3. Client -> Server: ACK (ack = y + 1)\nA 2-Way Handshake fails because delayed duplicate SYN packets could cause the server to allocate resources for a dead connection.",
    keyFormula: "SYN -> SYN-ACK -> ACK",
    examTip: "Remember that the final ACK can carry piggybacked data from client to server."
  },
  {
    id: "fc-sys-1",
    subject: "SYSTEM_DESIGN",
    topic: "caching-redis",
    front: "What is Cache Stampede (Thundering Herd) and how do you prevent it?",
    back: "Occurs when a high-traffic key expires, causing thousands of concurrent requests to simultaneously miss the cache and overwhelm the underlying database.\nPrevention: Mutex locking (single-flight cache load), probabilistic early expiration (XFetch), or background cache pre-warming.",
    keyFormula: "P(recompute) = -β * δ * ln(rand()) > (expiry - now)",
    examTip: "Use jitter (random time offset) on TTLs so large batches of keys don't expire at the exact same second!"
  }
];

let allFlashcardsCache = DEFAULT_FLASHCARDS;
activeFlashcards = DEFAULT_FLASHCARDS;
let currentFcSubject = 'ALL';
let areAllCardsFlipped = false;

async function loadFlashcards(subject = 'ALL') {
  currentFcSubject = subject;
  activeFlashcards = subject === 'ALL'
    ? allFlashcardsCache
    : allFlashcardsCache.filter((c) => c.subject === subject);
  currentFlashcardIndex = 0;
  isFlashcardFlipped = false;
  renderFlashcardsGrid(activeFlashcards);
  renderCurrentFlashcard();

  try {
    const data = await api.getFlashcards(subject === 'ALL' ? null : subject);
    if (data.flashcards && data.flashcards.length > 0) {
      allFlashcardsCache = data.flashcards;
      activeFlashcards = subject === 'ALL'
        ? allFlashcardsCache
        : allFlashcardsCache.filter((c) => c.subject === subject);
      renderFlashcardsGrid(activeFlashcards);
      renderCurrentFlashcard();
    }
  } catch (_) {
    // If network fails, already gracefully rendered from DEFAULT_FLASHCARDS
  }
}

function filterFlashcardsBySubject(subj) {
  currentFcSubject = subj;
  const pills = [fcFilterAll, fcFilterDbms, fcFilterOs, fcFilterDsa, fcFilterNetworking, fcFilterSystemDesign];
  pills.forEach((b) => {
    if (b) {
      b.style.backgroundColor = 'var(--bg-card)';
      b.style.color = 'var(--primary-dark)';
    }
  });

  const activeBtnMap = {
    ALL: fcFilterAll,
    DBMS: fcFilterDbms,
    OS: fcFilterOs,
    DSA: fcFilterDsa,
    NETWORKING: fcFilterNetworking,
    SYSTEM_DESIGN: fcFilterSystemDesign
  };

  const activeBtn = activeBtnMap[subj];
  if (activeBtn) {
    activeBtn.style.backgroundColor = 'var(--primary-dark)';
    activeBtn.style.color = '#FFFFFF';
  }

  loadFlashcards(subj);
}

function renderFlashcardsGrid(cards) {
  if (!fcCardsGrid) return;
  fcCardsGrid.innerHTML = '';
  if (flashcardCounterBadge) {
    flashcardCounterBadge.textContent = `Showing ${cards.length} Flashcards`;
  }

  if (cards.length === 0) {
    fcCardsGrid.innerHTML = '<p style="color: var(--text-muted); padding: 1.5rem; text-align: center;">No flashcards found for this selection.</p>';
    return;
  }

  cards.forEach((card, idx) => {
    const tile = document.createElement('div');
    tile.className = 'flashcard-grid-card';
    tile.dataset.id = card.id;

    // Header with badges
    const header = document.createElement('div');
    header.className = 'flashcard-grid-header';

    const numBadge = document.createElement('span');
    numBadge.style.fontSize = '0.78rem';
    numBadge.style.fontWeight = '700';
    numBadge.style.color = 'var(--text-muted)';
    numBadge.textContent = `#${idx + 1}`;

    const subjBadge = document.createElement('span');
    subjBadge.className = `stat-pill ${card.subject === 'DBMS' ? 'stat-pill-pass' : 'stat-pill-accuracy'}`;
    subjBadge.textContent = `${card.subject} • ${card.topic}`;

    header.appendChild(numBadge);
    header.appendChild(subjBadge);

    // Question
    const qEl = document.createElement('div');
    qEl.className = 'flashcard-grid-question';
    qEl.textContent = card.front;

    // Solution container
    const solContainer = document.createElement('div');
    solContainer.className = 'fc-solution-block';
    solContainer.style.display = areAllCardsFlipped ? 'block' : 'none';

    const ansEl = document.createElement('div');
    ansEl.className = 'flashcard-grid-answer';
    ansEl.textContent = card.back;
    solContainer.appendChild(ansEl);

    if (card.keyFormula) {
      const formEl = document.createElement('div');
      formEl.className = 'flashcard-formula-badge';
      formEl.textContent = `Key Theorem / Formula: ${card.keyFormula}`;
      solContainer.appendChild(formEl);
    }

    if (card.examTip) {
      const tipEl = document.createElement('div');
      tipEl.className = 'flashcard-trap-box';
      tipEl.textContent = `Exam Trap: ${card.examTip}`;
      solContainer.appendChild(tipEl);
    }

    // Rating Bar on Grid Card
    const ratingRow = document.createElement('div');
    ratingRow.style.display = 'flex';
    ratingRow.style.gap = '0.35rem';
    ratingRow.style.flexWrap = 'wrap';
    ratingRow.style.marginTop = '0.6rem';
    ratingRow.style.marginBottom = '0.4rem';

    const ratingOptions = [
      { id: 'again', label: 'Again', tip: '<1m' },
      { id: 'hard', label: 'Hard', tip: '1d' },
      { id: 'good', label: 'Good', tip: '3d' },
      { id: 'easy', label: 'Easy', tip: '7d' }
    ];

    ratingOptions.forEach((ro) => {
      const rBtn = document.createElement('button');
      rBtn.className = `rate-btn rate-btn-${ro.id}`;
      rBtn.style.padding = '0.25rem 0.55rem';
      rBtn.style.fontSize = '0.74rem';
      rBtn.textContent = ro.label;
      rBtn.title = `Review in ${ro.tip}`;
      rBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleRateSingleCard(card, ro.id, rBtn);
      });
      ratingRow.appendChild(rBtn);
    });
    solContainer.appendChild(ratingRow);

    // Actions row
    const actions = document.createElement('div');
    actions.className = 'fc-card-actions';

    const flipBtn = document.createElement('button');
    flipBtn.className = 'btn-outline';
    flipBtn.style.fontSize = '0.8rem';
    flipBtn.style.color = 'var(--primary-dark)';
    flipBtn.style.borderColor = 'var(--primary-dark)';
    flipBtn.textContent = areAllCardsFlipped ? 'Hide Solution' : 'Reveal Solution';

    flipBtn.addEventListener('click', () => {
      const isVisible = solContainer.style.display !== 'none';
      solContainer.style.display = isVisible ? 'none' : 'block';
      flipBtn.textContent = isVisible ? 'Reveal Solution' : 'Hide Solution';
    });

    const voiceBtn = document.createElement('button');
    voiceBtn.className = 'btn-speech';
    voiceBtn.style.fontSize = '0.75rem';
    voiceBtn.style.padding = '0.2rem 0.5rem';
    voiceBtn.textContent = 'Listen';
    voiceBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speakText(`${card.front}. Answer: ${card.back}`);
    });

    actions.appendChild(flipBtn);
    actions.appendChild(voiceBtn);

    tile.appendChild(header);
    tile.appendChild(qEl);
    tile.appendChild(solContainer);
    tile.appendChild(actions);

    fcCardsGrid.appendChild(tile);
  });
}

function toggleFlipAllCards() {
  areAllCardsFlipped = !areAllCardsFlipped;
  if (fcFlipAllBtn) {
    fcFlipAllBtn.textContent = areAllCardsFlipped ? 'Hide All' : 'Flip All';
  }
  renderFlashcardsGrid(activeFlashcards);
}

async function handleRateSingleCard(card, rating, btn) {
  try {
    btn.disabled = true;
    await api.rateFlashcard(card.id, rating, card.topic, card.subject);
    const orig = btn.textContent;
    btn.textContent = 'Saved';
    setTimeout(() => {
      btn.textContent = orig;
      btn.disabled = false;
    }, 1500);
  } catch (err) {
    alert(`Failed to save rating: ${err.message}`);
    btn.disabled = false;
  }
}

function renderCurrentFlashcard() {
  if (activeFlashcards.length === 0) {
    if (fcMainText) fcMainText.textContent = 'No flashcards match your search or filter.';
    if (fcDeckStepText) fcDeckStepText.textContent = '0 of 0';
    if (fcDeckPercentText) fcDeckPercentText.textContent = '0% Completed';
    if (fcDeckProgressFill) fcDeckProgressFill.style.width = '0%';
    return;
  }

  const card = activeFlashcards[currentFlashcardIndex];
  const total = activeFlashcards.length;
  const currentNum = currentFlashcardIndex + 1;
  const pct = Math.round((currentNum / total) * 100);

  if (fcDeckStepText) fcDeckStepText.textContent = `Card ${currentNum} of ${total}`;
  if (fcDeckPercentText) fcDeckPercentText.textContent = `${pct}% Completed`;
  if (fcDeckProgressFill) fcDeckProgressFill.style.width = `${pct}%`;

  if (flashcardCounterBadge) {
    flashcardCounterBadge.textContent = `Showing ${total} Flashcards`;
  }
  if (fcTopicLabel) fcTopicLabel.textContent = `${card.subject} • ${card.topic}`;

  if (!isFlashcardFlipped) {
    if (fcSideLabel) fcSideLabel.textContent = 'FRONT (QUESTION)';
    if (fcMainText) fcMainText.textContent = card.front;
    if (fcExtraBox) fcExtraBox.style.display = 'none';
    if (fcRatingContainer) fcRatingContainer.style.display = 'none';
  } else {
    if (fcSideLabel) fcSideLabel.textContent = 'BACK (EXPLANATION & PROOF)';
    if (fcMainText) fcMainText.textContent = card.back;
    if (fcExtraBox) {
      fcExtraBox.style.display = 'block';
      if (card.keyFormula && fcFormulaText) {
        fcFormulaText.textContent = card.keyFormula;
      }
      if (card.examTip && fcTrapBox && fcTrapText) {
        fcTrapBox.style.display = 'block';
        fcTrapText.textContent = `Exam Trap: ${card.examTip}`;
      } else if (fcTrapBox) {
        fcTrapBox.style.display = 'none';
      }
    }
    if (fcRatingContainer) fcRatingContainer.style.display = 'grid';
  }

  if (fcPrevBtn) fcPrevBtn.disabled = currentFlashcardIndex === 0;
  if (fcNextBtn) fcNextBtn.disabled = currentFlashcardIndex === total - 1;
}

function shuffleFlashcards() {
  activeFlashcards = [...activeFlashcards].sort(() => Math.random() - 0.5);
  currentFlashcardIndex = 0;
  isFlashcardFlipped = false;
  renderCurrentFlashcard();
  renderFlashcardsGrid(activeFlashcards);
}

function handleFlashcardSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  const base = currentFcSubject === 'ALL'
    ? allFlashcardsCache
    : allFlashcardsCache.filter((c) => c.subject === currentFcSubject);

  if (!query) {
    activeFlashcards = base;
  } else {
    activeFlashcards = base.filter((c) =>
      c.front.toLowerCase().includes(query) ||
      c.back.toLowerCase().includes(query) ||
      c.topic.toLowerCase().includes(query) ||
      (c.keyFormula && c.keyFormula.toLowerCase().includes(query))
    );
  }
  currentFlashcardIndex = 0;
  isFlashcardFlipped = false;
  renderCurrentFlashcard();
  renderFlashcardsGrid(activeFlashcards);
}

function toggleFlashcardFlip() {
  isFlashcardFlipped = !isFlashcardFlipped;
  renderCurrentFlashcard();
}

function prevFlashcard() {
  if (currentFlashcardIndex > 0) {
    currentFlashcardIndex -= 1;
    isFlashcardFlipped = false;
    renderCurrentFlashcard();
  }
}

function nextFlashcard() {
  if (currentFlashcardIndex < activeFlashcards.length - 1) {
    currentFlashcardIndex += 1;
    isFlashcardFlipped = false;
    renderCurrentFlashcard();
  }
}

async function handleRateFlashcard(rating) {
  const card = activeFlashcards[currentFlashcardIndex];
  try {
    await api.rateFlashcard(card.id, rating, card.topic, card.subject);
    if (currentFlashcardIndex < activeFlashcards.length - 1) {
      nextFlashcard();
    } else {
      alert(`Flashcard set completed! Your recall ratings updated MongoDB Cognitive Memory.`);
    }
  } catch (err) {
    alert(`Failed to save rating: ${err.message}`);
  }
}

// --- TIMED MOCK EXAM SIMULATOR ---

async function startMockExam() {
  startMockexamBtn.disabled = true;
  startMockexamBtn.textContent = 'Preparing 15-Question Exam...';

  try {
    const data = await api.startMockExam();
    mockExamQuestions = data.questions || [];
    mockExamCurrentIdx = 0;
    mockExamSubmissions = {};
    examSecondsRemaining = data.timeLimitSeconds || 900;
    examStartTime = Date.now();

    mockexamIntroCard.style.display = 'none';
    mockexamReportCard.style.display = 'none';
    mockexamActiveCard.style.display = 'block';

    renderMockExamQuestion();
    startExamTimer();
  } catch (err) {
    alert(`Failed to start mock exam: ${err.message}`);
  } finally {
    startMockexamBtn.disabled = false;
    startMockexamBtn.textContent = 'Start 15-Minute Mock Exam';
  }
}

function startExamTimer() {
  if (mockExamTimerInterval) clearInterval(mockExamTimerInterval);
  updateTimerDisplay();

  mockExamTimerInterval = setInterval(() => {
    examSecondsRemaining -= 1;
    updateTimerDisplay();

    if (examSecondsRemaining <= 0) {
      clearInterval(mockExamTimerInterval);
      alert('⏰ Time is up! Submitting your exam automatically...');
      submitMockExamFinal();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const mins = Math.floor(examSecondsRemaining / 60);
  const secs = examSecondsRemaining % 60;
  mockexamTimer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function renderMockExamQuestion() {
  const q = mockExamQuestions[mockExamCurrentIdx];
  const total = mockExamQuestions.length;

  examQIndicator.textContent = `Question ${mockExamCurrentIdx + 1} of ${total}`;
  examTopicBadge.textContent = `${q.subject} / ${q.topic}`;
  examQText.textContent = q.question;

  examPrevBtn.disabled = mockExamCurrentIdx === 0;
  examNextBtn.style.display = mockExamCurrentIdx === total - 1 ? 'none' : 'inline-block';

  examOptionsContainer.innerHTML = '';
  const selectedIdx = mockExamSubmissions[q.questionId];

  (q.options || []).forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = `option-btn ${selectedIdx === idx ? 'selected' : ''}`;

    const letterSpan = document.createElement('span');
    letterSpan.className = 'option-letter';
    letterSpan.textContent = String.fromCharCode(65 + idx);

    const textSpan = document.createElement('span');
    textSpan.textContent = opt;

    btn.appendChild(letterSpan);
    btn.appendChild(textSpan);

    btn.addEventListener('click', () => {
      mockExamSubmissions[q.questionId] = idx;
      document.querySelectorAll('#exam-options-container .option-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    });

    examOptionsContainer.appendChild(btn);
  });
}

function nextMockExamQuestion() {
  if (mockExamCurrentIdx < mockExamQuestions.length - 1) {
    mockExamCurrentIdx += 1;
    renderMockExamQuestion();
  }
}

function prevMockExamQuestion() {
  if (mockExamCurrentIdx > 0) {
    mockExamCurrentIdx -= 1;
    renderMockExamQuestion();
  }
}

async function submitMockExamFinal() {
  if (mockExamTimerInterval) clearInterval(mockExamTimerInterval);
  const timeSpentSeconds = Math.round((Date.now() - examStartTime) / 1000);

  const submissions = mockExamQuestions.map((q) => ({
    questionId: q.questionId,
    selectedOptionIndex: mockExamSubmissions[q.questionId] !== undefined ? mockExamSubmissions[q.questionId] : -1
  }));

  examSubmitBtn.disabled = true;
  examSubmitBtn.textContent = 'Grading Exam...';

  try {
    const result = await api.submitMockExam(submissions, timeSpentSeconds);
    mockexamActiveCard.style.display = 'none';
    mockexamReportCard.style.display = 'block';

    reportGradeCircle.textContent = result.letterGrade;
    reportGradeCircle.className = `grade-badge-circle grade-${result.letterGrade.charAt(0)}`;
    reportScoreText.textContent = `Score: ${result.score} / ${result.total} (${result.accuracy}%) &bull; Time: ${Math.floor(timeSpentSeconds / 60)}m ${timeSpentSeconds % 60}s`;
    reportAdviceText.textContent = result.tutorAdvice;

    // Review List
    reportReviewList.innerHTML = '<h3 style="margin-bottom: 0.75rem;">Question Breakdown & Solutions</h3>';
    (result.details || []).forEach((d, idx) => {
      const item = document.createElement('div');
      item.style.padding = '0.75rem';
      item.style.marginBottom = '0.5rem';
      item.style.borderRadius = '6px';
      item.style.border = '1px solid var(--border-color)';
      item.style.backgroundColor = d.correct ? '#F0FDF4' : '#FEF2F2';

      const qTitle = document.createElement('strong');
      qTitle.textContent = `Q${idx + 1}: ${d.question}`;
      const outcome = document.createElement('div');
      outcome.style.fontSize = '0.85rem';
      outcome.style.marginTop = '0.25rem';
      outcome.textContent = `${d.correct ? 'Correct' : 'Incorrect'} | Topic: ${d.topic}`;
      const expl = document.createElement('div');
      expl.style.fontSize = '0.82rem';
      expl.style.color = 'var(--text-muted)';
      expl.textContent = `Explanation: ${d.explanation}`;

      item.appendChild(qTitle);
      item.appendChild(outcome);
      item.appendChild(expl);
      reportReviewList.appendChild(item);
    });
  } catch (err) {
    alert(`Failed to grade exam: ${err.message}`);
  } finally {
    examSubmitBtn.disabled = false;
    examSubmitBtn.textContent = 'Submit Exam Final';
  }
}

// --- AI STUDY PLANNER ENGINE ---

async function loadStudyPlan() {
  try {
    const data = await api.getStudyPlan();
    spReadinessScore.textContent = `${data.readinessScore}%`;
    spCoveragePill.textContent = `Syllabus Coverage: ${data.coverageScore}%`;
    spAccuracyPill.textContent = `Average Accuracy: ${data.overallAccuracy}%`;

    // Action Checklist
    spChecklistContainer.innerHTML = '';
    (data.actionChecklist || []).forEach((act) => {
      const item = document.createElement('div');
      item.style.padding = '0.6rem 0.85rem';
      item.style.backgroundColor = '#FFFFFF';
      item.style.border = '1px solid var(--border-color)';
      item.style.borderRadius = '6px';
      item.style.fontSize = '0.9rem';
      item.style.fontWeight = '500';
      item.textContent = act;
      spChecklistContainer.appendChild(item);
    });

    // Critical Priority
    spCriticalContainer.innerHTML = '';
    if ((data.criticalList || []).length === 0) {
      spCriticalContainer.innerHTML = '<p style="font-size: 0.82rem; color: #166534;">Zero critical weaknesses detected.</p>';
    } else {
      data.criticalList.forEach((c) => {
        const box = document.createElement('div');
        box.className = 'study-priority-card';
        box.textContent = `${c.label} (${c.accuracy}% Accuracy) — ${c.reason}`;
        spCriticalContainer.appendChild(box);
      });
    }

    // Reinforcement
    spReinforceContainer.innerHTML = '';
    (data.reinforcementList || []).forEach((r) => {
      const box = document.createElement('div');
      box.style.borderLeftColor = '#F59E0B';
      box.className = 'study-priority-card';
      box.textContent = `${r.label} (${r.accuracy}% Accuracy)`;
      spReinforceContainer.appendChild(box);
    });

    // Mastered
    spMasteredContainer.innerHTML = '';
    (data.masteredList || []).forEach((m) => {
      const box = document.createElement('div');
      box.style.borderLeftColor = '#166534';
      box.className = 'study-priority-card';
      box.textContent = `${m.label} (${m.accuracy}% Accuracy)`;
      spMasteredContainer.appendChild(box);
    });
  } catch (err) {
    console.warn('Failed to load study plan:', err);
  }
}

// --- REVISION CHEAT SHEETS ENGINE ---

async function loadCheatSheet(subject) {
  try {
    const data = await api.getCheatSheet(subject);
    const sheet = data.sheet;

    csTitle.textContent = sheet.title;
    csSummary.textContent = sheet.summary;
    csSectionsGrid.innerHTML = '';

    (sheet.sections || []).forEach((sec) => {
      const box = document.createElement('div');
      box.className = 'chart-card';
      box.style.padding = '1rem';

      const h4 = document.createElement('h4');
      h4.style.color = 'var(--primary-dark)';
      h4.style.fontSize = '0.95rem';
      h4.style.marginBottom = '0.5rem';
      h4.textContent = sec.heading;

      const p = document.createElement('p');
      p.style.fontSize = '0.85rem';
      p.style.lineHeight = '1.6';
      p.style.whiteSpace = 'pre-line';
      p.textContent = sec.content;

      box.appendChild(h4);
      box.appendChild(p);
      csSectionsGrid.appendChild(box);
    });
  } catch (err) {
    csSummary.textContent = `Failed to load cheat sheet: ${err.message}`;
  }
}

// --- COGNITIVE MEMORIES TAB ---

async function loadMemories() {
  memoriesContainer.innerHTML = '<p style="color: var(--text-muted);">Loading memories from MongoDB Atlas...</p>';

  try {
    const data = await api.getMemories();
    memoriesContainer.innerHTML = '';

    if (!data.memories || data.memories.length === 0) {
      memoriesContainer.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">No cognitive memories recorded yet. Take a quiz or chat with the AI Tutor to build your profile!</p>';
      return;
    }

    data.memories.forEach((mem) => {
      const card = document.createElement('div');
      card.className = `memory-item ${mem.type}`;

      const header = document.createElement('div');
      header.className = 'memory-header';

      const typeSpan = document.createElement('span');
      typeSpan.className = `badge badge-${mem.type}`;
      typeSpan.textContent = mem.type.toUpperCase();

      const topicSpan = document.createElement('span');
      topicSpan.style.fontSize = '0.82rem';
      topicSpan.style.color = 'var(--text-muted)';
      topicSpan.textContent = `${mem.subject} / ${mem.topic}`;

      header.appendChild(typeSpan);
      header.appendChild(topicSpan);

      const content = document.createElement('p');
      content.className = 'memory-content';
      content.textContent = mem.content;

      const meta = document.createElement('div');
      meta.className = 'memory-meta';
      meta.textContent = `Strength: ${Math.round((mem.strength || 0) * 100)}% | Source: ${mem.source || 'quiz'} | Status: ${mem.status || 'active'}`;

      const actions = document.createElement('div');
      actions.className = 'memory-actions';

      const correctBtn = document.createElement('button');
      correctBtn.className = 'btn-outline';
      correctBtn.textContent = 'Correct';
      correctBtn.onclick = () => openCorrectModal(mem._id, mem.content);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-outline';
      deleteBtn.style.borderColor = 'var(--accent-red)';
      deleteBtn.style.color = 'var(--accent-red)';
      deleteBtn.textContent = 'Delete';
      deleteBtn.onclick = () => deleteMemory(mem._id);

      actions.appendChild(correctBtn);
      actions.appendChild(deleteBtn);

      card.appendChild(header);
      card.appendChild(content);
      card.appendChild(meta);
      card.appendChild(actions);

      memoriesContainer.appendChild(card);
    });
  } catch (err) {
    memoriesContainer.innerHTML = `<p style="color: var(--accent-red);">Failed to load memories: ${err.message}</p>`;
  }
}

function openCorrectModal(id, currentContent) {
  memoryToCorrectId = id;
  correctContentInput.value = currentContent;
  correctModal.classList.add('active');
}

function closeCorrectModal() {
  correctModal.classList.remove('active');
  memoryToCorrectId = null;
}

async function submitMemoryCorrection() {
  if (!memoryToCorrectId) return;
  const newContent = correctContentInput.value.trim();
  if (!newContent) return;

  correctSubmitBtn.disabled = true;
  try {
    await api.correctMemory(memoryToCorrectId, newContent);
    closeCorrectModal();
    loadMemories();
  } catch (err) {
    alert(`Failed to save correction: ${err.message}`);
  } finally {
    correctSubmitBtn.disabled = false;
  }
}

async function deleteMemory(id) {
  if (!confirm('Are you sure you want to delete this memory? (GDPR Right to be Forgotten)')) return;

  try {
    await api.deleteMemory(id);
    loadMemories();
  } catch (err) {
    alert(`Failed to delete memory: ${err.message}`);
  }
}

// --- MULTI-CHART ANALYTICS (CHART.JS) ---

async function loadProgress() {
  try {
    const data = await api.getProgress();

    statAccuracy.textContent = `${data.overallAccuracy || 0}%`;
    statAttempts.textContent = data.totalAttempts || 0;
    statCorrect.textContent = data.totalCorrect || 0;
    statWeaknesses.textContent = data.memoryBreakdown?.activeWeaknesses || 0;

    renderAllCharts(data);
  } catch (err) {
    console.warn('Failed to load progress analytics:', err);
  }
}

function renderAllCharts(data) {
  if (!window.Chart) return;
  renderTopicMasteryChart(data.topicBreakdown || []);
  renderSubjectCompareChart(data.subjectBreakdown || []);
  renderMemoryDistChart(data.memoryBreakdown || {});
  renderTimelineChart(data.timeline || []);
}

function renderTopicMasteryChart(topics) {
  const canvas = document.getElementById('chart-topic-mastery');
  if (!canvas) return;

  if (chartTopicMasteryInstance) {
    chartTopicMasteryInstance.destroy();
  }

  const labels = topics.map((t) => t.topic);
  const dataValues = topics.map((t) => t.accuracy);
  const backgroundColors = dataValues.map((val) => {
    if (val >= 70) return '#166534';
    if (val >= 40) return '#B45309';
    return '#DC2626';
  });

  chartTopicMasteryInstance = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Mastery Accuracy (%)',
          data: dataValues,
          backgroundColor: backgroundColors,
          borderRadius: 4
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: (v) => `${v}%` }
        }
      }
    }
  });
}

function renderSubjectCompareChart(subjects) {
  const canvas = document.getElementById('chart-subject-compare');
  if (!canvas) return;

  if (chartSubjectCompareInstance) {
    chartSubjectCompareInstance.destroy();
  }

  const labels = ['DBMS', 'OS'];
  const passedData = labels.map((subj) => {
    const found = subjects.find((s) => s.subject === subj);
    return found ? found.passed : 0;
  });
  const failedData = labels.map((subj) => {
    const found = subjects.find((s) => s.subject === subj);
    return found ? found.failed : 0;
  });

  chartSubjectCompareInstance = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Passed (Correct)',
          data: passedData,
          backgroundColor: '#166534',
          borderRadius: 4
        },
        {
          label: 'Failed (Wrong)',
          data: failedData,
          backgroundColor: '#DC2626',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });
}

function renderMemoryDistChart(memoryBreakdown) {
  const canvas = document.getElementById('chart-memory-dist');
  if (!canvas) return;

  if (chartMemoryDistInstance) {
    chartMemoryDistInstance.destroy();
  }

  const strengths = memoryBreakdown.activeStrengths || 0;
  const weaknesses = memoryBreakdown.activeWeaknesses || 0;
  const superseded = memoryBreakdown.supersededCount || 0;

  const hasData = strengths + weaknesses + superseded > 0;
  const data = hasData ? [strengths, weaknesses, superseded] : [1];
  const labels = hasData ? ['Active Strengths', 'Active Weaknesses', 'Superseded (Mastered)'] : ['No memories yet'];
  const colors = hasData ? ['#166534', '#F59E0B', '#64748B'] : ['#E2E8F0'];

  chartMemoryDistInstance = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          hoverOffset: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

function renderTimelineChart(timeline) {
  const canvas = document.getElementById('chart-timeline');
  if (!canvas) return;

  if (chartTimelineInstance) {
    chartTimelineInstance.destroy();
  }

  const labels = timeline.length > 0
    ? timeline.map((t) => `${t.date} (${t.topic})`)
    : ['Session 1'];
  const accuracyData = timeline.length > 0
    ? timeline.map((t) => t.accuracy)
    : [0];

  chartTimelineInstance = new window.Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Session Accuracy (%)',
          data: accuracyData,
          borderColor: '#0F4A1E',
          backgroundColor: 'rgba(15, 74, 30, 0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 5,
          pointBackgroundColor: '#0F4A1E'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: (v) => `${v}%` }
        }
      }
    }
  });
}

// --- GDPR DATA EXPORT & ACCOUNT DELETION ---

async function exportUserData() {
  try {
    const res = await fetch('/api/account/export', {
      headers: { 'X-Requested-With': 'study-buddy' }
    });
    if (!res.ok) throw new Error('Failed to export data');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-buddy-data-${currentUser?.username || 'student'}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    alert(`Export failed: ${err.message}`);
  }
}

async function deleteUserAccount() {
  const pass = prompt('Enter your password to permanently delete your account and all cognitive memories:');
  if (!pass) return;

  try {
    await api.deleteAccount(pass);
    alert('Account and memories deleted successfully.');
    window.location.reload();
  } catch (err) {
    alert(`Failed to delete account: ${err.message}`);
  }
}

// Start on DOM ready
document.addEventListener('DOMContentLoaded', init);
