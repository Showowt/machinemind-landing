/**
 * Viceroy Investor Mental Models
 * 6 psychological personas for private capital participants
 * Original Viceroy psychology — Sofia hospitality models were adapted FROM these
 */

export type InvestorModel =
  | "operator"       // Business owner, thinks in cash flow and control
  | "steward"        // Wealth preserver, family legacy focus
  | "opportunist"    // Actively hunting for better returns on idle capital
  | "disillusioned"  // Burned by markets/advisors, wants something different
  | "sovereign"      // Self-directed, hates middlemen, controls everything
  | "analytical";    // Engineer/professional, needs to understand the structure

export interface InvestorModelProfile {
  type: InvestorModel;
  confidence: number; // 0-100
  signals: string[];
  lastUpdated: Date;
}

export interface InvestorModelGuidance {
  type: InvestorModel;
  coreDrive: string;
  fear: string;
  tone: string;
  keyPhrases: string[];
  avoid: string[];
  alignmentStrategy: string;
  objectionHandling: Record<string, string>;
}

/**
 * The 6 Investor Mental Models
 * Each requires a different conversational approach
 */
export const INVESTOR_MODEL_GUIDANCE: Record<InvestorModel, InvestorModelGuidance> = {
  operator: {
    type: "operator",
    coreDrive: "Productive deployment of capital — wants assets working, not sitting",
    fear: "Idle money, missed opportunity cost, losing purchasing power to inflation",
    tone: "Direct, business-to-business, respect their operational intelligence",
    keyPhrases: [
      "You already think like someone who deploys capital productively",
      "This structure is built for people who understand cash flow",
      "Your assets should be working as hard as you do",
      "Private participation, structured like a business arrangement",
      "Operational performance, not market speculation",
    ],
    avoid: ["passive income", "investment returns", "yield", "portfolio"],
    alignmentStrategy:
      "Frame as a business arrangement between operators. They understand deal structure. Emphasize predictability, operational basis, and direct participation. Skip theory — go straight to structure.",
    objectionHandling: {
      "how does it work":
        "The structure is based on private contractual participation tied to demonstrated operational performance. The assessment form captures your objectives so we can determine alignment. It takes about 60 seconds.",
      "what are the returns":
        "We don't frame this in terms of projected returns — that's a securities framework. This is structured participation based on operational performance that's already been demonstrated. The assessment will show you if there's alignment with your objectives.",
      "sounds too good":
        "Fair. That's why we start with the assessment — it determines structural fit before anyone's time is committed. No pressure, just clarity on whether this aligns with how you deploy capital.",
    },
  },

  steward: {
    type: "steward",
    coreDrive: "Preservation and growth of family wealth across generations",
    fear: "Erosion, market volatility, losing what was built over decades",
    tone: "Measured, respectful, emphasize stability and proven track record",
    keyPhrases: [
      "Built on demonstrated performance, not projections",
      "Structured for predictability and capital preservation",
      "Private contractual arrangement — clean and clear",
      "Your legacy deserves a structure that respects what you've built",
      "Designed for people who think in decades, not quarters",
    ],
    avoid: ["aggressive", "high returns", "risk-reward", "growth play"],
    alignmentStrategy:
      "Emphasize proven operational basis, structural clarity, and long-term thinking. They care about what has been demonstrated, not what might happen. Position the assessment as a respectful, structured process.",
    objectionHandling: {
      "need to talk to my advisor":
        "Understandable. Keep in mind, this is structured as a private contractual arrangement, not a securities product — so it falls outside the typical advisory framework. The assessment will give you something concrete to evaluate.",
      "seems unfamiliar":
        "That's by design. The structure intentionally operates outside traditional securities frameworks. The 60-second assessment lets you see if the structure aligns with your preservation goals.",
      "how is this protected":
        "The structure is contractually clear and legally clean — private agreements rather than securities offerings. The assessment process exists specifically to ensure proper alignment before any participation.",
    },
  },

  opportunist: {
    type: "opportunist",
    coreDrive: "Maximizing idle capital — CDs, cash, equity sitting dormant",
    fear: "Missing out, assets depreciating, opportunity cost of doing nothing",
    tone: "Energetic but structured, respect their deal-hunting instincts",
    keyPhrases: [
      "Your capital is sitting idle while it could be participating",
      "CDs are paying you to wait — this is structured participation",
      "Every month your equity sits, that's unrealized productive capacity",
      "The assessment takes 60 seconds — just see if there's alignment",
      "Repositioning idle assets into structured participation",
    ],
    avoid: ["guaranteed", "safe bet", "no risk", "can't lose"],
    alignmentStrategy:
      "They're already looking. Don't oversell. Show them the assessment form quickly — they want to evaluate, not be pitched. Emphasize speed of the assessment process and structural clarity.",
    objectionHandling: {
      "what's the catch":
        "No catch — just structural alignment. The assessment determines if your asset type and objectives match the participation framework. If not, no time wasted.",
      "I've seen things like this":
        "This is deliberately different from securities-based structures. Private contractual participation based on operational performance that's already demonstrated. The assessment will make the distinction clear.",
      "send me more info":
        "The assessment IS the info. 60 seconds, you tell us your objectives and asset types, and we determine alignment. It's the most efficient way to see if this fits.",
    },
  },

  disillusioned: {
    type: "disillusioned",
    coreDrive: "Finding something that actually works after being burned",
    fear: "Being fooled again, another empty promise, losing more",
    tone: "Transparent, empathetic, validate their experience, no hype",
    keyPhrases: [
      "You've probably been promised things before — we don't do that",
      "This is based on what's already been demonstrated, not projected",
      "No projections, no speculation, no market timing",
      "The structure speaks for itself — that's why the assessment exists",
      "Private agreements, not securities frameworks that failed you",
    ],
    avoid: ["trust me", "once in a lifetime", "exclusive", "guaranteed", "amazing"],
    alignmentStrategy:
      "Lead with structure, not promises. Validate their skepticism. The assessment form is actually perfect for this persona — it lets THEM express objectives first, removing the sales pressure dynamic.",
    objectionHandling: {
      "been burned before":
        "That's exactly why this structure exists outside traditional markets. No projections, no speculation. Private contractual participation tied to demonstrated operational performance. The assessment lets you evaluate without any commitment.",
      "how is this different":
        "Securities products are built on projections and market speculation. This is built on operational performance that's already been demonstrated. Private agreements, not public instruments. The structural difference is fundamental.",
      "I don't trust anyone":
        "Healthy. The assessment process exists so you can evaluate the structure on your own terms. No pressure, no follow-up unless you request it. 60 seconds, then you decide.",
    },
  },

  sovereign: {
    type: "sovereign",
    coreDrive: "Complete control — hates middlemen, brokers, advisors taking a cut",
    fear: "Loss of control, being dependent on institutions, hidden fees",
    tone: "Peer-to-peer, autonomous, emphasize direct participation and control",
    keyPhrases: [
      "Direct participation — no brokers, no middlemen",
      "You maintain authority over your assets and decisions",
      "Private contractual arrangement — you and the structure, nothing in between",
      "Self-directed individuals are exactly who this was built for",
      "Your self-directed IRA or assets, your decision, your participation",
    ],
    avoid: ["we'll handle it", "leave it to us", "our team manages", "advisory"],
    alignmentStrategy:
      "Emphasize their autonomy. The assessment form IS their decision-making tool — they provide their objectives, they evaluate. No gatekeepers. Frame the entire process as self-directed evaluation.",
    objectionHandling: {
      "who controls the money":
        "You control your assets. The structure is a private contractual arrangement — participation, not delegation. The assessment outlines exactly how authority works within the framework.",
      "I don't use advisors":
        "This isn't advisory. It's direct contractual participation. No middlemen, no brokers. The assessment takes 60 seconds and you determine alignment yourself.",
      "what are the fees":
        "This isn't a fee-based structure like securities products. It's private contractual participation. The assessment will clarify the structural mechanics so you can evaluate directly.",
    },
  },

  analytical: {
    type: "analytical",
    coreDrive: "Understanding the mechanics before committing anything",
    fear: "Not understanding what they're getting into, hidden complexity",
    tone: "Precise, structural, detailed without being salesy",
    keyPhrases: [
      "The structure is intentionally transparent and contractually clear",
      "Based on demonstrated operational models, not projections",
      "Private contractual framework with defined participation mechanics",
      "The assessment captures your specific questions and objectives",
      "Structural compatibility is determined before any conversation",
    ],
    avoid: ["just trust the process", "don't overthink it", "everyone's doing it", "easy money"],
    alignmentStrategy:
      "They need to understand. Don't rush them. The assessment form gives them a structured way to engage. Emphasize the legal clarity, the contractual basis, and the operational foundation. Let the structure sell itself.",
    objectionHandling: {
      "I need to understand everything first":
        "Absolutely. The assessment is step one — it captures your objectives and questions so the structural details can be addressed specifically to your situation. 60 seconds to start that process.",
      "is this regulated":
        "The structure is deliberately designed as private contractual participation, not a securities offering. It operates outside securities regulatory frameworks by design. The assessment will help you evaluate the structural basis.",
      "what's the legal structure":
        "Private contractual agreements tied to demonstrated operational performance. The assessment captures your objectives, and if there's alignment, the full structural details are provided. Clean, documented, and legally clear.",
    },
  },
};

