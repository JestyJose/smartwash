/**
 * SMART WASH — WHO Handwashing Scoring Engine
 * Author: Rahul (Scoring & Dashboard Lead)
 * 
 * Deterministic compliance scoring engine:
 * Score = max(0, min(100, (Sum(W_i)/Sum(W_j) * 100) - P_missed - P_out_of_order))
 */

export const TARGET_STEP_DURATION_MS = 6000;

export function calculateHandwashScore(completedSteps = [], missedSteps = []) {
  if (completedSteps.length === 0 && missedSteps.length === 0) {
    return {
      totalScore: 0,
      completionScore: 0,
      durationScore: 0,
      confidenceScore: 0,
      grade: 'Needs Improvement',
      feedbackMessage: 'No handwashing steps recorded.'
    };
  }

  const EXPECTED_STEPS = 6;
  const W_i = 1; // Weight per step
  
  // Normalize completedSteps whether passed as plain numbers or step telemetry objects
  let totalDurationQuality = 0;
  let totalConfidence = 0;
  let hasTelemetry = false;
  const normalizedStepNumbers = [];

  for (const step of completedSteps) {
    if (typeof step === 'object' && step !== null) {
      normalizedStepNumbers.push(step.stepNumber);
      if (step.durationMs !== undefined) {
        hasTelemetry = true;
        const target = TARGET_STEP_DURATION_MS;
        const q = Math.min(1.0, Math.max(0.2, step.durationMs / target));
        totalDurationQuality += q;
      } else {
        totalDurationQuality += 1.0;
      }
      if (step.avgConfidence !== undefined) {
        hasTelemetry = true;
        // Normalize if 0.0-1.0 or 0-100
        const conf = step.avgConfidence > 1 ? step.avgConfidence / 100 : step.avgConfidence;
        totalConfidence += Math.min(1.0, Math.max(0, conf));
      } else {
        totalConfidence += 0.92;
      }
    } else {
      normalizedStepNumbers.push(Number(step));
      totalDurationQuality += 1.0;
      totalConfidence += 0.95;
    }
  }

  const completedCount = normalizedStepNumbers.length;
  const durationQuality = completedCount > 0 ? Math.round((totalDurationQuality / completedCount) * 100) : 0;
  const aiConfidence = completedCount > 0 ? Math.round((totalConfidence / completedCount) * 100) : 0;

  const totalWeightCompleted = completedCount * W_i;
  const totalWeightExpected = EXPECTED_STEPS * W_i;
  
  // Base completion score (out of 100)
  const baseScore = (totalWeightCompleted / totalWeightExpected) * 100;
  
  // Penalties
  const P_missed = missedSteps.length * 15; // 15 point penalty per missed step
  
  // Check for out-of-order execution
  let outOfOrderViolations = 0;
  let lastStep = 0;
  for (const step of normalizedStepNumbers) {
    if (step < lastStep) {
      outOfOrderViolations++;
    }
    lastStep = step;
  }
  const P_out_of_order = outOfOrderViolations * 10; // 10 point penalty per out of order

  // Small quality adjustment only when live telemetry with variation is provided
  let qualityAdjustment = 0;
  if (hasTelemetry && completedCount > 0) {
    // If average duration was rushed below recommended target, small deduction (max -6 pts)
    const durationDeficit = Math.max(0, 100 - durationQuality);
    const durationPenalty = (durationDeficit / 100) * 6;

    // If model confidence was low (< 80%), small deduction (max -4 pts)
    const confidenceDeficit = Math.max(0, 80 - aiConfidence);
    const confidencePenalty = (confidenceDeficit / 80) * 4;

    qualityAdjustment = -(durationPenalty + confidencePenalty);
  }
  
  // Final calculation clamped strictly between 0 and 100
  let totalScore = baseScore - P_missed - P_out_of_order + qualityAdjustment;
  totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

  // Determine Grade & Feedback Message
  let grade = 'Needs Improvement';
  let feedbackMessage = 'Try to complete all 6 WHO steps in order with thorough coverage!';

  if (totalScore >= 90) {
    grade = 'Excellent';
    feedbackMessage = 'Outstanding handwashing technique! Full WHO compliance achieved!';
  } else if (totalScore >= 75) {
    grade = 'Good';
    feedbackMessage = 'Great job! Ensure all steps meet the recommended duration for a perfect score.';
  } else if (totalScore >= 60) {
    grade = 'Satisfactory';
    feedbackMessage = 'Good effort! Make sure to cover all 6 WHO steps thoroughly in the proper order.';
  }

  return {
    totalScore,
    completionScore: Math.round(baseScore),
    durationQuality: durationQuality || 90,
    aiConfidence: aiConfidence || 92,
    completedStepsCount: `${completedCount}/${EXPECTED_STEPS}`,
    grade,
    feedbackMessage,
    breakdown: {
      completedSteps: `${completedCount}/${EXPECTED_STEPS}`,
      durationQuality: `${durationQuality || 90}%`,
      aiConfidence: `${aiConfidence || 92}%`,
      penalties: P_missed + P_out_of_order
    }
  };
}

export function calculateStreak(sessionHistory = []) {
  if (!sessionHistory || sessionHistory.length === 0) return 0;
  let streak = 0;
  for (const session of sessionHistory) {
    if ((session.score || 0) >= 70) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
