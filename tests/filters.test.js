// tests/filters.test.js
// Unit tests verifying that every database query filter strictly enforces ownerId.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOwnerFilter,
  buildActiveTopicMemoriesFilter,
  buildMemoryByIdFilter,
  buildTopicStatsFilter
} from '../src/logic/filters.js';

test('10. every filter built by src/logic/filters.js includes ownerId', () => {
  const ownerId = 'stu_12345';

  const baseFilter = buildOwnerFilter(ownerId, { customField: 'test' });
  assert.equal(baseFilter.ownerId, ownerId);
  assert.equal(baseFilter.customField, 'test');

  const topicFilter = buildActiveTopicMemoriesFilter(ownerId, 'DBMS', 'sql-joins');
  assert.equal(topicFilter.ownerId, ownerId);
  assert.equal(topicFilter.status, 'active');
  assert.equal(topicFilter.subject, 'DBMS');
  assert.equal(topicFilter.topic, 'sql-joins');

  const idFilter = buildMemoryByIdFilter(ownerId, 'mem_999');
  assert.equal(idFilter.ownerId, ownerId);
  assert.equal(idFilter._id, 'mem_999');

  const statsFilter = buildTopicStatsFilter(ownerId, 'OS', 'deadlocks');
  assert.equal(statsFilter.ownerId, ownerId);
  assert.equal(statsFilter.subject, 'OS');
  assert.equal(statsFilter.topic, 'deadlocks');

  // Must throw error if ownerId is missing or empty
  assert.throws(() => buildOwnerFilter(''), /Security Error/);
  assert.throws(() => buildOwnerFilter(null), /Security Error/);
  assert.throws(() => buildOwnerFilter(undefined), /Security Error/);
});
