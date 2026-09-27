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
  
  // Telemetry HUD State
  const [telemetry, setTelemetry] = useState({
    camActive: false,
    leftHand: false,
    rightHand: false,
    rawPrediction: 'None',
    rawConfidence: 0,
    expectedStep: 'Step 1',
    debounceCount: 0,
    requiredFrames: 10
  });

  const engineRef = useRef(null);
  const wsRef = useRef(null);
  const intervalRef = useRef(null);
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

  // WebSocket Connection
  useEffect(() => {
    if (!enabled) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsProcessing(false);
      return;
    }

    const connectWebSocket = () => {
      const ws = new WebSocket('ws://localhost:4550/ws_model');
      
      ws.onopen = () => {
        console.log('[useStepRecognition] WebSocket Connected');
        setIsProcessing(true);
      };

      ws.onmessage = (event) => {
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
        console.error('[useStepRecognition] WebSocket Error:', err);
      };

      ws.onclose = () => {
        console.log('[useStepRecognition] WebSocket Disconnected. Reconnecting...');
        setIsProcessing(false);
        if (enabled) {
          reconnectAttempts.current += 1;
          const backoff = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts.current));
          setTimeout(connectWebSocket, backoff);
        }
      };

      wsRef.current = ws;
    };

    reconnectAttempts.current = 0;
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled]);

  const handlePrediction = useCallback((prediction, timestamp) => {
    if (!engineRef.current) return;
    
    // We expect prediction format: { class: "Step X", confidence: 0.85 }
    // Pass it to our state machine engine
    const isMoving = prediction.class !== "background" && prediction.confidence > 0.4;
    setIsHandsMoving(isMoving);

    // [HANDWASH_DEBUG] format
    const expected = engineRef.current.mapStepToYoloClass(activeStep);
    const expectedString = expected.join(' or ');
    const frameStreak = engineRef.current.predictionHistory.filter(x => expected.includes(x)).length;
    console.log(`[HANDWASH_DEBUG] target: ${expectedString} | raw_pred: ${prediction.class} | conf: ${prediction.confidence.toFixed(2)} | hands_visible: L:YES R:YES | frame_streak: ${frameStreak}/${engineRef.current.historyWindowSize}`);

    setTelemetry(prev => ({
      ...prev,
      rawPrediction: prediction.class,
      rawConfidence: prediction.confidence,
      expectedStep: expectedString,
      debounceCount: frameStreak,
      requiredFrames: engineRef.current.historyWindowSize
    }));

    const result = engineRef.current.predict(prediction, timestamp);
    
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
    }

    setActiveStep(result.smoothedStep);
    setStepName(WHO_STEPS_INFO[result.smoothedStep]?.name || 'Unknown');
    setConfidence(result.confidence);
    setProgress(result.progressPercent);
    if (result.completedSteps) setCompletedSteps(result.completedSteps);
    if (result.missedSteps) setMissedSteps(result.missedSteps);
  }, [activeStep, confidence]);

  // Frame Capture Loop
  const sendFrame = useCallback(() => {
    if (!enabled || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    const video = videoRef?.current;
    if (video && !video.paused && !video.ended && video.readyState >= 2) {
      setTelemetry(prev => ({ ...prev, camActive: true }));
      // Draw to offscreen canvas
      ctxRef.current.drawImage(video, 0, 0, 320, 320);
      
      // Get Base64 JPEG (lower quality for performance)
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.6);
      
      // Send over WebSocket
      wsRef.current.send(dataUrl);
    }
  }, [enabled, videoRef]);

  // Set up interval for ~10fps transmission
  useEffect(() => {
    if (enabled) {
      intervalRef.current = setInterval(sendFrame, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, sendFrame]);

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
    lastStepTimeRef.current = performance.now();
  }, []);

  return {
    activeStep,
    stepName,
    confidence,
    progress,
    isProcessing,
    isHandsMoving,
    completedSteps,
    missedSteps,
    resetTracker,
    stepsInfo: WHO_STEPS_INFO,
    telemetry
  };
}
