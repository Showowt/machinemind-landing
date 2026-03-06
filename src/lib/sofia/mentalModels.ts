/**
 * Sofia Hospitality Mental Models
 * 6 psychological personas for hospitality business owners
 * Adapted from Viceroy investor psychology to B2B SaaS sales
 */

export type MentalModel =
  | "hustler" // Bootstrapped entrepreneur, wears every hat
  | "delegator" // Has staff, wants hands-off solution
  | "skeptic" // Burned before, needs proof and guarantees
  | "visionary" // Sees tech as competitive advantage
  | "traditionalist" // "We've always done it this way"
  | "desperate"; // Losing money now, needs immediate solution

export interface MentalModelProfile {
  type: MentalModel;
  confidence: number; // 0-100
  signals: string[];
  lastUpdated: Date;
}

export interface MentalModelGuidance {
  type: MentalModel;
  coreDrive: string;
  fear: string;
  tone: string;
  keyPhrases: string[];
  avoid: string[];
  closeStrategy: string;
  objectionHandling: Record<string, string>;
}

/**
 * The 6 Hospitality Mental Models
 * Each requires a different sales approach
 */
export const MENTAL_MODEL_GUIDANCE: Record<MentalModel, MentalModelGuidance> = {
  hustler: {
    type: "hustler",
    coreDrive:
      "Time freedom - they're doing everything themselves and drowning",
    fear: "Losing control, being scammed, wasting money on another tool",
    tone: "Direct, empathetic, fellow-entrepreneur energy",
    keyPhrases: [
      "I get it - you're wearing 10 hats",
      "What if you could clone yourself for customer messages?",
      "Every hour you spend on messages is an hour not growing your business",
      "ROI in black and white",
      "Set it and forget it",
    ],
    avoid: ["enterprise", "scale", "team", "delegation"],
    closeStrategy:
      "Show exact time savings. Frame as buying back hours. Calculate their hourly rate vs Sofia's cost. 'If your time is worth $50/hour and Sofia saves you 2 hours/day, that's $3,000/month in time... for $497.'",
    objectionHandling: {
      "too expensive":
        "I hear you - every dollar counts when you're building. But here's the math: if Sofia converts just ONE extra booking per month, it pays for itself. Everything else is profit.",
      "no time to set up":
        "That's exactly why you need this. Setup is 30 minutes, then it runs forever. 30 minutes now vs hours every week - which sounds better?",
      "will it work for my business":
        "Let's find out in 15 minutes. I'll show you exactly how it would work for YOUR specific situation. No pressure, just clarity.",
    },
  },

  delegator: {
    type: "delegator",
    coreDrive: "Remove themselves from operations - want turnkey solution",
    fear: "Having to manage another system, more complexity",
    tone: "Professional, results-focused, minimal-effort emphasis",
    keyPhrases: [
      "We handle everything",
      "You'll get a monthly report - that's it",
      "Your team won't need to change anything",
      "White-glove setup",
      "Just review the results",
    ],
    avoid: ["DIY", "customize", "configure", "manage"],
    closeStrategy:
      "Emphasize that MachineMind handles everything. They just see results. Monthly reports, zero management. 'You'll literally forget Sofia exists until you see your booking numbers climb.'",
    objectionHandling: {
      "sounds like more work":
        "The opposite - Sofia REDUCES your workload. Setup is on us, and then it runs autonomously. You just cash the extra bookings.",
      "my staff handles this":
        "Perfect - now they can focus on high-value tasks while Sofia handles the 24/7 inquiry volume. Think of it as an extension of your team that never sleeps.",
      "need to check with team":
        "Absolutely. Usually takes 15 minutes to show the team how it works. Want me to set up a quick demo they can join?",
    },
  },

  skeptic: {
    type: "skeptic",
    coreDrive: "Proof and guarantees - burned by tech vendors before",
    fear: "Making another bad decision, wasting money, looking foolish",
    tone: "Transparent, data-driven, no hype, acknowledge skepticism",
    keyPhrases: [
      "Totally fair to be skeptical",
      "Here are the actual numbers",
      "We track every conversion",
      "No long-term contract",
      "See it working before you pay",
      "Real client, real results",
    ],
    avoid: [
      "trust me",
      "guaranteed",
      "amazing",
      "revolutionary",
      "excessive emojis",
    ],
    closeStrategy:
      "Lead with proof. Specific case studies with verifiable details. Offer pilot program or money-back guarantee. 'Start with 30 days. If you don't see results, you pay nothing.'",
    objectionHandling: {
      "heard this before":
        "I bet you have. Most AI tools overpromise. Here's what's different: we only work with hospitality. I can give you 5 references in your exact category. Want their numbers?",
      "show me proof":
        "Let me send you a case study from [similar business]. Real numbers, no fluff. Or better yet, let's do a 15-min demo and I'll show you the actual dashboard.",
      "what if it doesn't work":
        "Simple: you don't pay. We offer a 30-day pilot. If the numbers don't add up, walk away. No hard feelings.",
    },
  },

  visionary: {
    type: "visionary",
    coreDrive: "Competitive advantage - sees technology as differentiation",
    fear: "Being left behind, competitors getting ahead",
    tone: "Strategic, forward-looking, innovation-focused",
    keyPhrases: [
      "First-mover advantage",
      "Your competitors are still using humans",
      "Imagine being known as the place that ALWAYS responds",
      "Future-proof your business",
      "AI-native hospitality",
    ],
    avoid: ["basic", "simple", "just", "only"],
    closeStrategy:
      "Frame as competitive positioning. Show how AI differentiates them. 'While your competitors make people wait, you're closing bookings at 3am. That reputation compounds.'",
    objectionHandling: {
      "is this really new":
        "The technology? No. But using it strategically for hospitality conversion? That's what we've perfected. Our clients see 30-50% better conversion than industry average.",
      "will AI replace my staff":
        "No - it amplifies them. Your team handles VIP requests while Sofia handles volume. It's about leverage, not replacement.",
      "what about personalization":
        "Sofia learns your voice, your offers, your FAQs. Guests don't know they're talking to AI - they just know you respond instantly.",
    },
  },

  traditionalist: {
    type: "traditionalist",
    coreDrive: "Stability - doesn't want to change what works",
    fear: "Technology failing, losing personal touch, change",
    tone: "Respectful, gradual, emphasize human element",
    keyPhrases: [
      "Sofia supports your team, doesn't replace them",
      "Think of it as night shift coverage",
      "Your regulars still get the personal touch",
      "Start small, see the results",
      "Your values stay intact",
    ],
    avoid: ["disrupt", "transform", "revolutionize", "replace"],
    closeStrategy:
      "Position as enhancement, not replacement. Start with after-hours only. 'Sofia just handles the messages that would go unanswered anyway. Your team keeps doing what they do best.'",
    objectionHandling: {
      "we like the personal touch":
        "So do we - that's why Sofia handles the routine inquiries so your team can focus on memorable experiences. VIPs still get human attention.",
      "not ready for AI":
        "I understand. What if we just handled after-hours inquiries? The ones you're missing anyway? That's a safe way to test.",
      "my customers expect humans":
        "They expect fast, helpful responses. Sofia provides that 24/7. For complex requests, she hands off to your team seamlessly.",
    },
  },

  desperate: {
    type: "desperate",
    coreDrive: "Immediate survival - losing money NOW, need fast solution",
    fear: "Business failing, running out of time",
    tone: "Urgent but calm, solution-focused, fast action",
    keyPhrases: [
      "We can have you live in 48 hours",
      "Start recovering revenue this week",
      "Quick wins first",
      "Stop the bleeding",
      "Every day costs you money",
    ],
    avoid: ["long-term", "eventually", "phase 2", "roadmap"],
    closeStrategy:
      "Speed of implementation. Emphasize fast ROI. 'We'll have Sofia live by Friday. By next Monday, you'll be capturing inquiries you're losing today.'",
    objectionHandling: {
      "can't afford it":
        "Can you afford NOT to? You told me you're losing $X/month. Sofia costs a fraction of that. The math is clear - every day you wait, you lose more.",
      "don't have bandwidth":
        "That's exactly why we exist. Zero bandwidth needed from you. Point us at your WhatsApp/inbox and we handle the rest.",
      "need to think about it":
        "I understand. Quick question: what changes between now and next week? Because every day that passes is another $X lost. Let's get you live and THEN you can think about optimizations.",
    },
  },
};

