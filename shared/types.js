/**
 * SMART WASH — Shared Types & Data Contracts
 * Owned by Jesty (Face ID + Backend)
 * 
 * Standard contract agreed by the team:
 * - Session document shape in Firestore
 * - Student record shape in Firestore
 * - Step result shape
 */

/**
 * @typedef {Object} HandwashStep
 * @property {number} stepNumber - Step index (1-6 for WHO handwashing technique)
 * @property {string} [stepName] - Descriptive name (e.g. "Palm to palm", "Back of hands")
 * @property {boolean} completed - Whether the step was successfully performed
 * @property {number} durationMs - Active duration in milliseconds
 * @property {number} avgConfidence - Model average confidence score (0.0 to 1.0)
 */

/**
 * @typedef {Object} Session
 * @property {string} [id] - Firestore document ID
 * @property {string} studentId - Unique identifier of the student
 * @property {string} studentName - Full name of the student
 * @property {any} timestamp - Firestore Timestamp or ISO string
 * @property {HandwashStep[]} steps - Array of 6 step execution records
 * @property {number} score - Overall quality score (0 to 100)
 * @property {string} [status] - Session status: 'in-progress' | 'completed' | 'abandoned'
 */

/**
 * @typedef {Object} Student
 * @property {string} studentId - Unique identifier (e.g. roll number or UUID)
 * @property {string} name - Student full name
 * @property {string} [classId] - Grade / section identifier
 * @property {number[]} [descriptor] - 128-float array face feature vector from face-api.js
 * @property {string} [photoUrl] - Storage URL or base64 preview of reference photo
 * @property {any} [createdAt] - Registration timestamp
 */

export const WHO_STEPS = [
  { stepNumber: 1, name: "Rub palms together" },
  { stepNumber: 2, name: "Rub back of each hand with palm" },
  { stepNumber: 3, name: "Palm to palm with fingers interlaced" },
  { stepNumber: 4, name: "Backs of fingers to opposing palms" },
  { stepNumber: 5, name: "Rotational rubbing of thumb" },
  { stepNumber: 6, name: "Rotational rubbing of fingertips in palm" }
];

/**
 * Creates a default initial session object
 * @param {string} studentId 
 * @param {string} studentName 
 * @returns {Session}
 */
export function createDefaultSession(studentId, studentName, identityMethod = 'face_recognition', classId = 'UNKNOWN') {
  return {
    sessionId: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    studentId,
    studentName,
    classId,
    timestamp: new Date().toISOString(),
    completedSteps: [],
    missedSteps: [],
    outOfOrderSteps: [],
    complianceScore: 0,
    identityMethod,
    sessionDurationSeconds: 0,
    status: 'in-progress'
  };
}

/**
 * Validates a session object against the contract
 * @param {any} session 
 * @returns {boolean}
 */
export function validateSessionContract(session) {
  if (!session || typeof session !== 'object') return false;
  if (typeof session.studentId !== 'string' || !session.studentId) return false;
  if (typeof session.studentName !== 'string') return false;
  if (!Array.isArray(session.steps)) return false;
  if (typeof session.score !== 'number') return false;
  return true;
}
