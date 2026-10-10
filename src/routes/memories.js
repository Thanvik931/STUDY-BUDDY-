// src/routes/memories.js
// Provides CRUD operations for student cognitive memories.
// WHY: Hackathon requirement. The student has sovereignty to inspect what the AI remembers,
// manually correct mistaken diagnoses, and delete memories (GDPR Right to be Forgotten).

import express from 'express';
import { requireUser } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { memoryCorrectionSchema, validateInput } from '../logic/validators.js';
import { getMemoriesList, correctMemory, deleteMemory } from '../services/memoryService.js';

const router = express.Router();

// GET /api/memories - List memories for the authenticated student (paginated, max 50)
router.get('/memories', requireUser, async (req, res, next) => {
  try {
    const skip = parseInt(req.query.skip, 10) || 0;
    const limit = parseInt(req.query.limit, 10) || 20;

    const result = await getMemoriesList({
      ownerId: req.ownerId,
      skip,
      limit
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/memories/:id/correct - Manually correct a memory diagnosis
router.post('/memories/:id/correct', requireUser, csrfProtection, async (req, res, next) => {
  const validation = validateInput(memoryCorrectionSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: validation.error.issues[0].message
      }
    });
  }

  try {
    const memoryId = req.params.id;
    const { content } = validation.data;

    const result = await correctMemory({
      ownerId: req.ownerId,
      memoryId,
      studentCorrectionText: content
    });

    if (!result) {
      return res.status(404).json({
        error: {
          code: 'MEMORY_NOT_FOUND',
          message: 'Active memory not found to correct'
        }
      });
    }

    res.status(200).json({
      message: 'Memory corrected successfully',
      result
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/memories/:id - Hard delete a memory document
router.delete('/memories/:id', requireUser, csrfProtection, async (req, res, next) => {
  try {
    const memoryId = req.params.id;

    const success = await deleteMemory({
      ownerId: req.ownerId,
      memoryId
    });

    if (!success) {
      return res.status(404).json({
        error: {
          code: 'MEMORY_NOT_FOUND',
          message: 'Memory not found or already deleted'
        }
      });
    }

    res.status(200).json({
      message: 'Memory deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

export default router;
