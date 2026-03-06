import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  detectMentalModel,
  getMentalModelPromptInjection,
  calculateScore,
  getScoringPromptInjection,
  buildNotificationPayload,
  sendTeamNotification,
  shouldSendNotification,
  type MentalModelProfile,
  type ScoringResult,
} from "@/lib/sofia";

const CAL_LINK = "https://cal.com/machine-mind/machinemind-strategy-session";

/**
 * Sofia's Master System Prompt
 * Combines base psychology with dynamic mental model + scoring injection
 */
function buildSystemPrompt(
  mentalModel: MentalModelProfile,
  score: ScoringResult,
  language: string,
): string {
  const mentalModelInjection = getMentalModelPromptInjection(mentalModel);
  const scoringInjection = getScoringPromptInjection(score);

  return `You are Sofia, MachineMind's elite AI sales closer. Your SINGLE MISSION is to get prospects to book a strategy call. Every message moves them toward clicking that calendar link.

${scoringInjection}

${mentalModelInjection}

## THE BOOKING LINK - USE IT CONSTANTLY
📅 ${CAL_LINK}

This is your #1 tool. Include it in almost every response. Make booking EASY.

## YOUR PSYCHOLOGY TOOLKIT

**1. PATTERN INTERRUPT**
Start differently than expected. Break autopilot thinking.
- Don't say "How can I help?"
- Instead: "Quick question - when a customer messages at 2am wanting to book, who answers?"

**2. PAIN AMPLIFICATION**
Make them FEEL the cost before offering solutions.
- "Every missed message is a customer choosing your competitor"
- "That 2am inquiry? They booked somewhere else by 8am"
- Calculate losses: "4 missed/week × $150 avg = $2,400/month you're not seeing"

**3. FUTURE PACING**
Help them visualize the after state:
- "Imagine waking up to 3 new bookings that came in while you slept"
- "Picture never missing another inquiry, ever"

**4. SOCIAL PROOF (Specific beats general)**
- "Osaka Nikkei increased reservations 40% in 60 days"
- "Four Seasons automates 80% of guest inquiries"
- "One boutique hotel recovered $8,000/month"

**5. SCARCITY & URGENCY**
- "We only take 3 new clients per month"
- "Every day without this is another day of lost revenue"

**6. THE BOOKING CLOSE**
- **Assumptive**: "Let's get you on the calendar: ${CAL_LINK}"
- **Choice**: "Would morning or afternoon work better?"
- **Summary**: "You're losing $X/month - the call is free: ${CAL_LINK}"

## CONVERSATION FLOW

**Gate 1 - DISCOVERY** (1-2 messages)
→ Hook with unexpected question about their business
→ What type of business?
→ After-hours inquiries?

**Gate 2 - QUALIFICATION** (3-4 messages)
→ Calculate their losses
→ "So you're potentially losing $X every month"
→ Build urgency

**Gate 3 - CLOSE** (5+ messages)
→ "15 minutes could solve this: ${CAL_LINK}"
→ Handle objections
→ Push for booking

## OBJECTION RESPONSES

**"How much does it cost?"**
→ "Great question - but first, how much is doing nothing costing you? Let's calculate on a quick call: ${CAL_LINK}"

**"I'll think about it"**
→ "Every day you wait is another day of missed revenue. The call is free, 15 min. What do you have to lose? ${CAL_LINK}"

**"We're too small"**
→ "Smaller businesses see the biggest impact. One solo owner recovered $3,000/month. Worth a 15-min call? ${CAL_LINK}"

**"I don't have time"**
→ "That's exactly why you need this - Sofia handles everything. 15 minutes now saves hours weekly: ${CAL_LINK}"

**"Send me information"**
→ "I could send a PDF you'll never read, OR 15 focused minutes showing YOUR specific opportunity. Which is more useful? ${CAL_LINK}"

## LANGUAGE RULES
- Respond in ${language === "es" ? "Spanish" : "English"} (match user's language)
- Keep messages SHORT - max 3-4 paragraphs
- Every message ends with a question OR the booking link
- Use emojis sparingly for warmth
- Be confident, not desperate
- NEVER apologize for following up

## YOUR MINDSET
You are NOT here to educate or provide free consulting.
You are here to QUALIFY and CLOSE.
Every question reveals pain or moves toward booking.
The free strategy call is where the real magic happens.

YOUR SUCCESS = BOOKED CALLS

Now go close.`;
}

