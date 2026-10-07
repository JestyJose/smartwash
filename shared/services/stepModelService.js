/**
 * SMART WASH — WHO Handwashing Step Recognition Engine (YOLOv11 Integration)
 * Author: Jobiya (AI/Model Lead)
 * 
 * Manages sequence buffer of YOLO classifications, majority-voting,
 * temporal accumulation, and progression of WHO handwashing steps.
 */

export const WHO_STEPS_INFO = [
  { id: 0, name: "Wet Hands & Apply Soap", recommendedDurationMs: 5000 },
  { id: 1, name: "Palm to Palm", recommendedDurationMs: 6000 },
  { id: 2, name: "Right Palm over Left Dorsum & vice versa", recommendedDurationMs: 6000 },
  { id: 3, name: "Palm to Palm with Fingers Interlaced", recommendedDurationMs: 6000 },
  { id: 4, name: "Backs of Fingers to Opposing Palms", recommendedDurationMs: 6000 },
  { id: 5, name: "Rotational Rubbing of Thumbs", recommendedDurationMs: 6000 },
  { id: 6, name: "Rotational Rubbing of Fingertips on Palms", recommendedDurationMs: 6000 }
];

export function calculateMajorityVote(predictionHistory) {
  if (!predictionHistory || predictionHistory.length === 0) {
    return { majorityClass: "background", confidence: 0 };
  }

  const counts = {};
  for (const p of predictionHistory) {
    counts[p] = (counts[p] || 0) + 1;
  }

  let majorityClass = "background";
  let maxCount = 0;

  for (const [cls, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      majorityClass = cls;
    }
  }

  const confidence = maxCount / predictionHistory.length;
  return { majorityClass, confidence };
}

export class StepRecognitionEngine {
  constructor(options = {}) {
    this.historyWindowSize = options.historyWindowSize || 12;
    this.confidenceThreshold = options.confidenceThreshold !== undefined ? options.confidenceThreshold : 0.28;
    this.consecutiveFramesRequired = options.consecutiveFramesRequired || 6;
    this.stepTimeoutSeconds = options.stepTimeoutSeconds || 30;
    this.useMock = !!options.useMock;
    
    this.predictionHistory = [];
    this.currentStep = 1;
    this.completedSteps = [];
    this.missedSteps = [];
    this.activeTimeMs = 0;
    this.lastFrameTime = null;
    this.stepStartTime = performance.now();
  }

  mapStepToYoloClass(stepId) {
    // Return arrays of accepted granular YOLO classes per step
    if (stepId === 1) return ["Step_1"];
    if (stepId === 2) return ["Step_2_Left", "Step_2_Right", "Step_2"];
    if (stepId === 3) return ["Step_3"];
    if (stepId === 4) return ["Step_4_Left", "Step_4_Right", "Step_4"];
    if (stepId === 5) return ["Step_5_Left", "Step_5_Right", "Step_5"];
    if (stepId === 6) return ["Step_6_Left", "Step_6_Right", "Step_6", "Step_7_Left", "Step_7_Right", "Step_7"];
    return ["background"];
  }

  getYoloClassStep(yoloClass) {
    for (let i = 1; i <= 6; i++) {
      if (this.mapStepToYoloClass(i).includes(yoloClass)) return i;
    }
    return -1;
  }

  predict(prediction, timestamp) {
    const now = timestamp || performance.now();
    const delta = this.lastFrameTime ? Math.min(400, Math.max(50, now - this.lastFrameTime)) : 100;
    this.lastFrameTime = now;
    
    // Add to rolling history buffer
    if (prediction && prediction.class && prediction.class !== 'background' && (prediction.confidence || 0) >= this.confidenceThreshold) {
      this.predictionHistory.push(prediction.class);
    } else {
      this.predictionHistory.push("background");
    }

    if (this.predictionHistory.length > this.historyWindowSize) {
      this.predictionHistory.shift();
    }

    const { majorityClass, confidence } = calculateMajorityVote(this.predictionHistory);
    const expectedClasses = this.mapStepToYoloClass(this.currentStep);
    
    // Check timeout
    if ((now - this.stepStartTime) > this.stepTimeoutSeconds * 1000 && this.currentStep <= 6) {
        this.missedSteps.push(this.currentStep);
        this.currentStep++;
        this.stepStartTime = now;
        this.activeTimeMs = 0;
        this.predictionHistory = [];
        return this._getOutput(confidence);
    }
    
    // Sequence Violation Policy: check if step K+1 persists with high confidence
    const detectedStep = this.getYoloClassStep(majorityClass);
    if (detectedStep > this.currentStep && detectedStep <= 6) {
        const streak = this.predictionHistory.filter(c => this.getYoloClassStep(c) === detectedStep).length;
        if (streak >= this.consecutiveFramesRequired) {
            // Mark step K as MISSED, advance to detectedStep
            this.missedSteps.push(this.currentStep);
            this.currentStep = detectedStep;
            this.activeTimeMs = 0;
            this.stepStartTime = now;
            this.predictionHistory = [];
            return this._getOutput(confidence);
        }
    }

    // Check if the current prediction or majority matches our expected current step
    const matchesCurrent = expectedClasses.includes(majorityClass) ||
      (expectedClasses.includes(prediction.class) && (prediction.confidence || 0) >= this.confidenceThreshold) ||
      (prediction.step === `Step_${this.currentStep}`);

    if (matchesCurrent && this.currentStep <= 6) {
      this.activeTimeMs += delta;
    }

    const targetMs = WHO_STEPS_INFO[this.currentStep]?.recommendedDurationMs || 6000;
    
    // Progress to next step if duration reached
    if (this.activeTimeMs >= targetMs && this.currentStep <= 6) {
      this.completedSteps.push(this.currentStep);
      this.activeTimeMs = 0;
      this.currentStep++;
      this.stepStartTime = now;
      this.predictionHistory = [];
    }

    return this._getOutput(confidence);
  }
  
  _getOutput(confidence = 0) {
      const stepIndex = Math.min(6, Math.max(1, this.currentStep));
      const targetMs = WHO_STEPS_INFO[stepIndex]?.recommendedDurationMs || 6000;
      const isCompleted = this.currentStep > 6 || this.completedSteps.length >= 6 || this.completedSteps.includes(6);
      return {
          rawStep: this.currentStep,
          smoothedStep: isCompleted ? 6 : stepIndex,
          confidence: Number((confidence || 0).toFixed(2)),
          progressPercent: isCompleted ? 100 : Math.min(100, Math.round((this.activeTimeMs / targetMs) * 100)),
          completedSteps: [...this.completedSteps],
          missedSteps: [...this.missedSteps],
          isCompleted: isCompleted,
          activeTimeMs: this.activeTimeMs,
          targetTimeMs: targetMs
      };
  }

  reset() {
    this.predictionHistory = [];
    this.currentStep = 1;
    this.completedSteps = [];
    this.missedSteps = [];
    this.activeTimeMs = 0;
    this.lastFrameTime = null;
    this.stepStartTime = performance.now();
  }
}
