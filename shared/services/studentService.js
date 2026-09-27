/**
 * SMART WASH — Student & Face Descriptor Service
 * Owned by Jesty (Face ID + Backend)
 * 
 * Handles enrollment of students, storage of 128-d face descriptors,
 * and high-performance Euclidean distance vector matching.
 */

import { db, storage, isMockFirebase } from '../firebaseConfig.js';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

// Sample seed students with synthetic 128-d descriptors for testing/demonstration
const SEED_STUDENTS = [
  {
    studentId: 'STU_101',
    name: 'Alex River',
    classId: 'Grade 5-A',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    // Normalized synthetic 128-d face vector pattern A
    descriptor: Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.1) * 0.5 + 0.5)
  },
  {
    studentId: 'STU_102',
    name: 'Jordan Taylor',
    classId: 'Grade 5-A',
    photoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
    // Normalized synthetic 128-d face vector pattern B
    descriptor: Array.from({ length: 128 }, (_, i) => Math.cos(i * 0.15) * 0.5 + 0.5)
  },
  {
    studentId: 'STU_103',
    name: 'Sam Chen',
    classId: 'Grade 5-B',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    // Normalized synthetic 128-d face vector pattern C
    descriptor: Array.from({ length: 128 }, (_, i) => ((i * 37) % 100) / 100)
  }
];

// In-memory store initialized with seed students and synced to localStorage
const loadMockStudents = () => {
  try {
    const stored = localStorage.getItem('smartwash_mock_students');
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Map(parsed);
    }
  } catch (e) {
    console.warn('Could not load mock students from localStorage', e);
  }
  return new Map(SEED_STUDENTS.map(s => [s.studentId, s]));
};

const mockStudentsStore = loadMockStudents();

const saveMockStudents = () => {
  try {
    localStorage.setItem('smartwash_mock_students', JSON.stringify(Array.from(mockStudentsStore.entries())));
  } catch (e) {
    console.warn('Could not save mock students to localStorage', e);
  }
};

/**
 * Calculates Euclidean distance between two 128-dimensional face feature vectors
 * @param {number[]} desc1 
 * @param {number[]} desc2 
 * @returns {number} distance (0.0 = identical, >0.6 usually distinct)
 */
export function calculateEuclideanDistance(desc1, desc2) {
  if (!desc1 || !desc2 || desc1.length !== desc2.length) {
    return Infinity;
  }
  let sumSquare = 0;
  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i];
    sumSquare += diff * diff;
  }
  return Math.sqrt(sumSquare);
}

/**
 * Matches an input face descriptor against enrolled students
 * @param {number[]} inputDescriptor - 128-float array
 * @param {import('../types.js').Student[]} enrolledStudents 
 * @param {number} threshold - Maximum Euclidean distance threshold (default: 0.6)
 * @returns {{ matchedStudent: import('../types.js').Student | null, distance: number, confidence: number }}
 */
export function matchFaceDescriptor(inputDescriptor, enrolledStudents = [], threshold = 0.6) {
  if (!inputDescriptor || inputDescriptor.length === 0 || enrolledStudents.length === 0) {
    return { matchedStudent: null, distance: Infinity, confidence: 0 };
  }

  let bestMatch = null;
  let minDistance = Infinity;

  for (const student of enrolledStudents) {
    if (!student.descriptor || !Array.isArray(student.descriptor)) continue;
    const distance = calculateEuclideanDistance(inputDescriptor, student.descriptor);
    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = student;
    }
  }

  if (minDistance <= threshold && bestMatch) {
    // Confidence formula: 100% at distance 0, dropping linearly to 0% at distance threshold
    const confidence = Math.max(0, Math.min(100, Math.round((1 - minDistance / threshold) * 100)));
    return { matchedStudent: bestMatch, distance: minDistance, confidence };
  }

  return { matchedStudent: null, distance: minDistance, confidence: 0 };
}

