/**
 * Sofia AI Sales System
 * Complete psychological sales engine for hospitality
 */

// Mental Models - 6 hospitality personas
export {
  type MentalModel,
  type MentalModelProfile,
  type MentalModelGuidance,
  MENTAL_MODEL_GUIDANCE,
  detectMentalModel,
  getMentalModelPromptInjection,
} from "./mentalModels";

// Scoring - Lead qualification
export {
  type LeadQuality,
  type Recommendation,
  type ScoreBreakdown,
  type ScoringResult,
  calculateScore,
  getScoringPromptInjection,
  shouldNotifyTeam,
} from "./scoring";

// Notifications - Team alerts
export {
  type NotificationPayload,
  sendTeamNotification,
  buildNotificationPayload,
  shouldSendNotification,
} from "./notifications";
