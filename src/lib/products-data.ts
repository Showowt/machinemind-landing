// ═══════════════════════════════════════════════════════════════
// MACHINEMIND PRODUCT ONE-PAGERS — Content Model
// Standalone, sales-grade landing pages for outreach links.
// One record per product → rendered by <ProductPage slug="…" />.
// All claims kept honest: capabilities and architecture are real;
// no fabricated metrics, no overstated verification per jurisdiction.
// ═══════════════════════════════════════════════════════════════

export type Lang = "es" | "en";

/** A bilingual string. */
export interface Loc {
  es: string;
  en: string;
}

/** One headline line; `em` lines render in the serif accent face. */
export interface HeadlineLine {
  t: string;
  em?: boolean;
}

export interface Metric {
  value: string;
  label: Loc;
}

export interface Step {
  title: Loc;
  body: Loc;
}

export interface Capability {
  title: Loc;
  body: Loc;
}

export interface Product {
  slug: string;
  /** Primary wordmark. */
  brand: string;
  /** If set, this word in the wordmark renders in the accent colour (e.g. "AI"). */
  brandAccentWord?: string;
  /** Optional country/context chip beside the wordmark. */
  badge?: string;
  /** Secondary accent colour (hero glow, numbers, chips, buttons). */
  accent: string;
  eyebrow: Loc;
  headline: { es: HeadlineLine[]; en: HeadlineLine[] };
  sub: Loc;
  /** Live app / demo link, if one exists. */
  liveUrl?: string;
  liveLabel?: Loc;
  metrics: Metric[];
  problem: { title: Loc; body: Loc };
  stepsLabel: Loc;
  steps: Step[];
  capabilitiesLabel: Loc;
  capabilities: Capability[];
  proof: { title: Loc; body: Loc; chips: string[] };
  cta: { title: Loc; body: Loc };
  seo: { title: string; description: string };
  /** Short line baked into the dynamic OG image. */
  ogTagline: string;
}

// Shared CTA destinations — matches the live homepage contact section.
export const BOOK_URL = "https://cal.com/machinemind";
export const CONTACT_EMAIL = "Phil@machinemindconsulting.com";

