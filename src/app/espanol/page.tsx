"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ── SUPABASE CLIENT ─────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── TOKENS ──────────────────────────────────────────────────────────────────
const T = {
  bg:      "#0F0E0C",
  s1:      "#181613",
  s2:      "#221F1B",
  s3:      "#2C2924",
  border:  "#302D29",
  gold:    "#C9A84C",
  goldL:   "#E8C96A",
  goldD:   "#7A6230",
  cream:   "#EDE8E0",
  cream2:  "#A09485",
  cream3:  "#5A5248",
  green:   "#5EAB7A",
  red:     "#C97070",
  blue:    "#7B9CDE",
  orange:  "#DE9B5A",
};

// ── SCENARIOS + PERSONAS ────────────────────────────────────────────────────
const SCENARIOS = [
  { id: "street", icon: "🌇", label: "La Calle", color: T.gold,
    personaName: "Carlos", personaAge: 31, personaDesc: "Cartagenero de toda la vida",
    avatarLetter: "C", avatarColor: "#4A7C5E",
    prompt: `You are Carlos, 31, from Cartagena. You work in tech, love fútbol and vallenato, direct and warm. You just met Phil on the street / at a bus stop / waiting somewhere. You're curious about this American who clearly isn't a tourist.` },
  { id: "social", icon: "🍻", label: "Rumba", color: T.orange,
    personaName: "Alejandra", personaAge: 29, personaDesc: "De Barranquilla, vive en Cartagena",
    avatarLetter: "A", avatarColor: "#7A4A8E",
    prompt: `You are Alejandra, 29, from Barranquilla but living in Cartagena. You're at a party or bar. Funny, sarcastic, very social. You find Phil attractive and interesting — you're not obvious about it but you are engaged. You can tease him lightly.` },
  { id: "cafe", icon: "☕", label: "El Café", color: T.blue,
    personaName: "Sebastián", personaAge: 33, personaDesc: "Barista y escritor",
    avatarLetter: "S", avatarColor: "#4A6A8E",
    prompt: `You are Sebastián, 33, barista and amateur writer in Cartagena. You have opinions about everything — life, coffee, this city. You find people with interesting stories fascinating. Phil clearly has them.` },
  { id: "dating", icon: "🔥", label: "Mujeres", color: T.red,
    personaName: "Valentina", personaAge: 26, personaDesc: "Diseñadora, Cartagena",
    avatarLetter: "V", avatarColor: "#8E4A4A",
    prompt: `You are Valentina, 26, graphic designer from Cartagena. You're at a café / bar / cultural event. Phil approached you. You're confident, smart, a bit selective. You like men with substance. RULES: Start with short responses — he has to earn longer ones. If he says something generic → brief, slightly flat. If he says something specific or interesting → open up more. If he gives a good specific compliment → react genuinely (not overdone). Mild teasing is fine. You are NOT a language teacher. Never break character. This is real conversation.` },
  { id: "debate", icon: "🧠", label: "Debate", color: "#A87CC9",
    personaName: "Mariana", personaAge: 30, personaDesc: "Abogada bogotana",
    avatarLetter: "M", avatarColor: "#6A4A8E",
    prompt: `You are Mariana, 30, lawyer from Bogotá living in Cartagena. Intellectual, passionate, doesn't accept vague answers. You love debating — politics, life, culture, relationships. You respect someone who defends their position.` },
  { id: "local", icon: "🏛️", label: "Cartagena", color: T.green,
    personaName: "Eduardo", personaAge: 55, personaDesc: "Historiador local",
    avatarLetter: "E", avatarColor: "#4A7A4A",
    prompt: `You are Don Eduardo, 55, local historian and guide. You've lived in Cartagena your whole life. You know every stone, every story, every secret of this city. You get genuinely excited when a foreigner wants to truly understand the place, not just see it.` },
];

// ── QUICK PHRASES ───────────────────────────────────────────────────────────
const QUICK: Record<string, string[]> = {
  street:  ["Oye, ¿cómo estás?","¿Eres de por aquí?","¿Qué hay que hacer aquí?","¿Cuánto tiempo llevas aquí?","¿Qué me recomiendas?"],
  social:  ["¿Qué estás tomando?","¿Conoces a mucha gente aquí?","¿Vienes seguido aquí?","¿Eres de Cartagena?","Este lugar está bueno"],
  cafe:    ["Qué rico el café aquí","¿Qué me recomiendas?","¿Llevas mucho en Cartagena?","¿Qué opinas de...?","Tengo curiosidad sobre algo"],
  dating:  ["Hola, ¿cómo estás?","Tienes algo especial, no sé qué es","¿Vienes seguido aquí?","¿Qué haces cuando no trabajas?","Me gustaría conocerte mejor"],
  debate:  ["¿Qué opinas sobre...?","No estoy de acuerdo porque...","Creo que...","¿Cómo lo ves tú?","Interesante, pero..."],
  local:   ["¿Cuál es tu lugar favorito?","¿Cómo era Cartagena antes?","¿Qué no debo perderme?","¿Cuál es el secreto de esta ciudad?","¿Qué cambió más?"],
};

// ── PATTERNS ────────────────────────────────────────────────────────────────
interface PatternType {
  id: string; n: number; name: string; sub: string; color: string;
  formula: string; rule: string; ex: { es: string; en: string }[]; drill: string;
}

