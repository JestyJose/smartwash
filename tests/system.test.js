import { describe, it, expect, beforeEach } from 'vitest';
import { StepRecognitionEngine } from '../shared/services/stepModelService.js';
import { calculateHandwashScore } from '../shared/services/scoringService.js';

describe('Phase 1: Model Label Normalization', () => {
  let engine;
  beforeEach(() => {
    engine = new StepRecognitionEngine();
  });

  it('correctly maps raw YOLO labels to integer steps', () => {
    expect(engine.getYoloClassStep('Step_1')).toBe(1);
    expect(engine.getYoloClassStep('Step_2_Left')).toBe(2);
    expect(engine.getYoloClassStep('Step_2_Right')).toBe(2);
    expect(engine.getYoloClassStep('Step_6_Left')).toBe(6);
    expect(engine.getYoloClassStep('Step_7_Right')).toBe(6);
    expect(engine.getYoloClassStep('background')).toBe(-1);
    expect(engine.getYoloClassStep('unknown_junk')).toBe(-1);
  });
});

describe('Phase 2: Temporal Debounce & State Machine', () => {
  let engine;
  beforeEach(() => {
    // Shorter timeouts for testing
    engine = new StepRecognitionEngine({
      historyWindowSize: 5,
      consecutiveFramesRequired: 3,
      confidenceThreshold: 0.75,
      stepTimeoutSeconds: 30
    });
  });

  it('ignores single-frame high confidence anomalies (flicker)', () => {
    // Send 1 frame of Step 2 (while expecting Step 1)
    engine.predict({ class: 'Step_2_Right', confidence: 0.90 }, performance.now());
    expect(engine.currentStep).toBe(1);
    expect(engine.missedSteps.length).toBe(0);
  });

  it('penalizes and skips step if K+1 persists over required frames', () => {
    // Current step is 1. We send 3 consecutive high-confidence frames for Step 2.
    const now = performance.now();
    engine.predict({ class: 'Step_2_Right', confidence: 0.90 }, now);
    engine.predict({ class: 'Step_2_Right', confidence: 0.90 }, now + 100);
    const result = engine.predict({ class: 'Step_2_Right', confidence: 0.90 }, now + 200);

    // It should have marked Step 1 as missed and advanced to Step 2
    expect(result.rawStep).toBe(2);
    expect(engine.currentStep).toBe(2);
    expect(result.missedSteps).toContain(1);
  });
});

describe('Phase 4: Deterministic Scoring Calculation', () => {
  it('awards 100 points for a perfect sequence', () => {
    const completed = [1, 2, 3, 4, 5, 6];
    const missed = [];
    const result = calculateHandwashScore(completed, missed);
    expect(result.totalScore).toBe(100);
  });

  it('deducts 15 points per missed step', () => {
    const completed = [2, 3, 4, 5, 6];
    const missed = [1];
    const result = calculateHandwashScore(completed, missed);
    // Base: 5/6 = 83.33 => 83
    // Missed: 1 * 15 = 15
    // 83.33 - 15 = 68.33 => 68
    expect(result.totalScore).toBe(68);
  });

  it('deducts 10 points per out-of-order violation', () => {
    const completed = [1, 3, 2, 4, 5, 6];
    const missed = [];
    const result = calculateHandwashScore(completed, missed);
    // Base: 6/6 = 100
    // Out of order: 3 -> 2 (1 violation) = 10
    // 100 - 10 = 90
    expect(result.totalScore).toBe(90);
  });

  it('clamps score at 0 for terrible performance', () => {
    const completed = [1];
    const missed = [2, 3, 4, 5, 6];
    const result = calculateHandwashScore(completed, missed);
    // Base: 1/6 = 16.66
    // Missed: 5 * 15 = 75
    // 16.66 - 75 < 0 => clamps to 0
    expect(result.totalScore).toBe(0);
  });
});
