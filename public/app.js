// public/app.js
// Client-side application controller.
// WHY: Strictly uses textContent and DOM node creation (NEVER innerHTML) for any stored
// or user-provided data, completely preventing Cross-Site Scripting (XSS) vulnerabilities.

import { api } from './api.js';

// Exact subjects and topics supported
const TOPICS = {
  DBMS: [
    { id: 'er-model-keys', label: 'ER Model & Keys (Primary, Foreign)' },
    { id: 'sql-joins', label: 'SQL Joins (INNER, LEFT, RIGHT, FULL)' },
    { id: 'normalization', label: 'Normalization (1NF, 2NF, 3NF, BCNF)' },
    { id: 'transactions-acid', label: 'Transactions & ACID Properties' },
    { id: 'indexing', label: 'Database Indexing (B-Trees)' }
  ],
  OS: [
    { id: 'process-scheduling', label: 'Process Scheduling (Round Robin, SJF)' },
    { id: 'deadlocks', label: 'Deadlocks & Banker\'s Algorithm' },
    { id: 'memory-paging', label: 'Memory Paging & Virtual Memory' },
    { id: 'synchronization', label: 'Process Synchronization & Semaphores' },
    { id: 'file-systems', label: 'File Systems & Inodes' }
  ]
};

// Application State
let currentStudent = null;
let currentQuestion = null;
let selectedOptionIndex = null;
let progressChartInstance = null;
let memoryToCorrectId = null;

// DOM Elements
const studentBadge = document.getElementById('current-student-badge');
const switchStudentBtn = document.getElementById('switch-student-btn');
const studentModal = document.getElementById('student-modal');
const existingStudentSelect = document.getElementById('existing-student-select');
const newStudentNameInput = document.getElementById('new-student-name');
const confirmStudentBtn = document.getElementById('confirm-student-btn');

const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

const openerBanner = document.getElementById('opener-banner');
const selectSubject = document.getElementById('select-subject');
const selectTopic = document.getElementById('select-topic');
const fetchQuestionBtn = document.getElementById('fetch-question-btn');

const questionCard = document.getElementById('question-card');
const questionText = document.getElementById('question-text');
const difficultyBadge = document.getElementById('question-difficulty-badge');
const degradedNotice = document.getElementById('degraded-notice');
const optionsContainer = document.getElementById('options-container');
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const feedbackBox = document.getElementById('feedback-box');
const whyBox = document.getElementById('why-box');
const whyText = document.getElementById('why-text');
const whyBreakdown = document.getElementById('why-breakdown');

const memoriesContainer = document.getElementById('memories-container');
const refreshMemoriesBtn = document.getElementById('refresh-memories-btn');

const correctModal = document.getElementById('correct-modal');
const correctContentInput = document.getElementById('correct-content-input');
const saveCorrectBtn = document.getElementById('save-correct-btn');
const cancelCorrectBtn = document.getElementById('cancel-correct-btn');

const statAccuracy = document.getElementById('stat-accuracy');
const statAttempts = document.getElementById('stat-attempts');
const statCorrect = document.getElementById('stat-correct');

// --- INITIALIZATION ---

async function init() {
  populateTopics('DBMS');
  setupEventListeners();

  const storedId = api.getStoredStudentId();
  if (storedId) {
    try {
      const data = await api.getStudents();
      const match = data.students.find((s) => s._id === storedId);
      if (match) {
        setStudent(match);
        return;
      }
    } catch (err) {
      console.warn('Failed to load stored student:', err.message);
    }
  }

  // Open modal if no student is selected
  openStudentModal();
}

function setupEventListeners() {
  // Tab switching
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Subject dropdown changes topic options
  selectSubject.addEventListener('change', (e) => {
    populateTopics(e.target.value);
  });

  // Student modal
  switchStudentBtn.addEventListener('click', openStudentModal);
  confirmStudentBtn.addEventListener('click', handleConfirmStudent);

  // Quiz
  fetchQuestionBtn.addEventListener('click', handleFetchQuestion);
  submitAnswerBtn.addEventListener('click', handleSubmitAnswer);

  // Memory tab
  refreshMemoriesBtn.addEventListener('click', loadMemories);

  // Correction modal
  cancelCorrectBtn.addEventListener('click', () => {
    correctModal.classList.remove('active');
  });
  saveCorrectBtn.addEventListener('click', handleSaveCorrection);
}

