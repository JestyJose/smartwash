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
  const [showDebugHud, setShowDebugHud] = React.useState(true);
  const videoRef = useRef(null);

  // 1. Jesty's Face ID Hook
  const { matchedStudent, confidence: faceConfidence, detectedDescriptor, multipleFacesDetected, unknownFaceDetected, enrollCurrentFace } = useFaceRecognition({
    videoRef,
    enabled: [KIOSK_STATES.IDLE, KIOSK_STATES.IDENTIFYING, KIOSK_STATES.UNKNOWN_STUDENT, KIOSK_STATES.MULTIPLE_FACES].includes(state.currentState),
    useMock: false,
    distanceThreshold: 0.60, // Relaxed threshold to improve reliability
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

  const handleStartIdentification = useCallback(() => {
    dispatch({ type: 'START_IDENTIFICATION' });
  }, []);

  const handleStepComplete = useCallback((stepData) => {
    dispatch({ type: 'STEP_COMPLETED', payload: stepData });
  }, []);

  const {
    activeStep: mlActiveStep,
    confidence: stepConfidence,
    progress: mlProgress,
    resetTracker,
    telemetry,
    missedSteps,
    isCompleted: mlIsCompleted,
    wsStatus
  } = useStepRecognition({
    videoRef,
    enabled: state.currentState === KIOSK_STATES.WASHING,
    useMock,
    confidenceThreshold: 0.30,
    onStepCompleted: handleStepComplete
  });

  const handleFinishWashing = useCallback(async () => {
    dispatch({ type: 'START_SCORING' });

    // Calculate explainable WHO compliance score (0-100) using scoringService
    const scoreBreakdown = calculateHandwashScore(state.completedSteps, missedSteps);
    const computedScore = scoreBreakdown.totalScore;

    if (state.sessionId) {
      await updateSession(state.sessionId, {
        complianceScore: computedScore,
        score: computedScore,
        completedSteps: state.completedSteps,
        missedSteps: missedSteps,
        durationQuality: scoreBreakdown.durationQuality,
        aiConfidence: scoreBreakdown.aiConfidence,
        breakdown: scoreBreakdown.breakdown,
        status: 'completed'
      });
    }

    dispatch({
      type: 'SCORING_COMPLETE',
      payload: {
        score: computedScore,
        steps: state.completedSteps,
        scoreBreakdown: scoreBreakdown
      }
    });
  }, [state.completedSteps, state.sessionId, missedSteps]);

  const handleResetToIdle = useCallback(() => {
    resetTracker();
    dispatch({ type: 'RESET_TO_IDLE' });
  }, [resetTracker]);

  // Watch ML step progression or completion to trigger finish
  React.useEffect(() => {
    if (state.currentState === KIOSK_STATES.WASHING && mlIsCompleted) {
      const timer = setTimeout(() => {
        handleFinishWashing();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state.currentState, mlIsCompleted, handleFinishWashing]);


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

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* AI Backend Connection Status Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 700,
            background: wsStatus === 'connected' ? 'rgba(16, 185, 129, 0.15)' : wsStatus === 'connecting' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${wsStatus === 'connected' ? '#10b981' : wsStatus === 'connecting' ? '#f59e0b' : '#ef4444'}`,
            color: wsStatus === 'connected' ? '#34d399' : wsStatus === 'connecting' ? '#fbbf24' : '#f87171'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'currentColor',
              boxShadow: '0 0 6px currentColor'
            }} />
            {wsStatus === 'connected' ? 'Python YOLO Engine: Online' : wsStatus === 'connecting' ? 'Connecting YOLO...' : 'YOLO Backend: Offline (Port 4550)'}
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

          {/* Developer Debug HUD Toggle */}
          <button
            onClick={() => setShowDebugHud(prev => !prev)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              background: showDebugHud ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${showDebugHud ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)'}`,
              color: showDebugHud ? '#93c5fd' : '#94a3b8',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Toggle Developer Telemetry HUD for presentation/defense"
          >
            <span>🛠️ Debug HUD:</span>
            <strong style={{ color: showDebugHud ? '#34d399' : '#f87171' }}>{showDebugHud ? 'ON' : 'OFF'}</strong>
          </button>
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
          {showDebugHud && telemetry && (
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              background: 'rgba(15, 23, 42, 0.94)',
              border: '1px solid rgba(59, 130, 246, 0.6)',
              backdropFilter: 'blur(10px)',
              padding: '12px 14px',
              borderRadius: '10px',
              fontFamily: 'monospace',
              fontSize: '11px',
              color: '#f8fafc',
              zIndex: 9999,
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              minWidth: '250px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>🧪 AI TELEMETRY HUD</span>
                <button
                  onClick={() => setShowDebugHud(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}
                  title="Hide HUD for Presentation"
                >
                  ✕ Hide
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '3px 8px' }}>
                <span style={{ color: '#94a3b8' }}>Pipeline FPS:</span>
                <span style={{ color: '#34d399', fontWeight: 'bold' }}>{telemetry.fps || 10} FPS</span>

                <span style={{ color: '#94a3b8' }}>WebSocket:</span>
                <span style={{ color: telemetry.wsStatus === 'connected' ? '#34d399' : telemetry.wsStatus === 'connecting' ? '#fbbf24' : '#f87171', fontWeight: 'bold' }}>
                  {telemetry.wsStatus ? telemetry.wsStatus.toUpperCase() : 'OFFLINE'}
                </span>

                <span style={{ color: '#94a3b8' }}>Current YOLO Class:</span>
                <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{telemetry.rawPrediction}</span>

                <span style={{ color: '#94a3b8' }}>Model Confidence:</span>
                <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{((telemetry.rawConfidence || 0) * 100).toFixed(1)}%</span>

                <span style={{ color: '#94a3b8' }}>Expected Step:</span>
                <span style={{ color: '#c084fc', fontWeight: 'bold' }}>{telemetry.expectedStep}</span>

                <span style={{ color: '#94a3b8' }}>Temporal Progress:</span>
                <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{mlProgress}%</span>

                <span style={{ color: '#94a3b8' }}>Kiosk State:</span>
                <span style={{ color: '#a7f3d0' }}>{state.currentState}</span>

                <span style={{ color: '#94a3b8' }}>Completed Steps:</span>
                <span style={{ color: '#34d399' }}>[{state.completedSteps.map(s => typeof s === 'object' ? s.stepNumber : s).join(', ') || 'None'}]</span>

                <span style={{ color: '#94a3b8' }}>Final Score:</span>
                <span style={{ color: state.finalScore !== null && state.finalScore !== undefined ? '#34d399' : '#94a3b8', fontWeight: 'bold' }}>
                  {state.finalScore !== null && state.finalScore !== undefined ? `${state.finalScore}/100` : '--'}
                </span>
              </div>
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
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#f87171' }}>MULTIPLE FACES DETECTED</h2>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '15px', maxWidth: '420px' }}>
                Background people detected. The system will automatically focus on the person closest in front.
              </p>
              <button
                onClick={() => dispatch({ type: 'START_IDENTIFICATION' })}
                style={{
                  padding: '10px 24px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                }}
              >
                Focus on Front Person ➔
              </button>
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
                <div style={{ textAlign: 'center', margin: '10px 0', color: '#94a3b8', fontSize: '12px' }}>OR</div>
                <button 
                  onClick={async () => {
                    const val = document.getElementById('manual-student-id').value || `STU_${Math.floor(Math.random() * 1000)}`;
                    const success = await enrollCurrentFace({ studentId: val, name: 'Guest ' + val, classId: 'Demo' });
                    if (success) {
                      alert('Face successfully enrolled! Step back to identify again.');
                      dispatch({ type: 'RESET_TO_IDLE' });
                    } else {
                      alert('Failed to enroll. Make sure your face is visible.');
                    }
                  }}
                  style={{ width: '100%', padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Quick Enroll My Face
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
              breakdown={state.scoreBreakdown}
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