/**
 * Detect investor mental model from conversation
 */
export function detectInvestorModel(
  messages: { role: string; content: string }[],
): InvestorModelProfile {
  const userContent = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase())
    .join(" ");

  const scores: Record<InvestorModel, { score: number; signals: string[] }> = {
    operator: { score: 0, signals: [] },
    steward: { score: 0, signals: [] },
    opportunist: { score: 0, signals: [] },
    disillusioned: { score: 0, signals: [] },
    sovereign: { score: 0, signals: [] },
    analytical: { score: 0, signals: [] },
  };

  // Operator signals
  if (userContent.match(/business|negocio|company|empresa|own|revenue|cash flow/)) {
    scores.operator.score += 15;
    scores.operator.signals.push("business-owner language");
  }
  if (userContent.match(/deploy|put to work|productive|working capital|idle/)) {
    scores.operator.score += 15;
    scores.operator.signals.push("capital deployment mindset");
  }
  if (userContent.match(/deal|structure|arrangement|terms|contract/)) {
    scores.operator.score += 10;
    scores.operator.signals.push("deal-oriented");
  }

  // Steward signals
  if (userContent.match(/family|legacy|children|generation|preserve|protect/)) {
    scores.steward.score += 18;
    scores.steward.signals.push("legacy/family focus");
  }
  if (userContent.match(/safe|stable|reliable|consistent|steady|conservative/)) {
    scores.steward.score += 12;
    scores.steward.signals.push("stability-oriented");
  }
  if (userContent.match(/long.?term|decades|retirement|estate/)) {
    scores.steward.score += 10;
    scores.steward.signals.push("long-term horizon");
  }

  // Opportunist signals
  if (userContent.match(/cd|certificate|savings|sitting|dormant|idle cash/)) {
    scores.opportunist.score += 18;
    scores.opportunist.signals.push("idle asset awareness");
  }
  if (userContent.match(/better|more|opportunity|looking for|searching|exploring/)) {
    scores.opportunist.score += 12;
    scores.opportunist.signals.push("actively searching");
  }
  if (userContent.match(/reposition|move|shift|redirect|deploy|put/)) {
    scores.opportunist.score += 10;
    scores.opportunist.signals.push("repositioning intent");
  }

  // Disillusioned signals
  if (userContent.match(/burned|lost|bad experience|scam|didn't work|failed/)) {
    scores.disillusioned.score += 20;
    scores.disillusioned.signals.push("negative past experience");
  }
  if (userContent.match(/market crash|2008|downturn|volatil|advisor.*wrong/)) {
    scores.disillusioned.score += 15;
    scores.disillusioned.signals.push("market trauma");
  }
  if (userContent.match(/skeptic|doubt|careful|cautious|wary|suspicious/)) {
    scores.disillusioned.score += 12;
    scores.disillusioned.signals.push("cautious language");
  }

  // Sovereign signals
  if (userContent.match(/self.?directed|sdira|my own|i control|i decide|i manage/)) {
    scores.sovereign.score += 20;
    scores.sovereign.signals.push("self-directed orientation");
  }
  if (userContent.match(/no broker|no advisor|no middleman|direct|myself/)) {
    scores.sovereign.score += 15;
    scores.sovereign.signals.push("anti-intermediary");
  }
  if (userContent.match(/crypto|bitcoin|btc|eth|defi|decentralized/)) {
    scores.sovereign.score += 12;
    scores.sovereign.signals.push("crypto/decentralization affinity");
  }

  // Analytical signals
  if (userContent.match(/how does|explain|understand|mechanics|structure|detail/)) {
    scores.analytical.score += 15;
    scores.analytical.signals.push("understanding-seeking");
  }
  if (userContent.match(/legal|compliance|regulation|contract|documentation/)) {
    scores.analytical.score += 15;
    scores.analytical.signals.push("legal/structural focus");
  }
  if (userContent.match(/data|numbers|track record|evidence|performance|history/)) {
    scores.analytical.score += 12;
    scores.analytical.signals.push("evidence-oriented");
  }

  // Find highest scoring model
  let topModel: InvestorModel = "operator";
  let topScore = 0;

  for (const [model, data] of Object.entries(scores)) {
    if (data.score > topScore) {
      topScore = data.score;
      topModel = model as InvestorModel;
    }
  }

  const confidence = Math.min(100, Math.round((topScore / 40) * 100));

  return {
    type: topModel,
    confidence,
    signals: scores[topModel].signals,
    lastUpdated: new Date(),
  };
}

/**
 * Get system prompt injection for investor mental model
 */
export function getInvestorModelPromptInjection(
  profile: InvestorModelProfile,
): string {
  if (profile.confidence < 25) {
    return "";
  }

  const guidance = INVESTOR_MODEL_GUIDANCE[profile.type];

  return `
═══ DETECTED INVESTOR PROFILE: ${profile.type.toUpperCase()} (${profile.confidence}% confidence) ═══
Signals: ${profile.signals.join(", ")}

ADAPT YOUR APPROACH:
- Core drive: ${guidance.coreDrive}
- Their fear: ${guidance.fear}
- Your tone: ${guidance.tone}
- Use phrases like: "${guidance.keyPhrases.slice(0, 3).join('", "')}"
- AVOID: ${guidance.avoid.join(", ")}
- Alignment strategy: ${guidance.alignmentStrategy}

OBJECTION RESPONSES:
${Object.entries(guidance.objectionHandling)
  .map(([obj, response]) => `- "${obj}": ${response}`)
  .join("\n")}
═══════════════════════════════════════════════════════════════════
`;
}
