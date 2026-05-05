import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  try {
    const { target, transcription } = await req.json();

    const system = `You are a listening comprehension grader for Spanish learners. The user heard a sentence spoken in Spanish and tried to transcribe what they heard.

Compare their transcription to the target sentence. Grade them on:
- How many words they got correct
- Which words they missed
- Which words they added that weren't there
- Overall comprehension

Be generous with minor spelling differences or accent marks. Focus on whether they HEARD the right words.

RETURN ONLY JSON:
{"score":0-100,"missingWords":["words they missed"],"extraWords":["words they added that weren't there"],"feedback":"one sentence of encouragement or specific tip"}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        system,
        messages: [{
          role: "user",
          content: `TARGET SENTENCE: "${target}"\nUSER TRANSCRIBED: "${transcription}"\n\nGrade the listening comprehension.`
        }],
      }),
    });

    const data = await res.json();
    const raw = data.content?.[0]?.text || "{}";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());

    return NextResponse.json({
      targetSentence: target,
      userTranscription: transcription,
      ...parsed,
    });
  } catch (err) {
    console.error("[ListenAPI]", err);
    return NextResponse.json({ error: "Listen grading failed" }, { status: 500 });
  }
}