/**
 * Enrolls a new student in Firestore and optionally uploads a photo to Firebase Storage
 * @param {Object} studentData 
 * @param {string} [studentData.studentId]
 * @param {string} [studentData.name]
 * @param {string} [studentData.className]
 * @param {string} [studentData.section]
 * @param {string} [studentData.rollNumber]
 * @param {number[]} [studentData.descriptor]
 * @param {string} [studentData.photoBase64] - Data URL of the captured photo
 * @returns {Promise<boolean>}
 */
export async function enrollStudent(studentData) {
  if (!studentData.studentId || !studentData.name) {
    throw new Error('studentId and name are required for enrollment');
  }

  let photoUrl = studentData.photoUrl || '';

  if (db && !isMockFirebase) {
    try {
      // 1. Upload photo if provided
      if (studentData.photoBase64 && storage) {
        const photoRef = ref(storage, `students/${studentData.studentId}/profile.jpg`);
        await uploadString(photoRef, studentData.photoBase64, 'data_url');
        photoUrl = await getDownloadURL(photoRef);
      }

      const record = {
        studentId: studentData.studentId,
        name: studentData.name,
        className: studentData.className || '',
        section: studentData.section || '',
        rollNumber: studentData.rollNumber || '',
        descriptor: studentData.descriptor || [],
        photoUrl: photoUrl,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const studentRef = doc(db, 'students', studentData.studentId);
      await setDoc(studentRef, record);
      return true;
    } catch (err) {
      console.warn('[studentService] Firestore/Storage setDoc failed:', err.message);
    }
  }

  // Mock Mode
  const record = {
    ...studentData,
    photoUrl: studentData.photoBase64 || photoUrl, // Use base64 locally if mock
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  mockStudentsStore.set(studentData.studentId, record);
  saveMockStudents();
  return true;
}

/**
 * Updates an existing student's record (e.g. for re-enrollment)
 * @param {string} studentId 
 * @param {Object} updateData 
 */
export async function updateStudent(studentId, updateData) {
  if (!studentId) throw new Error('studentId is required for update');

  let photoUrl = updateData.photoUrl || '';

  if (db && !isMockFirebase) {
    try {
      if (updateData.photoBase64 && storage) {
        const photoRef = ref(storage, `students/${studentId}/profile.jpg`);
        await uploadString(photoRef, updateData.photoBase64, 'data_url');
        photoUrl = await getDownloadURL(photoRef);
      }

      const dataToUpdate = {
        ...updateData,
        updatedAt: serverTimestamp()
      };
      
      if (photoUrl) {
        dataToUpdate.photoUrl = photoUrl;
      }
      
      delete dataToUpdate.photoBase64; // Don't save base64 string to Firestore

      const studentRef = doc(db, 'students', studentId);
      await updateDoc(studentRef, dataToUpdate);
      return true;
    } catch (err) {
      console.warn('[studentService] Firestore updateDoc failed:', err.message);
    }
  }

  // Mock mode
  const existing = mockStudentsStore.get(studentId) || {};
  const updated = {
    ...existing,
    ...updateData,
    photoUrl: updateData.photoBase64 || photoUrl || existing.photoUrl,
    updatedAt: new Date().toISOString()
  };
  delete updated.photoBase64;
  mockStudentsStore.set(studentId, updated);
  saveMockStudents();
  return true;
}

/**
 * Gets all enrolled students
 * @returns {Promise<import('../types.js').Student[]>}
 */
export async function getAllStudents() {
  if (db && !isMockFirebase) {
    try {
      const snapshot = await getDocs(collection(db, 'students'));
      if (!snapshot.empty) {
        return snapshot.docs.map(doc => ({ studentId: doc.id, ...doc.data() }));
      }
    } catch (err) {
      console.warn('[studentService] Firestore getDocs failed:', err.message);
    }
  }

  return Array.from(mockStudentsStore.values());
}

/**
 * Gets a student by ID
 * @param {string} studentId 
 * @returns {Promise<import('../types.js').Student | null>}
 */
export async function getStudentById(studentId) {
  if (db && !isMockFirebase) {
    try {
      const docRef = doc(db, 'students', studentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { studentId: docSnap.id, ...docSnap.data() };
      }
    } catch (err) {
      console.warn('[studentService] Firestore getStudentById failed:', err.message);
    }
  }

  return mockStudentsStore.get(studentId) || null;
}
