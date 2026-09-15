/**
 * SMART WASH — Kiosk App State Machine Reducer
 * Author: Joel (Frontend Shell Lead)
 * 
 * Manages the core kiosk workflow states:
 * idle -> identifying -> washing -> scoring -> feedback -> idle
 */

export const KIOSK_STATES = {
  IDLE: 'idle',
  IDENTIFYING: 'identifying',
  WASHING: 'washing',
  SCORING: 'scoring',
  FEEDBACK: 'feedback'
};

export const INITIAL_KIOSK_STATE = {
  currentState: KIOSK_STATES.IDLE,
  student: null,          // { studentId, name, confidence }
  sessionId: null,
  completedSteps: [],     // Array of { stepNumber, durationMs, avgConfidence, completed }
  finalScore: 0,
  startTime: null,
  endTime: null,
  error: null
};

export function kioskReducer(state, action) {
  switch (action.type) {
    case 'START_IDENTIFICATION':
      return {
        ...INITIAL_KIOSK_STATE,
        currentState: KIOSK_STATES.IDENTIFYING,
        startTime: Date.now()
      };

    case 'STUDENT_IDENTIFIED':
      return {
        ...state,
        currentState: KIOSK_STATES.WASHING,
        student: action.payload.student,
        sessionId: action.payload.sessionId || `session_${Date.now()}`
      };

    case 'IDENTIFICATION_FAILED':
      return {
        ...state,
        currentState: KIOSK_STATES.IDLE,
        error: action.payload?.error || 'Student not recognized. Please try again.'
      };

    case 'STEP_COMPLETED': {
      const existingIdx = state.completedSteps.findIndex(s => s.stepNumber === action.payload.stepNumber);
      let updatedSteps = [...state.completedSteps];
      
      if (existingIdx >= 0) {
        updatedSteps[existingIdx] = { ...updatedSteps[existingIdx], ...action.payload };
      } else {
        updatedSteps.push(action.payload);
      }

      return {
        ...state,
        completedSteps: updatedSteps
      };
    }

    case 'START_SCORING':
      return {
        ...state,
        currentState: KIOSK_STATES.SCORING,
        endTime: Date.now()
      };

    case 'SCORING_COMPLETE':
      return {
        ...state,
        currentState: KIOSK_STATES.FEEDBACK,
        finalScore: action.payload.score,
        completedSteps: action.payload.steps || state.completedSteps
      };

    case 'RESET_TO_IDLE':
      return {
        ...INITIAL_KIOSK_STATE
      };

    default:
      return state;
  }
}
