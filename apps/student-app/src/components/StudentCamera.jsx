import React, { useEffect, useRef } from 'react';

/**
 * KioskCamera Component
 * Renders webcam video feed with face ID bounding boxes and hand landmark graphics.
 */
export function KioskCamera({
  videoRef,
  state = 'idle',
  activeStep = 0,
  confidence = 0,
  student = null
}) {
  const localVideoRef = useRef(null);
  const targetVideoRef = videoRef || localVideoRef;

  useEffect(() => {
    let stream = null;

    async function initCamera() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720, facingMode: 'user' }
          });
          if (targetVideoRef.current) {
            targetVideoRef.current.srcObject = stream;
          }
        }
      } catch (err) {
        console.warn("[KioskCamera] Camera access denied or not available; using simulated feed.", err);
      }
    }

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [targetVideoRef]);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      borderRadius: '20px',
      overflow: 'hidden',
      background: '#090d16',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
    }}>
      <video
        ref={targetVideoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)' // Mirror view for natural kiosk feedback
        }}
      />

      {/* Simulated Live View Overlay Graphic */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '20px'
      }}>
        {/* Top Camera Status Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(10px)',
            padding: '6px 14px',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: state === 'washing' ? '#60a5fa' : state === 'identifying' ? '#c084fc' : '#34d399',
              boxShadow: '0 0 10px currentColor'
            }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>
              AI Kiosk Vision Engine
            </span>
          </div>

          {state === 'identifying' && (
            <div style={{
              background: 'rgba(139, 92, 246, 0.25)',
              border: '1px solid #8b5cf6',
              color: '#d8b4fe',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700
            }}>
              Scanning Face ID...
            </div>
          )}
        </div>

        {/* Center Face ID / Landmark Bounding Box Overlay */}
        {state === 'identifying' && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '320px',
            height: '390px',
            borderRadius: '160px',
            border: '3px dashed #a855f7',
            animation: 'pulse 1.5s infinite ease-in-out',
            boxShadow: '0 0 35px rgba(168, 85, 247, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexDirection: 'column',
            paddingBottom: '24px'
          }}>
            <span style={{
              fontSize: '12px',
              color: '#e9d5ff',
              fontWeight: 800,
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              padding: '6px 14px',
              borderRadius: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}>
              Position Face in Frame
            </span>
          </div>
        )}

        {state === 'washing' && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '320px',
            height: '220px',
            borderRadius: '20px',
            border: '2px solid rgba(59, 130, 246, 0.6)',
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 0 30px rgba(59, 130, 246, 0.25)'
          }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
              <span style={{ fontSize: '24px', animation: 'bounce 1s infinite alternate' }}>🧼</span>
              <span style={{ fontSize: '24px' }}>👐</span>
            </div>
            <span style={{ fontSize: '14px', color: '#93c5fd', fontWeight: 800 }}>
              AI Hand Landmark Tracking Active
            </span>
            <span style={{ fontSize: '12px', color: '#34d399', marginTop: '4px', fontWeight: 700 }}>
              Step {activeStep || 1} · {Math.round(confidence * 100)}% ML Confidence
            </span>
            <div style={{ marginTop: '10px', fontSize: '11px', color: '#94a3b8' }}>
              21 3D Coordinate Points Locked
            </div>
          </div>
        )}

        {/* Bottom Student Recognition Tag */}
        {student && (
          <div style={{
            alignSelf: 'flex-start',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(12px)',
            padding: '8px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(52, 211, 153, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: '14px' }}>
              {student.name ? student.name[0] : 'S'}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>{student.name}</div>
              <div style={{ fontSize: '10px', color: '#34d399' }}>Student ID: {student.studentId}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
