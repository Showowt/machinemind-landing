/**
 * Viceroy Lead Scoring System
 * Asset-based qualification scoring for private capital participants
 */

export type AlignmentQuality = "aligned" | "probable" | "exploring" | "misaligned";
export type AlignmentRecommendation =
  | "advance_to_assessment"
  | "deepen_conversation"
  | "nurture"
  | "graceful_exit";

export interface AlignmentBreakdown {
  assetCategory: number;
  decisionAuthority: number;
  structuralFit: number;
  psychologicalAlignment: number;
  engagement: number;
  assessmentIntent: number;
  redFlags: number;
}

export interface AlignmentResult {
  total: number; // 0-100
  quality: AlignmentQuality;
  recommendation: AlignmentRecommendation;
  breakdown: AlignmentBreakdown;
  signals: string[];
  gate: number; // 1-3
}

const ASSESSMENT_URL = "/viceroy/assess";

/**
 * Calculate alignment score from conversation
 */
export function calculateAlignmentScore(
  messages: { role: string; content: string }[],
): AlignmentResult {
  const userContent = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase())
    .join(" ");

  const messageCount = messages.filter((m) => m.role === "user").length;

  const breakdown: AlignmentBreakdown = {
    assetCategory: 0,
    decisionAuthority: 0,
    structuralFit: 0,
    psychologicalAlignment: 0,
    engagement: 0,
    assessmentIntent: 0,
    redFlags: 0,
  };

  const signals: string[] = [];

  // === ASSET CATEGORY SCORING ===
  if (userContent.match(/real estate|property|properties|equity|home|house|land/)) {
    breakdown.assetCategory += 20;
    signals.push("real estate equity");
  }
  if (userContent.match(/cd|certificate of deposit|certificates/)) {
    breakdown.assetCategory += 18;
    signals.push("CD accounts");
  }
  if (userContent.match(/cash|savings|liquid|reserves|bank/)) {
    breakdown.assetCategory += 15;
    signals.push("cash reserves");
  }
  if (userContent.match(/401k|401\(k\)|retirement|pension/)) {
    breakdown.assetCategory += 17;
    signals.push("401(k) accounts");
  }
  if (userContent.match(/sdira|self.?directed|ira/)) {
    breakdown.assetCategory += 20;
    signals.push("self-directed IRA");
  }
  if (userContent.match(/crypto|bitcoin|btc|ethereum|eth|digital asset/)) {
    breakdown.assetCategory += 16;
    signals.push("crypto holdings");
  }
  // Cap asset category at 25
  breakdown.assetCategory = Math.min(25, breakdown.assetCategory);

  // === DECISION AUTHORITY ===
  if (userContent.match(/i control|my decision|i decide|i manage|my own/)) {
    breakdown.decisionAuthority += 15;
    signals.push("direct decision authority");
  }
  if (userContent.match(/no advisor|no broker|myself|independently|self.?directed/)) {
    breakdown.decisionAuthority += 12;
    signals.push("independent decision maker");
  }
  if (userContent.match(/\$\d{3}k|\$\d{1,3},?\d{3},?\d{3}|million|200k|500k|equity/)) {
    breakdown.decisionAuthority += 10;
    signals.push("meaningful asset value");
  }

  // === STRUCTURAL FIT ===
  if (userContent.match(/private|contract|agreement|arrangement|participate|participation/)) {
    breakdown.structuralFit += 15;
    signals.push("private structure language");
  }
  if (userContent.match(/not stock|not market|alternative|outside|different/)) {
    breakdown.structuralFit += 12;
    signals.push("seeking non-securities structures");
  }
  if (userContent.match(/operational|demonstrated|proven|track record|performance/)) {
    breakdown.structuralFit += 10;
    signals.push("performance-based evaluation");
  }

  // === PSYCHOLOGICAL ALIGNMENT ===
  if (userContent.match(/operator|practical|hands.?on|builder|entrepreneur/)) {
    breakdown.psychologicalAlignment += 12;
    signals.push("operator mindset");
  }
  if (userContent.match(/reposition|deploy|productive|working|utilize/)) {
    breakdown.psychologicalAlignment += 10;
    signals.push("asset deployment orientation");
  }
  if (userContent.match(/structured|clear|transparent|straightforward|clean/)) {
    breakdown.psychologicalAlignment += 8;
    signals.push("clarity-seeking");
  }

  // === ENGAGEMENT ===
  if (messageCount >= 5) {
    breakdown.engagement = 15;
    signals.push("highly engaged (5+ messages)");
  } else if (messageCount >= 3) {
    breakdown.engagement = 10;
    signals.push("engaged (3-4 messages)");
  } else if (messageCount >= 2) {
    breakdown.engagement = 5;
    signals.push("initial engagement");
  }

  // === ASSESSMENT INTENT ===
  if (userContent.match(/assess|form|evaluate|apply|interested|sign up|next step/)) {
    breakdown.assessmentIntent = 20;
    signals.push("explicit assessment intent");
  } else if (userContent.match(/learn more|tell me|how do i|what's next|explore/)) {
    breakdown.assessmentIntent = 12;
    signals.push("information seeking");
  }

  // === RED FLAGS ===
  if (userContent.match(/return|percentage|yield|profit|how much.*make|roi/)) {
    breakdown.redFlags -= 10;
    signals.push("CAUTION: securities-framework language");
  }
  if (userContent.match(/financial advisor|broker|sec|finra|securities/)) {
    breakdown.redFlags -= 15;
    signals.push("CAUTION: securities industry orientation");
  }
  if (userContent.match(/guarantee|guaranteed|risk.?free|no risk|can't lose/)) {
    breakdown.redFlags -= 12;
    signals.push("CAUTION: unrealistic expectations");
  }
  if (userContent.match(/scam|fraud|ponzi|pyramid|illegal|report/)) {
    breakdown.redFlags -= 30;
    signals.push("RED FLAG: hostile/accusatory");
  }
  if (userContent.match(/student|research|paper|academic|project|homework/)) {
    breakdown.redFlags -= 20;
    signals.push("RED FLAG: non-participant");
  }

  // === TOTAL ===
  const total = Math.max(
    0,
    Math.min(
      100,
      breakdown.assetCategory +
        breakdown.decisionAuthority +
        breakdown.structuralFit +
        breakdown.psychologicalAlignment +
        breakdown.engagement +
        breakdown.assessmentIntent +
        breakdown.redFlags,
    ),
  );

  // === QUALITY ===
  let quality: AlignmentQuality;
  if (total >= 65) quality = "aligned";
  else if (total >= 40) quality = "probable";
  else if (total >= 20) quality = "exploring";
  else quality = "misaligned";

  // === RECOMMENDATION ===
  let recommendation: AlignmentRecommendation;
  if (total >= 65 || breakdown.assessmentIntent >= 15) {
    recommendation = "advance_to_assessment";
  } else if (total >= 40) {
    recommendation = "deepen_conversation";
  } else if (total >= 20) {
    recommendation = "nurture";
  } else {
    recommendation = "graceful_exit";
  }

  // === GATE ===
  let gate: number;
  if (messageCount <= 1) gate = 1;
  else if (messageCount <= 4) gate = 2;
  else gate = 3;

  return {
    total,
    quality,
    recommendation,
    breakdown,
    signals,
    gate,
  };
}

/**
 * Get scoring context for system prompt
 */
export function getAlignmentPromptInjection(result: AlignmentResult): string {
  const qualityIndicator = {
    aligned: "ALIGNED",
    probable: "PROBABLE",
    exploring: "EXPLORING",
    misaligned: "MISALIGNED",
  };

  const gateDescriptions = {
    1: "INTRODUCTION - Understand their asset situation and objectives",
    2: "ALIGNMENT - Assess structural and psychological fit",
    3: "ADVANCE - Guide to assessment form if aligned",
  };

  const recommendationActions = {
    advance_to_assessment: `GUIDE TO ASSESSMENT. They're aligned. Direct them: ${ASSESSMENT_URL}`,
    deepen_conversation: "Continue exploring their objectives and asset situation. Build clarity on structural fit.",
    nurture: "Answer questions, build understanding. Don't push the assessment yet.",
    graceful_exit: "Not aligned. Respectfully acknowledge and end the conversation efficiently.",
  };

  return `
═══ ALIGNMENT SCORE: ${result.total}/100 — ${qualityIndicator[result.quality]} ═══

CURRENT GATE: ${result.gate}/3 - ${gateDescriptions[result.gate as 1 | 2 | 3]}

SCORE BREAKDOWN:
- Asset Category: +${result.breakdown.assetCategory}
- Decision Authority: +${result.breakdown.decisionAuthority}
- Structural Fit: +${result.breakdown.structuralFit}
- Psychological Alignment: +${result.breakdown.psychologicalAlignment}
- Engagement: +${result.breakdown.engagement}
- Assessment Intent: +${result.breakdown.assessmentIntent}
- Red Flags: ${result.breakdown.redFlags}

SIGNALS: ${result.signals.join(" | ")}

YOUR MISSION: ${recommendationActions[result.recommendation]}
═══════════════════════════════════════════════════════════════════
`;
}
