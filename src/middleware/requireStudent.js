// src/middleware/requireStudent.js
// Verifies that incoming requests contain a valid student profile in the x-student-id header.
//
// ⚠️ HONEST ARCHITECTURAL NOTE:
// This is name-based profile separation for hackathon demonstration, NOT cryptographically
// secure authentication (like OAuth, JWT, or password hashing). In production, you would verify
// a signed session cookie or JWT token instead of a raw header.

import { getDB } from '../db.js';

export async function requireStudent(req, res, next) {
  const studentId = req.headers['x-student-id'];

  if (!studentId || typeof studentId !== 'string' || !studentId.trim()) {
    return res.status(401).json({
      error: {
        code: 'MISSING_STUDENT_HEADER',
        message: 'Request must include x-student-id header'
      }
    });
  }

  try {
    const db = getDB();
    const student = await db.collection('students').findOne({ _id: studentId.trim() });

    if (!student) {
      return res.status(404).json({
        error: {
          code: 'STUDENT_NOT_FOUND',
          message: `Student with id "${studentId}" was not found`
        }
      });
    }

    // Attach verified student profile and ownerId to the request object
    req.student = student;
    req.ownerId = student._id;

    next();
  } catch (err) {
    next(err);
  }
}
