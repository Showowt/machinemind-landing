"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── COLORS ──────────────────────────────────────────────────────────────────
const G = "#C9A84C";
const B = "#7B8CDE";
const GR = "#5EAB7A";
const RD = "#DE7B7B";
const PUR = "#A87CC9";

// ── SCENARIOS ───────────────────────────────────────────────────────────────
const SCENARIOS = [
  { id: "daily", icon: "☀️", label: "Vida Diaria", sub: "Taxis, tiendas, restaurantes, planes", color: G },
  { id: "social", icon: "🍻", label: "Social", sub: "Amigos, historias, conversacion real", color: B },
  { id: "biz", icon: "💼", label: "Negocios", sub: "Acuerdos, negociaciones, equipo", color: GR },
  { id: "site", icon: "🏗️", label: "Casa Badillo", sub: "Contratistas, materiales, tiempos", color: G },
  { id: "dating", icon: "🔥", label: "Mujeres", sub: "Citas, flirteo, conversacion con mujeres", color: RD },
  { id: "deep", icon: "🧠", label: "Profundo", sub: "Opiniones, sentimientos, ideas complejas", color: PUR },
  { id: "city", icon: "🏛️", label: "Cartagena", sub: "Ciudad, cultura, barrios, gente local", color: B },
];

// ── QUICK PHRASES ───────────────────────────────────────────────────────────
const QUICK: Record<string, string[]> = {
  daily: ["¿Cuanto cuesta?", "¿Me lleva a...?", "La cuenta, por favor", "¿Como llego a...?", "No entiendo bien"],
  social: ["Cuentame mas", "¿En serio?", "¡Que chevere!", "¿Y tu que piensas?", "Me parece interesante"],
  biz: ["¿Cuando terminamos?", "Eso no me cuadra", "¿Cual es el precio final?", "Necesito que...", "Vamos a quedar en..."],
  site: ["¿Como va el trabajo?", "¿Que falta?", "Hay un problema con...", "¿Cuantos dias mas?", "Necesito mas trabajadores"],
  dating: ["Me caes muy bien", "Tienes algo especial", "Me gustaria conocerte mejor", "¿Que te apasiona?", "Eres muy interesante"],
  deep: ["Creo que...", "La verdad es que...", "Me parece que...", "No estoy seguro, pero...", "Pienso que..."],
  city: ["¿Que barrio me recomiendas?", "¿Donde se come bien?", "¿Como es vivir aqui?", "Cuentame de Cartagena", "¿Que hay de bueno por aqui?"],
};

// ── PATTERNS ────────────────────────────────────────────────────────────────
interface PatternType {
  id: string;
  n: number;
  name: string;
  sub: string;
  color: string;
  formula: string;
  rule: string;
  examples: { es: string; en: string }[];
  drill: string;
}

