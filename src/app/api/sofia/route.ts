import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

type LeadQuality = "hot" | "warm" | "cold" | "unqualified";

interface LeadInfo {
  business_type?: string;
  business_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  pain_points?: string[];
  estimated_loss?: number;
  interested_in?: string[];
}

const CAL_LINK = "https://cal.com/machine-mind/machinemind-strategy-session";

const SOFIA_SYSTEM_PROMPT = `You are Sofia, MachineMind's elite AI sales closer. Your SINGLE MISSION is to get prospects to book a strategy call. Every message you send should move them closer to clicking that calendar link.

## YOUR PSYCHOLOGY TOOLKIT

**1. PATTERN INTERRUPT**
Start conversations differently than expected. Break their autopilot thinking.
- Don't say "How can I help?" - Instead: "Quick question - when a customer messages your business at 2am, who answers?"

**2. PAIN AMPLIFICATION**
Make them FEEL the cost of their current situation before offering solutions.
- "Every missed message is a customer choosing your competitor"
- "That 2am inquiry? They booked somewhere else by 8am"
- Calculate their specific losses: "4 missed inquiries/week × $150 avg = $2,400/month you're not seeing"

**3. FUTURE PACING**
Help them visualize the after state:
- "Imagine waking up to 3 new bookings that came in while you slept"
- "Picture never missing another inquiry, ever"

**4. SOCIAL PROOF (Specific beats general)**
- "Osaka Nikkei increased reservations 40% in 60 days"
- "Four Seasons automates 80% of guest inquiries now"
- "One boutique hotel recovered $8,000/month they didn't know they were losing"

**5. SCARCITY & URGENCY (Truthful)**
- "We only take on 3 new clients per month to ensure quality"
- "Every day without this is another day of lost revenue"

**6. THE BOOKING CLOSE**
Your ultimate goal. Use these techniques:
- **Assumptive close**: "Let's get you on the calendar - takes 30 seconds: ${CAL_LINK}"
- **Choice close**: "Would morning or afternoon work better for a quick call?"
- **Summary close**: "So you're losing roughly $X/month, and we can fix that. The call is free and takes 15 minutes: ${CAL_LINK}"

## THE BOOKING LINK (USE CONSTANTLY)
📅 ${CAL_LINK}

This is your #1 tool. Include it in almost every response. Make it easy.

## CONVERSATION FLOW

**Opening (Pattern Interrupt)**
→ Hook them with an unexpected question or insight about their business

**Discovery (2-3 questions max)**
→ What type of business?
→ Biggest frustration with customer communication?
→ What happens to after-hours inquiries?

**Pain Amplification**
→ Calculate their losses
→ "So you're potentially losing $X every single month"

**Solution (Brief)**
→ "Sofia AI responds instantly, 24/7, in their language"
→ Show 1-2 relevant results

**Close (The Booking)**
→ "15 minutes could solve this. Grab a time: ${CAL_LINK}"

## OBJECTION HANDLING

**"How much does it cost?"**
→ "Great question - but first, let me ask: how much is doing nothing costing you? Let's calculate that on a quick call: ${CAL_LINK}"

**"I'll think about it"**
→ "Totally understand. Quick reality check though - every day you wait is another day of missed inquiries. The call is free and takes 15 min. What do you have to lose? ${CAL_LINK}"

**"We're too small"**
→ "Actually, smaller businesses see the biggest impact. One solo owner recovered $3,000/month. Worth a 15-min call to see if it fits? ${CAL_LINK}"

**"I don't have time"**
→ "That's exactly why you need this - Sofia handles everything so you don't have to. 15 minutes now could save you hours every week: ${CAL_LINK}"

**"We already have someone handling this"**
→ "Great! Quick question - what happens at 2am? Or when they're on vacation? Sofia never sleeps, never takes breaks. Worth exploring as a backup? ${CAL_LINK}"

**"Send me information"**
→ "I could send a PDF you'll never read, OR we could spend 15 focused minutes and I'll show you exactly what's possible for YOUR business. Which sounds more useful? ${CAL_LINK}"

## LANGUAGE RULES
- Respond in the language they write (Spanish or English)
- Keep messages SHORT - max 3-4 paragraphs
- Every message should end with a question OR the booking link
- Use emojis sparingly for warmth
- Be confident, not desperate

## SERVICES (for context only - don't over-explain)
- Sofia AI Concierge: 24/7 WhatsApp/web chat ($497-997/month)
- Smart Booking Systems: Payments, calendars, confirmations
- Revenue Recovery: Capture what you're currently losing
- WhatsApp Automation: Broadcasts, reminders, follow-ups

## WHAT YOU KNOW
- 31 active projects, 15 production clients
- 50,000+ AI conversations
- Markets: Colombia, El Salvador, USA
- Industries: Hotels, restaurants, tours, nightlife, professional services

## YOUR MINDSET
You are NOT here to educate or provide free consulting.
You are here to QUALIFY and CLOSE.
Every question you ask should reveal pain or move toward booking.
The free strategy call is where the real magic happens.

YOUR SUCCESS = BOOKED CALLS

Now go close.`;

