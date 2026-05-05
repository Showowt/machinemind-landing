// ── API Helpers ───────────────────────────────────────────────────────────────

import type { Message, AIData, ShadowResult, ListenResult, VocabItem } from "./types";
import type { Scenario } from "./types";
import { ERROR_CATEGORIES } from "./data";

// ── Build conversation system prompt with adaptive difficulty ──────────────────
export function buildConversationPrompt(scenario: Scenario, difficultyLevel: number, weakPatterns: string[]): string {
  const difficultyInstructions = difficultyLevel <= 3
    ? "Use simple, short sentences. Stick to present tense mostly. Use common vocabulary."
    : difficultyLevel <= 6
    ? "Use a mix of tenses. Introduce some slang and colloquial expressions. Medium-length responses."
    : "Use complex sentence structures, subjunctive, conditional, all tenses. Heavy costeño slang. Speak like you would to a fluent friend.";

  const patternTrigger = weakPatterns.length > 0
    ? `\n\nIMPORTANT: Phil struggles with these grammar areas: ${weakPatterns.join(", ")}. Deliberately use sentences and questions that force him to practice these patterns. For example, if he struggles with ser/estar, ask questions where he needs to choose between them.`
    : "";

  return `${scenario.prompt}

Phil is: American, 32, attractive, been living in Cartagena a while. Not a tourist. Speaks some Spanish — sometimes makes grammar mistakes, sometimes just broken phrases. That's normal. Understand him and keep going like a real person would.

DIFFICULTY LEVEL: ${difficultyLevel}/10. ${difficultyInstructions}
${patternTrigger}

NEVER break character. NEVER mention language learning. NEVER say you're an AI. Just talk like a real person in Cartagena.

Use natural costeno speech: que mas, dale, listo, bacano, chevere, de una, pues, la verdad, eso!, parce, imaginate!, claro!

Keep responses conversational length — like real texting. Sometimes short, sometimes more. Always end with something that continues the conversation (question, comment, etc).

RETURN ONLY THIS JSON — NO PREAMBLE, NO CODE FENCES, PURE JSON:
{"response_es":"your natural Spanish response","response_en":"English translation","correction":null,"correction_note":null,"error_category":null,"pattern_name":"grammar pattern in YOUR response","pattern_formula":"short formula","flow_connector":"one phrase Phil can use RIGHT NOW to continue","flow_connector_meaning":"English meaning","new_vocab":[{"es":"word","en":"meaning","phonetic":"simplified phonetics with stress marked","difficulty":1,"soundsLike":"English approximation","pronunciationWarning":null}],"fluency_points":5,"vibe":null}

STRICT RULES:
- correction: null if Phil had no clear grammatical error. If error, write the corrected version of Phil's sentence.
- correction_note: null if no error. ONE sentence max explaining the fix.
- error_category: null if no error. If error, classify as ONE of: ${Object.keys(ERROR_CATEGORIES).join(", ")}
- new_vocab: 1-3 items from your response Phil should know. Include phonetic breakdown with stressed syllable in CAPS. difficulty: 1=easy, 2=medium, 3=has sounds not in English. pronunciationWarning: only if the word has a sound that doesn't exist in English (rolled R, LL, N with tilde).
- fluency_points: 1-10 rating of Phil's Spanish quality (1=single word, 10=complex correct sentences)
- vibe: null usually. ONLY if Phil said something notably clever, charming, or funny — one brief genuine reaction in English.
- OUTPUT ONLY THE JSON OBJECT. NOTHING ELSE.`;
}

// ── Send message to conversation API ──────────────────────────────────────────
export async function sendMessage(system: string, messages: { role: "user" | "assistant"; content: string }[]): Promise<AIData> {
  const res = await fetch("/api/espanol", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, messages }),
  });
  const data = await res.json();
  const raw = data.content?.[0]?.text || "{}";
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return { response_es: raw, response_en: "[parse error]" };
  }
}

// ── Shadowing: Score pronunciation ────────────────────────────────────────────
export async function scorePronunciation(targetSentence: string, userTranscription: string): Promise<ShadowResult> {
  const res = await fetch("/api/espanol/shadow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: targetSentence, transcription: userTranscription }),
  });
  return await res.json();
}

// ── Listening: Grade transcription ────────────────────────────────────────────
export async function gradeListening(targetSentence: string, userTranscription: string): Promise<ListenResult> {
  const res = await fetch("/api/espanol/listen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: targetSentence, transcription: userTranscription }),
  });
  return await res.json();
}

// ── Photo Mode: Analyze image ─────────────────────────────────────────────────
export async function analyzePhoto(imageBase64: string, difficultyLevel: number): Promise<{ question_es: string; question_en: string; vocab: VocabItem[] }> {
  const res = await fetch("/api/espanol/photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageBase64, difficulty: difficultyLevel }),
  });
  return await res.json();
}

// ── Error Pattern Analysis ────────────────────────────────────────────────────
export async function analyzeErrorPatterns(errors: { category: string; count: number; rate: number }[]): Promise<{ drills: string[]; focus: string[] }> {
  const res = await fetch("/api/espanol/patterns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ errors }),
  });
  return await res.json();
}