const PATTERNS: PatternType[] = [
  {
    id: "adj", n: 1, name: "Adjective After Noun", sub: "The #1 English-speaker mistake", color: G,
    formula: "[Noun] + [Adjective]",
    rule: "In Spanish adjectives come AFTER the noun. Every time. 'House big.' It feels wrong — that's the signal you're learning.",
    examples: [
      { es: "una casa grande", en: "a big house — NOT 'una grande casa'" },
      { es: "un dia bonito", en: "a beautiful day" },
      { es: "trabajo importante", en: "important work" },
      { es: "agua fria", en: "cold water" },
      { es: "un proyecto ambicioso", en: "an ambitious project" },
    ],
    drill: "Translate: 'I want a cold beer' / 'That's a beautiful city' / 'He's a good person' / 'It's an expensive hotel'"
  },
  {
    id: "want", n: 2, name: "Want To / Going To", sub: "Two patterns that unlock every intention", color: B,
    formula: "Quiero + [inf] | Voy a + [inf]",
    rule: "Quiero = desire. Voy a = near future plan. After both, the next verb stays in infinitive. You never conjugate it.",
    examples: [
      { es: "Quiero ir al mercado", en: "I want to go to the market" },
      { es: "Voy a hablar con el contratista", en: "I'm going to talk to the contractor" },
      { es: "¿Quieres tomar algo?", en: "Do you want to drink something?" },
      { es: "Voy a necesitar mas tiempo", en: "I'm going to need more time" },
      { es: "Quiero entender mejor esto", en: "I want to understand this better" },
    ],
    drill: "Express 5 things you want to do this week and 5 things you're going to do tomorrow."
  },
  {
    id: "opinion", n: 3, name: "Opinion Launchers", sub: "Open any complex thought with these", color: GR,
    formula: "Creo que + [sentence] | Me parece que + [sentence]",
    rule: "Sentence multipliers. After 'Creo que', simpler grammar still sounds sophisticated. They also buy thinking time.",
    examples: [
      { es: "Creo que el precio es muy alto", en: "I think the price is too high" },
      { es: "Me parece que necesitamos mas tiempo", en: "It seems to me we need more time" },
      { es: "Pienso que podemos hacerlo mejor", en: "I think we can do it better" },
      { es: "La verdad es que no se", en: "The truth is I don't know" },
      { es: "Siento que algo esta mal aqui", en: "I feel like something is wrong here" },
    ],
    drill: "Give your opinion on: today's weather, a recent decision, something you're unsure about."
  },
  {
    id: "flow", n: 4, name: "Conversation Keepers", sub: "4 phrases that keep any conversation alive", color: "#E07B54",
    formula: "¿Y tu? | ¿Como asi? | Cuentame mas | ¿En serio?",
    rule: "When you don't know what to say — use one. They signal genuine interest AND buy thinking time. '¿Como asi?' is the most powerful.",
    examples: [
      { es: "Interesante. ¿Y tu que piensas?", en: "Interesting. What do you think?" },
      { es: "¿Como asi? Explicame mejor.", en: "How so? Explain it better." },
      { es: "Cuentame mas sobre eso.", en: "Tell me more about that." },
      { es: "¿En serio? ¿Y que paso despues?", en: "Really? And what happened after?" },
      { es: "Eso es bacano. ¿Desde cuando?", en: "That's cool. Since when?" },
    ],
    drill: "Practice responding to everything with one of these BEFORE adding your own thought."
  },
  {
    id: "serstar", n: 5, name: "Ser vs. Estar", sub: "Permanent identity vs. temporary state", color: PUR,
    formula: "SER = permanent/identity | ESTAR = temporary/location/state",
    rule: "Quick test: 'Would this be true in 10 years?' Yes = SER. No = ESTAR. Nationality, profession, character = SER. Location, feelings, conditions = ESTAR.",
    examples: [
      { es: "Soy americano. Estoy en Colombia.", en: "I AM American (always) / I'm IN Colombia (right now)" },
      { es: "Es un buen restaurante. Esta muy lleno.", en: "It's a good restaurant / It's very full right now" },
      { es: "Soy empresario. Estoy ocupado hoy.", en: "I'm an entrepreneur (identity) / I'm busy today (state)" },
      { es: "La habitacion es grande. Esta sucia.", en: "The room is big (always) / It's dirty (right now)" },
      { es: "Ella es inteligente. Esta cansada.", en: "She's intelligent / She's tired right now" },
    ],
    drill: "Describe: yourself (identity), your current mood, your work, where you are now."
  },
  {
    id: "time", n: 6, name: "Time & Story Flow", sub: "Connects events into real narrative", color: G,
    formula: "Cuando + [verb] | Despues de + [inf] | Mientras + [verb] | Antes de + [inf]",
    rule: "Without connectors: 'Llegue. Comi. Hable.' With them: 'Cuando llegue, despues de comer, mientras hablaba...' — completely different level.",
    examples: [
      { es: "Cuando llegue, no habia nadie.", en: "When I arrived, there was no one." },
      { es: "Despues de comer, vamos al bar.", en: "After eating, we go to the bar." },
      { es: "Mientras trabajo, escucho musica.", en: "While I work, I listen to music." },
      { es: "Antes de salir, necesito llamarte.", en: "Before leaving, I need to call you." },
      { es: "Tan pronto como llegues, me avisas.", en: "As soon as you arrive, let me know." },
    ],
    drill: "Tell me about your yesterday using at least 3 of these connectors."
  },
  {
    id: "modal", n: 7, name: "Can / Should / Must", sub: "Three power verbs covering 40% of practical Spanish", color: GR,
    formula: "Puedo + inf | Deberias + inf | Tengo que + inf | Hay que + inf",
    rule: "Poder (can), Deberias (should), Tener que (have to — personal), Hay que (must — impersonal). These + any infinitive = almost any obligation or ability.",
    examples: [
      { es: "¿Puedes explicarme eso mejor?", en: "Can you explain that better?" },
      { es: "Deberias ver Getsemani por la noche.", en: "You should see Getsemani at night." },
      { es: "Tengo que salir en diez minutos.", en: "I have to leave in ten minutes." },
      { es: "Hay que hablar con el contratista hoy.", en: "Someone needs to talk to the contractor today." },
      { es: "No puedo creer lo rapido que va esto.", en: "I can't believe how fast this is going." },
    ],
    drill: "Give 3 recommendations using 'deberias'. List 3 things you can't do and 3 you have to do this week."
  },
  {
    id: "cond", n: 8, name: "Conditionals & Wishes", sub: "Hypotheticals, dreams, polite requests", color: B,
    formula: "Me gustaria + inf | Si pudiera + inf | Si tuviera + noun, [verb]-ria",
    rule: "Me gustaria and Quisiera are the polite versions of 'quiero'. They instantly elevate your register. Si + pudiera/tuviera + -ria opens hypothetical conversations.",
    examples: [
      { es: "Me gustaria conocerte mejor.", en: "I would like to get to know you better." },
      { es: "Quisiera mas tiempo para este proyecto.", en: "I'd want more time for this project." },
      { es: "Si pudiera, viviria aqui para siempre.", en: "If I could, I'd live here forever." },
      { es: "Si tuviera mas capital, expandiria mas rapido.", en: "If I had more capital, I'd expand faster." },
      { es: "¿Que harias si pudieras empezar de nuevo?", en: "What would you do if you could start over?" },
    ],
    drill: "Tell me 3 things you'd do with unlimited time. 3 polite requests using 'me gustaria'."
  },
  {
    id: "dating1", n: 9, name: "Flirteo Natural", sub: "Conversation starters and natural charm in Spanish", color: RD,
    formula: "Compliment + Question | Observation + Curiosity",
    rule: "Colombian women respond to genuine curiosity over generic compliments. Ask about her life, passions, dreams. Specific > generic. Humor > intensity.",
    examples: [
      { es: "Me caes muy bien, tienes algo especial.", en: "I really like you, there's something special about you." },
      { es: "¿Que te apasiona? Quiero saber mas de ti.", en: "What are you passionate about? I want to know more about you." },
      { es: "Tienes una energia muy bonita.", en: "You have really beautiful energy." },
      { es: "Me encanta tu forma de pensar.", en: "I love the way you think." },
      { es: "¿Como asi que nunca has ido? Vamos juntos.", en: "Wait, you've never been? Let's go together." },
    ],
    drill: "Practice: Give 3 specific compliments (not about looks). Ask 3 questions showing genuine curiosity."
  },
  {
    id: "dating2", n: 10, name: "Escalation & Plans", sub: "Moving from conversation to real plans", color: RD,
    formula: "Expression of Interest + Concrete Plan",
    rule: "Natural progression: conversation then genuine interest then specific compliment then deeper question then ask for number or date. Don't rush. Be direct but warm.",
    examples: [
      { es: "Oye, la estoy pasando muy bien contigo.", en: "Hey, I'm having a really good time with you." },
      { es: "Me gustaria invitarte a un cafe. ¿Cuando estas libre?", en: "I'd like to invite you for coffee. When are you free?" },
      { es: "Dame tu numero y te escribo para cuadrar algo.", en: "Give me your number and I'll text you to set something up." },
      { es: "¿Te gustaria ir a cenar conmigo este fin de semana?", en: "Would you like to go to dinner with me this weekend?" },
      { es: "Quiero seguir hablando contigo. ¿Nos vemos manana?", en: "I want to keep talking with you. See you tomorrow?" },
    ],
    drill: "Practice: Transition a friendly conversation into asking for a date. Use 'me gustaria' and suggest a specific plan."
  },
];

// ── MISSIONS ────────────────────────────────────────────────────────────────
interface MissionType {
  id: number;
  w: number;
  day: number;
  title: string;
  loc: string;
  desc: string;
  vocab: string[];
  diff: number;
  icon: string;
}