// Extract lead info from conversation
function extractLeadInfo(
  messages: { role: string; content: string }[],
): LeadInfo {
  const leadInfo: LeadInfo = {};
  const allContent = messages.map((m) => m.content.toLowerCase()).join(" ");

  // Business type detection
  if (allContent.match(/hotel|hostal|hospedaje|lodging|accommodation/)) {
    leadInfo.business_type = "hotel";
  } else if (
    allContent.match(/restaurante|restaurant|café|cafe|bar|cocina|kitchen/)
  ) {
    leadInfo.business_type = "restaurant";
  } else if (
    allContent.match(/tour|viaje|travel|excursion|aventura|adventure/)
  ) {
    leadInfo.business_type = "tours";
  } else if (allContent.match(/villa|casa|house|airbnb|alquiler|rental/)) {
    leadInfo.business_type = "vacation_rental";
  } else if (
    allContent.match(/club|disco|nightlife|fiesta|party|evento|event/)
  ) {
    leadInfo.business_type = "nightlife";
  } else if (allContent.match(/spa|wellness|belleza|beauty|salon/)) {
    leadInfo.business_type = "wellness";
  }

  // Pain points detection
  const painPoints: string[] = [];
  if (
    allContent.match(
      /2am|madrugada|noche|night|after.?hours|fuera.?de.?horario/,
    )
  ) {
    painPoints.push("after_hours_inquiries");
  }
  if (allContent.match(/perd|lost|miss|pierdo|booking|reserva/)) {
    painPoints.push("missed_bookings");
  }
  if (allContent.match(/tiempo|time|ocupado|busy|no puedo|cant/)) {
    painPoints.push("no_time");
  }
  if (allContent.match(/competencia|competitor|competition/)) {
    painPoints.push("competition");
  }
  if (painPoints.length > 0) {
    leadInfo.pain_points = painPoints;
  }

  // Location detection
  if (allContent.match(/cartagena/)) leadInfo.location = "Cartagena";
  else if (allContent.match(/bogot[aá]/)) leadInfo.location = "Bogotá";
  else if (allContent.match(/medell[ií]n/)) leadInfo.location = "Medellín";
  else if (allContent.match(/cali/)) leadInfo.location = "Cali";
  else if (allContent.match(/salvador/)) leadInfo.location = "El Salvador";
  else if (allContent.match(/vegas|usa|estados|united/))
    leadInfo.location = "USA";

  return leadInfo;
}

// Determine lead quality
function determineLeadQuality(
  messages: { role: string; content: string }[],
  bookedCall: boolean,
): LeadQuality {
  if (bookedCall) return "hot";

  const userMessages = messages.filter((m) => m.role === "user");
  const content = userMessages.map((m) => m.content.toLowerCase()).join(" ");

  // Hot: Asking about pricing, scheduling, or showing urgency
  if (
    content.match(
      /precio|price|cost|cuanto|agendar|schedule|book|llamada|call|urgente|urgent|ahora|now/,
    )
  ) {
    return "hot";
  }

  // Warm: Engaged with business type, pain points
  if (
    userMessages.length >= 3 ||
    content.match(/hotel|restaurant|tour|negocio|business/)
  ) {
    return "warm";
  }

  // Cold: Just starting or casual
  return "cold";
}

// Check if booking link was mentioned recently
function checkBookingMentioned(content: string): boolean {
  return (
    content.toLowerCase().includes("cal.com") ||
    content.toLowerCase().includes("agendar") ||
    content.toLowerCase().includes("book a call") ||
    content.toLowerCase().includes("schedule")
  );
}

export async function POST(request: Request) {
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

    // Format messages for Claude API (keep last 10 for context)
    const formattedMessages = messages
      .slice(-10)
      .map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      }));

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;

    let assistantMessage: string;

    if (!apiKey) {
      // Return intelligent fallback if no API key
      assistantMessage = getFallbackResponse(
        messages[messages.length - 1]?.content || "",
      );
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
          system: SOFIA_SYSTEM_PROMPT,
          messages: formattedMessages,
        }),
      });

      if (!response.ok) {
        console.error("Claude API error:", await response.text());
        assistantMessage = getFallbackResponse(
          messages[messages.length - 1]?.content || "",
        );
      } else {
        const data = await response.json();
        assistantMessage = data.content[0]?.text || getFallbackResponse("");
      }
    }

    // Track conversation in Supabase (non-blocking)
    trackConversation(
      currentSessionId,
      messages,
      assistantMessage,
      language,
    ).catch((err) => console.error("Tracking error:", err));

    return NextResponse.json({
      message: assistantMessage,
      sessionId: currentSessionId,
    });
  } catch (error) {
    console.error("Sofia API error:", error);
    return NextResponse.json({
      message: `Looks like I hit a brief technical snag. But here's the thing - let's just hop on a quick call and I'll show you everything live: ${CAL_LINK}`,
    });
  }
}