// Extract business type from conversation
function extractBusinessType(
  messages: { role: string; content: string }[],
): string | undefined {
  const content = messages.map((m) => m.content.toLowerCase()).join(" ");

  if (content.match(/hotel|hostal|hospedaje/)) return "hotel";
  if (content.match(/restaurante|restaurant|café|bar/)) return "restaurant";
  if (content.match(/tour|viaje|travel|excursion/)) return "tours";
  if (content.match(/villa|casa|airbnb|alquiler/)) return "vacation_rental";
  if (content.match(/club|disco|nightlife|fiesta/)) return "nightlife";
  if (content.match(/spa|wellness|belleza|salon/)) return "wellness";
  if (content.match(/yacht|boat|charter/)) return "charter";

  return undefined;
}

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const { messages, sessionId, language = "es" } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 },
      );
    }

    // Generate session ID if not provided
    const currentSessionId =
      sessionId ||
      `sofia_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // === PSYCHOLOGICAL ANALYSIS ===
    const mentalModel = detectMentalModel(messages);
    const score = calculateScore(messages);
    const businessType = extractBusinessType(messages);

    console.log(`[Sofia] Session ${currentSessionId.slice(0, 12)}...`);
    console.log(
      `[Sofia] Mental Model: ${mentalModel.type} (${mentalModel.confidence}%)`,
    );
    console.log(
      `[Sofia] Score: ${score.total}/100 (${score.quality}) - Gate ${score.gate}`,
    );
    console.log(`[Sofia] Recommendation: ${score.recommendation}`);

    // === NOTIFICATION CHECK ===
    const lastUserMessage = messages[messages.length - 1]?.content || "";
    if (shouldSendNotification(currentSessionId)) {
      const notificationPayload = buildNotificationPayload(
        currentSessionId,
        score,
        mentalModel,
        lastUserMessage,
        businessType,
      );

      if (notificationPayload) {
        // Non-blocking notification
        sendTeamNotification(notificationPayload).catch((err) =>
          console.error("[Sofia] Notification error:", err),
        );
      }
    }

    // Format messages for Claude API (keep last 10 for context)
    const formattedMessages = messages
      .slice(-10)
      .map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      }));

    // Build dynamic system prompt
    const systemPrompt = buildSystemPrompt(mentalModel, score, language);

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;

    let assistantMessage: string;

    if (!apiKey) {
      assistantMessage = getFallbackResponse(lastUserMessage, score, language);
    } else {
      // Call Claude API
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 800,
          system: systemPrompt,
          messages: formattedMessages,
        }),
      });

      if (!response.ok) {
        console.error("[Sofia] Claude API error:", await response.text());
        assistantMessage = getFallbackResponse(
          lastUserMessage,
          score,
          language,
        );
      } else {
        const data = await response.json();
        assistantMessage =
          data.content[0]?.text ||
          getFallbackResponse(lastUserMessage, score, language);
      }
    }

    // Track conversation in Supabase (non-blocking)
    trackConversation(
      currentSessionId,
      messages,
      assistantMessage,
      language,
      mentalModel,
      score,
      businessType,
    ).catch((err) => console.error("[Sofia] Tracking error:", err));

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      message: assistantMessage,
      sessionId: currentSessionId,
      score: score.total,
      quality: score.quality,
      gate: score.gate,
      recommendation: score.recommendation,
      mentalModel: mentalModel.type,
      mentalModelConfidence: mentalModel.confidence,
      processingTimeMs: processingTime,
    });
  } catch (error) {
    console.error("[Sofia] API error:", error);
    return NextResponse.json({
      message: `Looks like I hit a brief technical snag. But here's the thing - let's just hop on a quick call and I'll show you everything live: ${CAL_LINK}`,
      error: true,
    });
  }
}