/**
 * Detect mental model from conversation history
 * Returns the most likely model with confidence score
 */
export function detectMentalModel(
  messages: { role: string; content: string }[],
): MentalModelProfile {
  const userContent = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase())
    .join(" ");

  const scores: Record<MentalModel, { score: number; signals: string[] }> = {
    hustler: { score: 0, signals: [] },
    delegator: { score: 0, signals: [] },
    skeptic: { score: 0, signals: [] },
    visionary: { score: 0, signals: [] },
    traditionalist: { score: 0, signals: [] },
    desperate: { score: 0, signals: [] },
  };

  // Hustler signals
  if (userContent.match(/solo|myself|own|me\s+mismo|yo\s+hago|one person/)) {
    scores.hustler.score += 15;
    scores.hustler.signals.push("solo operator");
  }
  if (userContent.match(/time|tiempo|busy|ocupado|no puedo|overwhelm/)) {
    scores.hustler.score += 12;
    scores.hustler.signals.push("time-starved");
  }
  if (userContent.match(/bootstrap|small|peque[ñn]o|starting|empezando/)) {
    scores.hustler.score += 10;
    scores.hustler.signals.push("small/bootstrapped");
  }

  // Delegator signals
  if (userContent.match(/team|equipo|staff|personal|employees|empleados/)) {
    scores.delegator.score += 15;
    scores.delegator.signals.push("has team");
  }
  if (userContent.match(/manager|gerente|handle|manejen|automat/)) {
    scores.delegator.score += 12;
    scores.delegator.signals.push("wants delegation");
  }
  if (userContent.match(/dont want|no quiero|hands.?off|sin complicaciones/)) {
    scores.delegator.score += 10;
    scores.delegator.signals.push("hands-off preference");
  }

  // Skeptic signals
  if (
    userContent.match(/proof|prueba|guarantee|garant[ií]a|promise|promesas/)
  ) {
    scores.skeptic.score += 15;
    scores.skeptic.signals.push("wants proof");
  }
  if (userContent.match(/tried|probé|before|antes|didnt work|no funcion/)) {
    scores.skeptic.score += 15;
    scores.skeptic.signals.push("burned before");
  }
  if (userContent.match(/really|realmente|actually|de verdad|honest/)) {
    scores.skeptic.score += 8;
    scores.skeptic.signals.push("verification language");
  }

  // Visionary signals
  if (userContent.match(/tech|tecnolog|innovate|innova|ai|inteligencia/)) {
    scores.visionary.score += 15;
    scores.visionary.signals.push("tech-forward");
  }
  if (userContent.match(/compet|diferent|ahead|adelante|future|futuro/)) {
    scores.visionary.score += 12;
    scores.visionary.signals.push("competitive mindset");
  }
  if (userContent.match(/scale|escala|grow|crecer|expand/)) {
    scores.visionary.score += 10;
    scores.visionary.signals.push("growth-oriented");
  }

  // Traditionalist signals
  if (userContent.match(/always|siempre|years|años|tradition|personal touch/)) {
    scores.traditionalist.score += 15;
    scores.traditionalist.signals.push("tradition-oriented");
  }
  if (userContent.match(/change|cambio|concern|preocupa|careful|cuidado/)) {
    scores.traditionalist.score += 10;
    scores.traditionalist.signals.push("change-averse");
  }
  if (userContent.match(/loyal|leal|regulars|frequent|habituales/)) {
    scores.traditionalist.score += 8;
    scores.traditionalist.signals.push("relationship-focused");
  }

  // Desperate signals
  if (
    userContent.match(/urgent|urgente|now|ahora|asap|ya|immediately|inmediata/)
  ) {
    scores.desperate.score += 20;
    scores.desperate.signals.push("urgency language");
  }
  if (
    userContent.match(/losing|perdiendo|struggling|dif[ií]cil|crisis|problema/)
  ) {
    scores.desperate.score += 15;
    scores.desperate.signals.push("crisis language");
  }
  if (userContent.match(/save|salvar|help|ayuda|need|necesito/)) {
    scores.desperate.score += 10;
    scores.desperate.signals.push("help-seeking");
  }

  // Find highest scoring model
  let topModel: MentalModel = "hustler"; // default
  let topScore = 0;

  for (const [model, data] of Object.entries(scores)) {
    if (data.score > topScore) {
      topScore = data.score;
      topModel = model as MentalModel;
    }
  }

  // Calculate confidence (0-100)
  const confidence = Math.min(100, Math.round((topScore / 40) * 100));

  return {
    type: topModel,
    confidence,
    signals: scores[topModel].signals,
    lastUpdated: new Date(),
  };
}

/**
 * Get system prompt injection based on mental model
 */
export function getMentalModelPromptInjection(
  profile: MentalModelProfile,
): string {
  if (profile.confidence < 30) {
    return ""; // Not enough confidence to adapt
  }

  const guidance = MENTAL_MODEL_GUIDANCE[profile.type];

  return `
═══ DETECTED MENTAL MODEL: ${profile.type.toUpperCase()} (${profile.confidence}% confidence) ═══
Signals detected: ${profile.signals.join(", ")}

ADAPT YOUR APPROACH:
- Core drive: ${guidance.coreDrive}
- Their fear: ${guidance.fear}
- Your tone: ${guidance.tone}
- Use phrases like: "${guidance.keyPhrases.slice(0, 3).join('", "')}"
- AVOID: ${guidance.avoid.join(", ")}
- Close strategy: ${guidance.closeStrategy}

OBJECTION RESPONSES:
${Object.entries(guidance.objectionHandling)
  .map(([obj, response]) => `- "${obj}": ${response}`)
  .join("\n")}
═══════════════════════════════════════════════════════════════════
`;
}