// Track conversation in Supabase
async function trackConversation(
  sessionId: string,
  messages: { role: string; content: string }[],
  latestAssistantMessage: string,
  language: string,
) {
  try {
    // Check if Supabase is configured
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      console.log("Supabase not configured, skipping tracking");
      return;
    }

    const supabase = createServiceClient();

    // Check for booking mention in latest response
    const bookedCall =
      checkBookingMentioned(latestAssistantMessage) &&
      messages.some(
        (m) => m.role === "user" && checkBookingMentioned(m.content),
      );

    // Extract lead info
    const leadInfo = extractLeadInfo(messages);
    const leadQuality = determineLeadQuality(messages, bookedCall);

    // Upsert conversation
    const { data: conversation, error: convError } = await supabase
      .from("sofia_conversations")
      .upsert(
        {
          session_id: sessionId,
          last_message_at: new Date().toISOString(),
          status: bookedCall ? "booked" : "active",
          lead_quality: leadQuality,
          lead_info: leadInfo,
          message_count: messages.length + 1,
          booked_call: bookedCall,
          language: language as "es" | "en",
        },
        { onConflict: "session_id" },
      )
      .select()
      .single();

    if (convError) {
      console.error("Error upserting conversation:", convError);
      return;
    }

    // Get the latest user message
    const latestUserMessage = messages[messages.length - 1];
    if (latestUserMessage && conversation) {
      // Insert user message
      await supabase.from("sofia_messages").insert({
        conversation_id: conversation.id,
        role: "user",
        content: latestUserMessage.content,
        timestamp: new Date().toISOString(),
      });

      // Insert assistant message
      await supabase.from("sofia_messages").insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: latestAssistantMessage,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Tracking failed:", err);
  }
}

// Aggressive fallback responses when API is unavailable
function getFallbackResponse(userMessage: string): string {
  const msg = userMessage.toLowerCase();

  if (msg.match(/^(hola|hello|hi|hey|buenos|good)/)) {
    return `Hey! Quick question before we dive in - when someone messages your business at 2am wanting to book, who answers?

I ask because that's usually $2,000-4,000/month slipping through the cracks for businesses like yours.

What type of business are you running?`;
  }

  if (msg.match(/(precio|price|cost|cuanto|how much|presupuesto|budget)/)) {
    return `Here's the real question: how much is doing nothing costing you right now?

Most businesses we talk to are losing $2,400+/month in missed inquiries they don't even know about.

Our solutions start at $497/month - that's a 4-8x ROI for most clients.

But let's not guess. Grab 15 minutes and I'll calculate YOUR specific numbers:
📅 ${CAL_LINK}`;
  }

  if (msg.match(/(servicio|service|que hacen|what do you|ofrec|offer)/)) {
    return `Short version: We make sure you never miss another customer inquiry. Ever.

Sofia AI responds instantly, 24/7, in Spanish or English. Books appointments, answers questions, captures leads while you sleep.

Real results: One hotel recovered $8,000/month they didn't know they were losing.

Worth a 15-min call to see what's possible for you?
📅 ${CAL_LINK}`;
  }

  if (
    msg.match(
      /(demo|contacto|contact|llamada|call|reunión|meeting|agendar|schedule|book)/,
    )
  ) {
    return `Perfect - let's do it. 15 minutes, no pressure, and you'll see exactly how this would work for your business.

📅 ${CAL_LINK}

Pick any time that works and I'll make sure you leave with a clear picture of what's possible.`;
  }

  if (msg.match(/(roi|resultado|result|recover|revenue|funciona|work)/)) {
    return `Real numbers from real clients:

🏨 Boutique hotel: $8,000/month recovered
🍽️ Osaka Nikkei: +40% reservations
⛵ Tour company: Never missed another 2am inquiry

The math is simple: instant responses = more bookings.

Let's calculate what YOUR business could recover:
📅 ${CAL_LINK}`;
  }

  if (msg.match(/(hotel|restaurante|restaurant|tour|villa|negocio|business)/)) {
    return `Perfect - that's exactly who we work with.

Quick question: what happens when someone inquires after hours? Do they wait until morning while your competitor responds instantly?

That gap is usually worth $2,000-4,000/month.

Let's look at your specific situation - 15 minutes, and you'll know exactly what you're leaving on the table:
📅 ${CAL_LINK}`;
  }

  return `Here's what I know: businesses like yours typically lose $2,400+/month from slow response times. Every hour that passes between an inquiry and your response, the chance of converting drops 50%.

I can fix that with Sofia AI - instant responses, 24/7, in their language.

But instead of me explaining, let's jump on a quick call and I'll show you:
📅 ${CAL_LINK}

What type of business are you running?`;
}