// Track conversation in Supabase
async function trackConversation(
  sessionId: string,
  messages: { role: string; content: string }[],
  latestAssistantMessage: string,
  language: string,
  mentalModel: MentalModelProfile,
  score: ScoringResult,
  businessType?: string,
) {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      console.log("[Sofia] Supabase not configured, skipping tracking");
      return;
    }

    const supabase = createServiceClient();

    // Check for booking mention
    const bookedCall =
      latestAssistantMessage.toLowerCase().includes("cal.com") &&
      messages.some(
        (m) =>
          m.role === "user" &&
          (m.content.toLowerCase().includes("cal.com") ||
            m.content.toLowerCase().includes("agendar") ||
            m.content.toLowerCase().includes("book") ||
            m.content.toLowerCase().includes("schedule")),
      );

    // Upsert conversation with full analytics
    const { data: conversation, error: convError } = await supabase
      .from("sofia_conversations")
      .upsert(
        {
          session_id: sessionId,
          last_message_at: new Date().toISOString(),
          status: bookedCall ? "booked" : "active",
          lead_quality: score.quality,
          lead_info: {
            business_type: businessType,
            mental_model: mentalModel.type,
            mental_model_confidence: mentalModel.confidence,
            mental_model_signals: mentalModel.signals,
          },
          message_count: messages.length + 1,
          booked_call: bookedCall,
          language: language as "es" | "en",
          // New fields for analytics
          suitability_score: score.total,
          gate_reached: score.gate,
          score_breakdown: score.breakdown,
          detected_signals: score.signals,
          recommendation: score.recommendation,
        },
        { onConflict: "session_id" },
      )
      .select()
      .single();

    if (convError) {
      console.error("[Sofia] Error upserting conversation:", convError);
      return;
    }

    // Insert messages
    const latestUserMessage = messages[messages.length - 1];
    if (latestUserMessage && conversation) {
      // User message
      await supabase.from("sofia_messages").insert({
        conversation_id: conversation.id,
        role: "user",
        content: latestUserMessage.content,
        timestamp: new Date().toISOString(),
      });

      // Assistant message
      await supabase.from("sofia_messages").insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: latestAssistantMessage,
        timestamp: new Date().toISOString(),
        metadata: {
          score: score.total,
          gate: score.gate,
          mental_model: mentalModel.type,
        },
      });
    }
  } catch (err) {
    console.error("[Sofia] Tracking failed:", err);
  }
}

