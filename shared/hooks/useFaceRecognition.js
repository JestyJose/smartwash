/**
 * SMART WASH — Face Recognition React Hook
 * Owned by Jesty (Face ID + Backend)
 * 
 * Provides live video-stream face detection, descriptor calculation,
 * vector matching against enrolled students, and student enrollment helpers.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { getAllStudents, matchFaceDescriptor, enrollStudent } from '../services/studentService.js';

export function useFaceRecognition({
  videoRef,
  enabled = true,
  distanceThreshold = 0.6,
  scanIntervalMs = 1000
} = {}) {
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [matchedStudent, setMatchedStudent] = useState(null);
  const [distance, setDistance] = useState(Infinity);
  const [confidence, setConfidence] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [detectedDescriptor, setDetectedDescriptor] = useState(null);
  const [error, setError] = useState(null);
  const [multipleFacesDetected, setMultipleFacesDetected] = useState(false);
  const [unknownFaceDetected, setUnknownFaceDetected] = useState(false);

  const scanTimerRef = useRef(null);
  const consecutiveMatchesRef = useRef([]);

  // Load enrolled students from Firestore / store
  const refreshStudents = useCallback(async () => {
    try {
      const students = await getAllStudents();
      setEnrolledStudents(students);
      return students;
    } catch (err) {
      console.error('[useFaceRecognition] Failed to fetch enrolled students:', err);
      setError(err.message);
      return [];
    }
  }, []);

  useEffect(() => {
    refreshStudents();
  }, [refreshStudents]);

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setIsModelLoaded(true);
        console.log('[useFaceRecognition] Models loaded successfully');
      } catch (err) {
        console.error('[useFaceRecognition] Error loading models:', err);
        setError('Failed to load face recognition models.');
      }
    };
    loadModels();
  }, []);

  // Main facial scan loop
  const performScan = useCallback(async () => {
    if (!enabled || !videoRef?.current || !isModelLoaded) return;

    setIsDetecting(true);
    try {
      const video = videoRef.current;
      if (video.paused || video.ended || video.readyState < 2) {
        setIsDetecting(false);
        return;
      }

      // Perform face-api detection if models are loaded
      if (faceapi.nets.ssdMobilenetv1.isLoaded) {
        const detections = await faceapi
          .detectAllFaces(video)
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (detections && detections.length > 0) {
          // Sort by face bounding box area (largest face = student closest in front of camera)
          const sorted = [...detections].sort((a, b) => {
            const areaA = (a.detection?.box?.width || 0) * (a.detection?.box?.height || 0);
            const areaB = (b.detection?.box?.width || 0) * (b.detection?.box?.height || 0);
            return areaB - areaA;
          });

          const primaryFace = sorted[0];
          const primaryArea = (primaryFace.detection?.box?.width || 0) * (primaryFace.detection?.box?.height || 0);

          // Only flag MULTIPLE_FACES if two students are crowding side-by-side right in front of the sink
          // (i.e. second face is nearly as large as the primary face, > 75% of primary area and large in absolute terms)
          const secondFace = sorted[1];
          const secondArea = secondFace ? (secondFace.detection?.box?.width || 0) * (secondFace.detection?.box?.height || 0) : 0;
          const isCrowdedInFront = sorted.length > 1 && secondArea > 15000 && secondArea >= primaryArea * 0.75;

          if (isCrowdedInFront) {
            setMultipleFacesDetected(true);
            setUnknownFaceDetected(false);
            setDetectedDescriptor(null);
            setMatchedStudent(null);
            setDistance(Infinity);
            setConfidence(0);
            consecutiveMatchesRef.current = [];
          } else {
            // Focus on the primary person in front
            setMultipleFacesDetected(false);
            const descriptor = Array.from(primaryFace.descriptor);
            setDetectedDescriptor(descriptor);
            
            const match = matchFaceDescriptor(descriptor, enrolledStudents, distanceThreshold);
            
            if (match.matchedStudent) {
              setUnknownFaceDetected(false);
              // Add to consecutive matches
              consecutiveMatchesRef.current.push(match.matchedStudent.studentId);
              if (consecutiveMatchesRef.current.length > 2) {
                consecutiveMatchesRef.current.shift();
              }
              
              // Only confirm identity if we have 2 consecutive identical matches
              const allMatch = consecutiveMatchesRef.current.length === 2 && 
                               consecutiveMatchesRef.current.every(id => id === match.matchedStudent.studentId);
              
              if (allMatch) {
                setMatchedStudent(match.matchedStudent);
                setDistance(match.distance);
                setConfidence(match.confidence);
              }
            } else {
              setUnknownFaceDetected(true);
              setMatchedStudent(null);
              setDistance(Infinity);
              setConfidence(0);
              consecutiveMatchesRef.current = [];
            }
          }
        } else {
          setMultipleFacesDetected(false);
          setUnknownFaceDetected(false);
          setDetectedDescriptor(null);
          setMatchedStudent(null);
          setDistance(Infinity);
          setConfidence(0);
          consecutiveMatchesRef.current = [];
        }
      }
    } catch (err) {
      console.warn('[useFaceRecognition] Scan warning:', err.message);
    } finally {
      setIsDetecting(false);
    }
  }, [enabled, videoRef, enrolledStudents, distanceThreshold, isModelLoaded]);

  // Interval loop
  useEffect(() => {
    if (enabled && videoRef?.current && isModelLoaded) {
      scanTimerRef.current = setInterval(performScan, scanIntervalMs);
    } else {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    }
    return () => {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    };
  }, [enabled, videoRef, scanIntervalMs, performScan, isModelLoaded]);

  // Helper for quick simulation/testing in dev environments
  const simulateDetection = useCallback((studentId) => {
    const student = enrolledStudents.find(s => s.studentId === studentId);
    if (student) {
      setMatchedStudent(student);
      setDistance(0.15);
      setConfidence(92);
      setDetectedDescriptor(student.descriptor);
      console.log(`[useFaceRecognition] Simulated recognition for ${student.name}`);
    } else {
      setMatchedStudent(null);
      setDistance(Infinity);
      setConfidence(0);
      setDetectedDescriptor(null);
    }
  }, [enrolledStudents]);

  // Helper to enroll current video frame's face
  const enrollCurrentFace = useCallback(async ({ studentId, name, classId }) => {
    let descriptor = detectedDescriptor;

    // Perform an immediate live scan from the video element to get the freshest descriptor
    if (videoRef?.current && isModelLoaded && faceapi.nets.ssdMobilenetv1.isLoaded) {
      try {
        const video = videoRef.current;
        if (!video.paused && !video.ended && video.readyState >= 2) {
          const detection = await faceapi
            .detectSingleFace(video)
            .withFaceLandmarks()
            .withFaceDescriptor();
          if (detection) {
            descriptor = Array.from(detection.descriptor);
            setDetectedDescriptor(descriptor);
          }
        }
      } catch (err) {
        console.warn('[useFaceRecognition] Live scan during enrollment error:', err);
      }
    }

    if (!descriptor) {
      // Fallback synthetic vector if face wasn't in frame
      descriptor = Array.from({ length: 128 }, () => Math.random());
    }

    const success = await enrollStudent({
      studentId,
      name,
      classId,
      descriptor,
      photoUrl: ''
    });

    if (success) {
      await refreshStudents();
    }
    return success;
  }, [detectedDescriptor, videoRef, isModelLoaded, refreshStudents]);

  return {
    enrolledStudents,
    matchedStudent,
    distance,
    confidence,
    isDetecting,
    isModelLoaded,
    detectedDescriptor,
    multipleFacesDetected,
    unknownFaceDetected,
    error,
    refreshStudents,
    simulateDetection,
    enrollCurrentFace
  };
}