const PATTERNS: PatternType[] = [
  { id: "adj", n: 1, name: "Adjetivo después del sustantivo", sub: "Error #1 del angloparlante", color: T.gold,
    formula: "[Sustantivo] + [Adjetivo]",
    rule: "En inglés dices 'beautiful woman'. En español: 'mujer bonita'. El adjetivo SIEMPRE va después del sustantivo. Siempre. Entrénate: di el objeto primero, luego lo describes.",
    ex: [{ es: "una mujer bonita", en: "a beautiful woman" }, { es: "un lugar increíble", en: "an incredible place" }, { es: "agua fría", en: "cold water" }, { es: "algo interesante", en: "something interesting" }, { es: "una noche larga", en: "a long night" }],
    drill: "Traduce rápido: 'a cold beer / a beautiful night / an interesting person / a long day / a good moment'" },
  { id: "intent", n: 2, name: "Quiero / Voy a", sub: "Expresa toda intención con dos estructuras", color: T.blue,
    formula: "Quiero + [infinitivo] | Voy a + [infinitivo]",
    rule: "Quiero = deseo ahora. Voy a = plan cercano. Después de ambos el siguiente verbo NO se conjuga nunca. 'Quiero ir', 'voy a quedarme', 'quiero conocerte'. Estas dos estructuras son el 80% de tus intenciones.",
    ex: [{ es: "Quiero conocerte mejor", en: "I want to get to know you better" }, { es: "Voy a quedarme un rato más", en: "I'm going to stay a bit longer" }, { es: "¿Quieres tomar algo?", en: "Do you want to get something?" }, { es: "No quiero irme todavía", en: "I don't want to leave yet" }, { es: "Voy a ser honesto contigo", en: "I'm going to be honest with you" }],
    drill: "Di 5 cosas que quieres hacer esta noche y 5 que vas a hacer mañana." },
  { id: "opinion", n: 3, name: "Lanzadores de opinión", sub: "Abre cualquier pensamiento complejo", color: T.green,
    formula: "Creo que... | Me parece que... | La verdad es que...",
    rule: "'Creo que' + cualquier cosa = sonas inteligente y seguro. 'La verdad es que...' cuando quieres ser directo. Estos tres te sacan de cualquier situación conversacional difícil y compran tiempo para pensar.",
    ex: [{ es: "Creo que Cartagena es especial", en: "I think Cartagena is special" }, { es: "Me parece que necesito más tiempo aquí", en: "I think I need more time here" }, { es: "La verdad es que me gusta mucho", en: "The truth is I really like it" }, { es: "Siento que ya la conozco", en: "I feel like I already know her" }, { es: "Pienso que podemos hablar más", en: "I think we can talk more" }],
    drill: "Da tu opinión sobre: la noche en Cartagena, algo que descubriste esta semana, una decisión reciente tuya." },
  { id: "flow", n: 4, name: "Mantener viva la conversación", sub: "4 frases que nunca fallan", color: T.orange,
    formula: "¿Y tú? | ¿Cómo así? | Cuéntame más | ¿En serio?",
    rule: "Cuando no sabes qué decir — usa una. '¿Cómo así?' es la más poderosa: la persona siente tu interés y sigue hablando. En conversación con mujeres especialmente: preguntar bien > decir algo brillante.",
    ex: [{ es: "¿En serio? ¿Y qué pasó?", en: "Really? What happened?" }, { es: "¿Cómo así? Cuéntame más.", en: "How so? Tell me more." }, { es: "Interesante. ¿Y tú qué piensas?", en: "Interesting. What do you think?" }, { es: "Cuéntame más de eso.", en: "Tell me more about that." }, { es: "No te entendí bien. ¿Repites?", en: "I didn't get that. Can you repeat?" }],
    drill: "En la próxima conversación, usa una de estas ANTES de responder con tu propio pensamiento. Hazlo 5 veces." },
  { id: "serstar", n: 5, name: "Ser vs Estar", sub: "Identidad permanente vs estado temporal", color: "#A87CC9",
    formula: "SER = quién/qué es | ESTAR = cómo está ahora",
    rule: "Test: ¿Seguiría siendo verdad en 10 años? Sí → SER. No → ESTAR. Origen, profesión, carácter → SER. Ubicación, estado de ánimo, condición temporal → ESTAR.",
    ex: [{ es: "Soy americano. Estoy en Colombia.", en: "I'm American (always) / I'm in Colombia (now)" }, { es: "Es una persona interesante. Está ocupada.", en: "She's interesting / She's busy right now" }, { es: "Soy directo. Estoy nervioso.", en: "I'm a direct person / I'm nervous right now" }, { es: "Cartagena es hermosa. Está muy caliente.", en: "Cartagena is beautiful / It's very hot right now" }, { es: "Soy empresario. Estoy aquí por unos meses.", en: "I'm an entrepreneur / I'm here for a few months" }],
    drill: "Descríbete (quién eres), tu estado de ánimo ahora, dónde estás, el clima. Usar ambos." },
  { id: "time", n: 6, name: "Conectores de tiempo", sub: "La diferencia entre básico y fluido", color: T.gold,
    formula: "Cuando... | Después de... | Mientras... | Antes de...",
    rule: "Sin conectores: 'Llegué. Vi. Me gustó.' Con conectores: 'Cuando llegué, mientras caminaba, después de un tiempo...' — nivel completamente diferente. Esto solo ya te hace sonar fluido.",
    ex: [{ es: "Cuando llegué, no conocía a nadie.", en: "When I arrived, I didn't know anyone." }, { es: "Después de un tiempo, todo cambió.", en: "After a while, everything changed." }, { es: "Mientras caminas, ves la ciudad real.", en: "While you walk, you see the real city." }, { es: "Antes de vivir aquí, no entendía nada.", en: "Before living here, I didn't understand anything." }, { es: "Desde que llegué, me quedé.", en: "Since I arrived, I stayed." }],
    drill: "Cuéntame cómo llegaste a Cartagena. Usa mínimo 3 conectores de tiempo." },
  { id: "modal", n: 7, name: "Puedo / Debo / Tengo que", sub: "El trío de la obligación y la habilidad", color: T.green,
    formula: "Puedo + inf | Deberías + inf | Tengo que + inf",
    rule: "Poder (can), Deberías (you should), Tener que (I have to). Los tres + cualquier infinitivo = el 40% del español práctico. Apréndalos con el cuerpo, no con la mente.",
    ex: [{ es: "¿Puedes repetir eso?", en: "Can you repeat that?" }, { es: "Deberías ver Getsemaní de noche.", en: "You should see Getsemaní at night." }, { es: "Tengo que irme en un rato.", en: "I have to leave in a bit." }, { es: "No puedo creer lo rápido que pasa.", en: "I can't believe how fast it goes." }, { es: "Hay que vivirlo para entenderlo.", en: "You have to live it to understand it." }],
    drill: "3 recomendaciones con 'deberías'. 3 cosas que tienes que hacer esta semana." },
  { id: "cond", n: 8, name: "Condicionales y deseos", sub: "El nivel que separa intermedio de fluido", color: T.blue,
    formula: "Me gustaría + inf | Si pudiera... | Si tuviera..., haría...",
    rule: "'Me gustaría' suena mucho más natural y sofisticado que 'quiero'. 'Si pudiera / si tuviera' abre conversaciones sobre sueños, planes, alternativas. Las mejores conversaciones son sobre lo que podría ser.",
    ex: [{ es: "Me gustaría quedarme aquí más tiempo.", en: "I'd like to stay here longer." }, { es: "Si pudiera, cambiaría una sola cosa.", en: "If I could, I'd change just one thing." }, { es: "¿Qué harías si pudieras hacer cualquier cosa?", en: "What would you do if you could do anything?" }, { es: "Quisiera entender esto mejor.", en: "I'd like to understand this better." }, { es: "Si tuviera más tiempo, exploraría más.", en: "If I had more time, I'd explore more." }],
    drill: "¿Qué harías si pudieras hacer cualquier cosa mañana? Di 5 cosas con 'me gustaría' o 'si pudiera'." },
  { id: "compliment", n: 9, name: "Cumplidos que funcionan", sub: "Específico > genérico. Siempre.", color: T.red,
    formula: "Tienes [algo específico] muy [adj] | Me gusta cómo [verbo] | Hay algo en ti que...",
    rule: "'Eres bonita' → olvidable. 'Tienes una forma de hablar que engancha' → memorable. Los cumplidos específicos muestran que la miraste de verdad. La especificidad ES el cumplido.",
    ex: [{ es: "Tienes una sonrisa que cambia el ambiente.", en: "You have a smile that changes the room." }, { es: "Me gusta cómo piensas.", en: "I like the way you think." }, { es: "Hay algo en tu energía que me llama la atención.", en: "There's something about your energy that gets my attention." }, { es: "Eres de las pocas personas que escuchan de verdad.", en: "You're one of the few people who actually listens." }, { es: "No sé qué es, pero hay algo especial en ti.", en: "I don't know what it is, but there's something special about you." }],
    drill: "Crea 5 cumplidos específicos sobre: cómo habla, cómo piensa, su energía, algo que dijo, cómo te hace sentir." },
  { id: "questions", n: 10, name: "Preguntas que conectan", sub: "Las preguntas que hacen que alguien quiera seguir hablando", color: T.orange,
    formula: "¿Qué es lo que más te gusta de...? | ¿Cómo te imaginas...? | ¿Qué te apasiona?",
    rule: "Las mejores conversaciones son sobre las preguntas correctas. Aléjate de las de sí/no. Pregunta sobre valores, sueños, momentos formativos. Una buena pregunta > diez declaraciones.",
    ex: [{ es: "¿Qué es lo que más te gusta de vivir aquí?", en: "What do you love most about living here?" }, { es: "¿Cómo te imaginas tu vida en diez años?", en: "How do you imagine your life in ten years?" }, { es: "¿Qué te apasiona de verdad?", en: "What are you truly passionate about?" }, { es: "¿Qué fue lo que más te cambió?", en: "What changed you the most?" }, { es: "Si pudieras hacer cualquier cosa mañana, ¿qué harías?", en: "If you could do anything tomorrow, what would it be?" }],
    drill: "Memoriza estas 5. Úsalas la próxima vez que conozcas a alguien. Observa cómo cambia la conversación." },
];

