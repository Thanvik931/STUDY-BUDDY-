// public/api.js
// Client-side API service.
// WHY: Centralizes all HTTP communication with the backend.
// Passes CSRF headers ('X-Requested-With: study-buddy') and credentials for server-side cookies.

export const api = {
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'study-buddy',
      ...(options.headers || {})
    };

    const response = await fetch(endpoint, {
      credentials: 'same-origin',
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

  // Auth & Account
  async getMe() {
    return this.request('/api/auth/me');
  },

  async quickLogin() {
    return this.request('/api/auth/quick-login', {
      method: 'POST'
    });
  },

  async getFormToken() {
    return this.request('/api/auth/form-token');
  },

  async signup(username, displayName, password) {
    const { formToken } = await this.getFormToken();
    // Wait 3.1 seconds to satisfy the >= 3s anti-bot requirement
    await new Promise((resolve) => setTimeout(resolve, 3100));

    return this.request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        username,
        displayName,
        password,
        acceptTerms: true,
        formToken
      })
    });
  },

  async login(username, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  async logout() {
    return this.request('/api/auth/logout', {
      method: 'POST'
    });
  },

  async deleteAccount(password) {
    return this.request('/api/account', {
      method: 'DELETE',
      body: JSON.stringify({ password })
    });
  },

  // Session
  startSession() {
    return this.request('/api/session/start', {
      method: 'POST'
    });
  },

  // Adaptive Quiz
  getQuestion(subject, topic) {
    return this.request('/api/question', {
      method: 'POST',
      body: JSON.stringify({ subject, topic })
    });
  },

  generateQuizSet(subject, topic, count = 10) {
    return this.request('/api/quiz/generate-set', {
      method: 'POST',
      body: JSON.stringify({ subject, topic, count })
    });
  },

  submitAnswer(questionId, selectedOptionIndex) {
    return this.request('/api/answer', {
      method: 'POST',
      body: JSON.stringify({ questionId, selectedOptionIndex })
    });
  },

  // Concept Lessons
  getRecommendedLessons() {
    return this.request('/api/lessons/recommended');
  },

  teachLesson(subject, topic) {
    return this.request('/api/lessons/teach', {
      method: 'POST',
      body: JSON.stringify({ subject, topic })
    });
  },

  // Cognitive Memories
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
