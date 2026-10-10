// src/middleware/requireStudent.js
// Forwarding alias to requireUser for session-based authentication (Rule 13.1a).
// WHY: Rule 13.1a overrides the legacy header-based student picker.
// ownerId is ALWAYS derived from req.user._id from the server-side session cookie.

import { requireUser } from './auth.js';

export const requireStudent = requireUser;
export default requireUser;