export const products: Product[] = [
  // ───────────────────────────────────────────────────────────
  // PUENTE — Cross-Border Real Estate Intelligence
  // ───────────────────────────────────────────────────────────
  {
    slug: "puente",
    brand: "Puente",
    accent: "#38bdf8",
    eyebrow: {
      es: "Inteligencia Inmobiliaria Transfronteriza",
      en: "Cross-Border Real Estate Intelligence",
    },
    headline: {
      es: [
        { t: "Invierte en bienes raíces" },
        { t: "en EE.UU. desde LatAm —" },
        { t: "con IA que conoce cada regla", em: true },
      ],
      en: [
        { t: "Invest in U.S. real estate" },
        { t: "from Latin America —" },
        { t: "with AI that knows every rule", em: true },
      ],
    },
    sub: {
      es: "Puente responde preguntas de inversión, calcula la retención FIRPTA y compara mercados — fundamentado en una base de conocimiento verificada, no en conjeturas.",
      en: "Puente answers investment questions, calculates FIRPTA withholding, and compares markets — grounded in a verified knowledge base, not guesswork.",
    },
    liveUrl: "https://puente-app.vercel.app",
    liveLabel: { es: "Ver la plataforma", en: "View the platform" },
    metrics: [
      { value: "24/7", label: { es: "Asesor siempre activo", en: "Always-on advisor" } },
      { value: "204", label: { es: "Pasajes de conocimiento verificados", en: "Verified knowledge passages" } },
      { value: "3+", label: { es: "Mercados EE.UU. + marco LatAm", en: "U.S. markets + LatAm framework" } },
      { value: "ES / EN", label: { es: "Bilingüe nativo", en: "Natively bilingual" } },
    ],
    problem: {
      title: {
        es: "Comprar al otro lado de la frontera es un campo minado.",
        en: "Buying across the border is a minefield.",
      },
      body: {
        es: "Retención FIRPTA, tratados tributarios, financiamiento para extranjeros, datos de mercado dispersos. La información está fragmentada y los asesores son lentos y caros. Una decisión mal informada cuesta decenas de miles de dólares.",
        en: "FIRPTA withholding, tax treaties, foreign-buyer financing, scattered market data. The information is fragmented and advisors are slow and expensive. One ill-informed decision costs tens of thousands.",
      },
    },
    stepsLabel: { es: "Cómo funciona", en: "How it works" },
    steps: [
      {
        title: { es: "Pregunta en lenguaje natural", en: "Ask in plain language" },
        body: {
          es: "Por WhatsApp o en la web, en español o inglés. Sin formularios, sin jerga.",
          en: "Over WhatsApp or on the web, in Spanish or English. No forms, no jargon.",
        },
      },
      {
        title: { es: "Recuperación con fundamento (RAG)", en: "Grounded retrieval (RAG)" },
        body: {
          es: "Puente busca en una base de conocimiento verificada: mercados, impuestos y regulación transfronteriza.",
          en: "Puente searches a verified knowledge base: markets, taxes, and cross-border regulation.",
        },
      },
      {
        title: { es: "Respuesta anclada en la fuente", en: "Answer anchored to the source" },
        body: {
          es: "Claude redacta la respuesta citando el conocimiento recuperado — marcado cuando tiene contexto real detrás.",
          en: "Claude drafts the answer from the retrieved knowledge — flagged when there's real context behind it.",
        },
      },
      {
        title: { es: "Corre los números", en: "Run the numbers" },
        body: {
          es: "Calculadora integrada de FIRPTA, cap rate y cash-on-cash para pasar de la pregunta a la decisión.",
          en: "Built-in FIRPTA, cap-rate, and cash-on-cash calculator to go from question to decision.",
        },
      },
    ],
    capabilitiesLabel: { es: "Qué incluye", en: "What's inside" },
    capabilities: [
      {
        title: { es: "Chat con IA fundamentada", en: "Grounded AI chat" },
        body: { es: "Cada respuesta anclada en la base de conocimiento.", en: "Every answer anchored to the knowledge base." },
      },
      {
        title: { es: "Calculadora de inversión", en: "Investment calculator" },
        body: { es: "FIRPTA, cap rate y cash-on-cash integrados.", en: "FIRPTA, cap rate, and cash-on-cash built in." },
      },
      {
        title: { es: "Inteligencia de mercado", en: "Market intelligence" },
        body: { es: "Las Vegas, Tampa, Charlotte + Colombia y El Salvador.", en: "Las Vegas, Tampa, Charlotte + Colombia and El Salvador." },
      },
      {
        title: { es: "WhatsApp + web", en: "WhatsApp + web" },
        body: { es: "El mismo cerebro responde en los dos canales.", en: "The same brain answers across both channels." },
      },
      {
        title: { es: "Calificación de leads 24/7", en: "24/7 lead qualification" },
        body: { es: "Captura y clasifica interesados mientras duermes.", en: "Captures and scores prospects while you sleep." },
      },
      {
        title: { es: "Base de conocimiento ampliable", en: "Extensible knowledge base" },
        body: { es: "Nuevos mercados y normas se suman sin reescribir nada.", en: "New markets and rules drop in without a rewrite." },
      },
    ],
    proof: {
      title: { es: "Construido sobre una base de conocimiento real.", en: "Built on a real knowledge base." },
      body: {
        es: "Cada respuesta se ancla en fuentes recuperadas; cuando no hay base, Puente lo dice en lugar de inventar.",
        en: "Every answer anchors to retrieved sources; when there's no basis, Puente says so instead of inventing.",
      },
      chips: ["RAG + pgvector", "Voyage AI embeddings", "Claude (Anthropic)", "Next.js + Supabase"],
    },
    cta: {
      title: { es: "¿Listo para invertir con información, no con corazonadas?", en: "Ready to invest on data, not hunches?" },
      body: { es: "Agenda una llamada y te mostramos Puente con tu mercado.", en: "Book a call and we'll walk Puente through your market." },
    },
    seo: {
      title: "Puente · IA Inmobiliaria Transfronteriza | MachineMind",
      description:
        "IA que responde preguntas de inversión inmobiliaria EE.UU.–LatAm, calcula FIRPTA y compara mercados, fundamentada en fuentes verificadas. Cross-border U.S.–LatAm real estate AI.",
    },
    ogTagline: "Cross-Border Real Estate Intelligence",
  },

  // ───────────────────────────────────────────────────────────
  // SOPHIA — WhatsApp AI Assistant
  // ───────────────────────────────────────────────────────────
  {
    slug: "sophia",
    brand: "SOPHIA",
    accent: "#25D366",
    eyebrow: { es: "Asistente de IA por WhatsApp", en: "WhatsApp AI Assistant" },
    headline: {
      es: [
        { t: "Tu negocio responde" },
        { t: "al instante, 24/7 —" },
        { t: "en WhatsApp", em: true },
      ],
      en: [
        { t: "Your business replies" },
        { t: "instantly, 24/7 —" },
        { t: "on WhatsApp", em: true },
      ],
    },
    sub: {
      es: "SOPHIA entiende, responde, califica y agenda por WhatsApp — en español e inglés, con el contexto de tu negocio. Cuando algo importa, pasa la conversación a un humano.",
      en: "SOPHIA understands, replies, qualifies, and books over WhatsApp — in Spanish and English, with your business context. When it matters, it hands off to a human.",
    },
    liveUrl: "https://operator-demo-phi.vercel.app",
    liveLabel: { es: "Probar una demo", en: "Try a live demo" },
    metrics: [
      { value: "24/7", label: { es: "Sin horario, sin colas", en: "No hours, no queues" } },
      { value: "Segundos", label: { es: "Tiempo de respuesta", en: "Response time" } },
      { value: "ES / EN", label: { es: "Bilingüe nativo", en: "Natively bilingual" } },
      { value: "111+", label: { es: "Sistemas desplegados por MachineMind", en: "Systems deployed by MachineMind" } },
    ],
    problem: {
      title: {
        es: "Cada mensaje sin responder es un cliente que se va.",
        en: "Every unanswered message is a customer walking away.",
      },
      body: {
        es: "La mayoría de los clientes escribe fuera de horario. Responder en minutos, no en horas, define quién gana la venta. Pero nadie puede estar en el teléfono a las 11 p.m., en dos idiomas, sin fallar.",
        en: "Most customers message after hours. Replying in minutes, not hours, decides who wins the sale. But no one can be on the phone at 11 p.m., in two languages, without dropping the ball.",
      },
    },
    stepsLabel: { es: "Cómo funciona", en: "How it works" },
    steps: [
      {
        title: { es: "El cliente escribe a tu WhatsApp", en: "A customer messages your WhatsApp" },
        body: { es: "Tu número real, tu marca. Nada que instalar para el cliente.", en: "Your real number, your brand. Nothing for the customer to install." },
      },
      {
        title: { es: "SOPHIA entiende la intención", en: "SOPHIA understands the intent" },
        body: { es: "Claude interpreta qué quiere el cliente — reservar, cotizar, preguntar.", en: "Claude reads what the customer wants — to book, to quote, to ask." },
      },
      {
        title: { es: "Responde con el contexto de tu negocio", en: "Replies with your business context" },
        body: { es: "Precios, servicios, disponibilidad y tono — como tu mejor agente.", en: "Pricing, services, availability, and tone — like your best agent." },
      },
      {
        title: { es: "Califica, agenda o escala", en: "Qualifies, books, or escalates" },
        body: { es: "Cierra la reserva, califica el lead o pasa a un humano ante urgencia o riesgo.", en: "Closes the booking, scores the lead, or hands off to a human on urgency or risk." },
      },
    ],
    capabilitiesLabel: { es: "Qué incluye", en: "What's inside" },
    capabilities: [
      { title: { es: "Respuestas instantáneas 24/7", en: "Instant replies, 24/7" }, body: { es: "Sin horario, sin esperas, sin perder el lead.", en: "No hours, no waiting, no lost leads." } },
      { title: { es: "Bilingüe ES / EN", en: "Bilingual ES / EN" }, body: { es: "Cambia de idioma con el cliente, sin configurar nada.", en: "Switches languages with the customer, zero setup." } },
      { title: { es: "Calificación y scoring de leads", en: "Lead qualification & scoring" }, body: { es: "Separa al curioso del comprador real.", en: "Separates the browser from the real buyer." } },
      { title: { es: "Agendamiento y reservas", en: "Scheduling & bookings" }, body: { es: "Confirma citas y reservas dentro del chat.", en: "Confirms appointments and bookings inside the chat." } },
      { title: { es: "Escalamiento a humano", en: "Human escalation" }, body: { es: "Detecta urgencia y sentimiento, y pasa el relevo.", en: "Detects urgency and sentiment, then hands off." } },
      { title: { es: "Sobre tu número real", en: "On your real number" }, body: { es: "WhatsApp Business API vía Twilio / Meta.", en: "WhatsApp Business API via Twilio / Meta." } },
    ],
    proof: {
      title: { es: "Probado en producción, no en una demo.", en: "Proven in production, not in a demo." },
      body: {
        es: "SOPHIA es el motor detrás de las implementaciones de WhatsApp de MachineMind — desplegado en hospitalidad, inmobiliaria, servicios y más.",
        en: "SOPHIA is the engine behind MachineMind's WhatsApp deployments — running across hospitality, real estate, services, and more.",
      },
      chips: ["WhatsApp Business API", "Claude (Anthropic)", "Twilio / Meta", "Supabase + CRM"],
    },
    cta: {
      title: { es: "Pon a SOPHIA a responder por ti.", en: "Put SOPHIA to work answering for you." },
      body: { es: "Agenda una llamada y la configuramos con el contexto de tu negocio.", en: "Book a call and we'll set her up with your business context." },
    },
    seo: {
      title: "SOPHIA · Asistente de IA por WhatsApp | MachineMind",
      description:
        "IA bilingüe que responde, califica y agenda en WhatsApp 24/7, con el contexto de tu negocio. Bilingual WhatsApp AI that replies, qualifies, and books 24/7.",
    },
    ogTagline: "WhatsApp AI · 24/7 Bilingual Assistant",
  },

  // ───────────────────────────────────────────────────────────
  // STREET LEGAL AI — Colombia
  // ───────────────────────────────────────────────────────────
  {
    slug: "legal-co",
    brand: "Street Legal",
    brandAccentWord: "AI",
    badge: "Colombia",
    accent: "#E0B341",
    eyebrow: { es: "Información legal · Colombia", en: "Legal information · Colombia" },
    headline: {
      es: [
        { t: "Entiende tus derechos" },
        { t: "bajo la ley colombiana —" },
        { t: "en lenguaje claro", em: true },
      ],
      en: [
        { t: "Understand your rights" },
        { t: "under Colombian law —" },
        { t: "in plain language", em: true },
      ],
    },
    sub: {
      es: "Street Legal AI explica tus derechos y trámites con la ley colombiana — siempre con la fuente oficial, nunca como consejo jurídico. Información que te orienta antes de hablar con un abogado.",
      en: "Street Legal AI explains your rights and procedures under Colombian law — always with the official source, never as legal advice. Information that orients you before you talk to a lawyer.",
    },
    metrics: [
      { value: "0%", label: { es: "Consejo jurídico — solo información", en: "Legal advice — information only" } },
      { value: "100%", label: { es: "Respuestas con fuente oficial", en: "Answers with an official source" } },
      { value: "ES / EN", label: { es: "Bilingüe", en: "Bilingual" } },
      { value: "24/7", label: { es: "Orientación disponible", en: "Guidance available" } },
    ],
    problem: {
      title: {
        es: "La ley existe para protegerte — si logras entenderla.",
        en: "The law exists to protect you — if you can understand it.",
      },
      body: {
        es: "Arriendos, consumo, trámites, derechos ante la autoridad: la norma está escrita para abogados. La gente decide a ciegas o paga una consulta solo para saber por dónde empezar.",
        en: "Leases, consumer rights, paperwork, rights before authorities: the law is written for lawyers. People decide blind, or pay a consultation just to learn where to start.",
      },
    },
    stepsLabel: { es: "Cómo funciona", en: "How it works" },
    steps: [
      {
        title: { es: "Pregunta en español sobre tu situación", en: "Ask about your situation, in Spanish" },
        body: { es: "Describe lo que te pasa en tus palabras — sin tecnicismos.", en: "Describe what's happening in your own words — no jargon." },
      },
      {
        title: { es: "Fundamentada en la ley colombiana", en: "Grounded in Colombian law" },
        body: { es: "El motor recupera la norma oficial pertinente — no opiniones de internet.", en: "The engine retrieves the relevant official rule — not internet opinions." },
      },
      {
        title: { es: "Respuesta con cita, nunca consejo", en: "Cited answer, never advice" },
        body: { es: "Te explica qué dice la ley y enlaza la fuente primaria; si cruza la línea del consejo, se abstiene.", en: "It explains what the law says and links the primary source; if it crosses into advice, it abstains." },
      },
      {
        title: { es: "Sabes cuándo necesitas un abogado", en: "Know when you need a lawyer" },
        body: { es: "Te orienta y te dice con claridad cuándo un caso requiere representación.", en: "It orients you and says plainly when a case needs representation." },
      },
    ],
    capabilitiesLabel: { es: "Qué cubre", en: "What it covers" },
    capabilities: [
      { title: { es: "Fundamentado en ley colombiana", en: "Grounded in Colombian law" }, body: { es: "Respuestas ligadas a la norma oficial.", en: "Answers tied to the official rule." } },
      { title: { es: "Información, no consejo", en: "Information, not advice" }, body: { es: "Motor diseñado para no ejercer el derecho.", en: "Engine built not to practice law." } },
      { title: { es: "Cada respuesta con fuente", en: "Every answer sourced" }, body: { es: "Enlace a la fuente primaria oficial.", en: "A link to the official primary source." } },
      { title: { es: "Tarjeta de referencia (PDF)", en: "Reference card (PDF)" }, body: { es: "Resumen descargable de la norma clave.", en: "A downloadable summary of the key rule." } },
      { title: { es: "Áreas cotidianas", en: "Everyday areas" }, body: { es: "Arriendo y vivienda, consumo, trámites, familia, derechos ante la autoridad.", en: "Housing, consumer, paperwork, family, rights before authorities." } },
      { title: { es: "Bilingüe ES / EN", en: "Bilingual ES / EN" }, body: { es: "Pensado para colombianos y extranjeros.", en: "Built for Colombians and foreigners alike." } },
    ],
    proof: {
      title: { es: "Diseñado para no dar consejo — por arquitectura, no por descargo.", en: "Built not to give advice — by architecture, not disclaimer." },
      body: {
        es: "Motor de información-no-consejo: recupera, fundamenta, verifica la citación y, ante el consejo, reescribe o se abstiene. La misma arquitectura UPL-safe de Street Legal AI, adaptada al marco colombiano.",
        en: "An information-not-advice engine: retrieve, ground, verify the citation, and when it nears advice, rewrite or abstain. The same UPL-safe Street Legal AI architecture, adapted to the Colombian framework.",
      },
      chips: ["Información-no-consejo", "Firewall de citaciones", "Fuentes primarias oficiales", "Claude (Anthropic)"],
    },
    cta: {
      title: { es: "Lleva información legal clara a tus usuarios.", en: "Bring clear legal information to your users." },
      body: { es: "Agenda una llamada para ver Street Legal AI adaptado a Colombia.", en: "Book a call to see Street Legal AI adapted to Colombia." },
    },
    seo: {
      title: "Street Legal AI · Colombia | Información legal clara",
      description:
        "IA que explica tus derechos bajo la ley colombiana, siempre con fuente oficial y nunca como consejo jurídico. Plain-language legal information grounded in Colombian law.",
    },
    ogTagline: "Legal information, grounded in Colombian law",
  },

  // ───────────────────────────────────────────────────────────
  // STREET LEGAL AI — El Salvador
  // ───────────────────────────────────────────────────────────
  {
    slug: "legal-sv",
    brand: "Street Legal",
    brandAccentWord: "AI",
    badge: "El Salvador",
    accent: "#3B82F6",
    eyebrow: { es: "Información legal · El Salvador", en: "Legal information · El Salvador" },
    headline: {
      es: [
        { t: "Entiende tus derechos" },
        { t: "bajo la ley salvadoreña —" },
        { t: "en lenguaje claro", em: true },
      ],
      en: [
        { t: "Understand your rights" },
        { t: "under Salvadoran law —" },
        { t: "in plain language", em: true },
      ],
    },
    sub: {
      es: "Street Legal AI explica tus derechos y trámites con la ley salvadoreña — siempre con la fuente oficial, nunca como consejo jurídico. Información que te orienta antes de hablar con un abogado.",
      en: "Street Legal AI explains your rights and procedures under Salvadoran law — always with the official source, never as legal advice. Information that orients you before you talk to a lawyer.",
    },
    metrics: [
      { value: "0%", label: { es: "Consejo jurídico — solo información", en: "Legal advice — information only" } },
      { value: "100%", label: { es: "Respuestas con fuente oficial", en: "Answers with an official source" } },
      { value: "ES / EN", label: { es: "Bilingüe", en: "Bilingual" } },
      { value: "24/7", label: { es: "Orientación disponible", en: "Guidance available" } },
    ],
    problem: {
      title: {
        es: "La ley existe para protegerte — si logras entenderla.",
        en: "The law exists to protect you — if you can understand it.",
      },
      body: {
        es: "Arrendamiento, consumo, trámites, derechos ante la autoridad: la norma está escrita para abogados. La gente decide a ciegas o paga una consulta solo para saber por dónde empezar.",
        en: "Leases, consumer rights, paperwork, rights before authorities: the law is written for lawyers. People decide blind, or pay a consultation just to learn where to start.",
      },
    },
    stepsLabel: { es: "Cómo funciona", en: "How it works" },
    steps: [
      {
        title: { es: "Pregunta en español sobre tu situación", en: "Ask about your situation, in Spanish" },
        body: { es: "Describe lo que te pasa en tus palabras — sin tecnicismos.", en: "Describe what's happening in your own words — no jargon." },
      },
      {
        title: { es: "Fundamentada en la ley salvadoreña", en: "Grounded in Salvadoran law" },
        body: { es: "El motor recupera la norma oficial pertinente — no opiniones de internet.", en: "The engine retrieves the relevant official rule — not internet opinions." },
      },
      {
        title: { es: "Respuesta con cita, nunca consejo", en: "Cited answer, never advice" },
        body: { es: "Te explica qué dice la ley y enlaza la fuente primaria; si cruza la línea del consejo, se abstiene.", en: "It explains what the law says and links the primary source; if it crosses into advice, it abstains." },
      },
      {
        title: { es: "Sabes cuándo necesitas un abogado", en: "Know when you need a lawyer" },
        body: { es: "Te orienta y te dice con claridad cuándo un caso requiere representación.", en: "It orients you and says plainly when a case needs representation." },
      },
    ],
    capabilitiesLabel: { es: "Qué cubre", en: "What it covers" },
    capabilities: [
      { title: { es: "Fundamentado en ley salvadoreña", en: "Grounded in Salvadoran law" }, body: { es: "Respuestas ligadas a la norma oficial.", en: "Answers tied to the official rule." } },
      { title: { es: "Información, no consejo", en: "Information, not advice" }, body: { es: "Motor diseñado para no ejercer el derecho.", en: "Engine built not to practice law." } },
      { title: { es: "Cada respuesta con fuente", en: "Every answer sourced" }, body: { es: "Enlace a la fuente primaria oficial.", en: "A link to the official primary source." } },
      { title: { es: "Tarjeta de referencia (PDF)", en: "Reference card (PDF)" }, body: { es: "Resumen descargable de la norma clave.", en: "A downloadable summary of the key rule." } },
      { title: { es: "Áreas cotidianas", en: "Everyday areas" }, body: { es: "Arrendamiento, consumo, trámites, familia, derechos ante la autoridad.", en: "Housing, consumer, paperwork, family, rights before authorities." } },
      { title: { es: "Bilingüe ES / EN", en: "Bilingual ES / EN" }, body: { es: "Pensado para salvadoreños dentro y fuera del país.", en: "Built for Salvadorans at home and abroad." } },
    ],
    proof: {
      title: { es: "Diseñado para no dar consejo — por arquitectura, no por descargo.", en: "Built not to give advice — by architecture, not disclaimer." },
      body: {
        es: "Motor de información-no-consejo: recupera, fundamenta, verifica la citación y, ante el consejo, reescribe o se abstiene. La misma arquitectura UPL-safe de Street Legal AI, adaptada al marco salvadoreño.",
        en: "An information-not-advice engine: retrieve, ground, verify the citation, and when it nears advice, rewrite or abstain. The same UPL-safe Street Legal AI architecture, adapted to the Salvadoran framework.",
      },
      chips: ["Información-no-consejo", "Firewall de citaciones", "Fuentes primarias oficiales", "Claude (Anthropic)"],
    },
    cta: {
      title: { es: "Lleva información legal clara a tus usuarios.", en: "Bring clear legal information to your users." },
      body: { es: "Agenda una llamada para ver Street Legal AI adaptado a El Salvador.", en: "Book a call to see Street Legal AI adapted to El Salvador." },
    },
    seo: {
      title: "Street Legal AI · El Salvador | Información legal clara",
      description:
        "IA que explica tus derechos bajo la ley salvadoreña, siempre con fuente oficial y nunca como consejo jurídico. Plain-language legal information grounded in Salvadoran law.",
    },
    ogTagline: "Legal information, grounded in Salvadoran law",
  },

  // ───────────────────────────────────────────────────────────
  // IA PARA EL ESTADO — Public-Sector AI
  // ───────────────────────────────────────────────────────────
  {
    slug: "estado",
    brand: "IA para el Estado",
    accent: "#C9A96E",
    eyebrow: { es: "IA para el Sector Público", en: "AI for the Public Sector" },
    headline: {
      es: [
        { t: "IA para el Estado —" },
        { t: "con trazabilidad, residencia" },
        { t: "de datos y control humano", em: true },
      ],
      en: [
        { t: "AI for the State —" },
        { t: "auditable, data-resident," },
        { t: "human-in-the-loop", em: true },
      ],
    },
    sub: {
      es: "Las instituciones no pueden aceptar cajas negras, datos que salen del país ni decisiones automáticas sin responsable. Construimos IA pública que cita sus fuentes, guarda evidencia verificable y deja la decisión en manos de un funcionario.",
      en: "Institutions can't accept black boxes, data leaving the country, or automated decisions with no one accountable. We build public-sector AI that cites its sources, keeps verifiable evidence, and leaves the decision with an official.",
    },
    liveUrl: "https://aegis-custodia.vercel.app",
    liveLabel: { es: "Ver la capa de cumplimiento (demo)", en: "See the compliance layer (demo)" },
    metrics: [
      { value: "100%", label: { es: "Respuestas con fuente — cero invención", en: "Sourced answers — zero fabrication" } },
      { value: "Append-only", label: { es: "Evidencia auditada e inalterable", en: "Audited, tamper-evident evidence" } },
      { value: "D.143/144", label: { es: "Diseñado sobre la ley de datos de El Salvador", en: "Built around El Salvador's data law" } },
      { value: "Humano", label: { es: "En el bucle de toda decisión", en: "In the loop on every decision" } },
    ],
    problem: {
      title: {
        es: "El sector público necesita IA — pero no puede arriesgar la confianza.",
        en: "The public sector needs AI — but can't gamble public trust.",
      },
      body: {
        es: "Una respuesta inventada, un dato que cruza la frontera o una decisión sin responsable no son errores de producto: son riesgos institucionales y legales. La IA pública exige un estándar distinto.",
        en: "A fabricated answer, data crossing the border, or a decision with no owner aren't product bugs — they're institutional and legal risks. Public-sector AI demands a different standard.",
      },
    },
    stepsLabel: { es: "Los cuatro pilares", en: "The four pillars" },
    steps: [
      {
        title: { es: "IA fundamentada y citable", en: "Grounded, citable AI" },
        body: { es: "Respuestas ancladas en norma y política oficial; cuando no hay base, lo dice en vez de inventar.", en: "Answers anchored in official rule and policy; when there's no basis, it says so instead of inventing." },
      },
      {
        title: { es: "Residencia y soberanía de datos", en: "Data residency & sovereignty" },
        body: { es: "Arquitectura auto-hospedable, con los datos dentro del país y las llaves en manos de la institución.", en: "Self-hostable architecture, data kept in-country, keys held by the institution." },
      },
      {
        title: { es: "Evidencia verificable", en: "Verifiable evidence" },
        body: { es: "Registro append-only con sello criptográfico — auditable por terceros, imposible de alterar en silencio.", en: "Append-only ledger with a cryptographic seal — third-party auditable, impossible to alter silently." },
      },
      {
        title: { es: "Humano en el bucle", en: "Human in the loop" },
        body: { es: "La IA redacta y propone; el funcionario aprueba. Nada se emite solo en rutas legales o ciudadanas.", en: "The AI drafts and proposes; the official approves. Nothing goes out on its own on legal or citizen paths." },
      },
    ],
    capabilitiesLabel: { es: "Dónde se aplica", en: "Where it applies" },
    capabilities: [
      { title: { es: "Servicios al ciudadano", en: "Citizen services" }, body: { es: "Trámites, citas y seguimiento de expedientes.", en: "Paperwork, appointments, and case tracking." } },
      { title: { es: "Cumplimiento y protección de datos", en: "Compliance & data protection" }, body: { es: "Derechos ARCO y obligaciones de la LPDP.", en: "ARCO rights and data-protection obligations." } },
      { title: { es: "Asistentes institucionales", en: "Institutional assistants" }, body: { es: "Fundamentados en la norma, no en el modelo.", en: "Grounded in regulation, not in the model." } },
      { title: { es: "Modernización judicial y administrativa", en: "Judicial & administrative modernization" }, body: { es: "Flujos más rápidos sin perder el expediente.", en: "Faster flows without losing the record." } },
      { title: { es: "Sello de cumplimiento verificable", en: "Verifiable compliance seal" }, body: { es: "Postura auditable, comprobable públicamente.", en: "An auditable posture, publicly checkable." } },
      { title: { es: "Despliegue soberano", en: "Sovereign deployment" }, body: { es: "Auto-hospedable, con residencia en el país.", en: "Self-hostable, with in-country residency." } },
    ],
    proof: {
      title: { es: "Ya desplegado en El Salvador.", en: "Already deployed in El Salvador." },
      body: {
        es: "AEGIS Custodia — nuestra capa de cumplimiento y confianza — opera hoy sobre el marco salvadoreño de protección de datos (Decretos 143 y 144), con un sello verificable públicamente.",
        en: "AEGIS Custodia — our compliance and trust layer — runs today on El Salvador's data-protection framework (Decrees 143 and 144), with a publicly verifiable seal.",
      },
      chips: ["Decretos 143 / 144", "Evidencia Ed25519 + anclaje", "Registro append-only", "Claude (Anthropic)"],
    },
    cta: {
      title: { es: "Construyamos la IA pública de su institución.", en: "Let's build your institution's public-sector AI." },
      body: { es: "Agende una conversación con MachineMind.", en: "Book a conversation with MachineMind." },
    },
    seo: {
      title: "IA para el Estado · Sector Público | MachineMind",
      description:
        "IA pública con trazabilidad, residencia de datos, cumplimiento legal y control humano. Desplegada en El Salvador. Auditable, data-resident public-sector AI.",
    },
    ogTagline: "AI for the public sector · auditable · data-resident",
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export const productSlugs = products.map((p) => p.slug);
