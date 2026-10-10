// src/logic/filters.js
// Pure helper functions to build MongoDB query filters.
// WHY: Security constraint. Every database query, update, and delete in our system MUST include
// ownerId so that students can never access, modify, or delete another student's data.

/**
 * Creates an owner-scoped query filter.
 * @param {string} ownerId - Student ID from requireStudent middleware
 * @param {object} [extraCriteria={}] - Additional query fields (e.g. status, subject)
 * @returns {object} Filter guaranteed to contain ownerId
 */
export function buildOwnerFilter(ownerId, extraCriteria = {}) {
  if (!ownerId || typeof ownerId !== 'string') {
    throw new Error('Security Error: ownerId is required for all database filters.');
  }
  return {
    ownerId,
    ...extraCriteria
  };
}

/**
 * Builds filter for active memories by subject and topic.
 */
export function buildActiveTopicMemoriesFilter(ownerId, subject, topic) {
  return buildOwnerFilter(ownerId, {
    status: 'active',
    subject,
    topic
  });
}

/**
 * Builds filter for a single memory by ID, strictly scoped to owner.
 */
export function buildMemoryByIdFilter(ownerId, memoryId) {
  return buildOwnerFilter(ownerId, {
    _id: memoryId
  });
}

/**
 * Builds filter for student topic stats.
 */
export function buildTopicStatsFilter(ownerId, subject, topic) {
  return buildOwnerFilter(ownerId, {
    subject,
    topic
  });
}
