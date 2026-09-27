import React, { useReducer, useRef, useCallback } from 'react';
import { kioskReducer, INITIAL_KIOSK_STATE, KIOSK_STATES } from './studentStateMachine.js';
import { KioskCamera } from './components/StudentCamera.jsx';
import { WashingView } from './components/WashingView.jsx';
import { FeedbackView } from './components/FeedbackView.jsx';

import { useFaceRecognition } from '../../../shared/hooks/useFaceRecognition.js';
import { useStepRecognition } from '../../../shared/hooks/useStepRecognition.js';
import { createSession, updateSession } from '../../../shared/services/sessionService.js';
import { calculateHandwashScore } from '../../../shared/services/scoringService.js';
import { isMockFirebase } from '../../../shared/firebaseConfig.js';

export function StudentKioskApp({ useMock = true }) {
  const [state, dispatch] = useReducer(kioskReducer, INITIAL_KIOSK_STATE);
  const videoRef = useRef(null);

  // 1. Jesty's Face ID Hook
  const { matchedStudent, confidence: faceConfidence, detectedDescriptor, multipleFacesDetected, unknownFaceDetected } = useFaceRecognition({
    videoRef,
    enabled: [KIOSK_STATES.IDLE, KIOSK_STATES.IDENTIFYING, KIOSK_STATES.UNKNOWN_STUDENT, KIOSK_STATES.MULTIPLE_FACES].includes(state.currentState),
    useMock: false,
    distanceThreshold: 0.50, // Strict threshold for Phase 3
    scanIntervalMs: 400
  });

  // Autonomous Face Recognition State Machine Integration
  React.useEffect(() => {
    if ([KIOSK_STATES.WASHING, KIOSK_STATES.SCORING, KIOSK_STATES.FEEDBACK].includes(state.currentState)) return;

    if (multipleFacesDetected) {
      if (state.currentState !== KIOSK_STATES.MULTIPLE_FACES) dispatch({ type: 'MULTIPLE_FACES_DETECTED' });
      return;
    }

    if (unknownFaceDetected) {
      if (state.currentState !== KIOSK_STATES.UNKNOWN_STUDENT) dispatch({ type: 'UNKNOWN_FACE_DETECTED' });
      return;
    }

    if (detectedDescriptor && !matchedStudent && state.currentState !== KIOSK_STATES.IDENTIFYING) {
      dispatch({ type: 'START_IDENTIFICATION' });
      return;
    }

    // If no face is detected, return to IDLE
    if (!detectedDescriptor && !multipleFacesDetected && !unknownFaceDetected && state.currentState !== KIOSK_STATES.IDLE && state.currentState !== KIOSK_STATES.IDENTIFYING) {
      // Keep identifying running a bit to avoid flicker if they look away for a frame,
      // but immediately reset if they were in an error state and step away.
      if (state.currentState === KIOSK_STATES.UNKNOWN_STUDENT || state.currentState === KIOSK_STATES.MULTIPLE_FACES) {
         const timer = setTimeout(() => dispatch({ type: 'RESET_TO_IDLE' }), 1500);
         return () => clearTimeout(timer);
      }
    }
  }, [state.currentState, multipleFacesDetected, unknownFaceDetected, matchedStudent, detectedDescriptor]);

  // When face recognized: transition to WASHING
  React.useEffect(() => {
    if (state.currentState === KIOSK_STATES.IDENTIFYING && matchedStudent) {
      // Delay the transition by 1.2 seconds so the user can clearly see their name recognized
      const timer = setTimeout(async () => {
        const result = await createSession(matchedStudent.studentId, matchedStudent.name);
        dispatch({
          type: 'STUDENT_IDENTIFIED',
          payload: {
            student: matchedStudent,
            sessionId: result.id
          }
        });
      }, 1200);
      
      return () => clearTimeout(timer);
    }
  }, [state.currentState, matchedStudent]);

  // Remove activeWashingStep state since ML engine handles it now

  const {
    activeStep: mlActiveStep,
    confidence: stepConfidence,
    progress: mlProgress,
    resetTracker,
    telemetry,
    missedSteps
  } = useStepRecognition({
    videoRef,
    enabled: state.currentState === KIOSK_STATES.WASHING,
    useMock,
    confidenceThreshold: 0.60
  });


  const handleStartIdentification = useCallback(() => {
    dispatch({ type: 'START_IDENTIFICATION' });
  }, []);

  const handleStepComplete = useCallback((stepData) => {
    dispatch({ type: 'STEP_COMPLETED', payload: stepData });
  }, []);

  const handleFinishWashing = useCallback(async () => {
    dispatch({ type: 'START_SCORING' });

    // Calculate explainable WHO compliance score (0-100) using scoringService
    const scoreBreakdown = calculateHandwashScore(state.completedSteps, missedSteps);
    const computedScore = scoreBreakdown.totalScore;

    if (state.sessionId) {
      await updateSession(state.sessionId, {
        complianceScore: computedScore,
        completedSteps: state.completedSteps,
        missedSteps: missedSteps,
        status: 'completed'
      });
    }

    dispatch({
      type: 'SCORING_COMPLETE',
      payload: {
        score: computedScore,
        steps: state.completedSteps
      }
    });
  }, [state.completedSteps, state.sessionId]);

  const handleResetToIdle = useCallback(() => {
    resetTracker();
    dispatch({ type: 'RESET_TO_IDLE' });
  }, [resetTracker]);

  // Watch ML step progression to trigger finish
  React.useEffect(() => {
    if (state.currentState === KIOSK_STATES.WASHING && mlActiveStep >= 6) {
      const timer = setTimeout(() => {
        handleStepComplete({
          stepNumber: 6,
          durationMs: 5000,
          avgConfidence: stepConfidence || 0.88,
          completed: true
        });
        handleFinishWashing();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [state.currentState, mlActiveStep, handleFinishWashing, handleStepComplete, stepConfidence]);

  return (
    <div style={{
      width: '100%',
      minHeight: 'calc(100vh - 65px)',
      background: 'linear-gradient(135deg, #090d16 0%, #0f172a 100%)',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', sans-serif",
      overflow: 'hidden'
    }}>
      {/* Top Header */}
      <header style={{
        padding: '16px 32px',
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px'
          }}>
            🧼
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
              SMART WASH KIOSK
            </h1>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              State: <strong style={{ color: '#10b981', textTransform: 'uppercase' }}>{state.currentState}</strong>
            </span>
            {isMockFirebase && (
              <div style={{ marginLeft: '12px', padding: '2px 6px', background: '#f59e0b', color: '#fff', fontSize: '9px', fontWeight: 800, borderRadius: '4px', display: 'inline-block' }}>
                [ENV: LOCAL DEMO MODE - PERSISTENCE EPHEMERAL]
              </div>
            )}
          </div>
        </div>

        {/* State Indicator Pills */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(30, 41, 59, 0.6)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
          {Object.values(KIOSK_STATES).map(st => (
            <span
              key={st}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '6px',
                textTransform: 'capitalize',
                background: state.currentState === st ? '#10b981' : 'transparent',
                color: state.currentState === st ? '#ffffff' : '#64748b'
              }}
            >
              {st.replace('_', ' ')}
            </span>
          ))}
        </div>
      </header>

      {/* Main Kiosk Content Grid */}
      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '24px' }}>
        {/* Left Column: Live Camera Overlay */}
        <div style={{ position: 'relative' }}>
          <KioskCamera
            videoRef={videoRef}
            state={state.currentState}
            activeStep={mlActiveStep}
            confidence={stepConfidence || faceConfidence}
            student={state.student || matchedStudent}
          />
          {telemetry && (
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              background: 'rgba(0,0,0,0.85)',
              border: '1px solid #ef4444',
              padding: '12px',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '11px',
              color: '#fff',
              zIndex: 9999,
              boxShadow: '0 4px 6px rgba(0,0,0,0.5)',
              pointerEvents: 'none'
            }}>
              <div style={{ color: '#ef4444', fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #ef4444', paddingBottom: '4px' }}>[HANDWASH_DEBUG_HUD]</div>
              <div>Camera Stream: <span style={{ color: telemetry.camActive ? '#22c55e' : '#ef4444' }}>{telemetry.camActive ? 'ACTIVE (320x320 @ 10fps)' : 'INACTIVE'}</span></div>
              <div>Hand Tracker: [Left: <span style={{ color: telemetry.leftHand ? '#22c55e' : '#ef4444' }}>{telemetry.leftHand ? 'YES' : 'NO'}</span> | Right: <span style={{ color: telemetry.rightHand ? '#22c55e' : '#ef4444' }}>{telemetry.rightHand ? 'YES' : 'NO'}</span>]</div>
              <div>Raw Prediction: <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{telemetry.rawPrediction}</span></div>
              <div>Raw Confidence: <span style={{ color: '#eab308' }}>{(telemetry.rawConfidence || 0).toFixed(2)}</span></div>
              <div>Target Expected Step: <span style={{ color: '#a855f7' }}>{telemetry.expectedStep}</span></div>
              <div>Debounce Counter: {telemetry.debounceCount} / {telemetry.requiredFrames}</div>
              <div style={{ marginTop: '4px', fontSize: '9px', color: '#9ca3af' }}>Completed: [{state.completedSteps.join(', ')}]</div>
              <div style={{ fontSize: '9px', color: '#ef4444' }}>Missed: [{missedSteps.join(', ')}]</div>
            </div>
          )}
        </div>

        {/* Right Column: Dynamic State Views */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(12px)',
          borderRadius: '20px',
          padding: '28px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          {state.currentState === KIOSK_STATES.IDLE && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <div style={{ fontSize: '56px' }}>🧼</div>
              <h2 style={{ margin: 0, fontSize: '32px', fontWeight: 800 }}>Welcome to SMART WASH</h2>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '15px', maxWidth: '420px' }}>
                Step up to the sink kiosk to begin AI-guided handwashing compliance tracking.
              </p>
              <div style={{
                color: '#10b981',
                fontWeight: 600,
                fontSize: '18px',
                marginTop: '16px',
                padding: '12px 24px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '12px'
              }}>
                Please look at the camera to start
              </div>
            </div>
          )}

          {state.currentState === KIOSK_STATES.IDENTIFYING && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              {matchedStudent ? (
                <>
                  <div style={{ fontSize: '56px', textShadow: '0 0 20px rgba(16, 185, 129, 0.5)' }}>✅</div>
                  <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#10b981' }}>Identity Confirmed!</h2>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '16px', maxWidth: '400px' }}>
                    Welcome back, <strong style={{ color: '#ffffff', fontSize: '18px' }}>{matchedStudent.name}</strong>.<br/><br/>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Starting your handwashing session...</span>
                  </p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '56px', animation: 'spin 2s linear infinite' }}>🔍</div>
                  <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#c084fc' }}>Identifying Student...</h2>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', maxWidth: '400px' }}>
                    Looking at camera... Matching face descriptor against student database.
                  </p>
                </>
              )}
            </div>
          )}

          {state.currentState === KIOSK_STATES.MULTIPLE_FACES && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <div style={{ fontSize: '56px', textShadow: '0 0 20px rgba(239, 68, 68, 0.5)' }}>⚠️</div>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#f87171' }}>ONE STUDENT AT A TIME</h2>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '16px', maxWidth: '400px' }}>
                Please ensure only one person is in the camera frame to proceed with identification.
              </p>
            </div>
          )}

          {state.currentState === KIOSK_STATES.UNKNOWN_STUDENT && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <div style={{ fontSize: '56px', textShadow: '0 0 20px rgba(245, 158, 11, 0.5)' }}>❓</div>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#fbbf24' }}>STUDENT NOT RECOGNIZED</h2>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '16px', maxWidth: '400px' }}>
                We couldn't find a matching student profile. Please step closer or contact a teacher to enroll.
              </p>
              
              <div style={{ marginTop: '20px', background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '300px' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 'bold' }}>Manual Fallback</div>
                <input 
                  type="text" 
                  id="manual-student-id"
                  placeholder="Enter Student ID (e.g. STU_101)" 
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', marginBottom: '12px', boxSizing: 'border-box' }}
                />
                <button 
                  onClick={async () => {
                    const val = document.getElementById('manual-student-id').value;
                    if (val) {
                      const { getStudentById } = await import('../../../shared/services/studentService.js');
                      const st = await getStudentById(val);
                      if (st) {
                        const result = await createSession(st.studentId, st.name);
                        dispatch({ type: 'STUDENT_IDENTIFIED', payload: { student: st, sessionId: result.id } });
                      } else {
                        alert('Student ID not found in database.');
                      }
                    }
                  }}
                  style={{ width: '100%', padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Proceed with ID
                </button>
              </div>
            </div>
          )}

          {state.currentState === KIOSK_STATES.WASHING && (
            <WashingView
              activeStep={mlActiveStep}
              confidence={stepConfidence || 0.88}
              progress={mlProgress}
              onStepComplete={handleStepComplete}
              onFinishWashing={handleFinishWashing}
            />
          )}

          {state.currentState === KIOSK_STATES.FEEDBACK && (
            <FeedbackView
              score={state.finalScore}
              student={state.student}
              completedSteps={state.completedSteps}
              onReset={handleResetToIdle}
            />
          )}
        </div>
      </main>
    </div>
  );
}
