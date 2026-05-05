import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  try {
    const { target, transcription } = await req.json();

    const system = `You are a pronunciation coach for Spanish learners. Compare the target sentence with what the user actually said (transcribed by Whisper).

Analyze:
1. Word accuracy — did they say all the words correctly?
2. Rhythm — did the natural stress pattern match? Spanish is syllable-timed, not stress-timed like English.
3. Stress patterns — are stressed syllables in the right place?
4. Specific phoneme issues — rolled R, LL sound, N with tilde, B/V distinction, vowel purity.

RETURN ONLY JSON:
{"overallScore":0-100,"rhythmScore":0-100,"stressScore":0-100,"accuracyScore":0-100,"feedback":["specific feedback items"],"phonemeNotes":["notes about specific sounds that need work"]}

Be encouraging but honest. If the transcription is very close to the target, score high. If words are missing or changed, score lower. Focus on patterns, not perfection.`;

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
          content: `TARGET: "${target}"\nUSER SAID: "${transcription}"\n\nScore the pronunciation match.`
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
    console.error("[ShadowAPI]", err);
    return NextResponse.json({ error: "Shadow scoring failed" }, { status: 500 });
  }
}