const MISSIONS: MissionType[] = [
  { id: 1, w: 1, day: 1, icon: "🚕", title: "El Taxi", loc: "Cualquier taxi en Cartagena", desc: "Take a real taxi. Tell the driver your destination. Ask how long, ask the price. Negotiate if needed.", vocab: ["¿Me lleva a...?", "¿Cuanto cobra?", "¿Cuanto tarda?", "Esta muy caro", "Dale, vamos."], diff: 1 },
  { id: 2, w: 1, day: 2, icon: "🍽️", title: "El Restaurante", loc: "Restaurante local", desc: "Order a full meal. Ask what they recommend. Ask about ingredients. Get the check.", vocab: ["¿Que me recomienda?", "¿Que tiene de...?", "La cuenta, por favor.", "Estuvo delicioso."], diff: 1 },
  { id: 3, w: 1, day: 3, icon: "🛒", title: "El Mercado", loc: "Mercado de Bazurto", desc: "Buy 5 things. Negotiate the price on at least one item. Have a short personal exchange.", vocab: ["¿Cuanto vale?", "¿Me hace un descuentico?", "¿Donde encuentro...?", "Esta fresco?"], diff: 1 },
  { id: 4, w: 1, day: 4, icon: "🗺️", title: "Las Indicaciones", loc: "El Centro o Getsemani", desc: "Give someone directions to a place you know. Navigate entirely in Spanish.", vocab: ["Siga derecho.", "Doble a la izquierda.", "Esta a dos cuadras.", "No se puede perder."], diff: 1 },
  { id: 5, w: 1, day: 5, icon: "🏠", title: "El Vecino", loc: "Tu edificio o barrio", desc: "Have a genuine 5-minute conversation with someone in your building you don't usually talk to.", vocab: ["¿Cuanto tiempo lleva aqui?", "¿Que tal el barrio?", "Que calor, ¿verdad?", "Mucho gusto."], diff: 2 },
  { id: 6, w: 2, day: 8, icon: "🏗️", title: "El Contratista", loc: "Casa Badillo", desc: "Full project briefing at Casa Badillo in Spanish. Timeline, materials, raise one concern. No English.", vocab: ["¿Como vamos con el cronograma?", "¿Que falta?", "Eso no me cuadra.", "¿Cuando terminamos?"], diff: 3 },
  { id: 7, w: 2, day: 9, icon: "🤝", title: "La Negociacion", loc: "Cualquier proveedor", desc: "Negotiate something — price, timeline, terms. Don't accept first offer. Go 3 rounds minimum.", vocab: ["Ese precio esta muy alto.", "¿Lo mejor que me puede hacer?", "Si me da X, cerramos hoy.", "Necesito pensarlo."], diff: 3 },
  { id: 8, w: 2, day: 10, icon: "📋", title: "El Brief al Equipo", loc: "MachineMind", desc: "Brief your sales team entirely in Spanish for 10 minutes. Priorities, expectations, feedback.", vocab: ["Esta semana nos enfocamos en...", "Necesito que...", "Lo que espero es...", "¿Alguna pregunta?"], diff: 3 },
  { id: 9, w: 2, day: 12, icon: "📦", title: "El Proveedor", loc: "Cualquier proveedor local", desc: "Get a quote. Ask about quality, delivery time, payment terms. Compare to a competitor.", vocab: ["¿Cuales son sus tiempos?", "¿Que garantia tiene?", "¿Tiene algo mas economico?", "¿Me puede dar eso por escrito?"], diff: 3 },
  { id: 10, w: 3, day: 15, icon: "📖", title: "Mi Historia", loc: "Contexto social", desc: "Tell someone the complete story of why you came to Cartagena and what you're building.", vocab: ["Vine porque...", "Lo que mas me gusta es...", "El plan es...", "Lo mas dificil ha sido...", "Lo que nadie sabe es que..."], diff: 3 },
  { id: 11, w: 3, day: 16, icon: "🍸", title: "El Bar", loc: "Bar local en Getsemani", desc: "Go to a local bar. Start a conversation with a stranger. Find out their story. Stay 30 minutes.", vocab: ["¿De donde eres?", "¿A que te dedicas?", "Oye, ¿que me recomiendas tomar?", "¡Brindemos!"], diff: 4 },
  { id: 12, w: 3, day: 17, icon: "⚡", title: "El Debate", loc: "Cualquier contexto social", desc: "Have a real debate. Disagree respectfully. Hold your position through at least 2 exchanges.", vocab: ["Entiendo tu punto, pero...", "Yo lo veo diferente porque...", "Puede ser, aunque...", "Con todo respeto, no estoy de acuerdo."], diff: 4 },
  { id: 13, w: 3, day: 18, icon: "🔥", title: "La Cita", loc: "Bar, restaurante, o cafe", desc: "Have a full date conversation in Spanish. Show genuine interest. Ask deeper questions. Be charming, not trying hard.", vocab: ["Me caes muy bien.", "¿Que te apasiona?", "Me gustaria verte de nuevo.", "La estoy pasando increible contigo."], diff: 4 },
  { id: 14, w: 3, day: 19, icon: "😂", title: "El Humor", loc: "Cualquier contexto casual", desc: "Make someone genuinely laugh in Spanish. Tell a story with a punchline.", vocab: ["¿En serio? ¡No puede ser!", "Imaginante la situacion...", "La cosa es que...", "¡Me mato de la risa!"], diff: 4 },
  { id: 15, w: 4, day: 22, icon: "💰", title: "El Pitch Completo", loc: "Con un cliente colombiano", desc: "Pitch MachineMind's AI services entirely in Spanish. Problem, solution, results, pricing. Handle objections.", vocab: ["Nuestro sistema le permite...", "El resultado es...", "La inversion es...", "¿Le interesaria una demostracion?"], diff: 5 },
  { id: 16, w: 4, day: 24, icon: "💕", title: "La Segunda Cita", loc: "Cualquier lugar romantico", desc: "Have a deeper conversation. Talk about dreams, life plans, what you value. Be vulnerable in Spanish.", vocab: ["Lo que mas valoro en la vida es...", "Mi sueno es...", "Contigo me siento...", "Quiero que sepas que..."], diff: 5 },
  { id: 17, w: 4, day: 25, icon: "🎯", title: "La Reunion", loc: "Contexto de negocios", desc: "Conduct a full 30-minute business meeting in Spanish. No English. If you don't know a word, describe it.", vocab: ["Lo que quiero decir es...", "Como iba diciendo...", "Para resumir...", "¿Estamos de acuerdo?", "El proximo paso es..."], diff: 5 },
];

// ── TYPES ───────────────────────────────────────────────────────────────────
interface VocabItem {
  es: string;
  en: string;
  type?: string;
}

interface AIData {
  response_es?: string;
  response_en?: string;
  correction?: string | null;
  correction_note?: string | null;
  pattern_name?: string;
  pattern_formula?: string;
  flow_connector?: string;
  flow_connector_meaning?: string;
  new_vocab?: VocabItem[];
  fluency_points?: number;
  encouragement?: string | null;
}

interface Message {
  role: "user" | "ai";
  text?: string;
  d?: AIData;
  raw?: string;
  id: number;
}

interface Stats {
  msgs: number;
  corrections: number;
  fp: number;
  convos: number;
}

// ── SPEAK ───────────────────────────────────────────────────────────────────
function speakES(text: string, rate = 0.82) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es";
  u.rate = rate;
  const vs = window.speechSynthesis.getVoices();
  const v = vs.find(v => v.lang.startsWith("es-CO")) ||
    vs.find(v => v.lang.startsWith("es-US")) ||
    vs.find(v => v.lang.startsWith("es"));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

// ── STORAGE ─────────────────────────────────────────────────────────────────
function store(key: string, val: unknown) {
  try { localStorage.setItem(`es-${key}`, JSON.stringify(val)); } catch { /* noop */ }
}
function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(`es-${key}`);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

