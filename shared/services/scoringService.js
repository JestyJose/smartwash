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
  
  const totalWeightCompleted = completedSteps.length * W_i;
  const totalWeightExpected = EXPECTED_STEPS * W_i;
  
  // Base completion score (out of 100)
  const baseScore = (totalWeightCompleted / totalWeightExpected) * 100;
  
  // Penalties
  const P_missed = missedSteps.length * 15; // 15 point penalty per missed step
  
  // Check for out-of-order execution in the completedSteps array
  let outOfOrderViolations = 0;
  let lastStep = 0;
  for (const step of completedSteps) {
      if (step < lastStep) {
          outOfOrderViolations++;
      }
      lastStep = step;
  }
  const P_out_of_order = outOfOrderViolations * 10; // 10 point penalty per out of order
  
  // Final calculation clamped between 0 and 100
  let totalScore = baseScore - P_missed - P_out_of_order;
  totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

  // Determine Grade & Feedback Message
  let grade = 'Needs Improvement';
  let feedbackMessage = 'Try to complete all 6 WHO steps in order!';

  if (totalScore >= 90) {
    grade = 'Excellent';
    feedbackMessage = 'Outstanding handwashing technique! Full WHO compliance achieved!';
  } else if (totalScore >= 75) {
    grade = 'Good';
    feedbackMessage = 'Great job! Ensure you follow the correct sequence for a perfect score.';
  } else if (totalScore >= 60) {
    grade = 'Satisfactory';
    feedbackMessage = 'Good effort! Make sure to cover all WHO steps thoroughly.';
  }

  return {
    totalScore,
    completionScore: Math.round(baseScore),
    durationScore: 0, // Deprecated in new formula
    confidenceScore: 0, // Handled implicitly by state machine thresholds
    grade,
    feedbackMessage
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
