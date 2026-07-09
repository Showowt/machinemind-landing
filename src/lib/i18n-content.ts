// MachineMind Landing — Full-site i18n content
// Colombian Spanish (es) + English (en)
// Note: "Intelligence" is intentionally kept in English in both locales as a brand term.

export type Lang = "en" | "es";

// ---------------------------------------------------------------------------
// Shape types
// ---------------------------------------------------------------------------

export type NavTranslations = {
  systems: string;
  portfolio: string;
  process: string;
  about: string;
  contact: string;
};

export type HeroTranslations = {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  /** Contains {count} placeholder */
  subtitle: string;
  subtitle2: string;
  ctaPrimary: string;
  ctaSecondary: string;
  scroll: string;
};

export type MetricsTranslations = {
  systemsDeployed: string;
  customBuilds: string;
  clientRetention: string;
  avgDelivery: string;
};

export type SystemCardTranslations = {
  desc: string;
  metric: string;
};

export type SystemsTranslations = {
  eyebrow: string;
  /** Contains {Infinite Leverage.} — the italic portion — as a raw segment for rendering */
  headingPrefix: string;
  headingItalic: string;
  desc: string;
  sofia: SystemCardTranslations;
  cinema: SystemCardTranslations;
  viceroy: SystemCardTranslations;
};

export type PortfolioTranslations = {
  eyebrow: string;
  /** Contains {count} and Zero Templates. italic segment */
  headingPrefix: string;
  headingMiddle: string;
  headingItalic: string;
  desc: string;
  filterAll: string;
  viewLive: string;
  privateAccess: string;
  /** Contains {n} placeholder */
  showMore: string;
};

export type ProcessPhaseTranslations = {
  title: string;
  detail: string;
  desc: string;
};

export type ProcessTranslations = {
  eyebrow: string;
  headingPrefix: string;
  headingItalic: string;
  desc: string;
  phase1: ProcessPhaseTranslations;
  phase2: ProcessPhaseTranslations;
  phase3: ProcessPhaseTranslations;
  phase4: ProcessPhaseTranslations;
};

export type ManifestoTranslations = {
  line1: string;
  line2Prefix: string;
  line2Italic: string;
  line3Prefix: string;
  line3Italic1: string;
  line3Middle: string;
  line3Italic2: string;
  line4: string;
  line5: string;
  line6Bold: string;
};

export type AboutTranslations = {
  eyebrow: string;
  headingPrefix: string;
  headingItalic1: string;
  headingMiddle: string;
  headingItalic2: string;
  founder: string;
  p1: string;
  p2: string;
  location: string;
};

export type ContactTranslations = {
  eyebrow: string;
  heading: string;
  sub: string;
  sidebarTitle: string;
  benefits: readonly [string, string, string, string];
  bookCall: string;
  whatsapp: string;
};

export type FooterTranslations = {
  tagline: string;
};

export type LeadCaptureTranslations = {
  namePlaceholder: string;
  emailPlaceholder: string;
  phonePlaceholder: string;
  companyPlaceholder: string;
  interestDefault: string;
  interestSofia: string;
  interestCinema: string;
  interestSuite: string;
  interestCustom: string;
  messagePlaceholder: string;
  submit: string;
  sending: string;
  successTitle: string;
  successText: string;
  bookInstantCall: string;
  whatsappUs: string;
  error: string;
};

export type StickyBarTranslations = {
  text: string;
  button: string;
  emailPlaceholder: string;
  interestPlaceholder: string;
  send: string;
  success: string;
};

export type ExitIntentTranslations = {
  eyebrow: string;
  title: string;
  subtitle: string;
  emailPlaceholder: string;
  interest: string;
  submit: string;
  footer: string;
  successTitle: string;
  successText: string;
};