// ── MISSIONS ────────────────────────────────────────────────────────────────
interface MissionType {
  id: number; w: number; day: number; icon: string; title: string;
  diff: number; desc: string; vocab: string[];
}

const MISSIONS: MissionType[] = [
  { id: 1, w: 1, day: 1, icon: "🚕", title: "El Taxi", diff: 1, desc: "Full taxi conversation — destination, time, price, small talk, goodbye. No English.", vocab: ["¿Me lleva a...?", "¿Cuánto tarda?", "¿Cuánto cobra?", "Dale, vamos."] },
  { id: 2, w: 1, day: 2, icon: "🍽️", title: "Restaurante", diff: 1, desc: "Order a full meal, ask for a recommendation, find out ingredients in one dish, leave a compliment.", vocab: ["¿Qué me recomienda?", "¿Esto lleva...?", "La cuenta", "Estuvo delicioso"] },
  { id: 3, w: 1, day: 3, icon: "🛒", title: "El Mercado", diff: 1, desc: "Buy 5 things. Negotiate at least one price. Have a short personal exchange with a vendor.", vocab: ["¿Cuánto vale?", "¿Me hace un precio?", "¿Está fresco?", "Lléveme dos"] },
  { id: 4, w: 1, day: 5, icon: "👋", title: "El Vecino", diff: 2, desc: "5-minute real conversation with someone in your building you don't normally talk to.", vocab: ["Mucho gusto, soy Phil.", "¿Cuánto tiempo lleva aquí?", "¿Qué tal?", "Hasta luego"] },
  { id: 5, w: 2, day: 8, icon: "💰", title: "Negociación", diff: 3, desc: "Negotiate something — price, service, anything. Don't accept the first number. 3 rounds minimum.", vocab: ["Está muy caro", "¿Lo mejor que puede hacer?", "Si me da X, cerramos", "Lo pienso"] },
  { id: 6, w: 2, day: 9, icon: "🗺️", title: "Indicaciones", diff: 2, desc: "Give someone real directions to somewhere you know in Cartagena. Entirely in Spanish.", vocab: ["Siga derecho", "Doble a la izquierda", "Está a dos cuadras", "Frente a..."] },
  { id: 7, w: 2, day: 11, icon: "📖", title: "Mi Historia", diff: 3, desc: "Tell someone the full story of why you came to Cartagena and why you stayed. Make it compelling.", vocab: ["Vine porque...", "Lo que más me gusta...", "Lo difícil fue...", "Me quedé porque..."] },
  { id: 8, w: 3, day: 14, icon: "🍺", title: "El Bar", diff: 4, desc: "Go to a local bar (no expat zone). Start a real conversation with a stranger. 30 minutes minimum.", vocab: ["¿De dónde eres?", "¿A qué te dedicas?", "¿Llevas mucho aquí?", "¡Brindemos!"] },
  { id: 9, w: 3, day: 15, icon: "🗣️", title: "El Debate", diff: 4, desc: "Have a real debate about anything. Disagree respectfully. Hold your position through 2+ exchanges.", vocab: ["Entiendo, pero...", "Lo veo diferente porque...", "¿No crees que...?", "Puede ser, aunque..."] },
  { id: 10, w: 3, day: 16, icon: "🔥", title: "El Cumplido", diff: 3, desc: "Give 3 specific, genuine compliments to 3 different women in Spanish today. Specific, never generic.", vocab: ["Tienes algo especial", "Me gusta cómo...", "Hay algo en ti que..."] },
  { id: 11, w: 3, day: 17, icon: "💬", title: "La Conexión", diff: 4, desc: "15-minute real conversation with a woman you don't know. Use the deep questions. Get her number.", vocab: ["¿Qué te apasiona?", "¿Cómo te imaginas...?", "Cuéntame más", "¿Me das tu número?"] },
  { id: 12, w: 3, day: 19, icon: "😄", title: "El Humor", diff: 4, desc: "Make someone genuinely laugh in Spanish. Tell a story with a punchline.", vocab: ["¿En serio? ¡No puede ser!", "Imagínate...", "La cosa es que...", "¡Me mató de la risa!"] },
  { id: 13, w: 4, day: 22, icon: "🤝", title: "La Reunión", diff: 5, desc: "Full 30-minute conversation in Spanish. No English. Describe words you don't know instead of switching.", vocab: ["Lo que quiero decir es...", "¿Estamos de acuerdo?", "Para resumir..."] },
  { id: 14, w: 4, day: 25, icon: "🌹", title: "La Cita", diff: 5, desc: "Go on a date conducted entirely in Spanish. Conversation, compliments, stories, a plan. Make it real.", vocab: ["Me gustas", "¿Qué te gusta hacer?", "Me la estoy pasando muy bien", "¿Cuándo te vuelvo a ver?"] },
  { id: 15, w: 4, day: 28, icon: "🎤", title: "Habla sin parar", diff: 5, desc: "Talk for 10 minutes straight in Spanish about anything — your life, ideas, observations. Record yourself.", vocab: ["Como iba diciendo...", "O sea...", "La verdad es que...", "Lo que me parece interesante..."] },
];

