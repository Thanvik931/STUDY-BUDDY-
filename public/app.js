// public/app.js
// Client-side application controller for Study Buddy.
// WHY: Strictly uses textContent and safe DOM node creation (NEVER innerHTML with user input),
// preventing XSS. Implements 10-Question Adaptive Quiz runner, Concept Lessons teaching hub,
// Cognitive Memory inspection/correction, and Chart.js learning analytics.

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
let progressChartInstance = null;
let memoryToCorrectId = null;

// DOM Elements
const studentBadge = document.getElementById('current-student-badge');
const switchStudentBtn = document.getElementById('switch-student-btn');
const exportDataBtn = document.getElementById('export-data-btn');
const deleteAccountBtn = document.getElementById('delete-account-btn');
const studentModal = document.getElementById('student-modal');
const authUsernameInput = document.getElementById('auth-username');
const authDisplayNameInput = document.getElementById('auth-display-name');
const authPasswordInput = document.getElementById('auth-password');
const authErrorMsg = document.getElementById('auth-error');
const modalLoginBtn = document.getElementById('modal-login-btn');
const modalSignupBtn = document.getElementById('modal-signup-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

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

// Lessons Tab Elements
const recommendedChips = document.getElementById('recommended-chips');
const lessonSubject = document.getElementById('lesson-subject');
const lessonTopic = document.getElementById('lesson-topic');
const loadLessonBtn = document.getElementById('load-lesson-btn');
const teachPriorityBtn = document.getElementById('teach-priority-btn');
const lessonCardView = document.getElementById('lesson-card-view');
const lessonDiagnosisBox = document.getElementById('lesson-diagnosis-box');
const lessonTitle = document.getElementById('lesson-title');
const lessonSummary = document.getElementById('lesson-summary');
const lessonAnalogy = document.getElementById('lesson-analogy');
const lessonMechanics = document.getElementById('lesson-mechanics');
const lessonPitfalls = document.getElementById('lesson-pitfalls');
const lessonCode = document.getElementById('lesson-code');
const lessonTakeaways = document.getElementById('lesson-takeaways');
const quizFromLessonBtn = document.getElementById('quiz-from-lesson-btn');

// Memories Tab Elements
const memoriesContainer = document.getElementById('memories-container');
const refreshMemoriesBtn = document.getElementById('refresh-memories-btn');
const correctModal = document.getElementById('correct-modal');
const correctContentInput = document.getElementById('correct-content');
const correctSubmitBtn = document.getElementById('correct-submit-btn');
const correctCancelBtn = document.getElementById('correct-cancel-btn');

// Progress Tab Elements
const statAccuracy = document.getElementById('stat-accuracy');
const statAttempts = document.getElementById('stat-attempts');
const statCorrect = document.getElementById('stat-correct');

// --- INITIALIZATION ---

async function init() {
  populateTopics(selectSubject.value, selectTopic);
  populateTopics(lessonSubject.value, lessonTopic);
  setupEventListeners();

  // Check if authenticated
  try {
    const authData = await api.getMe();
    if (authData?.user) {
      setUser(authData.user);
      return;
    }
  } catch (_) {
    // Attempt automatic default login or open modal
    await autoLoginOrPrompt();
  }
}

async function autoLoginOrPrompt() {
  try {
    const quickData = await api.quickLogin();
    if (quickData?.user) {
      setUser(quickData.user);
      return;
    }
  } catch (_) {
    openAuthModal();
  }
}

function setUser(user) {
  currentUser = user;
  studentBadge.textContent = user.displayName || user.username;
  closeAuthModal();
  loadSessionOpener();
  loadRecommendedLessons();
  loadMemories();
  loadProgress();
}

function populateTopics(subject, targetSelect) {
  targetSelect.innerHTML = '';

  // Add "All Topics" option for comprehensive quiz
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
  // Tab Navigation
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Subject Dropdowns change topics
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

  // Auth buttons
  switchStudentBtn.addEventListener('click', () => openAuthModal());
  modalCancelBtn.addEventListener('click', () => closeAuthModal());
  modalLoginBtn.addEventListener('click', () => handleLogin());
  modalSignupBtn.addEventListener('click', () => handleSignup());

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
  if (!currentUser) return openAuthModal();

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
  if (!currentUser) return openAuthModal();

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
      // Quiz complete!
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
      chip.textContent = `🎯 ${rec.title}`;
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

  // Fallback
  await teachConcept(lessonSubject.value, lessonTopic.value);
}

async function teachConcept(subject, topic) {
  loadLessonBtn.disabled = true;
  loadLessonBtn.textContent = 'Loading Lesson...';

  try {
    const data = await api.teachLesson(subject, topic);
    const lesson = data.lesson;

    lessonCardView.style.display = 'block';
    lessonCardView.scrollIntoView({ behavior: 'smooth' });

    // Personal memory diagnosis
    if (lesson.studentDiagnosis) {
      lessonDiagnosisBox.style.display = 'block';
      lessonDiagnosisBox.textContent = `🧠 ${lesson.studentDiagnosis}`;
    } else {
      lessonDiagnosisBox.style.display = 'none';
    }

    lessonTitle.textContent = lesson.title;
    lessonSummary.textContent = lesson.summary;
    lessonAnalogy.textContent = lesson.analogy;
    lessonMechanics.textContent = lesson.coreMechanics;
    lessonPitfalls.textContent = lesson.commonPitfalls;
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
      meta.textContent = `Strength: ${Math.round((mem.strength || 0) * 100)}% | Source: ${mem.source || 'quiz'}`;

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

// --- PROGRESS TAB & CHART.JS ---

async function loadProgress() {
  try {
    const data = await api.getProgress();

    statAccuracy.textContent = `${data.overallAccuracy || 0}%`;
    statAttempts.textContent = data.totalAttempts || 0;
    statCorrect.textContent = data.totalCorrect || 0;

    renderProgressChart(data.timeline || []);
  } catch (err) {
    console.warn('Failed to load progress analytics:', err);
  }
}

function renderProgressChart(timeline) {
  const canvas = document.getElementById('progress-chart');
  if (!canvas || !window.Chart) return;

  const labels = timeline.map((t) => `${t.date} (${t.topic})`);
  const accuracyData = timeline.map((t) => t.accuracy);

  if (progressChartInstance) {
    progressChartInstance.destroy();
  }

  progressChartInstance = new window.Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Topic Accuracy (%)',
          data: accuracyData,
          borderColor: '#0F4A1E',
          backgroundColor: 'rgba(15, 74, 30, 0.1)',
          fill: true,
          tension: 0.3,
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

// --- AUTHENTICATION & ACCOUNT SOVEREIGNTY ---

function openAuthModal() {
  studentModal.classList.add('active');
  authErrorMsg.style.display = 'none';
}

function closeAuthModal() {
  studentModal.classList.remove('active');
}

async function handleLogin() {
  const username = authUsernameInput.value.trim();
  const password = authPasswordInput.value;

  if (!username || !password) {
    showAuthError('Username and password are required');
    return;
  }

  modalLoginBtn.disabled = true;
  try {
    const res = await api.login(username, password);
    setUser(res.user);
  } catch (err) {
    showAuthError(err.message);
  } finally {
    modalLoginBtn.disabled = false;
  }
}

async function handleSignup() {
  const username = authUsernameInput.value.trim();
  const displayName = authDisplayNameInput.value.trim();
  const password = authPasswordInput.value;

  if (!username || !displayName || !password) {
    showAuthError('Username, display name, and password are required');
    return;
  }

  modalSignupBtn.disabled = true;
  modalSignupBtn.textContent = 'Creating...';
  try {
    const res = await api.signup(username, displayName, password);
    setUser(res.user);
  } catch (err) {
    showAuthError(err.message);
  } finally {
    modalSignupBtn.disabled = false;
    modalSignupBtn.textContent = 'Create Account';
  }
}

function showAuthError(msg) {
  authErrorMsg.textContent = msg;
  authErrorMsg.style.display = 'block';
}

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