export type SiteTranslations = {
  nav: NavTranslations;
  hero: HeroTranslations;
  metrics: MetricsTranslations;
  systems: SystemsTranslations;
  portfolio: PortfolioTranslations;
  process: ProcessTranslations;
  manifesto: ManifestoTranslations;
  about: AboutTranslations;
  contact: ContactTranslations;
  footer: FooterTranslations;
  leadCapture: LeadCaptureTranslations;
  stickyBar: StickyBarTranslations;
  exitIntent: ExitIntentTranslations;
};

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------

export const TRANSLATIONS: Record<Lang, SiteTranslations> = {
  // =========================================================================
  // ENGLISH
  // =========================================================================
  en: {
    nav: {
      systems: "Systems",
      portfolio: "Portfolio",
      process: "Process",
      about: "About",
      contact: "Contact",
    },

    hero: {
      eyebrow: "AI AUTOMATION CONSULTANCY",
      titleLine1: "We Engineer",
      titleLine2: "Autonomous",
      subtitle:
        "AI that sells, books, qualifies, and operates 24/7 — deployed across {count} custom systems and counting.",
      subtitle2: "We don't build tools. We build unfair advantages.",
      ctaPrimary: "Start a Project",
      ctaSecondary: "View Portfolio",
      scroll: "Scroll to explore",
    },

    metrics: {
      systemsDeployed: "Systems Deployed",
      customBuilds: "Custom Builds",
      clientRetention: "Client Retention",
      avgDelivery: "Avg Delivery",
    },

    systems: {
      eyebrow: "WHAT WE BUILD",
      headingPrefix: "Three Engines.",
      headingItalic: "Infinite Leverage.",
      desc: "Each system compounds. Together they create an autonomous revenue machine.",
      sofia: {
        desc: "WhatsApp AI that qualifies leads, handles bookings, detects psychology, and closes deals 24/7. Six mental models. Escalation intelligence. Revenue generation on autopilot.",
        metric: "24/7 Revenue Generation",
      },
      cinema: {
        desc: "Websites that feel like films. 25 layers of scroll-driven animation, Three.js environments, GSAP choreography. Every pixel is engineered to convert visitors into clients.",
        metric: "25-Layer Cinematic System",
      },
      viceroy: {
        desc: "AI-powered investor qualification. Detects intent, scores across 8 dimensions, routes to humans when stakes are high. Autonomous deal flow at scale.",
        metric: "Autonomous Deal Flow",
      },
    },

    portfolio: {
      eyebrow: "PORTFOLIO",
      headingPrefix: "{count} Systems.",
      headingMiddle: "",
      headingItalic: "Zero Templates.",
      desc: "Every build is custom-engineered. Every deployment is production-grade.",
      filterAll: "All",
      viewLive: "View Live",
      privateAccess: "Private Access",
      showMore: "Show More ({n} remaining)",
    },

    process: {
      eyebrow: "THE PROCESS",
      headingPrefix: "Four Phases.",
      headingItalic: "Zero Waste.",
      desc: "From first call to production deployment in weeks, not months.",
      phase1: {
        title: "Discovery",
        detail: "Week 1 — Diagnostic & Strategy",
        desc: "We decode your revenue leaks, map automation opportunities, and identify the highest-ROI AI deployment. You get a full diagnostic with a prioritized roadmap.",
      },
      phase2: {
        title: "Architecture",
        detail: "Week 2 — Technical Blueprint",
        desc: "Custom system design — database schemas, AI pipelines, integration maps, security policies. Every component is purpose-built for your specific business logic.",
      },
      phase3: {
        title: "Build & Ship",
        detail: "Weeks 2-4 — Live Deployment",
        desc: "Rapid deployment with Cinema Engine aesthetics. TypeScript strict, Supabase RLS, Vercel edge. You see a working demo within days, not months.",
      },
      phase4: {
        title: "Scale & Learn",
        detail: "Ongoing — Compound Growth",
        desc: "Continuous optimization as your AI learns your business. Performance monitoring, A/B testing, and system expansion. Your competitors wonder what happened.",
      },
    },

    manifesto: {
      line1: "We don't build websites.",
      line2Prefix: "We build systems that",
      line2Italic: "breathe",
      line3Prefix: "that",
      line3Italic1: "learn",
      line3Middle: ", that",
      line3Italic2: "compound",
      line4: "Every deployment is a moat.",
      line5: "Every pixel is choreographed.",
      line6Bold: "We create what doesn't exist yet.",
    },

    about: {
      eyebrow: "ABOUT",
      headingPrefix: "Built in",
      headingItalic1: "Cartagena",
      headingMiddle: ". Deployed",
      headingItalic2: "Everywhere",
      founder: "Founded by Phil McGill",
      p1: "MachineMind is an AI automation consultancy that builds autonomous intelligence infrastructure for businesses that refuse to operate manually.",
      p2: "We specialize in hospitality, real estate, private capital, and high-touch service industries where every missed message is lost revenue.",
      location:
        "Based in Cartagena, Colombia — deploying worldwide for clients across the Americas, Europe, and the Middle East.",
    },

    contact: {
      eyebrow: "LET'S BUILD",
      heading: "Ready to build something that doesn't exist yet?",
      sub: "We take on 3 new clients per quarter. Tell us about your project and get a free strategy session.",
      sidebarTitle: "In your free session:",
      benefits: [
        "Revenue leak analysis",
        "Live Sofia AI demo on your business",
        "Custom automation roadmap",
        "ROI projection with real numbers",
      ],
      bookCall: "Book a Call",
      whatsapp: "WhatsApp",
    },

    footer: {
      tagline: "Autonomous Intelligence Infrastructure",
    },

    leadCapture: {
      namePlaceholder: "Your name *",
      emailPlaceholder: "Email *",
      phonePlaceholder: "Phone (optional)",
      companyPlaceholder: "Company / Business",
      interestDefault: "What are you interested in?",
      interestSofia: "Sofia AI — WhatsApp Automation",
      interestCinema: "Cinema Engine — Website",
      interestSuite: "Full Automation Suite",
      interestCustom: "Custom AI Project",
      messagePlaceholder: "Tell us about your project (optional)",
      submit: "Get Your Free Strategy Session",
      sending: "Sending...",
      successTitle: "We got you.",
      successText:
        "Expect a response within 2 hours. If you need us faster:",
      bookInstantCall: "Book Instant Call",
      whatsappUs: "WhatsApp Us",
      error:
        "Something went wrong. Try again or WhatsApp us directly.",
    },

    stickyBar: {
      text: "Losing revenue to missed inquiries?",
      button: "Get a Free Quote",
      emailPlaceholder: "Your email",
      interestPlaceholder: "Interest?",
      send: "Send",
      success: "Got it! We'll be in touch within 2 hours.",
    },

    exitIntent: {
      eyebrow: "BEFORE YOU GO",
      title: "Don't leave money on the table.",
      subtitle:
        "Get a free revenue leak analysis — discover how much you're losing from missed inquiries.",
      emailPlaceholder: "Your email",
      interest: "What interests you?",
      submit: "Get My Free Analysis",
      footer: "100% free. No spam. Just your personalized revenue opportunity.",
      successTitle: "You're in.",
      successText:
        "We'll reach out within 2 hours with your custom strategy.",
    },
  },

  // =========================================================================
  // SPANISH (Colombian — professional pero cercano, no rígido)
  // =========================================================================
  es: {
    nav: {
      systems: "Sistemas",
      portfolio: "Portafolio",
      process: "Proceso",
      about: "Nosotros",
      contact: "Contacto",
    },

    hero: {
      eyebrow: "CONSULTORÍA DE AUTOMATIZACIÓN CON IA",
      titleLine1: "Construimos",
      titleLine2: "Autonomous",
      subtitle:
        "IA que vende, agenda, califica y opera 24/7 — desplegada en {count} sistemas a la medida y contando.",
      subtitle2: "No construimos herramientas. Construimos ventajas injustas.",
      ctaPrimary: "Empezar un Proyecto",
      ctaSecondary: "Ver Portafolio",
      scroll: "Desliza para explorar",
    },

    metrics: {
      systemsDeployed: "Sistemas Desplegados",
      customBuilds: "Builds a la Medida",
      clientRetention: "Retención de Clientes",
      avgDelivery: "Entrega Promedio",
    },

    systems: {
      eyebrow: "LO QUE CONSTRUIMOS",
      headingPrefix: "Tres Motores.",
      headingItalic: "Apalancamiento Infinito.",
      desc: "Cada sistema se potencia solo. Juntos crean una máquina de ingresos autónoma.",
      sofia: {
        desc: "IA por WhatsApp que califica prospectos, gestiona reservas, detecta psicología del cliente y cierra negocios 24/7. Seis modelos mentales. Inteligencia de escalamiento. Generación de ingresos en piloto automático.",
        metric: "Generación de Ingresos 24/7",
      },
      cinema: {
        desc: "Sitios web que se sienten como películas. 25 capas de animación guiada por scroll, entornos Three.js, coreografía GSAP. Cada píxel está diseñado para convertir visitantes en clientes.",
        metric: "Sistema Cinematográfico de 25 Capas",
      },
      viceroy: {
        desc: "Calificación de inversionistas potenciada por IA. Detecta intención, puntúa en 8 dimensiones y escala a humanos cuando las apuestas son altas. Flujo de negocios autónomo a escala.",
        metric: "Flujo de Negocios Autónomo",
      },
    },

    portfolio: {
      eyebrow: "PORTAFOLIO",
      headingPrefix: "{count} Sistemas.",
      headingMiddle: "",
      headingItalic: "Cero Plantillas.",
      desc: "Cada build es a la medida. Cada despliegue es de nivel productivo.",
      filterAll: "Todos",
      viewLive: "Ver en Vivo",
      privateAccess: "Acceso Privado",
      showMore: "Ver Más ({n} restantes)",
    },

    process: {
      eyebrow: "EL PROCESO",
      headingPrefix: "Cuatro Fases.",
      headingItalic: "Cero Desperdicio.",
      desc: "De la primera llamada al despliegue en producción: semanas, no meses.",
      phase1: {
        title: "Diagnóstico",
        detail: "Semana 1 — Diagnóstico y Estrategia",
        desc: "Identificamos tus fugas de ingresos, mapeamos oportunidades de automatización y encontramos el despliegue de IA con mayor ROI. Obtienes un diagnóstico completo con una hoja de ruta priorizada.",
      },
      phase2: {
        title: "Arquitectura",
        detail: "Semana 2 — Blueprint Técnico",
        desc: "Diseño de sistema a la medida: esquemas de base de datos, pipelines de IA, mapas de integración, políticas de seguridad. Cada componente está construido específicamente para tu lógica de negocio.",
      },
      phase3: {
        title: "Construir y Lanzar",
        detail: "Semanas 2-4 — Despliegue en Vivo",
        desc: "Despliegue rápido con la estética del Cinema Engine. TypeScript strict, Supabase RLS, Vercel edge. Ves un demo funcional en días, no en meses.",
      },
      phase4: {
        title: "Escalar y Aprender",
        detail: "Continuo — Crecimiento Compuesto",
        desc: "Optimización continua mientras tu IA aprende de tu negocio. Monitoreo de rendimiento, pruebas A/B y expansión del sistema. Tus competidores se quedan preguntando qué pasó.",
      },
    },

    manifesto: {
      line1: "No construimos sitios web.",
      line2Prefix: "Construimos sistemas que",
      line2Italic: "respiran",
      line3Prefix: "que",
      line3Italic1: "aprenden",
      line3Middle: ", que",
      line3Italic2: "se potencian solos",
      line4: "Cada despliegue es una ventaja defensiva.",
      line5: "Cada píxel está coreografiado.",
      line6Bold: "Creamos lo que todavía no existe.",
    },

    about: {
      eyebrow: "NOSOTROS",
      headingPrefix: "Construido en",
      headingItalic1: "Cartagena",
      headingMiddle: ". Desplegado en",
      headingItalic2: "Todas Partes",
      founder: "Fundado por Phil McGill",
      p1: "MachineMind es una consultoría de automatización con IA que construye infraestructura de inteligencia autónoma para negocios que se niegan a operar de forma manual.",
      p2: "Nos especializamos en hospitalidad, bienes raíces, capital privado e industrias de servicio de alto contacto, donde cada mensaje perdido es ingreso perdido.",
      location:
        "Con base en Cartagena, Colombia — desplegando en todo el mundo para clientes en las Américas, Europa y Medio Oriente.",
    },

    contact: {
      eyebrow: "CONSTRUYAMOS",
      heading: "¿Listo para construir algo que todavía no existe?",
      sub: "Tomamos 3 clientes nuevos por trimestre. Cuéntanos sobre tu proyecto y obtén una sesión de estrategia gratuita.",
      sidebarTitle: "En tu sesión gratuita:",
      benefits: [
        "Análisis de fugas de ingresos",
        "Demo en vivo de Sofia AI aplicado a tu negocio",
        "Hoja de ruta de automatización personalizada",
        "Proyección de ROI con números reales",
      ],
      bookCall: "Agendar una Llamada",
      whatsapp: "WhatsApp",
    },

    footer: {
      tagline: "Infraestructura de Inteligencia Autónoma",
    },

    leadCapture: {
      namePlaceholder: "Tu nombre *",
      emailPlaceholder: "Correo electrónico *",
      phonePlaceholder: "Teléfono (opcional)",
      companyPlaceholder: "Empresa / Negocio",
      interestDefault: "¿Qué te interesa?",
      interestSofia: "Sofia AI — Automatización por WhatsApp",
      interestCinema: "Cinema Engine — Sitio Web",
      interestSuite: "Suite Completa de Automatización",
      interestCustom: "Proyecto de IA a la Medida",
      messagePlaceholder: "Cuéntanos sobre tu proyecto (opcional)",
      submit: "Obtener Mi Sesión de Estrategia Gratuita",
      sending: "Enviando...",
      successTitle: "Ya lo tenemos.",
      successText:
        "Espera una respuesta en menos de 2 horas. Si nos necesitas antes:",
      bookInstantCall: "Agendar Llamada Ya",
      whatsappUs: "Escríbenos por WhatsApp",
      error:
        "Algo salió mal. Intenta de nuevo o escríbenos directamente por WhatsApp.",
    },

    stickyBar: {
      text: "¿Perdiendo ingresos por consultas sin responder?",
      button: "Obtener Cotización Gratis",
      emailPlaceholder: "Tu correo",
      interestPlaceholder: "¿Qué te interesa?",
      send: "Enviar",
      success: "¡Listo! Te contactamos en menos de 2 horas.",
    },

    exitIntent: {
      eyebrow: "ANTES DE IRTE",
      title: "No dejes dinero sobre la mesa.",
      subtitle:
        "Obtén un análisis gratuito de fugas de ingresos — descubre cuánto estás perdiendo por consultas sin responder.",
      emailPlaceholder: "Tu correo",
      interest: "¿Qué te interesa?",
      submit: "Obtener Mi Análisis Gratis",
      footer:
        "100% gratis. Sin spam. Solo tu oportunidad de ingresos personalizada.",
      successTitle: "Ya estás adentro.",
      successText:
        "Te escribimos en menos de 2 horas con tu estrategia personalizada.",
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Convenience re-export of the shape type
// ---------------------------------------------------------------------------
export type TranslationShape = SiteTranslations;