// --- STUDENT MANAGEMENT ---

function setStudent(student) {
  currentStudent = student;
  api.setStoredStudentId(student._id);
  studentBadge.textContent = student.name;
  studentModal.classList.remove('active');
  loadSessionOpener();
}

async function openStudentModal() {
  existingStudentSelect.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '-- Choose Existing Student --';
  existingStudentSelect.appendChild(defaultOption);

  try {
    const data = await api.getStudents();
    data.students.forEach((stu) => {
      const opt = document.createElement('option');
      opt.value = stu._id;
      opt.textContent = stu.name;
      existingStudentSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Error fetching students:', err);
  }

  newStudentNameInput.value = '';
  studentModal.classList.add('active');
}

async function handleConfirmStudent() {
  const chosenId = existingStudentSelect.value;
  const newName = newStudentNameInput.value.trim();

  if (newName) {
    try {
      const data = await api.createStudent(newName);
      setStudent(data.student);
    } catch (err) {
      alert('Error creating student: ' + err.message);
    }
  } else if (chosenId) {
    try {
      const data = await api.getStudents();
      const match = data.students.find((s) => s._id === chosenId);
      if (match) setStudent(match);
    } catch (err) {
      alert('Error selecting student: ' + err.message);
    }
  } else {
    alert('Please choose an existing student or type a new name.');
  }
}

// --- TABS & TOPICS ---

function switchTab(tabKey) {
  tabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabKey);
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tabKey}`);
  });

  if (tabKey === 'memories') {
    loadMemories();
  } else if (tabKey === 'progress') {
    loadProgress();
  }
}

function populateTopics(subject) {
  selectTopic.innerHTML = '';
  const topicList = TOPICS[subject] || [];
  topicList.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.label;
    selectTopic.appendChild(opt);
  });
}

// --- QUIZ & AGENTIC MEMORY WORKFLOW ---

async function loadSessionOpener() {
  if (!currentStudent) return;
  try {
    const data = await api.startSession();
    openerBanner.textContent = data.opener;
    // Auto-select primary weak topic if suggested by backend
    if (data.weakTopics && data.weakTopics.length > 0) {
      const weak = data.weakTopics[0];
      if (weak.subject === selectSubject.value) {
        selectTopic.value = weak.topic;
      }
    }
  } catch (err) {
    openerBanner.textContent = 'Ready to study! Pick a topic above to begin.';
  }
}

async function handleFetchQuestion() {
  if (!currentStudent) {
    openStudentModal();
    return;
  }

  fetchQuestionBtn.disabled = true;
  fetchQuestionBtn.textContent = 'Generating...';
  feedbackBox.style.display = 'none';
  whyBox.style.display = 'none';
  submitAnswerBtn.disabled = true;
  submitAnswerBtn.style.display = 'block';
  selectedOptionIndex = null;

  try {
    const subject = selectSubject.value;
    const topic = selectTopic.value;
    const data = await api.getQuestion(subject, topic);

    currentQuestion = data;
    renderQuestion(data);
  } catch (err) {
    alert('Failed to load question: ' + err.message);
  } finally {
    fetchQuestionBtn.disabled = false;
    fetchQuestionBtn.textContent = 'Get Question';
  }
}

function renderQuestion(q) {
  questionCard.style.display = 'block';
  questionText.textContent = q.question;

  // Difficulty badge
  difficultyBadge.textContent = q.difficulty.toUpperCase();
  difficultyBadge.className = 'badge ' + (
    q.difficulty === 'easy' ? 'badge-weakness' :
    q.difficulty === 'hard' ? 'badge-strength' : 'badge-preference'
  );

  // Degraded notice
  degradedNotice.style.display = q.degraded ? 'inline-block' : 'none';

  // Render options strictly with textContent
  optionsContainer.innerHTML = '';
  q.options.forEach((optText, index) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.type = 'button';

    const letter = document.createElement('strong');
    letter.textContent = String.fromCharCode(65 + index) + '.';
    const textNode = document.createElement('span');
    textNode.textContent = optText;

    btn.appendChild(letter);
    btn.appendChild(textNode);

    btn.addEventListener('click', () => {
      selectedOptionIndex = index;
      document.querySelectorAll('.option-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      submitAnswerBtn.disabled = false;
    });

    optionsContainer.appendChild(btn);
  });

  // Why this question
  if (q.whyThisQuestion) {
    whyBox.style.display = 'block';
    whyText.textContent = q.whyThisQuestion;

    whyBreakdown.innerHTML = '';
    if (q.memoriesUsed && q.memoriesUsed.length > 0) {
      q.memoriesUsed.forEach((mem) => {
        const item = document.createElement('div');
        const scoreStr = mem.scores
          ? `(relevance: ${mem.scores.relevance}, strength: ${mem.scores.strength}, recency: ${mem.scores.recency} -> final: ${mem.scores.final})`
          : '';
        item.textContent = `• [${mem.type.toUpperCase()}] ${mem.content} ${scoreStr}`;
        whyBreakdown.appendChild(item);
      });
    }
  }
}

async function handleSubmitAnswer() {
  if (selectedOptionIndex === null || !currentQuestion) return;

  submitAnswerBtn.disabled = true;
  submitAnswerBtn.textContent = 'Checking...';

  try {
    const result = await api.submitAnswer(currentQuestion.questionId, selectedOptionIndex);

    // Disable all option buttons and highlight correct/wrong
    const optionButtons = document.querySelectorAll('.option-btn');
    optionButtons.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === result.correctIndex) {
        btn.classList.add('correct');
      } else if (idx === selectedOptionIndex && !result.correct) {
        btn.classList.add('wrong');
      }
    });

    submitAnswerBtn.style.display = 'none';

    // Show feedback card
    feedbackBox.style.display = 'block';
    feedbackBox.className = 'feedback-box ' + (result.correct ? 'correct' : 'wrong');
    feedbackBox.innerHTML = '';

    const titleEl = document.createElement('div');
    titleEl.style.fontWeight = '700';
    titleEl.style.marginBottom = '0.35rem';
    titleEl.textContent = result.correct ? '✅ Correct Answer!' : '❌ Incorrect';

    const explanationEl = document.createElement('p');
    explanationEl.textContent = result.explanation;

    feedbackBox.appendChild(titleEl);
    feedbackBox.appendChild(explanationEl);

    // If memory rules triggered an action
    if (result.memoryActions && result.memoryActions.length > 0) {
      const actionNotice = document.createElement('div');
      actionNotice.style.marginTop = '0.6rem';
      actionNotice.style.fontSize = '0.8rem';
      actionNotice.style.fontStyle = 'italic';
      actionNotice.textContent = `⚡ Agentic Memory Action: ${result.memoryActions.join(', ')} in MongoDB Atlas!`;
      feedbackBox.appendChild(actionNotice);
    }
  } catch (err) {
    alert('Failed to submit answer: ' + err.message);
    submitAnswerBtn.disabled = false;
  } finally {
    submitAnswerBtn.textContent = 'Submit Answer';
  }
}

// --- COGNITIVE MEMORIES TAB ---

async function loadMemories() {
  if (!currentStudent) return;
  memoriesContainer.innerHTML = '';

  const loadingEl = document.createElement('div');
  loadingEl.textContent = 'Loading memories from MongoDB Atlas...';
  loadingEl.style.color = 'var(--text-muted)';
  memoriesContainer.appendChild(loadingEl);

  try {
    const data = await api.getMemories(0, 50);
    memoriesContainer.innerHTML = '';

    if (!data.memories || data.memories.length === 0) {
      const emptyEl = document.createElement('p');
      emptyEl.textContent = 'No cognitive memories recorded yet. Take quizzes and make mistakes to form memories!';
      emptyEl.style.color = 'var(--text-muted)';
      memoriesContainer.appendChild(emptyEl);
      return;
    }

    data.memories.forEach((mem) => {
      const card = createMemoryCard(mem);
      memoriesContainer.appendChild(card);
    });
  } catch (err) {
    memoriesContainer.innerHTML = '';
    const errorEl = document.createElement('p');
    errorEl.textContent = 'Error loading memories: ' + err.message;
    errorEl.style.color = 'var(--accent-red)';
    memoriesContainer.appendChild(errorEl);
  }
}

function createMemoryCard(mem) {
  const card = document.createElement('div');
  card.className = 'memory-card';

  // Header (Badge & Topic)
  const header = document.createElement('div');
  header.className = 'memory-header';

  const badge = document.createElement('span');
  badge.className = `badge badge-${mem.type}`;
  badge.textContent = mem.type;

  const topicTag = document.createElement('span');
  topicTag.style.fontSize = '0.75rem';
  topicTag.style.fontWeight = '600';
  topicTag.style.color = 'var(--text-muted)';
  topicTag.textContent = `${mem.subject}: ${mem.topic}`;

  header.appendChild(badge);
  header.appendChild(topicTag);

  // Content (Safe textContent)
  const content = document.createElement('p');
  content.className = 'memory-content';
  content.textContent = mem.content;

  // Metadata & Countdown to Expiry
  const meta = document.createElement('div');
  meta.className = 'memory-meta';

  const strengthLine = document.createElement('div');
  strengthLine.textContent = `Strength: ${(mem.strength * 100).toFixed(0)}% | Source: ${mem.source}`;

  const expiryLine = document.createElement('div');
  if (mem.expiresAt) {
    const msLeft = new Date(mem.expiresAt).getTime() - Date.now();
    if (msLeft > 0) {
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      expiryLine.textContent = `⏳ Expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''} (TTL index)`;
    } else {
      expiryLine.textContent = '⏳ Expired (pending TTL purge)';
    }
  } else {
    expiryLine.textContent = 'Permanent memory';
  }

  meta.appendChild(strengthLine);
  meta.appendChild(expiryLine);

  // Actions Toolbar
  const actions = document.createElement('div');
  actions.className = 'memory-actions';

  const correctBtn = document.createElement('button');
  correctBtn.className = 'btn-small';
  correctBtn.textContent = '✏️ Correct';
  correctBtn.addEventListener('click', () => openCorrectionModal(mem._id, mem.content));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-small danger';
  deleteBtn.textContent = '🗑️ Delete';
  deleteBtn.addEventListener('click', () => handleDeleteMemory(mem._id));

  actions.appendChild(correctBtn);
  actions.appendChild(deleteBtn);

  card.appendChild(header);
  card.appendChild(content);
  card.appendChild(meta);
  card.appendChild(actions);

  return card;
}

function openCorrectionModal(memoryId, currentText) {
  memoryToCorrectId = memoryId;
  correctContentInput.value = currentText || '';
  correctModal.classList.add('active');
}

async function handleSaveCorrection() {
  if (!memoryToCorrectId) return;
  const newContent = correctContentInput.value.trim();
  if (newContent.length < 5) {
    alert('Please provide at least 5 characters for the correction note.');
    return;
  }

  try {
    await api.correctMemory(memoryToCorrectId, newContent);
    correctModal.classList.remove('active');
    loadMemories();
    alert('Memory corrected and converted to strength in MongoDB Atlas!');
  } catch (err) {
    alert('Failed to correct memory: ' + err.message);
  }
}

async function handleDeleteMemory(memoryId) {
  if (!confirm('Are you sure you want to permanently delete this memory from MongoDB Atlas?')) {
    return;
  }

  try {
    await api.deleteMemory(memoryId);
    loadMemories();
  } catch (err) {
    alert('Failed to delete memory: ' + err.message);
  }
}

// --- PROGRESS TAB & CHART.JS ---

async function loadProgress() {
  if (!currentStudent) return;

  try {
    const data = await api.getProgress();

    statAccuracy.textContent = data.overallAccuracy + '%';
    statAttempts.textContent = data.totalAttempts;
    statCorrect.textContent = data.totalCorrect;

    renderProgressChart(data.timeline || []);
  } catch (err) {
    console.error('Failed to load progress data:', err);
  }
}

function renderProgressChart(timeline) {
  const ctx = document.getElementById('progress-chart').getContext('2d');

  if (progressChartInstance) {
    progressChartInstance.destroy();
  }

  const labels = timeline.map((p) => `${p.date} (${p.topic})`);
  const values = timeline.map((p) => p.accuracy);

  progressChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Topic Accuracy (%)',
        data: values,
        borderColor: '#0F4A1E',
        backgroundColor: 'rgba(15, 74, 30, 0.15)',
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#0F4A1E',
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            callback: (val) => val + '%'
          }
        }
      }
    }
  });
}

// Start app
window.addEventListener('DOMContentLoaded', init);
