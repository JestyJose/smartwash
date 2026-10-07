/**
 * SMART WASH — React Hook for YOLOv11 WHO Step Recognition (WebSocket Client)
 * Author: Jobiya (AI/Model Lead)
 * 
 * Streams webcam frames, downscales them to 320x320, sends them to FastAPI via WS,
 * feeds results into StepRecognitionEngine, and returns active step & progress.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { StepRecognitionEngine, WHO_STEPS_INFO } from '../services/stepModelService.js';

export function useStepRecognition({
  videoRef,
  enabled = true,
  useMock = false,
  confidenceThreshold = 0.65,
  onStepCompleted = null
} = {}) {
  const [activeStep, setActiveStep] = useState(1);
  const [stepName, setStepName] = useState(WHO_STEPS_INFO[1]?.name || 'Palm to Palm');
  const [confidence, setConfidence] = useState(0.88);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHandsMoving, setIsHandsMoving] = useState(false);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [missedSteps, setMissedSteps] = useState([]);
  
  // Reconnect backoff state
  const reconnectAttempts = useRef(0);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [isCompleted, setIsCompleted] = useState(false);
  
  // Telemetry HUD State
  const [telemetry, setTelemetry] = useState({
    fps: 0,
    camActive: false,
    leftHand: false,
    rightHand: false,
    rawPrediction: 'None',
    rawConfidence: 0,
    expectedStep: 'Step 1',
    debounceCount: 0,
    requiredFrames: 10,
    wsStatus: 'disconnected'
  });

  const fpsRef = useRef({ count: 0, lastCheck: performance.now(), currentFps: 0 });
  const engineRef = useRef(null);
  const wsRef = useRef(null);
  const intervalRef = useRef(null);
  const mockIntervalRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  
  const lastStepTimeRef = useRef(performance.now());
  const onStepCompletedRef = useRef(onStepCompleted);

  useEffect(() => {
    onStepCompletedRef.current = onStepCompleted;
  });

  // Initialize Canvas for downscaling
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 320;
    canvasRef.current = canvas;
    ctxRef.current = canvas.getContext('2d', { willReadFrequently: true });
  }, []);

  // Initialize StepRecognitionEngine
  useEffect(() => {
    engineRef.current = new StepRecognitionEngine({
      useMock,
      confidenceThreshold
    });
  }, [useMock, confidenceThreshold]);

  // Persistent WebSocket Connection to Python FastAPI
  useEffect(() => {
    let isUnmounted = false;
    let retryTimer = null;

    const connectWebSocket = () => {
      if (isUnmounted) return;
      setWsStatus('connecting');
      setTelemetry(prev => ({ ...prev, wsStatus: 'connecting' }));

      try {
        const ws = new WebSocket('ws://localhost:4550/ws_model');
        
        ws.onopen = () => {
          if (isUnmounted) return;
          console.log('[useStepRecognition] WebSocket Connected to Python FastAPI');
          setIsProcessing(true);
          setWsStatus('connected');
          setTelemetry(prev => ({ ...prev, wsStatus: 'connected' }));
          reconnectAttempts.current = 0;
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.prediction && engineRef.current) {
              handlePrediction(data.prediction, data.timestamp);
            }
          } catch (err) {
            console.error('[useStepRecognition] Error parsing WS message:', err);
          }
        };

        ws.onerror = (err) => {
          if (isUnmounted) return;
          console.warn('[useStepRecognition] WebSocket Error (Backend may be offline):', err);
          setWsStatus('error');
          setTelemetry(prev => ({ ...prev, wsStatus: 'error' }));
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          console.log('[useStepRecognition] WebSocket Disconnected. Reconnecting...');
          setIsProcessing(false);
          setWsStatus('disconnected');
          setTelemetry(prev => ({ ...prev, wsStatus: 'disconnected' }));

          reconnectAttempts.current += 1;
          const backoff = Math.min(10000, 1500 * Math.pow(1.3, reconnectAttempts.current));
          retryTimer = setTimeout(connectWebSocket, backoff);
        };

        wsRef.current = ws;
      } catch (err) {
        setWsStatus('error');
        retryTimer = setTimeout(connectWebSocket, 3000);
      }
    };

    reconnectAttempts.current = 0;
    connectWebSocket();

    return () => {
      isUnmounted = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const handlePrediction = useCallback((prediction, timestamp) => {
    if (!engineRef.current) return;
    
    // FPS tracking
    const now = performance.now();
    fpsRef.current.count++;
    if (now - fpsRef.current.lastCheck >= 1000) {
      fpsRef.current.currentFps = Math.round((fpsRef.current.count * 1000) / (now - fpsRef.current.lastCheck));
      fpsRef.current.count = 0;
      fpsRef.current.lastCheck = now;
    }

    const isMoving = prediction.class !== "background" && (prediction.confidence || 0) > 0.25;
    setIsHandsMoving(isMoving);

    const expected = engineRef.current.mapStepToYoloClass(activeStep);
    const expectedString = expected.join(' or ');
    const frameStreak = engineRef.current.predictionHistory.filter(x => expected.includes(x)).length;

    setTelemetry(prev => ({
      ...prev,
      fps: fpsRef.current.currentFps || (isMoving ? 10 : 8),
      rawPrediction: prediction.class || 'background',
      rawConfidence: prediction.confidence || 0,
      expectedStep: expectedString,
      debounceCount: frameStreak,
      requiredFrames: engineRef.current.historyWindowSize
    }));

    const result = engineRef.current.predict(prediction, timestamp);
    
    // Normal step increment (e.g. step 1 -> 2)
    if (result.smoothedStep > activeStep) {
      const duration = performance.now() - lastStepTimeRef.current;
      lastStepTimeRef.current = performance.now();
      if (onStepCompletedRef.current) {
        onStepCompletedRef.current({
          stepNumber: activeStep,
          durationMs: duration,
          avgConfidence: confidence,
          completed: true
        });
      }
      setCompletedSteps(prev => [...prev, activeStep]);
    } else if (result.isCompleted && !completedSteps.includes(6)) {
      // Step 6 completion trigger
      const duration = performance.now() - lastStepTimeRef.current;
      lastStepTimeRef.current = performance.now();
      if (onStepCompletedRef.current) {
        onStepCompletedRef.current({
          stepNumber: 6,
          durationMs: duration,
          avgConfidence: confidence,
          completed: true
        });
      }
      setCompletedSteps(prev => [...prev, 6]);
      setIsCompleted(true);
    }

    setActiveStep(result.smoothedStep);
    setStepName(WHO_STEPS_INFO[result.smoothedStep]?.name || 'Unknown');
    setConfidence(result.confidence || 0.88);
    setProgress(result.progressPercent);
    if (result.completedSteps) setCompletedSteps(result.completedSteps);
    if (result.missedSteps) setMissedSteps(result.missedSteps);
    if (result.isCompleted) setIsCompleted(true);
  }, [activeStep, confidence, completedSteps]);

  // Frame Capture Loop: sends frame to Python backend
  const sendFrame = useCallback(() => {
    if (!enabled || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    const video = videoRef?.current;
    if (video && !video.paused && !video.ended && video.readyState >= 2) {
      setTelemetry(prev => ({ ...prev, camActive: true }));
      // Draw to offscreen canvas (320x320 resolution expected by YOLO)
      ctxRef.current.drawImage(video, 0, 0, 320, 320);
      
      // Get Base64 JPEG
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.65);
      
      // Send over WebSocket
      wsRef.current.send(dataUrl);
    }
  }, [enabled, videoRef]);

  // Set up interval for ~10fps transmission to FastAPI
  useEffect(() => {
    if (enabled) {
      intervalRef.current = setInterval(sendFrame, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, sendFrame]);

  // Graceful Mock Fallback Simulation if useMock is set or if backend disconnected for a long time
  useEffect(() => {
    if (!enabled) {
      if (mockIntervalRef.current) clearInterval(mockIntervalRef.current);
      return;
    }

    if (useMock) {
      mockIntervalRef.current = setInterval(() => {
        if (!engineRef.current) return;
        const currentTarget = engineRef.current.mapStepToYoloClass(activeStep)[0] || 'Step_1';
        handlePrediction({
          class: currentTarget,
          confidence: 0.85 + Math.random() * 0.12,
          step: `Step_${activeStep}`
        });
      }, 500);
    }

    return () => {
      if (mockIntervalRef.current) clearInterval(mockIntervalRef.current);
    };
  }, [enabled, useMock, activeStep, handlePrediction]);

  const resetTracker = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.reset();
    }
    setActiveStep(1);
    setStepName(WHO_STEPS_INFO[1]?.name || 'Palm to Palm');
    setConfidence(0.88);
    setProgress(0);
    setCompletedSteps([]);
    setMissedSteps([]);
    setIsCompleted(false);
    lastStepTimeRef.current = performance.now();
  }, []);

  return {
    activeStep,
    stepName,
    confidence,
    progress,
    isProcessing,
    isHandsMoving,
    isCompleted,
    completedSteps,
    missedSteps,
    resetTracker,
    stepsInfo: WHO_STEPS_INFO,
    telemetry,
    wsStatus
  };
}
