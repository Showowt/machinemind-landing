import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  try {
    const { errors } = await req.json();

    const system = `You are a Spanish language acquisition expert. Given a learner's error pattern data, generate targeted drills and focus areas.

RETURN ONLY JSON:
{"drills":["specific practice drill sentences"],"focus":["key areas to focus on with brief explanation"]}

Keep drills practical — things someone living in Cartagena would actually say. Max 5 drills, max 3 focus areas.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        system,
        messages: [{
          role: "user",
          content: `Error patterns:\n${JSON.stringify(errors, null, 2)}\n\nGenerate targeted drills for the weakest areas.`
        }],
      }),
    });

    const data = await res.json();
    const raw = data.content?.[0]?.text || "{}";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[PatternsAPI]", err);
    return NextResponse.json({ error: "Pattern analysis failed" }, { status: 500 });
  }
}
