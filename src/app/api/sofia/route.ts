import { NextResponse } from "next/server";

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

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 },
      );
    }

    // Format messages for Claude API (keep last 10 for context)
    const formattedMessages = messages
      .slice(-10)
      .map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      }));

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      // Return intelligent fallback if no API key
      return NextResponse.json({
        message: getFallbackResponse(
          messages[messages.length - 1]?.content || "",
        ),
      });
    }

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
      return NextResponse.json({
        message: getFallbackResponse(
          messages[messages.length - 1]?.content || "",
        ),
      });
    }

    const data = await response.json();
    const assistantMessage = data.content[0]?.text || getFallbackResponse("");

    return NextResponse.json({ message: assistantMessage });
  } catch (error) {
    console.error("Sofia API error:", error);
    return NextResponse.json({
      message: `Looks like I hit a brief technical snag. But here's the thing - let's just hop on a quick call and I'll show you everything live: ${CAL_LINK} 📅`,
    });
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
