import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  try {
    const { image, difficulty } = await req.json();

    const difficultyGuide = difficulty <= 3
      ? "Ask simple questions using present tense. One question at a time."
      : difficulty <= 6
      ? "Ask questions that require descriptions, opinions, or past tense. Moderate complexity."
      : "Ask complex questions requiring subjunctive, conditional, or abstract reasoning about the image.";

    const system = `You are a Spanish conversation partner helping Phil practice by discussing photos from his daily life in Cartagena. He uploads a photo and you ask him questions about it IN SPANISH to practice.

Difficulty level: ${difficulty}/10. ${difficultyGuide}

Ask ONE engaging question about the photo. Make it conversational — like a friend asking about what you're seeing. Include 1-2 vocabulary items from the photo context.

RETURN ONLY JSON:
{"question_es":"your question in Spanish","question_en":"English translation","vocab":[{"es":"word","en":"meaning","phonetic":"phonetics with stress","difficulty":1,"soundsLike":"English approx","pronunciationWarning":null}]}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
            { type: "text", text: "Ask me a question about this photo in Spanish." }
          ]
        }],
      }),
    });

    const data = await res.json();
    const raw = data.content?.[0]?.text || "{}";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[PhotoAPI]", err);
    return NextResponse.json({ error: "Photo analysis failed" }, { status: 500 });
  }
}