// Intelligent fallback responses based on score and context
function getFallbackResponse(
  userMessage: string,
  score: ScoringResult,
  language: string,
): string {
  const msg = userMessage.toLowerCase();
  const isSpanish = language === "es";

  // High score = aggressive close
  if (score.total >= 60) {
    return isSpanish
      ? `Perfecto - claramente tienes un negocio que se beneficiaría de nunca perder otra consulta.

Aquí está el trato: 15 minutos en una llamada y te mostraré exactamente cuánto estás perdiendo y cómo recuperarlo.

Sin compromiso. Sin presión. Solo claridad.

📅 ${CAL_LINK}

¿Cuándo te funciona mejor - mañana o más adelante esta semana?`
      : `Perfect - you clearly have a business that would benefit from never missing another inquiry.

Here's the deal: 15 minutes on a call and I'll show you exactly how much you're losing and how to recover it.

No commitment. No pressure. Just clarity.

📅 ${CAL_LINK}

When works better for you - tomorrow or later this week?`;
  }

  // Greeting
  if (msg.match(/^(hola|hello|hi|hey|buenos|good)/)) {
    return isSpanish
      ? `¡Hey! 👋 Pregunta rápida antes de empezar:

Cuando alguien le escribe a tu negocio a las 2am queriendo reservar... ¿quién responde?

Porque ahí es donde la mayoría pierde $2,000-4,000 al mes sin darse cuenta.

¿Qué tipo de negocio tienes?`
      : `Hey! 👋 Quick question before we dive in:

When someone messages your business at 2am wanting to book... who answers?

Because that's where most businesses lose $2,000-4,000/month without realizing it.

What type of business are you running?`;
  }

  // Price question
  if (msg.match(/(precio|price|cost|cuanto|how much|presupuesto|budget)/)) {
    return isSpanish
      ? `La pregunta real es: ¿cuánto te está costando NO hacer nada ahora mismo?

La mayoría de negocios como el tuyo pierden $2,400+/mes en consultas perdidas que ni siquiera saben.

Nuestras soluciones empiezan en $497/mes - eso es un ROI de 4-8x para la mayoría de clientes.

Pero no adivinemos. Agarra 15 minutos y calcularé TUS números específicos:
📅 ${CAL_LINK}`
      : `Here's the real question: how much is doing nothing costing you right now?

Most businesses like yours are losing $2,400+/month in missed inquiries they don't even know about.

Our solutions start at $497/month - that's a 4-8x ROI for most clients.

But let's not guess. Grab 15 minutes and I'll calculate YOUR specific numbers:
📅 ${CAL_LINK}`;
  }

  // Booking intent
  if (
    msg.match(
      /(demo|contacto|contact|llamada|call|reunión|meeting|agendar|schedule|book)/,
    )
  ) {
    return isSpanish
      ? `Perfecto - hagámoslo. 15 minutos, sin presión, y verás exactamente cómo funcionaría esto para tu negocio.

📅 ${CAL_LINK}

Escoge cualquier hora que te funcione y me aseguraré de que salgas con una imagen clara de lo que es posible.`
      : `Perfect - let's do it. 15 minutes, no pressure, and you'll see exactly how this would work for your business.

📅 ${CAL_LINK}

Pick any time that works and I'll make sure you leave with a clear picture of what's possible.`;
  }

  // Business type mentioned
  if (msg.match(/(hotel|restaurante|restaurant|tour|villa|negocio|business)/)) {
    return isSpanish
      ? `Perfecto - eso es exactamente con quien trabajamos.

Pregunta rápida: ¿qué pasa cuando alguien pregunta fuera de horario? ¿Esperan hasta mañana mientras tu competencia responde al instante?

Esa brecha usualmente vale $2,000-4,000/mes.

Veamos tu situación específica - 15 minutos, y sabrás exactamente lo que estás dejando en la mesa:
📅 ${CAL_LINK}`
      : `Perfect - that's exactly who we work with.

Quick question: what happens when someone inquires after hours? Do they wait until morning while your competitor responds instantly?

That gap is usually worth $2,000-4,000/month.

Let's look at your specific situation - 15 minutes, and you'll know exactly what you're leaving on the table:
📅 ${CAL_LINK}`;
  }

  // Default - lead with pain
  return isSpanish
    ? `Esto es lo que sé: negocios como el tuyo típicamente pierden $2,400+/mes por tiempos de respuesta lentos. Cada hora que pasa entre una consulta y tu respuesta, la probabilidad de convertir cae 50%.

Puedo arreglar eso con Sofia AI - respuestas instantáneas, 24/7, en su idioma.

Pero en vez de que yo explique, saltemos a una llamada rápida y te muestro:
📅 ${CAL_LINK}

¿Qué tipo de negocio tienes?`
    : `Here's what I know: businesses like yours typically lose $2,400+/month from slow response times. Every hour between an inquiry and your response, the conversion chance drops 50%.

I can fix that with Sofia AI - instant responses, 24/7, in their language.

But instead of me explaining, let's jump on a quick call and I'll show you:
📅 ${CAL_LINK}

What type of business are you running?`;
}
