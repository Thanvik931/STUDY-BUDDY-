// src/routes/students.js
// Deprecated endpoint: Replaced by server-side session authentication (Rule 13.1a).
// WHY: In Rule 13.1a, the student picker and x-student-id header are replaced by real session auth.
// This route returns the authenticated user profile for compatibility.

import express from 'express';
import { requireUser } from '../middleware/auth.js';

const router = express.Router();

router.get('/students', async (req, res, next) => {
  if (req.headers['cookie']) {
    return requireUser(req, res, () => {
      res.status(200).json({
        students: [
          {
            _id: req.user._id.toString(),
            name: req.user.displayName,
            username: req.user.username
          }
        ]
      });
    });
  }
  res.status(200).json({ students: [] });
});

export default router;
