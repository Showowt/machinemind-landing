/**
 * Viceroy Private Capital Qualification System
 * Psychological alignment engine for private contractual participation
 */

// Investor Mental Models — 6 capital participant personas
export {
  type InvestorModel,
  type InvestorModelProfile,
  type InvestorModelGuidance,
  INVESTOR_MODEL_GUIDANCE,
  detectInvestorModel,
  getInvestorModelPromptInjection,
} from "./mentalModels";

// Alignment Scoring — Asset-based qualification
export {
  type AlignmentQuality,
  type AlignmentRecommendation,
  type AlignmentBreakdown,
  type AlignmentResult,
  calculateAlignmentScore,
  getAlignmentPromptInjection,
} from "./scoring";
