// public/app.js
// Client-side application controller for Study Buddy AI Tutor.
// Strictly uses textContent and safe DOM node creation (NEVER innerHTML with user input),
// preventing XSS. Implements Home Page landing with proper Sign In & Registration,
// 1-on-1 Socratic AI Tutor, 10-Question Adaptive Quiz, Concept Lessons with live pass/fail memory,
// Active Recall Flashcards with spaced repetition, Timed Mock Exam with letter grade cards,
// AI Study Planner & Readiness Roadmap, Cheat Sheets, Cognitive Memory, and 4 Chart.js analytics visualizations.

import { api } from './api.js';

// Supported subjects and topics
const TOPICS = {
  DBMS: [
    { id: 'sql-joins', label: 'SQL Joins (INNER, LEFT, RIGHT, FULL)' },
    { id: 'er-model-keys', label: 'ER Model & Keys (Primary, Foreign, Candidate)' },
    { id: 'normalization', label: 'Normalization (1NF, 2NF, 3NF, BCNF)' },
    { id: 'transactions-acid', label: 'Transactions & ACID Properties' },
    { id: 'indexing', label: 'Database Indexing (B+ Trees, Hash)' }
  ],
  OS: [
    { id: 'process-scheduling', label: 'Process Scheduling (Round Robin, SJF, FCFS)' },
    { id: 'deadlocks', label: 'Deadlocks & Banker\'s Algorithm' },
    { id: 'memory-paging', label: 'Virtual Memory & Paging (TLB, Page Faults)' },
    { id: 'synchronization', label: 'Process Synchronization & Semaphores' },
    { id: 'file-systems', label: 'File Systems & Inodes' }
  ]
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

// Tab 3: Flashcards Elements
const flashcardCounterBadge = document.getElementById('flashcard-counter-badge');
const fcViewGridBtn = document.getElementById('fc-view-grid-btn');
const fcViewDeckBtn = document.getElementById('fc-view-deck-btn');
const fcFlipAllBtn = document.getElementById('fc-flip-all-btn');
const fcFilterAll = document.getElementById('fc-filter-all');
const fcFilterDbms = document.getElementById('fc-filter-dbms');
const fcFilterOs = document.getElementById('fc-filter-os');
const fcGridView = document.getElementById('fc-grid-view');
const fcDeckView = document.getElementById('fc-deck-view');
const fcCardsGrid = document.getElementById('fc-cards-grid');

const flashcardElement = document.getElementById('flashcard-element');
const fcSideLabel = document.getElementById('fc-side-label');
const fcTopicLabel = document.getElementById('fc-topic-label');
const fcMainText = document.getElementById('fc-main-text');
const fcExtraBox = document.getElementById('fc-extra-box');
const fcFormulaText = document.getElementById('fc-formula-text');
const fcRatingContainer = document.getElementById('fc-rating-container');
const fcVoiceBtn = document.getElementById('fc-voice-btn');
const fcPrevBtn = document.getElementById('fc-prev-btn');
const fcNextBtn = document.getElementById('fc-next-btn');

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
  viewApp.style.display = 'block';

  studentBadge.textContent = `${user.displayName || user.username} (${user.role || 'Student'})`;
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
      tutorModeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTutorMode = btn.dataset.mode;
    });
  });
  tutorReadAloudBtn.addEventListener('click', () => speakText(lastTutorReplyText));
  quickPromptButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tutorChatInput.value = btn.textContent;
      handleTutorChatSubmit(new Event('submit'));
    });
  });

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
  csSubjDbmsBtn.addEventListener('click', () => {
    csSubjDbmsBtn.className = 'btn-primary';
    csSubjOsBtn.className = 'btn-outline';
    loadCheatSheet('DBMS');
  });
  csSubjOsBtn.addEventListener('click', () => {
    csSubjOsBtn.className = 'btn-primary';
    csSubjDbmsBtn.className = 'btn-outline';
    loadCheatSheet('OS');
  });

  // Tab 7: Memories
  refreshMemoriesBtn.addEventListener('click', () => loadMemories());
  correctCancelBtn.addEventListener('click', () => closeCorrectModal());
  correctSubmitBtn.addEventListener('click', () => submitMemoryCorrection());

  // GDPR Sovereignty
  exportDataBtn.addEventListener('click', () => exportUserData());
  deleteAccountBtn.addEventListener('click', () => deleteUserAccount());
}

