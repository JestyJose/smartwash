import React, { useReducer, useRef, useCallback } from 'react';
import { kioskReducer, INITIAL_KIOSK_STATE, KIOSK_STATES } from './kioskStateMachine.js';
import { KioskCamera } from './components/KioskCamera.jsx';
import { WashingView } from './components/WashingView.jsx';
import { FeedbackView } from './components/FeedbackView.jsx';

import { useFaceRecognition } from '../../../shared/hooks/useFaceRecognition.js';
import { useStepRecognition } from '../../../shared/hooks/useStepRecognition.js';
import { createSession, updateSession } from '../../../shared/services/sessionService.js';
import { calculateHandwashScore } from '../../../shared/services/scoringService.js';

export function StudentKioskApp({ useMock = true }) {
  const [state, dispatch] = useReducer(kioskReducer, INITIAL_KIOSK_STATE);
  const videoRef = useRef(null);

  // 1. Jesty's Face ID Hook
  const { matchedStudent, confidence: faceConfidence, enrollCurrentFace, detectedDescriptor } = useFaceRecognition({
    videoRef,
    enabled: state.currentState === KIOSK_STATES.IDLE || state.currentState === KIOSK_STATES.IDENTIFYING,
    useMock
  });

  // Auto-start identification when a face is detected in IDLE state
  React.useEffect(() => {
    if (state.currentState === KIOSK_STATES.IDLE && detectedDescriptor) {
      dispatch({ type: 'START_IDENTIFICATION' });
    }
  }, [state.currentState, detectedDescriptor]);

  // When face recognized: transition to WASHING
  React.useEffect(() => {
    if (state.currentState === KIOSK_STATES.IDENTIFYING && matchedStudent) {
      // Delay the transition by 2.5 seconds so the user can clearly see their name recognized
      const timer = setTimeout(async () => {
        const result = await createSession(matchedStudent.studentId, matchedStudent.name);
        dispatch({
          type: 'STUDENT_IDENTIFIED',
          payload: {
            student: matchedStudent,
            sessionId: result.id
          }
        });
      }, 2500);
      
      return () => clearTimeout(timer);
    }
  }, [state.currentState, matchedStudent]);

  // Remove activeWashingStep state since ML engine handles it now

  const {
    activeStep: mlActiveStep,
    confidence: stepConfidence,
    progress: mlProgress,
    resetTracker
  } = useStepRecognition({
    videoRef,
    enabled: state.currentState === KIOSK_STATES.WASHING,
    useMock,
    confidenceThreshold: 0.60
  });

  // Watch ML step progression to trigger finish
  React.useEffect(() => {
    if (state.currentState === KIOSK_STATES.WASHING && mlActiveStep >= 6) {
      const timer = setTimeout(() => {
        handleFinishWashing();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.currentState, mlActiveStep]);

  const handleStartIdentification = useCallback(() => {
    dispatch({ type: 'START_IDENTIFICATION' });
  }, []);

  const handleStepComplete = useCallback((stepData) => {
    dispatch({ type: 'STEP_COMPLETED', payload: stepData });
  }, []);

  const handleFinishWashing = useCallback(async () => {
    dispatch({ type: 'START_SCORING' });

    // Calculate explainable WHO compliance score (0-100) using scoringService
    const scoreBreakdown = calculateHandwashScore(state.completedSteps);
    const computedScore = scoreBreakdown.totalScore || 95;

    if (state.sessionId) {
      await updateSession(state.sessionId, {
        score: computedScore,
        steps: state.completedSteps,
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
              Joel's Student Kiosk Web Shell · State: <strong style={{ color: '#10b981', textTransform: 'uppercase' }}>{state.currentState}</strong>
            </span>
          </div>
        </div>

        {/* State Indicator Pills */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(30, 41, 59, 0.6)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
          {['idle', 'identifying', 'washing', 'scoring', 'feedback'].map(st => (
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
              {st}
            </span>
          ))}
        </div>
      </header>

      {/* Main Kiosk Content Grid */}
      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '24px' }}>
        {/* Left Column: Live Camera Overlay */}
        <KioskCamera
          videoRef={videoRef}
          state={state.currentState}
          activeStep={mlActiveStep}
          confidence={stepConfidence || faceConfidence}
          student={state.student || matchedStudent}
        />

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
              {useMock && !matchedStudent && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => dispatch({
                      type: 'STUDENT_IDENTIFIED',
                      payload: {
                        student: { studentId: 'STU_101', name: 'Demo Student' },
                        sessionId: `session_${Date.now()}`
                      }
                    })}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px dashed #c084fc',
                      background: 'rgba(192, 132, 252, 0.1)',
                      color: '#e9d5ff',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Simulate Face Recognized ➔
                  </button>
                  <button
                    onClick={async () => {
                      const name = prompt("Enter your name to enroll your face:", "Student");
                      if (name) {
                        const success = await enrollCurrentFace({ studentId: 'STU_' + Math.floor(Math.random()*10000), name: name, classId: 'Demo' });
                        if (success) alert('Face enrolled successfully! Please look at the camera again to be identified.');
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #10b981',
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#34d399',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Enroll My Face
                  </button>
                </div>
              )}
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
