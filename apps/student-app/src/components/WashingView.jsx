import React, { useState, useEffect } from 'react';
import { WHO_STEPS_INFO } from '../../../../shared/services/stepModelService.js';

export function WashingView({
  activeStep = 1,
  confidence = 0.85,
  progress = 0,
  onStepComplete = null,
  onFinishWashing = null
}) {
  const currentStepInfo = WHO_STEPS_INFO[activeStep] || WHO_STEPS_INFO[1];
  const recDuration = (currentStepInfo.recommendedDurationMs || 6000) / 1000;
  const onStepCompleteRef = React.useRef(onStepComplete);
  const onFinishWashingRef = React.useRef(onFinishWashing);
  const confidenceRef = React.useRef(confidence);
  const [mediaFailed, setMediaFailed] = useState(false);

  React.useEffect(() => {
    onStepCompleteRef.current = onStepComplete;
    onFinishWashingRef.current = onFinishWashing;
    confidenceRef.current = confidence;
  });

  // Synchronized Multimedia Guidance (Voice Assistant & Video Loop)
  React.useEffect(() => {
    setMediaFailed(false);
    
    // Voice Assistant (SpeechSynthesis API fallback/primary)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Terminate previous audio streams
      const utterance = new SpeechSynthesisUtterance(`Step ${activeStep}: ${currentStepInfo.name}`);
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      
      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('[WashingView] Voice assistant failed to play:', err);
      }
    }

    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [activeStep, currentStepInfo.name]);

  const progressPercent = Math.min(100, Math.max(0, progress));

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      justifyContent: 'space-between',
      gap: '20px'
    }}>
      {/* Multimedia Instruction Panel */}
      {!mediaFailed ? (
        <div style={{ 
          width: '100%', height: '170px', background: '#000', borderRadius: '18px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <video 
            key={`vid-step-${activeStep}`}
            src={`/assets/step_${activeStep}.mp4`} 
            autoPlay 
            loop 
            muted 
            playsInline
            onError={() => {
              console.warn(`[WashingView] Graceful degradation: Video asset /assets/step_${activeStep}.mp4 not found.`);
              setMediaFailed(true);
            }}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', color: '#fff' }}>
            ▶ Live Demonstration
          </div>
        </div>
      ) : (
        <div style={{
          width: '100%',
          height: '130px',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
          borderRadius: '16px',
          padding: '16px 20px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            flexShrink: 0
          }}>
            {activeStep === 1 ? '👏' : activeStep === 2 ? '🤚' : activeStep === 3 ? '🤞' : activeStep === 4 ? '✊' : activeStep === 5 ? '👍' : '🤌'}
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              WHO Technique Instructions
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: '2px 0' }}>
              {currentStepInfo.name}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              Perform continuous rubbing movement in front of the lens. Target duration: {recDuration} seconds.
            </div>
          </div>
        </div>
      )}

      {/* Active Step Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9))',
        borderRadius: '18px',
        padding: '24px 28px',
        border: '1px solid rgba(59, 130, 246, 0.4)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              WHO Handwashing Standard
            </span>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '28px', fontWeight: 800, color: '#ffffff' }}>
              Step {activeStep}: {currentStepInfo.name}
            </h2>
          </div>

          <div style={{
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '8px 16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#60a5fa' }}>{Math.round((progressPercent / 100) * recDuration)}s</div>
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Target: {recDuration}s</div>
          </div>
        </div>

        {/* Step Progress Bar */}
        <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #3b82f6, #34d399)',
            borderRadius: '4px',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Grid of WHO 6 Steps */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {WHO_STEPS_INFO.slice(1).map((step) => {
          const isActive = step.id === activeStep;
          const isDone = step.id < activeStep;

          return (
            <div
              key={step.id}
              style={{
                background: isActive
                  ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(139, 92, 246, 0.25))'
                  : isDone
                  ? 'rgba(16, 185, 129, 0.1)'
                  : 'rgba(15, 23, 42, 0.4)',
                borderRadius: '14px',
                padding: '16px',
                border: isActive
                  ? '2px solid #3b82f6'
                  : isDone
                  ? '1px solid rgba(52, 211, 153, 0.4)'
                  : '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '90px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: isActive ? '#60a5fa' : isDone ? '#34d399' : '#94a3b8' }}>
                  STEP {step.id}
                </span>
                {isDone && <span style={{ fontSize: '12px', color: '#34d399' }}>✓ Done</span>}
                {isActive && <span style={{ fontSize: '10px', background: '#3b82f6', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>IN PROGRESS</span>}
              </div>

              <span style={{ fontSize: '13px', fontWeight: 600, color: isActive || isDone ? '#ffffff' : '#64748b', marginTop: '6px' }}>
                {step.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Autonomous AI Touchless Status Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30, 41, 59, 0.4)', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 10px #34d399' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>
            Touchless AI Vision Engine Active · Analyzing Hand Movements Automatically
          </span>
        </div>

        {/* Discreet Demo Skip Button (For Presentation Overrides) */}
        <button
          onClick={() => {
            if (onStepComplete) {
              onStepComplete({
                stepNumber: activeStep,
                durationMs: recDuration * 1000,
                avgConfidence: confidence || 0.9,
                completed: true
              });
            }
            if (activeStep >= 6 && onFinishWashing) {
              onFinishWashing();
            }
          }}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            border: '1px dashed #f59e0b',
            background: 'rgba(245, 158, 11, 0.1)',
            color: '#fbbf24',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title="Instructor / Testing Manual Override: Skip current step for presentation demonstration"
        >
          <span>🧪 [DEMO Override]</span>
          <span>Skip Step ➔</span>
        </button>
      </div>
    </div>
  );
}