function switchTab(tabId) {
  tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === tabId));
  tabPanels.forEach((p) => p.classList.toggle('active', p.id === `tab-${tabId}`));

  if (tabId === 'tutor') loadTutorChatHistory();
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
    appendChatBubble('tutor', `⚠️ Error: ${err.message}`);
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
    fuBox.textContent = `💡 Socratic Question for you: ${followUp}`;
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
    startBatchQuizBtn.textContent = '🚀 Start 10-Question Quiz';
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
    fetchSingleQuestionBtn.textContent = '⚡ Single Question';
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
    titleEl.textContent = result.correct ? '✅ Correct! ' : '❌ Incorrect. ';
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
    summaryMemoryImpact.textContent = '🌟 Outstanding performance! Your demonstrated mastery has been stored as Strength memories in MongoDB Atlas.';
  } else if (pct >= 50) {
    summaryMemoryImpact.textContent = '👍 Solid attempt. Weaknesses on missed topics were diagnosed into MongoDB Agentic Memory to guide future learning.';
  } else {
    summaryMemoryImpact.textContent = '⚠️ Tricky concepts identified. Cognitive memory has recorded active weaknesses so the AI Tutor can teach you these topics!';
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
      chip.textContent = `🎯 ${rec.title}${statsSnippet}`;
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
    lessonStatAttempts.textContent = `📊 ${stats.totalAttempts} Attempted`;
    lessonStatPassed.textContent = `✅ ${stats.passedCount} Passed`;
    lessonStatFailed.textContent = `❌ ${stats.failedCount} Failed`;
    lessonStatRate.textContent = `🎯 ${stats.accuracyPercent}% Accuracy`;

    if (lesson.aiProvider === 'gemini') {
      lessonAiBadge.textContent = '🤖 Gemini 2.5 AI Engine (Live)';
      lessonAiBadge.style.backgroundColor = '#DCFCE7';
      lessonAiBadge.style.color = '#166534';
      lessonAiBadge.style.borderColor = '#86EFAC';
    } else {
      lessonAiBadge.textContent = '🤖 Gemini AI (Adaptive Cognitive Engine)';
      lessonAiBadge.style.backgroundColor = '#F3E8FF';
      lessonAiBadge.style.color = '#6B21A8';
      lessonAiBadge.style.borderColor = '#D8B4FE';
    }

    if (lesson.diagnosis || lesson.studentDiagnosis) {
      lessonDiagnosisBox.style.display = 'block';
      lessonDiagnosisBox.textContent = `🧠 ${lesson.diagnosis || lesson.studentDiagnosis}`;
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
    loadLessonBtn.textContent = '📖 Teach This Concept';
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

let allFlashcardsCache = [];
let currentFcSubject = 'ALL';
let areAllCardsFlipped = false;

async function loadFlashcards(subject = 'ALL') {
  try {
    currentFcSubject = subject;
    const data = await api.getFlashcards(subject === 'ALL' ? null : subject);
    allFlashcardsCache = data.flashcards || [];
    activeFlashcards = allFlashcardsCache;
    currentFlashcardIndex = 0;
    isFlashcardFlipped = false;
    renderFlashcardsGrid(activeFlashcards);
    renderCurrentFlashcard();
  } catch (err) {
    if (fcCardsGrid) fcCardsGrid.innerHTML = `<p style="color: var(--accent-red); padding: 1rem;">Error loading flashcards: ${err.message}</p>`;
    if (fcMainText) fcMainText.textContent = `Error loading flashcards: ${err.message}`;
  }
}

function filterFlashcardsBySubject(subj) {
  currentFcSubject = subj;
  [fcFilterAll, fcFilterDbms, fcFilterOs].forEach((b) => {
    if (b) {
      b.style.backgroundColor = 'var(--bg-card)';
      b.style.color = 'var(--primary-dark)';
    }
  });

  if (subj === 'ALL' && fcFilterAll) {
    fcFilterAll.style.backgroundColor = 'var(--primary-dark)';
    fcFilterAll.style.color = '#FFFFFF';
  } else if (subj === 'DBMS' && fcFilterDbms) {
    fcFilterDbms.style.backgroundColor = 'var(--primary-dark)';
    fcFilterDbms.style.color = '#FFFFFF';
  } else if (subj === 'OS' && fcFilterOs) {
    fcFilterOs.style.backgroundColor = 'var(--primary-dark)';
    fcFilterOs.style.color = '#FFFFFF';
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
      tipEl.textContent = `⚠️ Exam Trap: ${card.examTip}`;
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
      { id: 'again', label: '🔴 Again', tip: '<1m' },
      { id: 'hard', label: '🟠 Hard', tip: '1d' },
      { id: 'good', label: '🔵 Good', tip: '3d' },
      { id: 'easy', label: '🟢 Easy', tip: '7d' }
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
    flipBtn.textContent = areAllCardsFlipped ? '🔒 Hide Solution' : '🔄 Reveal Solution';

    flipBtn.addEventListener('click', () => {
      const isVisible = solContainer.style.display !== 'none';
      solContainer.style.display = isVisible ? 'none' : 'block';
      flipBtn.textContent = isVisible ? '🔄 Reveal Solution' : '🔒 Hide Solution';
    });

    const voiceBtn = document.createElement('button');
    voiceBtn.className = 'btn-speech';
    voiceBtn.style.fontSize = '0.75rem';
    voiceBtn.style.padding = '0.2rem 0.5rem';
    voiceBtn.textContent = '🔊 Listen';
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
    fcFlipAllBtn.textContent = areAllCardsFlipped ? '🔒 Hide All' : '👁️ Flip All';
  }
  renderFlashcardsGrid(activeFlashcards);
}

async function handleRateSingleCard(card, rating, btn) {
  try {
    btn.disabled = true;
    await api.rateFlashcard(card.id, rating, card.topic, card.subject);
    const orig = btn.textContent;
    btn.textContent = '✅ Saved';
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
    if (fcMainText) fcMainText.textContent = 'No flashcards available.';
    return;
  }

  const card = activeFlashcards[currentFlashcardIndex];
  if (flashcardCounterBadge) {
    flashcardCounterBadge.textContent = `Card ${currentFlashcardIndex + 1} of ${activeFlashcards.length}`;
  }
  if (fcTopicLabel) fcTopicLabel.textContent = `${card.subject} / ${card.topic}`;

  if (!isFlashcardFlipped) {
    if (fcSideLabel) fcSideLabel.textContent = 'FRONT (QUESTION)';
    if (fcMainText) fcMainText.textContent = card.front;
    if (fcExtraBox) fcExtraBox.style.display = 'none';
    if (fcRatingContainer) fcRatingContainer.style.display = 'none';
  } else {
    if (fcSideLabel) fcSideLabel.textContent = 'BACK (EXPLANATION & PROOF)';
    if (fcMainText) fcMainText.textContent = card.back;
    if (card.keyFormula && fcExtraBox && fcFormulaText) {
      fcExtraBox.style.display = 'block';
      fcFormulaText.textContent = card.keyFormula;
    } else if (fcExtraBox) {
      fcExtraBox.style.display = 'none';
    }
    if (fcRatingContainer) fcRatingContainer.style.display = 'flex';
  }

  if (fcPrevBtn) fcPrevBtn.disabled = currentFlashcardIndex === 0;
  if (fcNextBtn) fcNextBtn.disabled = currentFlashcardIndex === activeFlashcards.length - 1;
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
      alert(`🎉 Flashcard set completed! Your recall ratings updated MongoDB Cognitive Memory.`);
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
    startMockexamBtn.textContent = '🚀 Start 15-Minute Mock Exam';
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
      outcome.textContent = `${d.correct ? '✅ Correct' : '❌ Incorrect'} | Topic: ${d.topic}`;
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
      spCriticalContainer.innerHTML = '<p style="font-size: 0.82rem; color: #166534;">🎉 Zero critical weaknesses detected!</p>';
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
      box.textContent = `✅ ${m.label} (${m.accuracy}% Accuracy)`;
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
      correctBtn.textContent = '✏️ Correct';
      correctBtn.onclick = () => openCorrectModal(mem._id, mem.content);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-outline';
      deleteBtn.style.borderColor = 'var(--accent-red)';
      deleteBtn.style.color = 'var(--accent-red)';
      deleteBtn.textContent = '🗑️ Delete';
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
