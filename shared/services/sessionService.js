/**
 * SMART WASH — Session Service
 * Owned by Jesty (Face ID + Backend)
 * 
 * Handles CRUD operations for Firestore 'sessions' collection.
 * Supports real Firestore + seamless local memory fallback for mock mode.
 */

import { db, isMockFirebase } from '../firebaseConfig.js';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { createDefaultSession, validateSessionContract } from '../types.js';

// Persistent local storage for mock environment / offline testing
const STORAGE_KEY = 'smartwash_mock_sessions';

const SEED_SESSIONS = [
  {
    id: 'mock_sess_101',
    sessionId: 'mock_sess_101',
    studentId: 'STU_101',
    studentName: 'Alex River',
    classId: 'Grade 5-A',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    completedSteps: [1, 2, 3, 4, 5, 6],
    missedSteps: [],
    complianceScore: 95,
    score: 95,
    identityMethod: 'face_recognition',
    status: 'completed',
    durationQuality: 92,
    aiConfidence: 94
  },
  {
    id: 'mock_sess_102',
    sessionId: 'mock_sess_102',
    studentId: 'STU_102',
    studentName: 'Jordan Taylor',
    classId: 'Grade 5-A',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    completedSteps: [1, 2, 3, 4, 5],
    missedSteps: [6],
    complianceScore: 82,
    score: 82,
    identityMethod: 'face_recognition',
    status: 'completed',
    durationQuality: 88,
    aiConfidence: 91
  },
  {
    id: 'mock_sess_103',
    sessionId: 'mock_sess_103',
    studentId: 'STU_103',
    studentName: 'Sam Chen',
    classId: 'Grade 5-B',
    timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
    completedSteps: [1, 2, 3, 4, 5, 6],
    missedSteps: [],
    complianceScore: 98,
    score: 98,
    identityMethod: 'face_recognition',
    status: 'completed',
    durationQuality: 96,
    aiConfidence: 95
  }
];

function loadMockSessions() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return new Map(parsed.map(s => [s.id || s.sessionId, s]));
      }
    }
  } catch (e) {
    console.warn('[sessionService] Could not load sessions from localStorage', e);
  }
  return new Map(SEED_SESSIONS.map(s => [s.id, s]));
}

const mockSessionsStore = loadMockSessions();

function saveMockSessions() {
  try {
    if (typeof localStorage !== 'undefined') {
      const arr = Array.from(mockSessionsStore.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    }
  } catch (e) {
    console.warn('[sessionService] Could not save sessions to localStorage', e);
  }
}

/**
 * Creates a new student handwashing session
 * @param {string} studentId 
 * @param {string} studentName 
 * @param {string} identityMethod
 * @returns {Promise<{ id: string, session: import('../types.js').Session }>}
 */
export async function createSession(studentId, studentName, identityMethod = 'face_recognition') {
  const initialSession = createDefaultSession(studentId, studentName, identityMethod);
  
  if (db && !isMockFirebase) {
    try {
      const docRef = await addDoc(collection(db, 'sessions'), {
        ...initialSession,
        timestamp: serverTimestamp()
      });
      return { id: docRef.id, session: { ...initialSession, id: docRef.id } };
    } catch (err) {
      console.warn('[sessionService] Firestore addDoc failed, using local store:', err.message);
    }
  }

  // Mock / Fallback Mode
  const mockId = `mock_session_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const createdSession = { ...initialSession, id: mockId, sessionId: mockId };
  mockSessionsStore.set(mockId, createdSession);
  saveMockSessions();
  return { id: mockId, session: createdSession };
}

/**
 * Updates an ongoing or finished session
 * @param {string} sessionId 
 * @param {Partial<import('../types.js').Session>} updateData 
 * @returns {Promise<boolean>}
 */
export async function updateSession(sessionId, updateData) {
  if (!sessionId) throw new Error('sessionId is required for updateSession');

  if (db && !isMockFirebase) {
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (err) {
      console.warn('[sessionService] Firestore updateDoc failed, falling back to mock:', err.message);
    }
  }

  // Mock / Fallback Mode
  const existing = mockSessionsStore.get(sessionId) || {};
  const updated = {
    ...existing,
    ...updateData,
    score: updateData.score !== undefined ? updateData.score : (updateData.complianceScore !== undefined ? updateData.complianceScore : existing.score),
    complianceScore: updateData.complianceScore !== undefined ? updateData.complianceScore : (updateData.score !== undefined ? updateData.score : existing.complianceScore),
    id: sessionId,
    updatedAt: new Date().toISOString()
  };
  mockSessionsStore.set(sessionId, updated);
  saveMockSessions();
  return true;
}

/**
 * Gets a session document by ID
 * @param {string} sessionId 
 * @returns {Promise<import('../types.js').Session | null>}
 */
export async function getSession(sessionId) {
  if (db && !isMockFirebase) {
    try {
      const docRef = doc(db, 'sessions', sessionId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
    } catch (err) {
      console.warn('[sessionService] Firestore getDoc failed:', err.message);
    }
  }

  const store = loadMockSessions();
  return store.get(sessionId) || mockSessionsStore.get(sessionId) || null;
}

/**
 * Retrieves all sessions for a given student
 * @param {string} studentId 
 * @returns {Promise<import('../types.js').Session[]>}
 */
export async function getStudentSessions(studentId) {
  if (db && !isMockFirebase) {
    try {
      const q = query(
        collection(db, 'sessions'), 
        where('studentId', '==', studentId),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('[sessionService] Firestore query failed:', err.message);
    }
  }

  // Mock fallback
  const store = loadMockSessions();
  return Array.from(store.values())
    .filter(s => s.studentId === studentId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Retrieves all sessions (for teacher dashboard)
 * @returns {Promise<import('../types.js').Session[]>}
 */
export async function getAllSessions() {
  if (db && !isMockFirebase) {
    try {
      const snapshot = await getDocs(collection(db, 'sessions'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('[sessionService] Firestore getAllSessions failed:', err.message);
    }
  }

  const store = loadMockSessions();
  return Array.from(store.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}