// ── PROMPT ──────────────────────────────────────────────────────────────────
function buildPrompt(sc: typeof SCENARIOS[0]): string {
  const datingExtra = sc.id === "dating" ? `
DATING MODE: You play the role of an attractive, educated Colombian woman from Cartagena having a natural conversation with Phil. Be warm but not easy. Have your own personality and opinions. Make Phil work for it.
- Respond naturally as a woman would in conversation — not as a language teacher
- Compliments about specific things > generic. Ask about his life, not just appearance.
- Colombian women respond to: playfulness, storytelling, ambition, humor
- Key phrases to model: "me caes muy bien", "tienes algo especial", "me gustaria conocerte mejor"
- In your response_es: Respond as the woman AND include brief coaching in brackets like [Coach: ahora puedes decir...]
` : "";

  return `You are ESPANOL OS — Phil's elite Colombian Spanish coach. Phil is an American entrepreneur in Cartagena, Colombia, building Casa Badillo hotel and running MachineMind AI consulting.

CURRENT SCENARIO: ${sc.label} — ${sc.sub}
${datingExtra}
YOUR VOICE: Educated Cartagenero — warm, direct, witty, opinionated. Use costeno: que mas, listo, dale, bacano, chevere, eso, de una, pues, la verdad, parce, imaginante, claro que si. Reference real Cartagena: Getsemani, El Centro, Bocagrande, Manga, la Popa.

PHIL'S WEAK SPOTS (model fixes naturally in YOUR responses):
- Adjectives before nouns (English order) → model [noun]+[adj]
- No time connectors → model cuando/mientras/despues de
- No opinion launchers → model creo que/me parece/la verdad
- Ser vs estar confusion
- Stays in present tense only

RETURN ONLY THIS JSON. NO MARKDOWN. NO CODE FENCES. PURE JSON:
{"response_es":"Spanish response — natural, Colombian, ends with a question","response_en":"English translation","correction":null,"correction_note":null,"pattern_name":"Grammar pattern in YOUR response","pattern_formula":"Structural formula","flow_connector":"One phrase Phil can use RIGHT NOW","flow_connector_meaning":"English meaning","new_vocab":[{"es":"word","en":"meaning","type":"expression"}],"fluency_points":5,"encouragement":null}

RULES: correction=null if no error, else corrected sentence. correction_note=null if no error. new_vocab max 2 items. fluency_points 1-10. encouragement=null usually. ONLY JSON OUTPUT.`;
}

// ── ICONS ───────────────────────────────────────────────────────────────────
const ICONS = {
  talk: <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  patterns: <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  missions: <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  vocab: <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  progress: <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};

// ── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;1,500&family=JetBrains+Mono:wght@400;500;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  ::-webkit-scrollbar{width:2px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:#1c1c1c;border-radius:1px;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:.2}50%{opacity:1}}
  .fu{animation:fadeUp .22s ease;}
  .dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:${G};animation:pulse 1.3s ease infinite;margin-right:3px;}
  .dot:nth-child(2){animation-delay:.22s}.dot:nth-child(3){animation-delay:.44s}
  textarea:focus,input:focus{outline:none;}
  textarea::placeholder,input::placeholder{color:#252525;}
  textarea{resize:none;}
  button{cursor:pointer;font-family:'Outfit',sans-serif;}
  button:disabled{opacity:.25;cursor:not-allowed!important;}
`;

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function EspanolOS() {
  const [tab, setTab] = useState("talk");
  const [sc, setSc] = useState(SCENARIOS[0]);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [inp, setInp] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [showEN, setShowEN] = useState(true);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [expandPat, setExpandPat] = useState<string | null>(null);
  const [practiceText, setPracticeText] = useState<Record<string, string>>({});
  const [activeMission, setActiveMission] = useState<MissionType | null>(null);

  // Persistent state
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [missionsDone, setMissionsDone] = useState<number[]>([]);
  const [stats, setStats] = useState<Stats>({ msgs: 0, corrections: 0, fp: 0, convos: 0 });
  const [streak, setStreak] = useState(0);
  const [mounted, setMounted] = useState(false);

  const recRef = useRef<ReturnType<typeof Object> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const lastAI = [...msgs].reverse().find(m => m.role === "ai");

  // Load persistent data
  useEffect(() => {
    setVocab(load<VocabItem[]>("vocab", []));
    setMissionsDone(load<number[]>("missions", []));
    setStats(load<Stats>("stats", { msgs: 0, corrections: 0, fp: 0, convos: 0 }));
    const streakData = load<{ count: number; date: string }>("streak", { count: 0, date: "" });
    const today = new Date().toDateString();
    setStreak(streakData.date === today ? streakData.count : Math.max(0, streakData.count - 1));
    setMounted(true);
    window.speechSynthesis?.getVoices();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  const updateStreak = useCallback(() => {
    const today = new Date().toDateString();
    const streakData = load<{ count: number; date: string }>("streak", { count: 0, date: "" });
    const newStreak = streakData.date === today ? streakData.count : streakData.count + 1;
    setStreak(newStreak);
    store("streak", { count: newStreak, date: today });
  }, []);

  // Voice input
  const toggleListen = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Voice input requires Chrome."); return; }
    if (listening) { (recRef.current as { stop: () => void })?.stop(); setListening(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new (SR as any)();
    rec.lang = "es";
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      setInp((p: string) => (p ? p + " " : "") + e.results[0][0].transcript);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening]);

  // Send message
  const send = useCallback(async () => {
    if (!inp.trim() || loading) return;
    const txt = inp.trim();
    const uMsg: Message = { role: "user", text: txt, id: Date.now() };
    const updated = [...msgs, uMsg];
    setMsgs(updated);
    setInp("");
    setLoading(true);
    setShowAnalysis(false);
    setShowQuick(false);
    updateStreak();

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
      try {
        d = JSON.parse(raw.replace(/```json|```/g, "").trim());
      } catch {
        d = { response_es: raw, response_en: "[parse error]" };
      }

      setMsgs(prev => [...prev, { role: "ai", d, raw, id: Date.now() }]);
      setShowAnalysis(true);

      // Update vocab
      if (d.new_vocab && d.new_vocab.length > 0) {
        setVocab(prev => {
          const nv = [...prev, ...d.new_vocab!].filter((v, i, a) => a.findIndex(x => x.es === v.es) === i);
          store("vocab", nv);
          return nv;
        });
      }

      // Update stats
      setStats(prev => {
        const ns = {
          msgs: prev.msgs + 1,
          corrections: prev.corrections + (d.correction ? 1 : 0),
          fp: prev.fp + (d.fluency_points || 0),
          convos: prev.convos,
        };
        store("stats", ns);
        return ns;
      });
    } catch {
      setMsgs(prev => [...prev, {
        role: "ai",
        d: { response_es: "Error de conexion. Intenta de nuevo.", response_en: "Connection error." },
        raw: "{}",
        id: Date.now(),
      }]);
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [inp, loading, msgs, sc, updateStreak]);

  const newConvo = useCallback(() => {
    setMsgs([]);
    setActiveMission(null);
    setShowAnalysis(false);
    setShowQuick(false);
    setStats(prev => {
      const ns = { ...prev, convos: prev.convos + 1 };
      store("stats", ns);
      return ns;
    });
  }, []);

  const completeMission = useCallback((id: number) => {
    setMissionsDone(prev => {
      const u = [...new Set([...prev, id])];
      store("missions", u);
      return u;
    });
  }, []);

  const fluency = Math.min(100, Math.round(stats.fp * 0.7 + vocab.length * 0.6 + missionsDone.length * 3));

  if (!mounted) return <div style={{ height: "100dvh", background: "#050505" }} />;

  return (
    <div style={{ height: "100dvh", background: "#050505", color: "#e2e2e2", fontFamily: "'Outfit',sans-serif", display: "flex", flexDirection: "column", overflow: "hidden", maxWidth: 520, margin: "0 auto", position: "relative" }}>
      <style>{CSS}</style>

      {/* ── TOP HEADER ── */}
      <div style={{ flexShrink: 0, padding: "10px 16px 8px", borderBottom: "1px solid #0d0d0d", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, color: G, fontWeight: 700 }}>ESPANOL</span>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, color: "#181818", fontWeight: 700 }}>OS</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#0a0a0a", border: "1px solid #141414", borderRadius: 20 }}>
            <span style={{ fontSize: 12 }}>🔥</span>
            <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 11, color: G, fontWeight: 700 }}>{streak}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "#0a0a0a", border: "1px solid #141414", borderRadius: 20 }}>
            <div style={{ width: 40, height: 3, background: "#111", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${fluency}%`, height: "100%", background: G, borderRadius: 2, transition: "width .5s" }} />
            </div>
            <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 11, color: G, fontWeight: 700 }}>{fluency}</span>
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* ═══ TAB: CONVERSAR ═══ */}
        {tab === "talk" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Scenario scroll */}
            <div style={{ flexShrink: 0, overflowX: "auto", display: "flex", gap: 6, padding: "8px 14px", borderBottom: "1px solid #0a0a0a" }}>
              {SCENARIOS.map(s => (
                <button key={s.id} onClick={() => { setSc(s); newConvo(); }}
                  style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: `1px solid ${sc.id === s.id ? s.color + "55" : "#141414"}`, background: sc.id === s.id ? s.color + "0d" : "none", color: sc.id === s.id ? s.color : "#2e2e2e", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 13 }}>{s.icon}</span> {s.label}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 0", display: "flex", flexDirection: "column", gap: 10 }}>
              {msgs.length === 0 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, textAlign: "center", padding: "0 24px" }}>
                  <div style={{ fontSize: 11, color: sc.color, letterSpacing: "2px", fontWeight: 700, marginBottom: 4 }}>{sc.icon} {sc.label.toUpperCase()}</div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 36, color: "#0d0d0d", fontStyle: "italic", lineHeight: 1 }}>Habla.</div>
                  <div style={{ fontSize: 12, color: "#1c1c1c", lineHeight: 2, marginTop: 6 }}>
                    Escribe en espanol.<br />
                    <span style={{ color: G }}>Roto, simple, una palabra.</span><br />
                    <span style={{ color: "#1a1a1a" }}>El sistema te corrige en tiempo real.</span>
                  </div>
                  {activeMission && (
                    <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(201,168,76,.07)", border: "1px solid rgba(201,168,76,.2)", borderRadius: 10, width: "100%", textAlign: "left" }}>
                      <div style={{ fontSize: 9, color: G, letterSpacing: "2px", fontWeight: 700, marginBottom: 4 }}>MISION ACTIVA</div>
                      <div style={{ fontSize: 13, color: "#c8c8c8", fontWeight: 600, marginBottom: 3 }}>{activeMission.icon} {activeMission.title}</div>
                      <div style={{ fontSize: 11, color: "#333", lineHeight: 1.6 }}>{activeMission.desc}</div>
                    </div>
                  )}
                  <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                    {(QUICK[sc.id] || []).map((q, i) => (
                      <button key={i} onClick={() => setInp(q)}
                        style={{ padding: "6px 12px", borderRadius: 16, border: "1px solid #141414", background: "#0a0a0a", color: "#333", fontSize: 11, fontStyle: "italic" }}>
                        &ldquo;{q}&rdquo;
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {msgs.map(msg => (
                <div key={msg.id} className="fu" style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: 4 }}>
                  {msg.role === "user" ? (
                    <div style={{ background: "#0f0f0f", border: "1px solid #191919", borderRadius: "16px 16px 4px 16px", padding: "10px 14px", maxWidth: "82%", fontSize: 14, lineHeight: 1.65, color: "#c8c8c8" }}>{msg.text}</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: "86%" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                        <div style={{ background: "#0b0b0b", border: "1px solid #141414", borderRadius: "16px 16px 16px 4px", padding: "10px 14px", fontSize: 14, lineHeight: 1.72, color: "#e2e2e2", flex: 1 }}>
                          {msg.d?.response_es}
                        </div>
                        {msg.d?.response_es && (
                          <button onClick={() => speakES(msg.d!.response_es!)} style={{ background: "none", border: "none", fontSize: 14, opacity: .3, padding: "8px 4px", flexShrink: 0, lineHeight: 1 }}>🔊</button>
                        )}
                      </div>
                      {showEN && msg.d?.response_en && (
                        <div style={{ padding: "2px 6px", fontSize: 11, color: "#252525", fontStyle: "italic", lineHeight: 1.6 }}>{msg.d.response_en}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {loading && <div style={{ display: "flex", gap: 2, padding: "2px" }}><div className="dot" /><div className="dot" /><div className="dot" /></div>}
              <div ref={bottomRef} style={{ height: 8 }} />
            </div>

            {/* ── ANALYSIS DRAWER ── */}
            {showAnalysis && lastAI && (
              <div className="fu" style={{ flexShrink: 0, borderTop: "1px solid #0d0d0d", background: "#060606", maxHeight: 220, overflowY: "auto" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px 0" }}>
                  <span style={{ fontSize: 9, letterSpacing: "2px", color: "#252525", fontWeight: 700 }}>ANALISIS</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setShowEN(p => !p)} style={{ fontSize: 9, color: "#252525", background: "none", border: "1px solid #141414", borderRadius: 4, padding: "2px 8px", letterSpacing: "1px", fontWeight: 700 }}>EN {showEN ? "ON" : "OFF"}</button>
                    <button onClick={() => setShowAnalysis(false)} style={{ fontSize: 9, color: "#252525", background: "none", border: "1px solid #141414", borderRadius: 4, padding: "2px 8px" }}>✕</button>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 14px 12px" }}>
                  {/* Fluency bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 20, border: "1px solid #141414", background: "#0a0a0a" }}>
                    <div style={{ display: "flex", gap: 1 }}>
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} style={{ width: 4, height: 8, borderRadius: 1, background: i < (lastAI.d?.fluency_points || 0) ? G : "#111" }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 9, color: G, fontFamily: "JetBrains Mono,monospace", fontWeight: 700 }}>{lastAI.d?.fluency_points || 0}/10</span>
                  </div>

                  {/* No error */}
                  {!lastAI.d?.correction && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 20, border: `1px solid ${GR}30`, background: `${GR}08`, fontSize: 11, color: GR, fontWeight: 500 }}>
                      <span>✓</span><span>Sin errores</span>
                    </div>
                  )}

                  {/* Correction */}
                  {lastAI.d?.correction && (
                    <div style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${RD}25`, background: `${RD}07` }}>
                      <div style={{ fontSize: 9, color: RD, letterSpacing: "1.5px", fontWeight: 700, marginBottom: 3 }}>CORRECCION</div>
                      <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 12, color: RD, lineHeight: 1.5 }}>{lastAI.d.correction}</div>
                      {lastAI.d.correction_note && <div style={{ fontSize: 11, color: "#5a2a2a", marginTop: 3, lineHeight: 1.5 }}>{lastAI.d.correction_note}</div>}
                    </div>
                  )}

                  {/* Encouragement */}
                  {lastAI.d?.encouragement && (
                    <div style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${G}20`, background: `${G}06`, fontSize: 11, color: "#7a6222", lineHeight: 1.5 }}>⭐ {lastAI.d.encouragement}</div>
                  )}

                  {/* Pattern */}
                  {lastAI.d?.pattern_name && (
                    <div style={{ padding: "5px 10px", borderRadius: 20, border: `1px solid ${G}30`, background: `${G}08` }}>
                      <div style={{ fontSize: 9, color: G, letterSpacing: "1px", fontWeight: 700 }}>{lastAI.d.pattern_name}</div>
                      <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 9, color: "#5a4a18", marginTop: 1 }}>{lastAI.d.pattern_formula}</div>
                    </div>
                  )}

                  {/* Flow connector */}
                  {lastAI.d?.flow_connector && (
                    <button onClick={() => { setInp(p => (p ? p + " " : "") + lastAI.d!.flow_connector!); setShowAnalysis(false); inputRef.current?.focus(); }}
                      style={{ padding: "6px 12px", borderRadius: 20, border: `1px solid ${B}35`, background: `${B}08`, color: B, fontSize: 12, fontWeight: 600, fontStyle: "italic", display: "flex", alignItems: "center", gap: 5 }}>
                      &ldquo;{lastAI.d.flow_connector}&rdquo; <span style={{ fontSize: 9, opacity: .6, fontStyle: "normal" }}>→ insertar</span>
                    </button>
                  )}

                  {/* Vocab chips */}
                  {lastAI.d?.new_vocab?.map((v, i) => (
                    <button key={i} onClick={() => speakES(v.es)}
                      style={{ padding: "5px 10px", borderRadius: 20, border: "1px solid #141414", background: "#0a0a0a", fontSize: 11, color: "#3a3a3a", fontStyle: "italic", display: "flex", alignItems: "center", gap: 4 }}>
                      🔊 {v.es} — <span style={{ color: "#252525", fontStyle: "normal" }}>{v.en}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── QUICK PHRASES ── */}
            {showQuick && (
              <div className="fu" style={{ flexShrink: 0, borderTop: "1px solid #0d0d0d", background: "#060606", padding: "8px 14px", display: "flex", flexWrap: "wrap", gap: 5 }}>
                {(QUICK[sc.id] || []).map((q, i) => (
                  <button key={i} onClick={() => { setInp(q); setShowQuick(false); inputRef.current?.focus(); }}
                    style={{ padding: "5px 11px", borderRadius: 14, border: "1px solid #161616", background: "#0a0a0a", color: "#3a3a3a", fontSize: 11, fontStyle: "italic" }}>
                    &ldquo;{q}&rdquo;
                  </button>
                ))}
              </div>
            )}

            {/* ── INPUT AREA ── */}
            <div style={{ flexShrink: 0, padding: "10px 12px", borderTop: "1px solid #0a0a0a", background: "#050505" }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, overflowX: "auto" }}>
                {lastAI && (
                  <button onClick={() => { setShowAnalysis(p => !p); setShowQuick(false); }}
                    style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 14, border: `1px solid ${showAnalysis ? G + "40" : "#141414"}`, background: showAnalysis ? `${G}08` : "none", color: showAnalysis ? G : "#252525", fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", display: "flex", alignItems: "center", gap: 4 }}>
                    {lastAI.d?.correction ? <span style={{ color: RD, fontSize: 8 }}>●</span> : <span style={{ color: GR, fontSize: 8 }}>●</span>}
                    ANALISIS
                  </button>
                )}
                <button onClick={() => { setShowQuick(p => !p); setShowAnalysis(false); }}
                  style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 14, border: `1px solid ${showQuick ? B + "40" : "#141414"}`, background: showQuick ? `${B}08` : "none", color: showQuick ? B : "#252525", fontSize: 9, fontWeight: 700, letterSpacing: "1.5px" }}>
                  FRASES
                </button>
                <button onClick={() => setShowEN(p => !p)}
                  style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 14, border: "1px solid #141414", color: "#252525", fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", background: "none" }}>
                  EN {showEN ? "ON" : "OFF"}
                </button>
                <button onClick={newConvo}
                  style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 14, border: "1px solid #141414", color: "#252525", fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", background: "none", marginLeft: "auto" }}>
                  NUEVA
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <button onClick={toggleListen}
                  style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${listening ? "rgba(222,100,100,.5)" : "#141414"}`, background: listening ? "rgba(222,100,100,.08)" : "none", fontSize: 18, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s" }}>
                  {listening ? "🔴" : "🎤"}
                </button>
                <textarea ref={inputRef} value={inp} onChange={e => setInp(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Escribe en espanol..."
                  rows={2}
                  style={{ flex: 1, background: "#0a0a0a", border: "1px solid #141414", borderRadius: 12, color: "#e2e2e2", fontFamily: "'Outfit',sans-serif", fontSize: 14, padding: "10px 12px", lineHeight: 1.5, minHeight: 44, maxHeight: 90 }} />
                <button onClick={send} disabled={loading || !inp.trim()}
                  style={{ width: 44, height: 44, borderRadius: 12, background: inp.trim() && !loading ? G : "#0f0f0f", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .2s" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke={inp.trim() && !loading ? "#000" : "#222"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
              <div style={{ marginTop: 5, fontSize: 9, color: "#1a1a1a", letterSpacing: ".5px", display: "flex", justifyContent: "space-between" }}>
                <span>{stats.msgs} msgs · {vocab.length} vocab</span>
                <span>{missionsDone.length}/{MISSIONS.length} misiones</span>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: PATRONES ═══ */}
        {tab === "patterns" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: G, marginBottom: 4 }}>10 Patrones. Todo el Espanol.</div>
              <div style={{ fontSize: 11, color: "#2e2e2e", lineHeight: 1.8 }}>Domina estas estructuras y puedes expresar cualquier cosa. Incluye patrones de flirteo.</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PATTERNS.map(p => (
                <div key={p.id} onClick={() => setExpandPat(expandPat === p.id ? null : p.id)}
                  style={{ background: "#080808", border: `1px solid ${expandPat === p.id ? p.color + "35" : "#0f0f0f"}`, borderRadius: 10, padding: "13px 14px", transition: "border-color .2s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                        <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 9, color: "#222" }}>#{p.n.toString().padStart(2, "0")}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#d0d0d0" }}>{p.name}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#2a2a2a", marginBottom: 3 }}>{p.sub}</div>
                      <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, color: p.color }}>{p.formula}</div>
                    </div>
                    <span style={{ color: "#2a2a2a", fontSize: 10, flexShrink: 0 }}>{expandPat === p.id ? "▲" : "▼"}</span>
                  </div>

                  {expandPat === p.id && (
                    <div style={{ marginTop: 14 }} onClick={e => e.stopPropagation()}>
                      <div style={{ background: "#050505", border: "1px solid #0d0d0d", borderRadius: 7, padding: "9px 11px", fontSize: 11, color: "#363636", lineHeight: 1.8, marginBottom: 12 }}>
                        <span style={{ color: p.color }}>Rule — </span>{p.rule}
                      </div>
                      {p.examples.map((ex, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderBottom: "1px solid #0c0c0c", flexWrap: "wrap" }}>
                          <button onClick={() => speakES(ex.es)} style={{ background: "none", border: "none", fontSize: 12, opacity: .35, flexShrink: 0 }}>🔊</button>
                          <span style={{ fontSize: 13, color: "#d0d0d0", fontStyle: "italic", flex: "1 1 auto", minWidth: 160 }}>&ldquo;{ex.es}&rdquo;</span>
                          <span style={{ fontSize: 10, color: "#2e2e2e", flex: "1 1 auto" }}>— {ex.en}</span>
                        </div>
                      ))}
                      <div style={{ marginTop: 12, background: `${p.color}07`, border: `1px solid ${p.color}18`, borderRadius: 7, padding: "8px 11px", marginBottom: 12 }}>
                        <div style={{ fontSize: 9, color: p.color, letterSpacing: "1.5px", fontWeight: 700, marginBottom: 3 }}>DRILL</div>
                        <div style={{ fontSize: 11, color: "#363636", lineHeight: 1.7 }}>{p.drill}</div>
                      </div>
                      <div style={{ display: "flex", gap: 7 }}>
                        <input value={practiceText[p.id] || ""} onChange={e => setPracticeText(prev => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="Tu intento en espanol..."
                          style={{ flex: 1, background: "#060606", border: "1px solid #141414", borderRadius: 8, color: "#e0e0e0", fontFamily: "'Outfit',sans-serif", fontSize: 13, padding: "9px 11px" }} />
                        <button style={{ background: p.color, color: "#000", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}
                          onClick={() => { if (practiceText[p.id]) { setInp(practiceText[p.id]); setTab("talk"); } }}>
                          → Ir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ TAB: MISIONES ═══ */}
        {tab === "missions" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: G, marginBottom: 4 }}>17 Misiones. Tu Vida Real.</div>
              <div style={{ fontSize: 11, color: "#2e2e2e", lineHeight: 1.7 }}>Negocios, vida diaria, citas. El lenguaje bajo presion real se queda para siempre.</div>
              <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                {[1, 2, 3, 4].map(w => {
                  const tot = MISSIONS.filter(m => m.w === w).length;
                  const done = MISSIONS.filter(m => m.w === w && missionsDone.includes(m.id)).length;
                  const c = done === tot ? GR : G;
                  return <span key={w} style={{ fontSize: 10, color: c }}>S{w}: {done}/{tot}</span>;
                })}
              </div>
            </div>
            {[1, 2, 3, 4].map(wk => {
              const wm = MISSIONS.filter(m => m.w === wk);
              const wn: Record<number, string> = { 1: "Supervivencia", 2: "Comercio", 3: "Social + Dating", 4: "Fluidez" };
              return (
                <div key={wk} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 9, color: "#2a2a2a", letterSpacing: "2px", fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                    SEMANA {wk} — {wn[wk]}
                    <div style={{ flex: 1, height: 1, background: "#0d0d0d" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {wm.map(m => {
                      const done = missionsDone.includes(m.id);
                      return (
                        <div key={m.id} style={{ background: done ? "#060606" : "#090909", border: `1px solid ${done ? GR + "20" : "#0f0f0f"}`, borderRadius: 10, padding: "13px 14px", opacity: done ? .6 : 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                                <span style={{ fontSize: 9, color: "#252525", letterSpacing: "1px" }}>DIA {m.day}</span>
                                <div style={{ display: "flex", gap: 2 }}>
                                  {Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: i < m.diff ? G : "#111" }} />)}
                                </div>
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: done ? "#333" : "#d0d0d0", marginBottom: 3 }}>{m.icon} {m.title}</div>
                              <div style={{ fontSize: 11, color: "#2e2e2e", lineHeight: 1.6, marginBottom: 6 }}>{m.desc}</div>
                              <div style={{ fontSize: 9, color: "#222", marginBottom: 8 }}>📍 {m.loc}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {m.vocab.map((v, i) => (
                                  <button key={i} onClick={() => speakES(v)}
                                    style={{ fontSize: 9, color: "#333", background: "#0c0c0c", border: "1px solid #131313", borderRadius: 4, padding: "2px 7px", fontStyle: "italic" }}>
                                    🔊 {v}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
                              {!done && (
                                <button onClick={() => {
                                  setActiveMission(m);
                                  const targetSc = [13, 16].includes(m.id) ? SCENARIOS.find(s => s.id === "dating") : SCENARIOS.find(s => s.id === "biz");
                                  setSc(targetSc || SCENARIOS[0]);
                                  setTab("talk");
                                  newConvo();
                                }}
                                  style={{ background: G, color: "#000", border: "none", borderRadius: 7, padding: "7px 12px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
                                  Practicar
                                </button>
                              )}
                              <button onClick={() => !done && completeMission(m.id)}
                                style={{ background: done ? "#090909" : "none", border: `1px solid ${done ? GR + "35" : "#161616"}`, borderRadius: 7, padding: "7px 12px", fontSize: 10, fontWeight: 600, color: done ? GR : "#2a2a2a", whiteSpace: "nowrap" }}>
                                {done ? "✓ Hecha" : "Marcar lista"}
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

        {/* ═══ TAB: VOCAB ═══ */}
        {tab === "vocab" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: G, marginBottom: 4 }}>Tu Vocabulario</div>
              <div style={{ fontSize: 11, color: "#2e2e2e", lineHeight: 1.7 }}>Cada palabra salio de una conversacion real tuya. {vocab.length} palabras acumuladas.</div>
            </div>
            {vocab.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 0", color: "#1c1c1c" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📚</div>
                <div style={{ fontSize: 12, lineHeight: 2 }}>Empieza a conversar.<br />Tu banco crece automaticamente.</div>
              </div>
            ) : (
              <>
                {/* Spaced repetition review */}
                <div style={{ marginBottom: 14, padding: "10px 12px", background: "rgba(201,168,76,.05)", border: "1px solid rgba(201,168,76,.15)", borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: G, letterSpacing: "1.5px", fontWeight: 700, marginBottom: 6 }}>REPASAR AHORA</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {vocab.slice(-6).map((v, i) => (
                      <button key={i} onClick={() => speakES(v.es)}
                        style={{ padding: "4px 10px", borderRadius: 12, border: `1px solid ${G}25`, background: `${G}07`, fontSize: 11, color: "#7a6020", fontStyle: "italic" }}>
                        🔊 {v.es}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {[...vocab].reverse().map((v, i) => (
                    <div key={i} style={{ background: "#080808", border: "1px solid #0f0f0f", borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "#d0d0d0", fontStyle: "italic", marginBottom: 2 }}>{v.es}</div>
                        <div style={{ fontSize: 10, color: "#2a2a2a" }}>{v.en}</div>
                        {v.type && <div style={{ fontSize: 8, color: "#1c1c1c", marginTop: 1, letterSpacing: "1px" }}>{v.type}</div>}
                      </div>
                      <button onClick={() => speakES(v.es)} style={{ background: "none", border: "none", fontSize: 16, opacity: .25, flexShrink: 0 }}>🔊</button>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <button onClick={() => { setVocab([]); store("vocab", []); }}
                    style={{ background: "none", border: "1px solid #141414", borderRadius: 6, padding: "6px 16px", fontSize: 9, color: "#222", letterSpacing: "1.5px" }}>
                    LIMPIAR TODO
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ TAB: PROGRESO ═══ */}
        {tab === "progress" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: G, marginBottom: 18 }}>Tu Progreso</div>

            {/* Fluency */}
            <div style={{ background: "#080808", border: "1px solid #111", borderRadius: 12, padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: "#252525", letterSpacing: "2px", fontWeight: 700, marginBottom: 10 }}>FLUIDEZ ACUMULADA</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 44, color: G, fontWeight: 700, lineHeight: 1 }}>{fluency}</div>
                <div style={{ fontSize: 13, color: "#252525" }}>/100</div>
              </div>
              <div style={{ height: 5, background: "#0f0f0f", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ width: `${fluency}%`, height: "100%", background: `linear-gradient(90deg,${G}77,${G})`, borderRadius: 3, transition: "width .8s ease" }} />
              </div>
              <div style={{ fontSize: 11, color: "#2e2e2e" }}>
                {fluency < 15 ? "Principiante — buen comienzo" : fluency < 35 ? "Basico — ya puedes sobrevivir" : fluency < 55 ? "Intermedio — las conversaciones fluyen" : fluency < 75 ? "Avanzado — casi nativo" : "Fluido — felicitaciones, parcero!"}
              </div>
            </div>

            {/* Streak */}
            <div style={{ background: "#080808", border: "1px solid #111", borderRadius: 12, padding: 18, marginBottom: 12, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 36 }}>🔥</div>
              <div>
                <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 32, color: G, fontWeight: 700, lineHeight: 1 }}>{streak}</div>
                <div style={{ fontSize: 10, color: "#252525", marginTop: 2 }}>DIAS DE RACHA CONSECUTIVOS</div>
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              {[
                { label: "Mensajes", val: stats.msgs, c: G },
                { label: "Correcciones", val: stats.corrections, c: RD },
                { label: "Palabras", val: vocab.length, c: B },
                { label: "Misiones", val: missionsDone.length, c: GR },
                { label: "Conversaciones", val: stats.convos, c: G },
                { label: "Puntos Fluidez", val: stats.fp, c: B },
              ].map((s, i) => (
                <div key={i} style={{ background: "#080808", border: "1px solid #0f0f0f", borderRadius: 10, padding: "14px 14px" }}>
                  <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 28, color: s.c, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{s.val}</div>
                  <div style={{ fontSize: 9, color: "#2a2a2a", letterSpacing: ".5px" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Mission progress */}
            <div style={{ background: "#080808", border: "1px solid #111", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: "#252525", letterSpacing: "2px", fontWeight: 700, marginBottom: 12 }}>PROGRESO POR SEMANA</div>
              {[1, 2, 3, 4].map(w => {
                const tot = MISSIONS.filter(m => m.w === w).length;
                const done = MISSIONS.filter(m => m.w === w && missionsDone.includes(m.id)).length;
                const pct = Math.round(done / tot * 100);
                const wn: Record<number, string> = { 1: "Supervivencia", 2: "Comercio", 3: "Social + Dating", 4: "Fluidez" };
                return (
                  <div key={w} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "#333" }}>Semana {w} — {wn[w]}</span>
                      <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, color: done === tot ? GR : "#2a2a2a" }}>{done}/{tot}</span>
                    </div>
                    <div style={{ height: 3, background: "#0f0f0f", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: done === tot ? GR : G, borderRadius: 2, transition: "width .4s" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ textAlign: "center" }}>
              <button onClick={() => { const r: Stats = { msgs: 0, corrections: 0, fp: 0, convos: 0 }; setStats(r); store("stats", r); }}
                style={{ background: "none", border: "1px solid #141414", borderRadius: 6, padding: "6px 18px", fontSize: 9, color: "#222", letterSpacing: "1.5px" }}>
                RESETEAR ESTADISTICAS
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{ flexShrink: 0, borderTop: "1px solid #0d0d0d", background: "#050505", display: "flex", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {([
          { id: "talk", label: "Hablar" },
          { id: "patterns", label: "Patrones" },
          { id: "missions", label: "Misiones" },
          { id: "vocab", label: "Vocab" },
          { id: "progress", label: "Progreso" },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: "10px 4px", background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: tab === t.id ? G : "#252525", transition: "color .2s" }}>
            <div style={{ opacity: tab === t.id ? 1 : .35 }}>{ICONS[t.id]}</div>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.5px" }}>{t.label}</span>
            {tab === t.id && <div style={{ width: 4, height: 4, borderRadius: "50%", background: G }} />}
          </button>
        ))}
      </div>
    </div>
  );
}
