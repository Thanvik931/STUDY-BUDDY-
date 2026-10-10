// public/app.js
// Client-side application controller for Study Buddy.
// WHY: Strictly uses textContent and safe DOM node creation (NEVER innerHTML with user input),
// preventing XSS. Implements Home Page landing with proper Sign In & Registration,
// 10-Question Adaptive Quiz runner, Concept Lessons with Gemini AI & live pass/fail memory,
// Cognitive Memory inspection/correction, and 4 multi-dimensional Chart.js analytics visualizations.

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
let activeQuizQuestions = [];
let currentQuizIndex = 0;
let quizScore = 0;
let selectedOptionIndex = null;
let memoryToCorrectId = null;

// Chart Instances
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
const lessonDiagnosisBox = document.getElementById('lesson-diagnosis-box');
const lessonTitle = document.getElementById('lesson-title');
const lessonSummary = document.getElementById('lesson-summary');
const lessonAnalogy = document.getElementById('lesson-analogy');
const lessonMechanics = document.getElementById('lesson-mechanics');
const lessonPitfalls = document.getElementById('lesson-pitfalls');
const lessonCode = document.getElementById('lesson-code');
const lessonTakeaways = document.getElementById('lesson-takeaways');
const quizFromLessonBtn = document.getElementById('quiz-from-lesson-btn');

// Tab 3: Memories Elements
const memoriesContainer = document.getElementById('memories-container');
const refreshMemoriesBtn = document.getElementById('refresh-memories-btn');
const correctModal = document.getElementById('correct-modal');
const correctContentInput = document.getElementById('correct-content');
const correctSubmitBtn = document.getElementById('correct-submit-btn');
const correctCancelBtn = document.getElementById('correct-cancel-btn');

// Tab 4: Progress Elements
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

// --- INITIALIZATION ---

async function init() {
  populateTopics(selectSubject.value, selectTopic);
  populateTopics(lessonSubject.value, lessonTopic);
  setupEventListeners();

  // Check if session cookie exists
  try {
    const authData = await api.getMe();
    if (authData?.user) {
      setUser(authData.user);
      return;
    }
  } catch (_) {
    // Not logged in -> Show Home Page landing view
  }

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

  // Auth Form Submits
  loginForm.addEventListener('submit', handleLoginFormSubmit);
  signupForm.addEventListener('submit', handleSignupFormSubmit);

  // Demo Login Buttons
  if (landingQuickDemoBtn) landingQuickDemoBtn.addEventListener('click', handleDemoLogin);
  if (quickDemoBtn) quickDemoBtn.addEventListener('click', handleDemoLogin);

  // Logout
  logoutBtn.addEventListener('click', handleLogout);

  // App Tabs Navigation
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Subject Dropdowns
  selectSubject.addEventListener('change', () => populateTopics(selectSubject.value, selectTopic));
  lessonSubject.addEventListener('change', () => populateTopics(lessonSubject.value, lessonTopic));

  // Quiz buttons
  startBatchQuizBtn.addEventListener('click', () => start10QuestionQuiz());
  fetchSingleQuestionBtn.addEventListener('click', () => startSingleQuestion());
  submitAnswerBtn.addEventListener('click', () => submitAnswer());
  nextQuestionBtn.addEventListener('click', () => nextQuestion());
  teachWeaknessBtn.addEventListener('click', () => teachWeakestTopic());
  restartQuizBtn.addEventListener('click', () => start10QuestionQuiz());

  // Lessons buttons
  loadLessonBtn.addEventListener('click', () => loadSelectedLesson());
  teachPriorityBtn.addEventListener('click', () => teachWeakestTopic());
  quizFromLessonBtn.addEventListener('click', () => quizTopicFromLesson());

  // Memories buttons
  refreshMemoriesBtn.addEventListener('click', () => loadMemories());
  correctCancelBtn.addEventListener('click', () => closeCorrectModal());
  correctSubmitBtn.addEventListener('click', () => submitMemoryCorrection());

  // GDPR Sovereignty buttons
  exportDataBtn.addEventListener('click', () => exportUserData());
  deleteAccountBtn.addEventListener('click', () => deleteUserAccount());
}

function switchTab(tabId) {
  tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === tabId));
  tabPanels.forEach((p) => p.classList.toggle('active', p.id === `tab-${tabId}`));

  if (tabId === 'memories') loadMemories();
  if (tabId === 'progress') loadProgress();
  if (tabId === 'lessons') loadRecommendedLessons();
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

  // Update progress indicators
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

  // Render options safely
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
      document.querySelectorAll('.option-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedOptionIndex = idx;
      submitAnswerBtn.disabled = false;
    });

    optionsContainer.appendChild(btn);
  });

  // Display Why This Question transparency
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

    // Lock option buttons and mark correct / incorrect
    const optButtons = optionsContainer.querySelectorAll('.option-btn');
    optButtons.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === result.correctIndex) {
        btn.classList.add('correct');
      } else if (idx === selectedOptionIndex && !result.correct) {
        btn.classList.add('incorrect');
      }
    });

    // Update feedback box
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

    // Check if there are more questions in set
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

    // Populate Live Memory Stats Banner
    const stats = lesson.studentStats || { totalAttempts: 0, passedCount: 0, failedCount: 0, accuracyPercent: 0 };
    lessonStatAttempts.textContent = `📊 ${stats.totalAttempts} Attempted`;
    lessonStatPassed.textContent = `✅ ${stats.passedCount} Passed`;
    lessonStatFailed.textContent = `❌ ${stats.failedCount} Failed`;
    lessonStatRate.textContent = `🎯 ${stats.accuracyPercent}% Accuracy`;

    // AI Provider Badge
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

    // Personal memory diagnosis
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

    // Configure the "Quiz This Topic" button
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

// --- COGNITIVE MEMORIES TAB ---

async function loadMemories() {
  memoriesContainer.innerHTML = '<p style="color: var(--text-muted);">Loading memories from MongoDB Atlas...</p>';

  try {
    const data = await api.getMemories();
    memoriesContainer.innerHTML = '';

    if (!data.memories || data.memories.length === 0) {
      memoriesContainer.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">No cognitive memories recorded yet. Take a quiz to let the AI learn your patterns!</p>';
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

  // 1. Chart: Topic Mastery Breakdown (Horizontal Bar)
  renderTopicMasteryChart(data.topicBreakdown || []);

  // 2. Chart: Subject Performance (Pass vs Fail Comparison)
  renderSubjectCompareChart(data.subjectBreakdown || []);

  // 3. Chart: Cognitive Memory State Breakdown (Doughnut)
  renderMemoryDistChart(data.memoryBreakdown || {});

  // 4. Chart: Learning Progression Curve (Line)
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
    if (val >= 70) return '#166534'; // Green
    if (val >= 40) return '#B45309'; // Amber
    return '#DC2626'; // Red
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
      plugins: {
        legend: { display: false }
      },
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

  // If no memories yet, show empty placeholder segment
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
        legend: {
          position: 'bottom'
        }
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
