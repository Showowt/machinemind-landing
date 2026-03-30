import { NextResponse } from "next/server";
import {
  detectInvestorModel,
  getInvestorModelPromptInjection,
  calculateAlignmentScore,
  getAlignmentPromptInjection,
  type InvestorModelProfile,
  type AlignmentResult,
} from "@/lib/viceroy";

const ASSESSMENT_URL = "/viceroy/assess";

/**
 * Viceroy Sofia System Prompt
 * Qualification AI for private capital participation
 */
function buildViceroySystemPrompt(
  investorModel: InvestorModelProfile,
  alignment: AlignmentResult,
): string {
  const modelInjection = getInvestorModelPromptInjection(investorModel);
  const alignmentInjection = getAlignmentPromptInjection(alignment);

  return `You are the Viceroy qualification assistant. Your purpose is to have a structured conversation that determines whether an individual is structurally and psychologically aligned with private contractual participation.

${alignmentInjection}

${modelInjection}

## YOUR ROLE

You are NOT selling. You are NOT pitching. You are qualifying.

Your job is to determine:
1. What type of assets does this person control? (real estate equity, CDs, cash reserves, 401k, self-directed IRA, crypto)
2. Do they have direct authority over those assets?
3. Are they comfortable with private contractual arrangements vs securities-based structures?
4. Do they think like an operator or a spectator?

## THE ASSESSMENT FORM
When alignment is detected, guide them to: ${ASSESSMENT_URL}
The assessment takes 60 seconds. It captures their objectives and asset situation.

## CONVERSATION FRAMEWORK

**Gate 1 — INTRODUCTION** (1-2 messages)
Understand their current situation. What assets do they hold? What are they looking to accomplish?
- "What type of assets are you currently working with?"
- "What would you like those assets to be doing that they're not doing now?"

**Gate 2 — ALIGNMENT** (3-4 messages)
Assess structural and psychological fit.
- Do they control decisions directly?
- Are they comfortable with private agreements?
- Do they evaluate based on demonstrated performance vs projections?

**Gate 3 — ADVANCE** (5+ messages)
If aligned: direct to assessment form.
If not aligned: respectfully acknowledge the mismatch.

## LANGUAGE RULES — CRITICAL

NEVER use these terms:
- Investment, returns, yield, ROI, profit, percentage, projections
- Securities, stocks, bonds, annuities
- Guaranteed, risk-free, safe bet

ALWAYS use these terms:
- Private contractual participation
- Capital participation structure
- Asset repositioning
- Structured income participation
- Demonstrated operational performance
- Direct participation

## TONE
- Measured, confident, structural
- Not salesy — conversational and clear
- Respect their intelligence and autonomy
- Let them express their objectives first
- Be precise, not promotional

## RESPONSES
- Keep messages concise — 2-3 paragraphs maximum
- Every response either asks a qualifying question or guides to assessment
- Never over-explain the structure in chat — that's what the assessment process is for
- If someone uses securities language, gently redirect to participation framework

Now qualify.`;
}

/**
 * Fallback responses when API key not available
 */
function getViceroyFallback(
  userMessage: string,
  alignment: AlignmentResult,
): string {
  const msg = userMessage.toLowerCase();

  if (alignment.total >= 60) {
    return `Based on what you've described, there appears to be structural alignment with the participation framework.

The next step is straightforward — the 60-second assessment captures your specific objectives and asset situation so we can determine proper fit.

Would you like to proceed with the assessment?`;
  }

  if (msg.match(/^(hello|hi|hey|good|greetings)/)) {
    return `Welcome. I'm here to help determine whether there's alignment between your current asset situation and our private participation structure.

To start — what type of assets are you currently managing? This helps me understand whether the structure may be relevant to your objectives.`;
  }

  if (msg.match(/real estate|property|home|equity/)) {
    return `Real estate equity is one of the primary asset categories that aligns well with this structure — particularly when the individual has direct authority over positioning decisions.

How much equity are you working with, and is this something you have sole decision authority over?`;
  }

  if (msg.match(/cd|certificate|savings|cash|bank/)) {
    return `Cash reserves and CD accounts are often the most directly repositionable assets, which makes them structurally compatible with private participation.

Are these assets currently producing at a level that matches your objectives, or are you exploring ways to deploy them more productively?`;
  }

  if (msg.match(/401k|ira|retirement|self.?directed|crypto/)) {
    return `Self-directed accounts and crypto holdings are particularly aligned with this structure because the individual maintains direct control and decision authority.

Are your accounts self-directed, or are they currently managed through a traditional custodian?`;
  }

  if (msg.match(/how|what|explain|tell me/)) {
    return `The structure is built around private contractual participation tied to demonstrated operational performance — not securities, not market speculation, not projections.

Rather than explaining the mechanics in chat, the most efficient path is the 60-second assessment. It captures your objectives and asset situation so alignment can be properly evaluated.

What type of assets are you currently working with?`;
  }

  return `I appreciate your interest. The participation structure is designed for individuals who control deployable assets directly — real estate equity, CDs, cash reserves, retirement accounts, or crypto.

To determine alignment, I need to understand two things:
1. What type of assets are you working with?
2. What would you like those assets to accomplish that they're not accomplishing now?`;
}

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const { messages, sessionId } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array required" },
        { status: 400 },
      );
    }

    const currentSessionId =
      sessionId ||
      `viceroy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Psychological analysis
    const investorModel = detectInvestorModel(messages);
    const alignment = calculateAlignmentScore(messages);

    console.log(`[Viceroy] Session ${currentSessionId.slice(0, 12)}...`);
    console.log(`[Viceroy] Investor Model: ${investorModel.type} (${investorModel.confidence}%)`);
    console.log(`[Viceroy] Alignment: ${alignment.total}/100 (${alignment.quality}) - Gate ${alignment.gate}`);

    const lastUserMessage = messages[messages.length - 1]?.content || "";
    let assistantMessage: string;

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      assistantMessage = getViceroyFallback(lastUserMessage, alignment);
    } else {
      const systemPrompt = buildViceroySystemPrompt(investorModel, alignment);
      const formattedMessages = messages.slice(-10).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 600,
          system: systemPrompt,
          messages: formattedMessages,
        }),
      });

      if (!response.ok) {
        console.error("[Viceroy] Claude API error:", await response.text());
        assistantMessage = getViceroyFallback(lastUserMessage, alignment);
      } else {
        const data = await response.json();
        assistantMessage =
          data.content[0]?.text ||
          getViceroyFallback(lastUserMessage, alignment);
      }
    }

    return NextResponse.json({
      message: assistantMessage,
      sessionId: currentSessionId,
      alignmentScore: alignment.total,
      quality: alignment.quality,
      gate: alignment.gate,
      recommendation: alignment.recommendation,
      investorModel: investorModel.type,
      investorModelConfidence: investorModel.confidence,
      processingTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error("[Viceroy] API error:", error);
    return NextResponse.json({
      message: "I appreciate your interest. To get started, the 60-second assessment is the most efficient way to determine alignment. What type of assets are you currently working with?",
      error: true,
    });
  }
}
