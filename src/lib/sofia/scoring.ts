/**
 * Sofia Lead Scoring System
 * Real-time suitability scoring for hospitality prospects
 */

export type LeadQuality = "hot" | "warm" | "cold" | "unqualified";
export type Recommendation =
  | "close_now"
  | "book_call"
  | "nurture"
  | "disqualify";

export interface ScoreBreakdown {
  businessType: number;
  painLevel: number;
  urgency: number;
  budget: number;
  engagement: number;
  bookingIntent: number;
  redFlags: number;
}

export interface ScoringResult {
  total: number; // 0-100
  quality: LeadQuality;
  recommendation: Recommendation;
  breakdown: ScoreBreakdown;
  signals: string[];
  gate: number; // 1-3 qualification gate
}

const CAL_LINK = "https://cal.com/machine-mind/machinemind-strategy-session";

/**
 * Calculate lead score from conversation
 */
export function calculateScore(
  messages: { role: string; content: string }[],
): ScoringResult {
  const userContent = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase())
    .join(" ");

  const messageCount = messages.filter((m) => m.role === "user").length;

  const breakdown: ScoreBreakdown = {
    businessType: 0,
    painLevel: 0,
    urgency: 0,
    budget: 0,
    engagement: 0,
    bookingIntent: 0,
    redFlags: 0,
  };

  const signals: string[] = [];

  // === BUSINESS TYPE SCORING ===
  // Higher value = higher score
  if (userContent.match(/hotel|resort|boutique hotel|all.?inclusive/)) {
    breakdown.businessType = 20;
    signals.push("hotel (high-value)");
  } else if (userContent.match(/villa|vacation rental|airbnb|alquiler/)) {
    breakdown.businessType = 18;
    signals.push("vacation rental");
  } else if (userContent.match(/tour|excursion|adventure|boat|yacht|charter/)) {
    breakdown.businessType = 17;
    signals.push("tours/experiences");
  } else if (userContent.match(/restaurante|restaurant|bar|club|nightlife/)) {
    breakdown.businessType = 15;
    signals.push("restaurant/nightlife");
  } else if (userContent.match(/spa|wellness|salon|beauty|clinic/)) {
    breakdown.businessType = 14;
    signals.push("wellness/beauty");
  } else if (userContent.match(/negocio|business|empresa|company/)) {
    breakdown.businessType = 10;
    signals.push("general business");
  }

  // === PAIN LEVEL SCORING ===
  // More pain = more likely to buy
  if (userContent.match(/losing|perdiendo|miss|pierdo|lost|perdido/)) {
    breakdown.painLevel += 12;
    signals.push("acknowledges lost revenue");
  }
  if (userContent.match(/2am|3am|night|noche|madrugada|after.?hours/)) {
    breakdown.painLevel += 10;
    signals.push("after-hours pain point");
  }
  if (
    userContent.match(/overwhelm|can't keep up|no puedo|too many|demasiado/)
  ) {
    breakdown.painLevel += 10;
    signals.push("overwhelmed");
  }
  if (userContent.match(/slow|lento|late|tarde|delay|demora/)) {
    breakdown.painLevel += 8;
    signals.push("slow response issue");
  }
  if (userContent.match(/competi|competidor|losing to|perdiendo ante/)) {
    breakdown.painLevel += 8;
    signals.push("competitor pressure");
  }

  // === URGENCY SCORING ===
  if (userContent.match(/now|ahora|today|hoy|asap|urgente|immediate/)) {
    breakdown.urgency += 15;
    signals.push("high urgency");
  }
  if (userContent.match(/soon|pronto|this week|esta semana|quick/)) {
    breakdown.urgency += 10;
    signals.push("medium urgency");
  }
  if (userContent.match(/season|temporada|busy period|peak/)) {
    breakdown.urgency += 8;
    signals.push("seasonal pressure");
  }

  // === BUDGET SIGNALS ===
  if (
    userContent.match(/budget|presupuesto|invest|inverti|ready to|listo para/)
  ) {
    breakdown.budget += 12;
    signals.push("budget language");
  }
  if (userContent.match(/\$[5-9]\d{2}|\$1[0-9]{3}|mil|thousand/)) {
    breakdown.budget += 15;
    signals.push("realistic budget range");
  }
  if (userContent.match(/roi|return|recuperar|worth it|vale la pena/)) {
    breakdown.budget += 10;
    signals.push("ROI-focused");
  }

  // === ENGAGEMENT SCORING ===
  // More messages = more engaged
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

  // === BOOKING INTENT ===
  if (userContent.match(/cal\.com|agendar|schedule|book.*call|llamada/)) {
    breakdown.bookingIntent = 20;
    signals.push("explicit booking intent");
  } else if (userContent.match(/demo|mostrar|show me|enseñ|meeting|reunión/)) {
    breakdown.bookingIntent = 15;
    signals.push("demo interest");
  } else if (userContent.match(/how does|como funciona|tell me|cuéntame/)) {
    breakdown.bookingIntent = 8;
    signals.push("information seeking");
  }

  // === RED FLAGS (Negative) ===
  if (userContent.match(/free|gratis|no pay|sin pagar|cheap|barato/)) {
    breakdown.redFlags -= 15;
    signals.push("RED FLAG: price sensitivity");
  }
  if (
    userContent.match(/just looking|solo mirando|not sure|no sé|maybe|quizás/)
  ) {
    breakdown.redFlags -= 8;
    signals.push("RED FLAG: low commitment");
  }
  if (
    userContent.match(
      /student|estudiante|project|proyecto|research|investigación/,
    )
  ) {
    breakdown.redFlags -= 20;
    signals.push("RED FLAG: likely not buyer");
  }
  if (userContent.match(/spam|scam|estafa|fake|falso/)) {
    breakdown.redFlags -= 30;
    signals.push("RED FLAG: hostile");
  }

  // === CALCULATE TOTAL ===
  const total = Math.max(
    0,
    Math.min(
      100,
      breakdown.businessType +
        breakdown.painLevel +
        breakdown.urgency +
        breakdown.budget +
        breakdown.engagement +
        breakdown.bookingIntent +
        breakdown.redFlags,
    ),
  );

  // === DETERMINE QUALITY ===
  let quality: LeadQuality;
  if (total >= 70) {
    quality = "hot";
  } else if (total >= 45) {
    quality = "warm";
  } else if (total >= 20) {
    quality = "cold";
  } else {
    quality = "unqualified";
  }

  // === DETERMINE RECOMMENDATION ===
  let recommendation: Recommendation;
  if (total >= 70 || breakdown.bookingIntent >= 15) {
    recommendation = "close_now";
  } else if (total >= 45) {
    recommendation = "book_call";
  } else if (total >= 20) {
    recommendation = "nurture";
  } else {
    recommendation = "disqualify";
  }

  // === DETERMINE GATE ===
  let gate: number;
  if (messageCount <= 1) {
    gate = 1; // Discovery
  } else if (messageCount <= 4) {
    gate = 2; // Qualification
  } else {
    gate = 3; // Close
  }

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
export function getScoringPromptInjection(result: ScoringResult): string {
  const qualityEmoji = {
    hot: "🔥",
    warm: "🟡",
    cold: "🔵",
    unqualified: "⚪",
  };

  const gateDescriptions = {
    1: "DISCOVERY - Identify business type and pain points",
    2: "QUALIFICATION - Assess urgency, budget signals, fit",
    3: "CLOSE - Push for booking, handle objections, close",
  };

  const recommendationActions = {
    close_now: `PUSH HARD FOR BOOKING NOW. They're ready. Link: ${CAL_LINK}`,
    book_call: `Guide toward booking. Build more urgency. Link: ${CAL_LINK}`,
    nurture:
      "Build rapport, identify specific pain points, don't push too hard yet",
    disqualify: "Politely wrap up, this is not a fit. Don't waste time.",
  };

  return `
═══ LEAD SCORE: ${result.total}/100 ${qualityEmoji[result.quality]} ${result.quality.toUpperCase()} ═══

CURRENT GATE: ${result.gate}/3 - ${gateDescriptions[result.gate as 1 | 2 | 3]}

SCORE BREAKDOWN:
- Business Type: +${result.breakdown.businessType}
- Pain Level: +${result.breakdown.painLevel}
- Urgency: +${result.breakdown.urgency}
- Budget Signals: +${result.breakdown.budget}
- Engagement: +${result.breakdown.engagement}
- Booking Intent: +${result.breakdown.bookingIntent}
- Red Flags: ${result.breakdown.redFlags}

SIGNALS: ${result.signals.join(" | ")}

YOUR MISSION: ${recommendationActions[result.recommendation]}
═══════════════════════════════════════════════════════════════════
`;
}

/**
 * Determine if we should notify the team
 */
export function shouldNotifyTeam(result: ScoringResult): {
  notify: boolean;
  type: "whale" | "hot_lead" | "escalation_ready" | null;
  urgency: "critical" | "high" | "medium" | null;
} {
  // Hot lead with high score
  if (result.total >= 75) {
    return { notify: true, type: "hot_lead", urgency: "high" };
  }

  // Explicit booking intent at any score
  if (result.breakdown.bookingIntent >= 15) {
    return { notify: true, type: "escalation_ready", urgency: "high" };
  }

  // High engagement + warm score
  if (result.gate >= 3 && result.total >= 50) {
    return { notify: true, type: "escalation_ready", urgency: "medium" };
  }

  return { notify: false, type: null, urgency: null };
}