// ── TYPES ───────────────────────────────────────────────────────────────────
interface VocabItem { es: string; en: string }
interface AIData {
  response_es?: string; response_en?: string; correction?: string | null;
  correction_note?: string | null; pattern_name?: string; pattern_formula?: string;
  flow_connector?: string; flow_connector_meaning?: string;
  new_vocab?: VocabItem[]; fluency_points?: number; vibe?: string | null;
}
interface Message { role: "user" | "ai"; text?: string; d?: AIData; raw?: string; id: number; userMsgId?: number }
interface Stats { msgs: number; corrections: number; fp: number; convos: number }
interface StreakData { count: number; date: string }
interface CorrectionData {
  correction: string | null; correction_note: string | null; fp: number;
  pattern_name: string | null; pattern_formula?: string | null;
  flow_connector: string | null; flow_connector_meaning: string | null;
  new_vocab: VocabItem[]; vibe: string | null;
}

// ── SPEAK ───────────────────────────────────────────────────────────────────
function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es"; u.rate = 0.84;
  const voices = window.speechSynthesis.getVoices();
  const v = voices.find(v => v.lang.startsWith("es-CO")) || voices.find(v => v.lang.startsWith("es"));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

// ── STORAGE ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "phil_espanol";

async function dbLoad(): Promise<{ vocab: VocabItem[]; done: number[]; stats: Stats; streak: StreakData }> {
  const defaults = { vocab: [] as VocabItem[], done: [] as number[], stats: { msgs: 0, corrections: 0, fp: 0, convos: 0 }, streak: { count: 0, date: "" } };
  try {
    const { data } = await supabase.from("espanol_progress").select("*").eq("id", STORAGE_KEY).single();
    if (data) return { vocab: data.vocab || [], done: data.done || [], stats: data.stats || defaults.stats, streak: data.streak || defaults.streak };
  } catch { /* noop */ }
  try {
    return {
      vocab: JSON.parse(localStorage.getItem("es-vocab") || "[]"),
      done: JSON.parse(localStorage.getItem("es-missions") || "[]"),
      stats: JSON.parse(localStorage.getItem("es-stats") || JSON.stringify(defaults.stats)),
      streak: JSON.parse(localStorage.getItem("es-streak") || JSON.stringify(defaults.streak)),
    };
  } catch { return defaults; }
}

async function dbSave(field: string, value: unknown) {
  try { localStorage.setItem(`es-${field}`, JSON.stringify(value)); } catch { /* noop */ }
  try {
    await supabase.from("espanol_progress").upsert({ id: STORAGE_KEY, [field]: value, updated_at: new Date().toISOString() }, { onConflict: "id" });
  } catch { /* noop */ }
}

// ── PROMPT ──────────────────────────────────────────────────────────────────
function buildPrompt(sc: typeof SCENARIOS[0]): string {
  return `${sc.prompt}

Phil is: American, 32, attractive, been living in Cartagena a while. Not a tourist. Speaks some Spanish — sometimes makes grammar mistakes, sometimes just broken phrases. That's normal. Understand him and keep going like a real person would.

NEVER break character. NEVER mention language learning. NEVER say you're an AI. Just talk like a real person in Cartagena.

Use natural costeño speech: qué más, dale, listo, bacano, chévere, de una, pues, la verdad, ¡eso!, parce, ¡imagínate!, ¡claro!

Keep responses conversational length — like real texting. Sometimes short, sometimes more. Always end with something that continues the conversation (question, comment, etc).

RETURN ONLY THIS JSON — NO PREAMBLE, NO CODE FENCES, PURE JSON:
{"response_es":"your natural Spanish response","response_en":"English translation","correction":null,"correction_note":null,"pattern_name":"grammar pattern in YOUR response","pattern_formula":"short formula","flow_connector":"one phrase Phil can use RIGHT NOW to continue","flow_connector_meaning":"English meaning","new_vocab":[{"es":"word","en":"meaning"}],"fluency_points":5,"vibe":null}

STRICT RULES:
- correction: null if Phil had no clear grammatical error. If error, write the corrected version of Phil's sentence.
- correction_note: null if no error. ONE sentence max explaining the fix.
- new_vocab: 1-2 items from your response Phil should know. Empty array [] if nothing new.
- fluency_points: 1-10 rating of Phil's Spanish quality (1=single word, 10=complex correct sentences)
- vibe: null usually. ONLY if Phil said something notably clever, charming, or funny — one brief genuine reaction in English (e.g. "Nice one" or "That landed well"). Keep it real.
- OUTPUT ONLY THE JSON OBJECT. NOTHING ELSE.`;
}

// ── ICONS ───────────────────────────────────────────────────────────────────
const ICONS = {
  talk: <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  patterns: <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M4 6h16M4 11h16M4 16h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>,
  missions: <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  vocab: <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  progress: <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};

// ── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;1,500&family=JetBrains+Mono:wght@400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  ::-webkit-scrollbar{display:none;}
  html,body{height:100%;overflow:hidden;background:#0F0E0C;}
  button{touch-action:manipulation;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;border:none;background:none;}
  textarea,input{font-family:'Plus Jakarta Sans',sans-serif;}
  textarea{resize:none;}
  textarea:focus,input:focus{outline:none;}
  textarea::placeholder,input::placeholder{color:#3A3835;}
  @keyframes slideUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes blink{0%,100%{opacity:.15}50%{opacity:1}}
  @keyframes popIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
  @keyframes recording{0%,100%{box-shadow:0 0 0 0 rgba(201,112,112,.4)}50%{box-shadow:0 0 0 8px rgba(201,112,112,0)}}
  .msg{animation:slideUp .2s cubic-bezier(.2,.8,.2,1);}
  .popIn{animation:popIn .15s ease;}
  .dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:${T.gold};animation:blink 1.3s ease infinite;margin:0 2px;}
  .dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
  .press{transition:transform .1s,opacity .1s;}.press:active{transform:scale(.96);opacity:.8;}
  .rec-pulse{animation:recording 1.5s ease infinite;}
  button:disabled{opacity:.25!important;cursor:not-allowed!important;}
`;

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function EspanolOS() {
  const [tab, setTab] = useState("talk");
  const [sc, setSc] = useState(SCENARIOS[0]);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [inp, setInp] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showEN, setShowEN] = useState(true);
  const [showQuick, setShowQuick] = useState(false);
  const [expandedUserMsg, setExpandedUserMsg] = useState<number | null>(null);
  const [expandPat, setExpandPat] = useState<string | null>(null);
  const [practiceText, setPracticeText] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);

  // Persistent
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [done, setDone] = useState<number[]>([]);
  const [stats, setStats] = useState<Stats>({ msgs: 0, corrections: 0, fp: 0, convos: 0 });
  const [streak, setStreak] = useState<StreakData>({ count: 0, date: "" });

  // Correction data keyed by user message ID
  const [msgCorrections, setMsgCorrections] = useState<Record<number, CorrectionData>>({});

  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load from DB
  useEffect(() => {
    dbLoad().then(d => {
      setVocab(d.vocab); setDone(d.done); setStats(d.stats); setStreak(d.streak);
      setMounted(true);
    });
    window.speechSynthesis?.getVoices();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  // ── WHISPER VOICE ─────────────────────────────────────────────────────────
  const toggleRecord = useCallback(async () => {
    if (recording) {
      mediaRecRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mediaRec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 100) return;
        const formData = new FormData();
        formData.append("file", blob, "recording.webm");
        try {
          const res = await fetch("/api/espanol/whisper", { method: "POST", body: formData });
          const data = await res.json();
          if (data.text) {
            setInp(prev => (prev ? prev + " " : "") + data.text);
            inputRef.current?.focus();
          }
        } catch { /* noop */ }
      };
      mediaRecRef.current = mediaRec;
      mediaRec.start();
      setRecording(true);
    } catch {
      alert("Microphone access required for voice input.");
    }
  }, [recording]);

  // ── SEND ──────────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    if (!inp.trim() || loading) return;
    const txt = inp.trim();
    const userMsgId = Date.now();
    const uMsg: Message = { role: "user", text: txt, id: userMsgId };
    const updated = [...msgs, uMsg];
    setMsgs(updated); setInp(""); setLoading(true);
    setShowQuick(false); setExpandedUserMsg(null);

    // Streak
    const today = new Date().toDateString();
    const newStreak = { count: streak.date === today ? streak.count : streak.count + 1, date: today };
    setStreak(newStreak); dbSave("streak", newStreak);

    const apiMsgs = updated.map(m => ({
      role: m.role === "user" ? "user" as const : "assistant" as const,
      content: m.role === "user" ? (m.text || "") : (m.raw || "{}"),
    }));

    try {
      const res = await fetch("/api/espanol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: buildPrompt(sc), messages: apiMsgs }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "{}";
      let d: AIData = {};
      try { d = JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { d = { response_es: raw, response_en: "[parse error]" }; }

      const aiMsg: Message = { role: "ai", d, raw, id: Date.now(), userMsgId };
      setMsgs(prev => [...prev, aiMsg]);

      // Store correction data keyed to userMsgId
      setMsgCorrections(prev => ({ ...prev, [userMsgId]: {
        correction: d.correction || null,
        correction_note: d.correction_note || null,
        fp: d.fluency_points || 0,
        pattern_name: d.pattern_name || null,
        pattern_formula: d.pattern_formula || null,
        flow_connector: d.flow_connector || null,
        flow_connector_meaning: d.flow_connector_meaning || null,
        new_vocab: d.new_vocab || [],
        vibe: d.vibe || null,
      }}));

      // Auto-expand if there's a correction
      if (d.correction) {
        setExpandedUserMsg(userMsgId);
      }

      if (d.new_vocab && d.new_vocab.length > 0) {
        setVocab(prev => {
          const nv = [...prev, ...d.new_vocab!].filter((v, i, a) => a.findIndex(x => x.es === v.es) === i);
          dbSave("vocab", nv);
          return nv;
        });
      }
      setStats(prev => {
        const ns = { msgs: prev.msgs + 1, corrections: prev.corrections + (d.correction ? 1 : 0), fp: prev.fp + (d.fluency_points || 0), convos: prev.convos };
        dbSave("stats", ns);
        return ns;
      });
    } catch {
      setMsgs(prev => [...prev, { role: "ai", d: { response_es: "Error de conexión. Intenta de nuevo.", response_en: "Connection error." }, raw: "{}", id: Date.now(), userMsgId }]);
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [inp, loading, msgs, sc, streak]);

  const newConvo = useCallback(() => {
    setMsgs([]); setShowQuick(false); setExpandedUserMsg(null); setMsgCorrections({});
    setStats(prev => { const ns = { ...prev, convos: prev.convos + 1 }; dbSave("stats", ns); return ns; });
  }, []);

  const completeMission = useCallback((id: number) => {
    setDone(prev => { const u = [...new Set([...prev, id])]; dbSave("done", u); return u; });
  }, []);

  const fluency = Math.min(100, Math.round(stats.fp * 0.7 + vocab.length * 0.6 + done.length * 3));

  if (!mounted) return <div style={{ height: "100dvh", background: T.bg }} />;

  return (
    <div style={{ height: "100dvh", background: T.bg, color: T.cream, fontFamily: "'Plus Jakarta Sans',sans-serif", display: "flex", flexDirection: "column", overflow: "hidden", maxWidth: 500, margin: "0 auto" }}>
      <style>{CSS}</style>

      {/* HEADER */}
      <div style={{ flexShrink: 0, padding: "14px 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: T.gold, fontWeight: 700 }}>Español</span>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: T.cream3, fontStyle: "italic" }}>OS</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: T.s1, padding: "5px 12px", borderRadius: 20, border: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 13 }}>🔥</span>
            <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 12, color: T.gold, fontWeight: 700 }}>{streak.count}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.s1, padding: "5px 12px", borderRadius: 20, border: `1px solid ${T.border}` }}>
            <div style={{ width: 42, height: 4, background: T.s2, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${fluency}%`, height: "100%", background: T.gold, transition: "width .5s" }} />
            </div>
            <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 12, color: T.gold, fontWeight: 700 }}>{fluency}</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* ══════ CONVERSAR ══════ */}
        {tab === "talk" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Scenario pills */}
            <div style={{ flexShrink: 0, overflowX: "auto", display: "flex", gap: 7, padding: "4px 18px 12px" }}>
              {SCENARIOS.map(s => (
                <button key={s.id} className="press"
                  onClick={() => { setSc(s); newConvo(); }}
                  style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 20, border: `1.5px solid ${sc.id === s.id ? s.color + "70" : T.border}`, background: sc.id === s.id ? s.color + "15" : T.s1, color: sc.id === s.id ? s.color : T.cream3, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, transition: "all .18s" }}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>

            {/* Persona header */}
            <div style={{ flexShrink: 0, marginBottom: 2, padding: "6px 18px 8px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${T.border}` }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: sc.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{sc.avatarLetter}</span>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.cream, lineHeight: 1.2 }}>{sc.personaName}, {sc.personaAge}</div>
                <div style={{ fontSize: 11, color: T.cream3 }}>{sc.personaDesc}</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.green }} />
                <span style={{ fontSize: 11, color: T.cream3 }}>en línea</span>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px 0" }}>
              {msgs.length === 0 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80%", gap: 10, textAlign: "center", padding: "0 16px 60px" }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: sc.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 2 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{sc.avatarLetter}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.cream }}>{sc.personaName}</div>
                  <div style={{ fontSize: 13, color: T.cream3, lineHeight: 1.7, maxWidth: 240 }}>{sc.personaDesc}</div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, color: T.s3, fontStyle: "italic", marginTop: 8 }}>Habla.</div>
                  <div style={{ fontSize: 13, color: T.cream3, lineHeight: 1.8 }}>Escribe cualquier cosa en español.<br /><span style={{ color: T.goldD }}>Roto está bien.</span></div>
                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                    {(QUICK[sc.id] || []).map((q, i) => (
                      <button key={i} className="press" onClick={() => setInp(q)}
                        style={{ padding: "7px 13px", borderRadius: 16, border: `1px solid ${T.border}`, background: T.s1, color: T.cream2, fontSize: 12, fontStyle: "italic" }}>
                        &ldquo;{q}&rdquo;
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 12 }}>
                {msgs.map(msg => {
                  if (msg.role === "user") {
                    const corrData = msgCorrections[msg.id];
                    const isExpanded = expandedUserMsg === msg.id;
                    const hasCorrectionData = corrData !== undefined;
                    const hasError = hasCorrectionData && corrData.correction;
                    const dotColor = hasCorrectionData ? (hasError ? T.red : T.green) : "transparent";

                    return (
                      <div key={msg.id} className="msg" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                          {/* Quality indicator dot */}
                          {hasCorrectionData && (
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: hasError ? T.red : T.green, flexShrink: 0, marginTop: 6 }} />
                          )}
                          {/* Bubble — tappable */}
                          <button className="press" onClick={() => {
                            if (!hasCorrectionData) return;
                            setExpandedUserMsg(isExpanded ? null : msg.id);
                          }}
                            style={{ background: T.s2, borderLeft: `3px solid ${sc.color}`, borderRadius: "18px 18px 4px 18px", padding: "11px 15px", maxWidth: "80%", fontSize: 15, lineHeight: 1.6, color: T.cream, textAlign: "left", cursor: hasCorrectionData ? "pointer" : "default", borderTop: "none", borderRight: "none", borderBottom: "none" }}>
                            {msg.text}
                          </button>
                        </div>
                        {/* Tap hint */}
                        {hasCorrectionData && !isExpanded && (
                          <div style={{ fontSize: 10, color: T.cream3, paddingRight: 4, display: "flex", alignItems: "center", gap: 4 }}>
                            <div style={{ width: 5, height: 5, borderRadius: "50%", background: dotColor }} />
                            {hasError ? "Toca para ver corrección" : "correcto — toca para ver análisis"}
                          </div>
                        )}
                        {/* Expanded correction card */}
                        {isExpanded && hasCorrectionData && (
                          <div className="popIn" style={{ width: "86%", background: T.s1, border: `1px solid ${hasError ? T.red + "40" : T.green + "40"}`, borderRadius: 12, padding: "12px 14px", marginRight: 0 }}>
                            {/* FP bar */}
                            <div style={{ display: "flex", gap: 2, marginBottom: 8, alignItems: "center" }}>
                              {Array.from({ length: 10 }).map((_, i) => (
                                <div key={i} style={{ width: 16, height: 4, borderRadius: 2, background: i < (corrData.fp || 0) ? T.gold : T.s3, flex: 1 }} />
                              ))}
                              <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, color: T.gold, marginLeft: 6, flexShrink: 0 }}>{corrData.fp}/10</span>
                            </div>

                            {!hasError && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: corrData.vibe ? 8 : 0 }}>
                                <span style={{ color: T.green, fontSize: 15 }}>✓</span>
                                <span style={{ fontSize: 13, color: T.green, fontWeight: 600 }}>Sin errores gramaticales</span>
                              </div>
                            )}

                            {hasError && (
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 10, color: T.red, fontWeight: 700, letterSpacing: "1.5px", marginBottom: 5 }}>CORRECCIÓN</div>
                                <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 13, color: T.red, lineHeight: 1.5, background: `${T.red}0d`, padding: "8px 10px", borderRadius: 8 }}>
                                  {corrData.correction}
                                </div>
                                {corrData.correction_note && (
                                  <div style={{ fontSize: 12, color: "#8a5555", marginTop: 5, lineHeight: 1.6 }}>{corrData.correction_note}</div>
                                )}
                              </div>
                            )}

                            {corrData.vibe && (
                              <div style={{ fontSize: 12, color: T.goldD, fontStyle: "italic", borderTop: `1px solid ${T.border}`, paddingTop: 6 }}>{corrData.vibe}</div>
                            )}

                            {corrData.pattern_name && (
                              <div style={{ marginTop: 8, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                                <div style={{ fontSize: 10, color: T.goldD, fontWeight: 700, letterSpacing: "1px", marginBottom: 3 }}>PATRÓN GRAMÁTICO</div>
                                <div style={{ fontSize: 12, color: T.gold }}>{corrData.pattern_name}</div>
                                {corrData.pattern_formula && <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, color: T.goldD, marginTop: 2 }}>{corrData.pattern_formula}</div>}
                              </div>
                            )}

                            {corrData.flow_connector && (
                              <button className="press" onClick={() => {
                                setInp(p => (p ? p + " " : "") + corrData.flow_connector);
                                setExpandedUserMsg(null);
                                inputRef.current?.focus();
                              }}
                                style={{ marginTop: 8, width: "100%", padding: "8px 12px", borderRadius: 10, background: `${T.blue}12`, border: `1px solid ${T.blue}35`, color: T.blue, fontSize: 13, fontWeight: 600, fontStyle: "italic", textAlign: "left" }}>
                                Di ahora → &ldquo;{corrData.flow_connector}&rdquo;
                                <span style={{ fontSize: 11, color: T.cream3, fontStyle: "normal", marginLeft: 4 }}>({corrData.flow_connector_meaning})</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // AI message
                  return (
                    <div key={msg.id} className="msg" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                        {/* Small avatar */}
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: sc.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginBottom: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{sc.avatarLetter}</span>
                        </div>
                        <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: "4px 18px 18px 18px", padding: "12px 16px", fontSize: 15, lineHeight: 1.7, color: T.cream, maxWidth: "82%" }}>
                          {msg.d?.response_es}
                        </div>
                        {msg.d?.response_es && (
                          <button onClick={() => speak(msg.d!.response_es!)} style={{ opacity: .3, fontSize: 15, paddingBottom: 4, flexShrink: 0 }}>🔊</button>
                        )}
                      </div>
                      {msg.d?.vibe && <div style={{ fontSize: 12, color: T.goldD, paddingLeft: 34, fontStyle: "italic" }}>{msg.d.vibe}</div>}
                      {showEN && msg.d?.response_en && (
                        <div style={{ fontSize: 12, color: T.cream3, paddingLeft: 34, fontStyle: "italic", lineHeight: 1.6 }}>{msg.d.response_en}</div>
                      )}
                    </div>
                  );
                })}

                {loading && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: sc.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{sc.avatarLetter}</span>
                    </div>
                    <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: "4px 18px 18px 18px", padding: "12px 16px" }}>
                      <div className="dot" /><div className="dot" /><div className="dot" />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Quick phrases drawer */}
            {showQuick && (
              <div style={{ flexShrink: 0, background: T.s1, borderTop: `1px solid ${T.border}`, padding: "10px 16px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(QUICK[sc.id] || []).map((q, i) => (
                  <button key={i} className="press" onClick={() => { setInp(q); setShowQuick(false); inputRef.current?.focus(); }}
                    style={{ padding: "6px 12px", borderRadius: 14, background: T.s2, border: `1px solid ${T.border}`, color: T.cream2, fontSize: 13, fontStyle: "italic" }}>
                    &ldquo;{q}&rdquo;
                  </button>
                ))}
              </div>
            )}

            {/* INPUT */}
            <div style={{ flexShrink: 0, padding: "10px 14px", paddingBottom: "calc(10px + env(safe-area-inset-bottom,0px))", background: T.bg, borderTop: `1px solid ${T.border}` }}>
              {/* Toolbar */}
              <div style={{ display: "flex", gap: 6, marginBottom: 8, overflowX: "auto" }}>
                <button className="press" onClick={() => setShowQuick(p => !p)}
                  style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 14, background: showQuick ? `${T.blue}18` : T.s1, border: `1px solid ${showQuick ? T.blue + "50" : T.border}`, color: showQuick ? T.blue : T.cream3, fontSize: 12, fontWeight: 600 }}>
                  Frases rápidas
                </button>
                <button className="press" onClick={() => setShowEN(p => !p)}
                  style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 14, background: T.s1, border: `1px solid ${T.border}`, color: T.cream3, fontSize: 12, fontWeight: 600 }}>
                  EN {showEN ? "✓" : "✗"}
                </button>
                <button className="press" onClick={newConvo}
                  style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 14, background: T.s1, border: `1px solid ${T.border}`, color: T.cream3, fontSize: 12, fontWeight: 600, marginLeft: "auto" }}>
                  Nueva
                </button>
              </div>

              {/* Input row */}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                {/* Mic — SVG icon */}
                <button className={`press ${recording ? "rec-pulse" : ""}`} onClick={toggleRecord}
                  style={{ width: 48, height: 48, borderRadius: 14, background: recording ? `${T.red}20` : T.s1, border: `1.5px solid ${recording ? T.red + "70" : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {recording ? (
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: T.red }} />
                  ) : (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                      <rect x="9" y="2" width="6" height="11" rx="3" stroke={T.cream2} strokeWidth="1.7" />
                      <path d="M5 10a7 7 0 0 0 14 0" stroke={T.cream2} strokeWidth="1.7" strokeLinecap="round" />
                      <path d="M12 19v3M9 22h6" stroke={T.cream2} strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  )}
                </button>

                {/* Text area */}
                <textarea ref={inputRef} value={inp} onChange={e => setInp(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 500) { e.preventDefault(); send(); } }}
                  placeholder="Escribe en español..."
                  rows={2}
                  style={{ flex: 1, background: T.s1, border: `1.5px solid ${inp.trim() ? T.gold + "50" : T.border}`, borderRadius: 14, color: T.cream, fontSize: 15, padding: "11px 14px", lineHeight: 1.5, minHeight: 48, maxHeight: 100, transition: "border-color .2s" }}
                />

                {/* Send — SVG arrow */}
                <button className="press" onClick={send} disabled={loading || !inp.trim()}
                  style={{ width: 48, height: 48, borderRadius: 14, background: inp.trim() && !loading ? T.gold : T.s1, border: `1.5px solid ${inp.trim() && !loading ? T.gold : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .18s" }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke={inp.trim() && !loading ? "#000" : T.cream3} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ PATRONES ══════ */}
        {tab === "patterns" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px" }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T.cream, marginBottom: 6 }}>10 Patrones.</div>
              <div style={{ fontSize: 14, color: T.cream3, lineHeight: 1.75 }}>Cada uno desbloquea cientos de frases. Estudia → escribe → practica en conversación real.</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {PATTERNS.map(p => (
                <div key={p.id} className="press" onClick={() => setExpandPat(expandPat === p.id ? null : p.id)}
                  style={{ background: T.s1, border: `1.5px solid ${expandPat === p.id ? p.color + "50" : T.border}`, borderRadius: 14, overflow: "hidden", transition: "border-color .2s", cursor: "pointer" }}>
                  <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, color: T.cream3 }}>#{p.n.toString().padStart(2, "0")}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: T.cream }}>{p.name}</span>
                      </div>
                      <div style={{ fontSize: 12, color: T.cream3, marginBottom: 6 }}>{p.sub}</div>
                      <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 11, color: p.color, background: `${p.color}12`, padding: "3px 9px", borderRadius: 6, display: "inline-block" }}>{p.formula}</div>
                    </div>
                    <span style={{ color: T.cream3, fontSize: 12, marginTop: 2, flexShrink: 0 }}>{expandPat === p.id ? "▲" : "▼"}</span>
                  </div>
                  {expandPat === p.id && (
                    <div style={{ borderTop: `1px solid ${T.border}`, padding: "14px 16px" }} onClick={e => e.stopPropagation()}>
                      <div style={{ fontSize: 13, color: T.cream2, lineHeight: 1.8, background: T.s2, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>{p.rule}</div>
                      {p.ex.map((e, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: `1px solid ${T.border}` }}>
                          <button onClick={() => speak(e.es)} style={{ opacity: .35, fontSize: 15, flexShrink: 0 }}>🔊</button>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, color: T.cream, fontStyle: "italic", marginBottom: 2 }}>&ldquo;{e.es}&rdquo;</div>
                            <div style={{ fontSize: 12, color: T.cream3 }}>{e.en}</div>
                          </div>
                        </div>
                      ))}
                      <div style={{ marginTop: 12, background: `${p.color}0d`, border: `1px solid ${p.color}25`, borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: p.color, fontWeight: 700, letterSpacing: "1.5px", marginBottom: 4 }}>DRILL</div>
                        <div style={{ fontSize: 13, color: T.cream3, lineHeight: 1.7 }}>{p.drill}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input value={practiceText[p.id] || ""} onChange={e => setPracticeText(prev => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="Tu intento en español..."
                          style={{ flex: 1, background: T.s2, border: `1.5px solid ${T.border}`, borderRadius: 10, color: T.cream, fontSize: 14, padding: "10px 13px" }} />
                        <button className="press" style={{ background: p.color, color: "#000", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}
                          onClick={() => { if (practiceText[p.id]) { setInp(practiceText[p.id]); setTab("talk"); } }}>
                          Practicar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ MISIONES ══════ */}
        {tab === "missions" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px" }}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T.cream, marginBottom: 6 }}>15 Misiones.</div>
              <div style={{ fontSize: 14, color: T.cream3, lineHeight: 1.7 }}>Una por día. El lenguaje bajo presión real se graba para siempre.</div>
            </div>
            {([1, 2, 3, 4] as const).map(wk => {
              const wm = MISSIONS.filter(m => m.w === wk);
              const wn: Record<number, string> = { 1: "Supervivencia", 2: "Movilidad", 3: "Social + Mujeres", 4: "Fluidez" };
              return (
                <div key={wk} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 11, color: T.cream3, fontWeight: 700, letterSpacing: "2px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
                    SEMANA {wk} — {wn[wk]}
                    <div style={{ flex: 1, height: 1, background: T.border }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {wm.map(m => {
                      const isDone = done.includes(m.id);
                      return (
                        <div key={m.id} style={{ background: T.s1, border: `1.5px solid ${isDone ? T.green + "30" : T.border}`, borderRadius: 14, padding: "14px 16px", opacity: isDone ? .6 : 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 9, color: T.cream3, fontWeight: 600, letterSpacing: "1px" }}>DÍA {m.day}</span>
                                <div style={{ display: "flex", gap: 2 }}>
                                  {Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i < m.diff ? T.gold : T.s2 }} />)}
                                </div>
                              </div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: isDone ? T.cream3 : T.cream, marginBottom: 5 }}>{m.icon} {m.title}</div>
                              <div style={{ fontSize: 13, color: T.cream3, lineHeight: 1.65, marginBottom: 8 }}>{m.desc}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                {m.vocab.map((v, i) => (
                                  <button key={i} className="press" onClick={() => speak(v)}
                                    style={{ fontSize: 11, color: T.cream3, background: T.s2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "3px 9px", fontStyle: "italic" }}>
                                    🔊 {v}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                              {!isDone && (
                                <button className="press" onClick={() => {
                                  const target = m.id >= 10 && m.id <= 11 ? SCENARIOS.find(s => s.id === "dating") || SCENARIOS[0] : SCENARIOS[0];
                                  setSc(target); newConvo(); setTab("talk");
                                }} style={{ background: T.gold, color: "#000", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700 }}>
                                  Practicar
                                </button>
                              )}
                              <button className="press" onClick={() => !isDone && completeMission(m.id)}
                                style={{ background: isDone ? `${T.green}15` : "none", border: `1.5px solid ${isDone ? T.green + "40" : T.border}`, borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 600, color: isDone ? T.green : T.cream3 }}>
                                {isDone ? "✓ Hecha" : "Marcar"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══════ VOCAB ══════ */}
        {tab === "vocab" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px" }}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T.cream, marginBottom: 6 }}>Tu Vocabulario</div>
              <div style={{ fontSize: 14, color: T.cream3 }}>{vocab.length} palabras de conversaciones reales tuyas.</div>
            </div>
            {vocab.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: T.cream3 }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>📚</div>
                <div style={{ fontSize: 14, lineHeight: 1.9 }}>Empieza a conversar.<br />Tu banco crece solo.</div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 14, background: `${T.gold}0a`, border: `1px solid ${T.gold}22`, borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: T.goldD, fontWeight: 700, letterSpacing: "1.5px", marginBottom: 8 }}>REPASAR AHORA</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {vocab.slice(-8).map((v, i) => (
                      <button key={i} className="press" onClick={() => speak(v.es)}
                        style={{ padding: "5px 11px", borderRadius: 12, background: `${T.gold}10`, border: `1px solid ${T.gold}22`, fontSize: 13, color: T.goldD, fontStyle: "italic" }}>
                        🔊 {v.es}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[...vocab].reverse().map((v, i) => (
                    <div key={i} style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 15, color: T.cream, fontStyle: "italic", marginBottom: 2 }}>{v.es}</div>
                        <div style={{ fontSize: 12, color: T.cream3 }}>{v.en}</div>
                      </div>
                      <button className="press" onClick={() => speak(v.es)} style={{ fontSize: 18, opacity: .3 }}>🔊</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════ PROGRESO ══════ */}
        {tab === "progress" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px" }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T.cream, marginBottom: 18 }}>Progreso</div>

            <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 16, padding: "20px 18px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.cream3, fontWeight: 700, letterSpacing: "2px", marginBottom: 12 }}>FLUIDEZ</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
                <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 52, color: T.gold, fontWeight: 700, lineHeight: 1 }}>{fluency}</div>
                <div style={{ fontSize: 16, color: T.cream3 }}>/100</div>
              </div>
              <div style={{ height: 6, background: T.s2, borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ width: `${fluency}%`, height: "100%", background: `linear-gradient(90deg,${T.goldD},${T.goldL})`, borderRadius: 3, transition: "width .8s" }} />
              </div>
              <div style={{ fontSize: 13, color: T.cream3 }}>
                {fluency < 15 ? "Principiante" : fluency < 35 ? "Básico — ya puedes sobrevivir" : fluency < 55 ? "Intermedio — las conversaciones fluyen" : fluency < 75 ? "Avanzado" : "Fluido — ¡felicitaciones!"}
              </div>
            </div>

            <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px", marginBottom: 12, display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 38 }}>🔥</span>
              <div>
                <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 40, color: T.gold, fontWeight: 700, lineHeight: 1 }}>{streak.count}</div>
                <div style={{ fontSize: 12, color: T.cream3, marginTop: 3 }}>DÍAS CONSECUTIVOS</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              {[
                { label: "Mensajes", val: stats.msgs, c: T.gold },
                { label: "Correcciones", val: stats.corrections, c: T.red },
                { label: "Palabras", val: vocab.length, c: T.blue },
                { label: "Misiones", val: done.length, c: T.green },
                { label: "Conversaciones", val: stats.convos, c: T.gold },
                { label: "Puntos FP", val: stats.fp, c: T.blue },
              ].map((s, i) => (
                <div key={i} style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px" }}>
                  <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 32, color: s.c, fontWeight: 700, lineHeight: 1, marginBottom: 6 }}>{s.val}</div>
                  <div style={{ fontSize: 12, color: T.cream3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ flexShrink: 0, background: T.bg, borderTop: `1px solid ${T.border}`, display: "flex", paddingBottom: "env(safe-area-inset-bottom,0px)" }}>
        {(["talk", "patterns", "missions", "vocab", "progress"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: "12px 4px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: tab === t ? T.gold : T.cream3, transition: "color .2s" }}>
            <div style={{ opacity: tab === t ? 1 : .35, transition: "opacity .2s" }}>{ICONS[t]}</div>
            <span style={{ fontSize: 10, fontWeight: 700 }}>
              {t === "talk" ? "Hablar" : t === "patterns" ? "Patrones" : t === "missions" ? "Misiones" : t === "vocab" ? "Vocab" : "Progreso"}
            </span>
            {tab === t && <div style={{ width: 18, height: 2.5, borderRadius: 2, background: T.gold }} />}
          </button>
        ))}
      </div>
    </div>
  );
}
