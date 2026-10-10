// public/api.js
// Client-side API service.
// WHY: Centralizes all HTTP communication with the backend. Automatically attaches
// the active student ID in the x-student-id header and parses standardized error shapes.

const STORAGE_KEY = 'study_buddy_student_id';

export const api = {
  getStoredStudentId() {
    return localStorage.getItem(STORAGE_KEY) || '';
  },

  setStoredStudentId(id) {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  },

  async request(endpoint, options = {}) {
    const studentId = this.getStoredStudentId();
    const headers = {
      'Content-Type': 'application/json',
      ...(studentId ? { 'x-student-id': studentId } : {}),
      ...(options.headers || {})
    };

    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.error?.message || `Request failed with status ${response.status}`;
      const err = new Error(errorMessage);
      err.code = data.error?.code || 'API_ERROR';
      err.status = response.status;
      throw err;
    }

    return data;
  },

  // Students
  getStudents() {
    return this.request('/api/students');
  },

  createStudent(name) {
    return this.request('/api/students', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  },

  // Session
  startSession() {
    return this.request('/api/session/start', {
      method: 'POST'
    });
  },

  // Quiz
  getQuestion(subject, topic) {
    return this.request('/api/question', {
      method: 'POST',
      body: JSON.stringify({ subject, topic })
    });
  },

  submitAnswer(questionId, selectedOptionIndex) {
    return this.request('/api/answer', {
      method: 'POST',
      body: JSON.stringify({ questionId, selectedOptionIndex })
    });
  },

  // Memories
  getMemories(skip = 0, limit = 50) {
    return this.request(`/api/memories?skip=${skip}&limit=${limit}`);
  },

  correctMemory(id, content) {
    return this.request(`/api/memories/${id}/correct`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  },

  deleteMemory(id) {
    return this.request(`/api/memories/${id}`, {
      method: 'DELETE'
    });
  },

  // Progress (Chart.js)
  getProgress() {
    return this.request('/api/progress');
  }
};
