// MachineMind Portfolio Projects Data
// ORDERED BY SOPHISTICATION: Most Elite → Standard

export type ProjectCategory = "flagship" | "demo" | "automation" | "enterprise";

export interface Project {
  slug: string;
  nameEs: string;
  nameEn: string;
  taglineEs: string;
  taglineEn: string;
  descriptionEs?: string;
  descriptionEn?: string;
  category: ProjectCategory;
  subcategory?: string;
  techStack: string[];
  liveUrl: string | null;
  thumbnailUrl?: string;
  colorAccent: string;
  isActive: boolean;
  isFeatured: boolean;
}

export const projects: Project[] = [
  // ============================================
  // TIER 1: ELITE - Classified & Full-Stack AI
  // ============================================
  {
    slug: "aegis-shield",
    nameEs: "AEGIS Shield",
    nameEn: "AEGIS Shield",
    taglineEs: "Control de acceso militar con IA",
    taglineEn: "Military-grade access control with AI",
    descriptionEs:
      "Sistema de control de acceso militar con DBIDS, Sentinel AI, autenticación biométrica y gestión de políticas.",
    descriptionEn:
      "Military access control system with DBIDS integration, Sentinel AI, biometric auth, and policy management.",
    category: "enterprise",
    subcategory: "defense",
    techStack: [
      "Next.js 14",
      "Supabase",
      "DBIDS",
      "Sentinel AI",
      "bcrypt",
      "RLS",
    ],
    liveUrl: null,
    colorAccent: "#1c4a5e",
    isActive: true,
    isFeatured: true,
  },
  {
    slug: "sofia-realestate",
    nameEs: "Sofia Real Estate",
    nameEn: "Sofia Real Estate",
    taglineEs: "IA que vende propiedades mientras duermes",
    taglineEn: "AI that sells properties while you sleep",
    descriptionEs:
      "Calificación de leads 24/7, respuestas instantáneas en WhatsApp, seguimiento automático, generación de documentos legales.",
    descriptionEn:
      "24/7 lead qualification, instant WhatsApp responses, automatic follow-up, legal document generation.",
    category: "enterprise",
    subcategory: "real-estate",
    techStack: [
      "Next.js 16",
      "Supabase",
      "Claude AI",
      "WhatsApp",
      "Twilio",
      "RLS",
    ],
    liveUrl: null,
    colorAccent: "#0891b2",
    isActive: true,
    isFeatured: true,
  },
  {
    slug: "movvia",
    nameEs: "Movvia",
    nameEn: "Movvia",
    taglineEs: "Concierge de lujo para Cartagena",
    taglineEn: "Luxury concierge platform for Cartagena",
    descriptionEs:
      "Plataforma completa de hospitalidad con reservas, pagos Wompi, experiencias de lujo, checkout y gestión de restaurantes.",
    descriptionEn:
      "Complete hospitality platform with bookings, Wompi payments, luxury experiences, checkout, and restaurant management.",
    category: "flagship",
    subcategory: "hospitality",
    techStack: [
      "Next.js 16",
      "Supabase",
      "Wompi",
      "Twilio",
      "Claude AI",
      "RLS",
    ],
    liveUrl: "https://movvia-pi.vercel.app",
    colorAccent: "#00B4FF",
    isActive: true,
    isFeatured: true,
  },
  {
    slug: "simmer-down",
    nameEs: "Simmer Down Pizza",
    nameEn: "Simmer Down Pizza",
    taglineEs: "Pizzería con experiencias interactivas",
    taglineEn: "Pizzeria with interactive experiences",
    descriptionEs:
      "Sistema de pedidos con partículas de fuego Canvas, código Konami, menú secreto, easter eggs y etiquetas dietéticas.",
    descriptionEn:
      "Ordering system with Canvas fire particles, Konami code, secret menu, easter eggs, and dietary tags.",
    category: "flagship",
    subcategory: "restaurant",
    techStack: [
      "Next.js 16",
      "Supabase",
      "Zustand",
      "Framer Motion",
      "Canvas API",
    ],
    liveUrl: "https://simmer-down.vercel.app",
    colorAccent: "#f97316",
    isActive: true,
    isFeatured: true,
  },
  {
    slug: "dharma",
    nameEs: "Dharma Beach Club",
    nameEn: "Dharma Beach Club",
    taglineEs: "Club de playa de lujo en Islas del Rosario",
    taglineEn: "Luxury beach club in Islas del Rosario",
    descriptionEs:
      "Experiencia de día completo con pagos Stripe, transporte en lancha, gastronomía gourmet, y conexión espiritual.",
    descriptionEn:
      "Full day experience with Stripe payments, boat transportation, gourmet gastronomy, and spiritual connection.",
    category: "flagship",
    subcategory: "hospitality",
    techStack: ["Next.js 16", "Supabase", "Stripe", "Framer Motion", "Zustand"],
    liveUrl: "https://dharma-topaz.vercel.app",
    colorAccent: "#d4af37",
    isActive: true,
    isFeatured: true,
  },

  {
    slug: "natucoru",
    nameEs: "Fundación Natucorú",
    nameEn: "Fundación Natucorú",
    taglineEs: "Conservación amazónica con comunidades indígenas",
    taglineEn: "Amazon conservation with indigenous communities",
    descriptionEs:
      "Plataforma cinematográfica bilingüe para fundación de conservación — mapa interactivo de 6 departamentos, portafolio de proyectos con galerías, diseño editorial que transmite la selva.",
    descriptionEn:
      "Cinematic bilingual platform for conservation foundation — interactive map of 6 departments, project portfolio with galleries, editorial design that transmits the jungle.",
    category: "flagship",
    subcategory: "conservation",
    techStack: [
      "Next.js 14",
      "Tailwind CSS",
      "Framer Motion",
      "Bilingual ES/EN",
    ],
    liveUrl: "https://natucoru.vercel.app",
    colorAccent: "#1B4332",
    isActive: true,
    isFeatured: true,
  },

  // ============================================
  // TIER 2: HIGH-END - AI + Premium Features
  // ============================================
  {
    slug: "demo-fourseasons-bogota",
    nameEs: "Four Seasons Bogotá",
    nameEn: "Four Seasons Bogotá",
    taglineEs: "Concierge AI para hotel 5 estrellas",
    taglineEn: "AI concierge for 5-star hotel",
    descriptionEs:
      "Demo de hotel de lujo con Claude AI SDK, reservaciones inteligentes y experiencias personalizadas.",
    descriptionEn:
      "Luxury hotel demo with Claude AI SDK, intelligent reservations, and personalized experiences.",
    category: "demo",
    subcategory: "hospitality",
    techStack: ["Next.js 16", "Claude AI SDK", "Tailwind", "Framer Motion"],
    liveUrl: "https://demo-fourseasons-bogota.vercel.app",
    colorAccent: "#00B4FF",
    isActive: true,
    isFeatured: true,
  },
  {
    slug: "demo-seven7times",
    nameEs: "SEVEN 7 TIMES Disco Club",
    nameEn: "SEVEN 7 TIMES Disco Club",
    taglineEs: "El disco club más grande del Caribe Colombiano",
    taglineEn: "Largest disco club in Colombian Caribbean",
    descriptionEs:
      "Discoteca con Sofia AI, calculador de ingresos perdidos, showcase de ambientes con partículas doradas.",
    descriptionEn:
      "Nightclub with Sofia AI, revenue leak calculator, environments showcase with gold particles.",
    category: "demo",
    subcategory: "nightlife",
    techStack: [
      "Next.js 16",
      "Sofia AI",
      "Tailwind v4",
      "Canvas",
      "Framer Motion",
    ],
    liveUrl: "https://demo-seven7times.vercel.app",
    colorAccent: "#d4af37",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-villareal",
    nameEs: "Villa Real Villeta",
    nameEn: "Villa Real Villeta",
    taglineEs: "Villa de lujo con pricing dinámico AI",
    taglineEn: "Luxury villa with AI dynamic pricing",
    descriptionEs:
      "Villa de lujo con Sofia AI, pricing dinámico, automatización de journey del huésped, before/after sliders.",
    descriptionEn:
      "Luxury villa with Sofia AI, dynamic pricing, guest journey automation, before/after sliders.",
    category: "demo",
    subcategory: "real-estate",
    techStack: ["Next.js 16", "Sofia AI", "Tailwind v4", "Framer Motion"],
    liveUrl: "https://demo-villareal.vercel.app",
    colorAccent: "#16a34a",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-worldlion",
    nameEs: "World Lion Tours",
    nameEn: "World Lion Tours",
    taglineEs: "Tours Comuna 13 con León AI",
    taglineEn: "Comuna 13 tours with León AI",
    descriptionEs:
      "Operador turístico con León AI concierge, calculador de impacto de ingresos, showcase de reseñas verificadas.",
    descriptionEn:
      "Tour operator with León AI concierge, revenue impact calculator, verified review showcase.",
    category: "demo",
    subcategory: "tourism",
    techStack: ["Next.js 16", "León AI", "Tailwind v4", "Framer Motion"],
    liveUrl: "https://demo-worldlion.vercel.app",
    colorAccent: "#f97316",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "tu-tataumana",
    nameEs: "Tu Tataúmana",
    nameEn: "Tu Tataúmana",
    taglineEs: "Reservas automáticas 24/7 por WhatsApp",
    taglineEn: "24/7 automatic WhatsApp bookings",
    descriptionEs:
      "Operador turístico con Sofia AI que reserva tours, responde preguntas y convierte visitantes automáticamente.",
    descriptionEn:
      "Tour operator with Sofia AI that books tours, answers questions, and converts visitors automatically.",
    category: "flagship",
    subcategory: "tourism",
    techStack: ["Next.js 16", "Sofia AI", "WhatsApp", "Supabase", "Twilio"],
    liveUrl: "https://tu-tataumana.vercel.app",
    colorAccent: "#0d9488",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-lakasta",
    nameEs: "LA KASTA Premium Grill",
    nameEn: "LA KASTA Premium Grill",
    taglineEs: "Parrilla premium con analytics AI",
    taglineEn: "Premium grill with AI analytics",
    descriptionEs:
      "Parrilla premium con Sofia AI, analytics dashboard en tiempo real, soporte multi-location.",
    descriptionEn:
      "Premium grill with Sofia AI, real-time analytics dashboard, multi-location support.",
    category: "demo",
    subcategory: "restaurant",
    techStack: [
      "Next.js 16",
      "Sofia AI",
      "Tailwind v4",
      "Framer Motion",
      "Zustand",
    ],
    liveUrl: "https://demo-lakasta.vercel.app",
    colorAccent: "#b91c1c",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-alambique",
    nameEs: "Alambique Medellín",
    nameEn: "Alambique Medellín",
    taglineEs: "Rooftop lab con Sofia AI + Instagram",
    taglineEn: "Rooftop lab with Sofia AI + Instagram",
    descriptionEs:
      "Restaurante rooftop con Sofia AI para reservaciones, gestión de reputación e integración Instagram.",
    descriptionEn:
      "Rooftop restaurant with Sofia AI for reservations, reputation management, and Instagram integration.",
    category: "demo",
    subcategory: "restaurant",
    techStack: ["Next.js 16", "Sofia AI", "Tailwind v4", "Instagram API"],
    liveUrl: "https://demo-alambique.vercel.app",
    colorAccent: "#8b5cf6",
    isActive: true,
    isFeatured: false,
  },

  // ============================================
  // TIER 3: MID-TIER - AI Integration
  // ============================================
  {
    slug: "demo-confort",
    nameEs: "Confort Rent a Car",
    nameEn: "Confort Rent a Car",
    taglineEs: "Renta de autos con Sofia AI WhatsApp",
    taglineEn: "Car rental with Sofia AI WhatsApp",
    descriptionEs:
      "Sistema de renta de autos con Sofia AI WhatsApp, gestión de reputación en Trustpilot, Google, Facebook.",
    descriptionEn:
      "Car rental system with Sofia AI WhatsApp, reputation management on Trustpilot, Google, Facebook.",
    category: "demo",
    subcategory: "transport",
    techStack: ["Next.js 16", "Sofia AI", "Twilio", "Tailwind v4"],
    liveUrl: "https://demo-confort.vercel.app",
    colorAccent: "#059669",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-cafenoir",
    nameEs: "Café Noir Bar & Lounge",
    nameEn: "Café Noir Bar & Lounge",
    taglineEs: "Café con Sofia AI + E-commerce",
    taglineEn: "Café with Sofia AI + E-commerce",
    descriptionEs:
      "Café y bar con Sofia AI, gestión de reputación, email marketing automatizado y e-commerce integrado.",
    descriptionEn:
      "Café and bar with Sofia AI, reputation management, automated email marketing, and integrated e-commerce.",
    category: "demo",
    subcategory: "restaurant",
    techStack: ["Next.js 16", "Sofia AI", "Tailwind v4", "E-commerce"],
    liveUrl: "https://demo-cafenoir.vercel.app",
    colorAccent: "#1c1917",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "frenessi",
    nameEs: "Frenessi",
    nameEn: "Frenessi",
    taglineEs: "Experiencia gastronómica de alta cocina",
    taglineEn: "High-end fine dining experience",
    descriptionEs:
      "Concepto de restaurante de alta gama con animaciones Cinema Engine, storytelling inmersivo de marca y pipeline de reservaciones.",
    descriptionEn:
      "High-end restaurant concept with Cinema Engine animations, immersive brand storytelling, and reservation pipeline.",
    category: "flagship",
    subcategory: "restaurant",
    techStack: ["Next.js 14", "Cinema Engine", "Framer Motion", "Tailwind"],
    liveUrl: "https://frenessi-pitch.vercel.app",
    colorAccent: "#dc2626",
    isActive: true,
    isFeatured: true,
  },
  {
    slug: "libertario",
    nameEs: "Libertario Coffee",
    nameEn: "Libertario Coffee",
    taglineEs: "BariRockStar Virtual 24/7 WhatsApp",
    taglineEn: "Virtual BariRockStar 24/7 WhatsApp",
    descriptionEs:
      "Café especialidad con bot WhatsApp AI bilingüe, booking de experiencias, generación automática de reseñas.",
    descriptionEn:
      "Specialty coffee with bilingual WhatsApp AI bot, experience booking, automatic review generation.",
    category: "demo",
    subcategory: "restaurant",
    techStack: ["Next.js 16", "WhatsApp AI", "Tailwind v4", "Twilio"],
    liveUrl: "https://libertario-demo.vercel.app",
    colorAccent: "#78350f",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-nextproducciones",
    nameEs: "Next Producciones",
    nameEn: "Next Producciones",
    taglineEs: "Producción audiovisual con IA",
    taglineEn: "AI-powered audiovisual production",
    descriptionEs:
      "Productora audiovisual con asistente AI para cotizaciones, planificación y gestión de proyectos.",
    descriptionEn:
      "Audiovisual production with AI assistant for quotes, planning, and project management.",
    category: "demo",
    subcategory: "media",
    techStack: ["Next.js 16", "Anthropic SDK", "Zustand", "Tailwind v4"],
    liveUrl: "https://demo-nextproducciones.vercel.app",
    colorAccent: "#0ea5e9",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-mariaeu",
    nameEs: "María EU",
    nameEn: "María EU",
    taglineEs: "Consultoría con IA integrada",
    taglineEn: "AI-powered consulting",
    descriptionEs:
      "Plataforma de consultoría con asistente AI para análisis y recomendaciones personalizadas.",
    descriptionEn:
      "Consulting platform with AI assistant for analysis and personalized recommendations.",
    category: "demo",
    subcategory: "consulting",
    techStack: ["Next.js 16", "Anthropic SDK", "Tailwind v4"],
    liveUrl: "https://demo-mariaeu.vercel.app",
    colorAccent: "#6366f1",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "integrity-cleaning",
    nameEs: "Integrity Cleaning Las Vegas",
    nameEn: "Integrity Cleaning Las Vegas",
    taglineEs: "Limpieza premium con cotizador inteligente",
    taglineEn: "Premium cleaning with smart quote calculator",
    descriptionEs:
      "Servicio de limpieza con calculador de cotizaciones instantáneo, horarios 24/7 para casino workers.",
    descriptionEn:
      "Cleaning service with instant quote calculator, 24/7 hours for casino workers.",
    category: "demo",
    subcategory: "services",
    techStack: ["Next.js 16", "Supabase", "Tailwind v4", "Calculator"],
    liveUrl: "https://integrity-cleaning.vercel.app",
    colorAccent: "#0284c7",
    isActive: true,
    isFeatured: false,
  },

  // ============================================
  // TIER 4: STANDARD - Clean Design
  // ============================================
  {
    slug: "demo-aerotransfer",
    nameEs: "AeroTransfer",
    nameEn: "AeroTransfer",
    taglineEs: "Charter y transfers ejecutivos",
    taglineEn: "Executive charter and transfers",
    descriptionEs:
      "Servicio de charter y transfers con animaciones premium y booking simplificado.",
    descriptionEn:
      "Charter and transfer service with premium animations and simplified booking.",
    category: "demo",
    subcategory: "transport",
    techStack: ["Next.js 16", "Framer Motion", "Tailwind"],
    liveUrl: "https://demo-aerotransfer.vercel.app",
    colorAccent: "#2563eb",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-rizos",
    nameEs: "Rizos Hair Care",
    nameEn: "Rizos Hair Care",
    taglineEs: "Cuidado del cabello con asesor AI",
    taglineEn: "Hair care with AI advisor",
    descriptionEs:
      "Marca de cuidado capilar con asesor AI para recomendaciones de productos personalizadas.",
    descriptionEn:
      "Hair care brand with AI advisor for personalized product recommendations.",
    category: "demo",
    subcategory: "beauty",
    techStack: ["Next.js 16", "Anthropic SDK", "Tailwind v4"],
    liveUrl: "https://demo-rizos.vercel.app",
    colorAccent: "#db2777",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-tutaina",
    nameEs: "Tutaína Experiencias",
    nameEn: "Tutaína Experiences",
    taglineEs: "Experiencias culturales auténticas",
    taglineEn: "Authentic cultural experiences",
    descriptionEs:
      "Operador de experiencias culturales con asistente AI para planificación personalizada.",
    descriptionEn:
      "Cultural experience operator with AI assistant for personalized planning.",
    category: "demo",
    subcategory: "tourism",
    techStack: ["Next.js 15", "Anthropic SDK", "Tailwind v4"],
    liveUrl: "https://demo-tutaina.vercel.app",
    colorAccent: "#f59e0b",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-100luxury",
    nameEs: "100 Luxury",
    nameEn: "100 Luxury",
    taglineEs: "Marca de hospitalidad de lujo",
    taglineEn: "Luxury hospitality brand",
    descriptionEs:
      "Landing page premium para marca de hospitalidad de alto nivel.",
    descriptionEn: "Premium landing page for high-end hospitality brand.",
    category: "demo",
    subcategory: "hospitality",
    techStack: ["Next.js 16", "Tailwind"],
    liveUrl: "https://demo-100luxury.vercel.app",
    colorAccent: "#00B4FF",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-benzdriver",
    nameEs: "BenzDriver",
    nameEn: "BenzDriver",
    taglineEs: "Transporte premium ejecutivo",
    taglineEn: "Premium executive transport",
    descriptionEs: "Servicio de transporte ejecutivo con flota Mercedes-Benz.",
    descriptionEn: "Executive transport service with Mercedes-Benz fleet.",
    category: "demo",
    subcategory: "transport",
    techStack: ["Next.js 16", "Tailwind"],
    liveUrl: "https://demo-benzdriver.vercel.app",
    colorAccent: "#171717",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-blacksound",
    nameEs: "BlackSound",
    nameEn: "BlackSound",
    taglineEs: "Entretenimiento y vida nocturna",
    taglineEn: "Entertainment and nightlife",
    descriptionEs:
      "Plataforma de entretenimiento nocturno con diseño oscuro premium.",
    descriptionEn: "Nightlife entertainment platform with premium dark design.",
    category: "demo",
    subcategory: "nightlife",
    techStack: ["Next.js 16", "Tailwind"],
    liveUrl: "https://demo-blacksound.vercel.app",
    colorAccent: "#9333ea",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-jota-pardo",
    nameEs: "Jota Pardo",
    nameEn: "Jota Pardo",
    taglineEs: "Servicios de concierge personal",
    taglineEn: "Personal concierge services",
    descriptionEs:
      "Servicios de concierge personal para viajeros de alto nivel.",
    descriptionEn: "Personal concierge services for high-end travelers.",
    category: "demo",
    subcategory: "concierge",
    techStack: ["Next.js 16", "Tailwind"],
    liveUrl: "https://demo-jota-pardo.vercel.app",
    colorAccent: "#0ea5e9",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-angelica-valencia",
    nameEs: "Angelica Valencia",
    nameEn: "Angelica Valencia",
    taglineEs: "Concierge personal de lujo",
    taglineEn: "Luxury personal concierge",
    descriptionEs:
      "Servicios de concierge personal exclusivo para clientes VIP.",
    descriptionEn: "Exclusive personal concierge services for VIP clients.",
    category: "demo",
    subcategory: "concierge",
    techStack: ["Next.js 16", "Tailwind"],
    liveUrl: "https://demo-angelica-valencia.vercel.app",
    colorAccent: "#ec4899",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-medellinvip",
    nameEs: "Medellín VIP",
    nameEn: "Medellín VIP",
    taglineEs: "Turismo VIP en Medellín",
    taglineEn: "VIP tourism in Medellín",
    descriptionEs:
      "Experiencias VIP exclusivas en Medellín para viajeros internacionales.",
    descriptionEn:
      "Exclusive VIP experiences in Medellín for international travelers.",
    category: "demo",
    subcategory: "tourism",
    techStack: ["Next.js 16", "Tailwind"],
    liveUrl: "https://demo-medellinvip.vercel.app",
    colorAccent: "#f59e0b",
    isActive: true,
    isFeatured: false,
  },

  // ============================================
  // AUTOMATION PLATFORMS - Internal Tools
  // ============================================
  {
    slug: "pangea",
    nameEs: "Pangea Platform",
    nameEn: "Pangea Platform",
    taglineEs: "Infraestructura global de IA",
    taglineEn: "Global AI infrastructure",
    descriptionEs:
      "Plataforma core de MachineMind para orquestación de agentes AI y automatización empresarial.",
    descriptionEn:
      "MachineMind core platform for AI agent orchestration and enterprise automation.",
    category: "automation",
    subcategory: "platform",
    techStack: ["Next.js 16", "Supabase", "Claude AI", "Tailwind v4"],
    liveUrl: "https://pangea-xi-cyan.vercel.app",
    colorAccent: "#4f46e5",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "sofia-nevada",
    nameEs: "Sofia Nevada",
    nameEn: "Sofia Nevada",
    taglineEs: "Gestión de reputación con IA",
    taglineEn: "AI reputation management",
    descriptionEs:
      "Plataforma de gestión de reputación con monitoreo de reseñas multi-plataforma y respuestas AI.",
    descriptionEn:
      "Reputation management platform with multi-platform review monitoring and AI responses.",
    category: "automation",
    subcategory: "reputation",
    techStack: ["Next.js 16", "Supabase", "Anthropic SDK", "Twilio"],
    liveUrl: "https://sofia-nevada.vercel.app",
    colorAccent: "#7c3aed",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "voxlink",
    nameEs: "VoxLink",
    nameEn: "VoxLink",
    taglineEs: "Comunicación voz/video en tiempo real",
    taglineEn: "Real-time voice/video communication",
    descriptionEs:
      "Plataforma de comunicación con WebRTC, video conferencing y transcripción AI.",
    descriptionEn:
      "Communication platform with WebRTC, video conferencing, and AI transcription.",
    category: "automation",
    subcategory: "communication",
    techStack: ["Next.js 14", "Daily.co", "PeerJS", "WebRTC"],
    liveUrl: null,
    colorAccent: "#06b6d4",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "outreach-engine",
    nameEs: "Outreach Engine",
    nameEn: "Outreach Engine",
    taglineEs: "Generación de leads automatizada",
    taglineEn: "Automated lead generation",
    descriptionEs:
      "Motor de outreach con scraping, enriquecimiento de datos y secuencias de email automatizadas.",
    descriptionEn:
      "Outreach engine with scraping, data enrichment, and automated email sequences.",
    category: "automation",
    subcategory: "marketing",
    techStack: ["Next.js 16", "NextAuth", "Google APIs", "XLSX"],
    liveUrl: null,
    colorAccent: "#10b981",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "pulse",
    nameEs: "Pulse",
    nameEn: "Pulse",
    taglineEs: "Analítica en tiempo real",
    taglineEn: "Real-time analytics",
    descriptionEs:
      "Dashboard de analítica con métricas en tiempo real, alertas y reportes automatizados.",
    descriptionEn:
      "Analytics dashboard with real-time metrics, alerts, and automated reports.",
    category: "automation",
    subcategory: "analytics",
    techStack: ["Next.js 16", "Supabase", "Zustand", "date-fns"],
    liveUrl: null,
    colorAccent: "#8b5cf6",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "contentengine",
    nameEs: "Content Engine",
    nameEn: "Content Engine",
    taglineEs: "Gestión de contenido AI",
    taglineEn: "AI content management",
    descriptionEs:
      "Sistema de gestión de contenido con generación AI y scheduling automatizado.",
    descriptionEn:
      "Content management system with AI generation and automated scheduling.",
    category: "automation",
    subcategory: "content",
    techStack: ["Next.js 16", "Supabase", "Claude AI", "date-fns"],
    liveUrl: null,
    colorAccent: "#f97316",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "moneymachine",
    nameEs: "MoneyMachine",
    nameEn: "MoneyMachine",
    taglineEs: "Gestión financiera automatizada",
    taglineEn: "Automated financial management",
    descriptionEs:
      "Plataforma de gestión financiera con facturación automática y reportes.",
    descriptionEn:
      "Financial management platform with automatic invoicing and reports.",
    category: "automation",
    subcategory: "finance",
    techStack: ["Next.js 16", "Supabase", "Resend"],
    liveUrl: null,
    colorAccent: "#22c55e",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "website-factory",
    nameEs: "Website Factory",
    nameEn: "Website Factory",
    taglineEs: "Generador de sitios desde config",
    taglineEn: "Config-based website generator",
    descriptionEs:
      "Motor de generación de sitios web a partir de configuración JSON.",
    descriptionEn: "Website generation engine from JSON configuration.",
    category: "automation",
    subcategory: "tools",
    techStack: ["Node.js", "Templates", "CLI"],
    liveUrl: null,
    colorAccent: "#3b82f6",
    isActive: true,
    isFeatured: false,
  },

  // ============================================
  // ENTERPRISE - Classified/Government
  // ============================================
  {
    slug: "csj-modernizacion",
    nameEs: "CSJ Modernización",
    nameEn: "CSJ Modernization",
    taglineEs: "Plataforma de modernización judicial",
    taglineEn: "Judicial modernization platform",
    descriptionEs:
      "Sistema de modernización para el Consejo Superior de la Judicatura de Colombia.",
    descriptionEn:
      "Modernization system for Colombia's Superior Council of the Judiciary.",
    category: "enterprise",
    subcategory: "government",
    techStack: ["Next.js 16", "Tailwind", "Government APIs"],
    liveUrl: null,
    colorAccent: "#1e40af",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "csj-panel-ejecutivo",
    nameEs: "CSJ Panel Ejecutivo",
    nameEn: "CSJ Executive Panel",
    taglineEs: "Dashboard ejecutivo judicial",
    taglineEn: "Judicial executive dashboard",
    descriptionEs:
      "Panel ejecutivo con métricas judiciales y KPIs para toma de decisiones.",
    descriptionEn:
      "Executive panel with judicial metrics and KPIs for decision making.",
    category: "enterprise",
    subcategory: "government",
    techStack: ["Next.js 14", "React 18", "Tailwind", "Charts"],
    liveUrl: null,
    colorAccent: "#1e3a5f",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "openclaw",
    nameEs: "OpenClaw",
    nameEn: "OpenClaw",
    taglineEs: "Gateway multi-canal WhatsApp",
    taglineEn: "Multi-channel WhatsApp gateway",
    descriptionEs:
      "Gateway empresarial para WhatsApp con múltiples cuentas, RPC y webhooks.",
    descriptionEn:
      "Enterprise WhatsApp gateway with multiple accounts, RPC, and webhooks.",
    category: "enterprise",
    subcategory: "messaging",
    techStack: ["TypeScript", "Baileys", "RPC", "Node.js 22+"],
    liveUrl: null,
    colorAccent: "#16a34a",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "concierge-command-center",
    nameEs: "Concierge Command Center",
    nameEn: "Concierge Command Center",
    taglineEs: "Dashboard unificado de operaciones",
    taglineEn: "Unified operations dashboard",
    descriptionEs:
      "Centro de comando para gestión de múltiples concierges y operaciones.",
    descriptionEn:
      "Command center for managing multiple concierges and operations.",
    category: "enterprise",
    subcategory: "management",
    techStack: ["Next.js 16", "Supabase", "Real-time"],
    liveUrl: null,
    colorAccent: "#6366f1",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "cartagena-concierge",
    nameEs: "Cartagena Concierge",
    nameEn: "Cartagena Concierge",
    taglineEs: "Sistema de reservas turísticas",
    taglineEn: "Tourist booking system",
    descriptionEs:
      "Sistema centralizado de reservas para operadores turísticos en Cartagena.",
    descriptionEn:
      "Centralized booking system for tour operators in Cartagena.",
    category: "enterprise",
    subcategory: "tourism",
    techStack: ["Next.js 16", "Supabase", "Framer Motion"],
    liveUrl: null,
    colorAccent: "#0891b2",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "xclusive-platform",
    nameEs: "XClusive Platform",
    nameEn: "XClusive Platform",
    taglineEs: "Plataforma de membresía premium",
    taglineEn: "Premium membership platform",
    descriptionEs:
      "Plataforma de membresías exclusivas con gestión de beneficios y eventos.",
    descriptionEn:
      "Exclusive membership platform with benefits and events management.",
    category: "enterprise",
    subcategory: "membership",
    techStack: ["Next.js 16", "Supabase", "date-fns"],
    liveUrl: null,
    colorAccent: "#be123c",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "lavanderia-oriental",
    nameEs: "Lavandería Oriental",
    nameEn: "Lavandería Oriental",
    taglineEs: "Sistema de gestión de lavandería",
    taglineEn: "Laundry management system",
    descriptionEs:
      "Sistema completo de gestión de lavandería con tracking y notificaciones.",
    descriptionEn:
      "Complete laundry management system with tracking and notifications.",
    category: "enterprise",
    subcategory: "services",
    techStack: ["Express", "React", "Drizzle", "PostgreSQL", "OpenAI"],
    liveUrl: null,
    colorAccent: "#0ea5e9",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "wuilo",
    nameEs: "Wuilo",
    nameEn: "Wuilo",
    taglineEs: "Plataforma de servicios on-demand",
    taglineEn: "On-demand services platform",
    descriptionEs:
      "Plataforma de servicios bajo demanda con matching y pagos integrados.",
    descriptionEn:
      "On-demand services platform with matching and integrated payments.",
    category: "enterprise",
    subcategory: "services",
    techStack: ["Next.js 16", "Supabase"],
    liveUrl: null,
    colorAccent: "#7c3aed",
    isActive: true,
    isFeatured: false,
  },
];

// Helper functions
export function getProjectsByCategory(category: ProjectCategory): Project[] {
  return projects.filter((p) => p.category === category && p.isActive);
}

export function getFeaturedProjects(): Project[] {
  return projects.filter((p) => p.isFeatured && p.isActive);
}

export function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export function getActiveProjectCount(): number {
  return projects.filter((p) => p.isActive).length;
}

export function getProjectsWithLiveUrl(): Project[] {
  return projects.filter((p) => p.liveUrl && p.isActive);
}

// Category labels
export const categoryLabels: Record<
  ProjectCategory,
  { es: string; en: string }
> = {
  flagship: { es: "Insignia", en: "Flagship" },
  demo: { es: "Demos", en: "Demos" },
  automation: { es: "Automatización", en: "Automation" },
  enterprise: { es: "Empresarial", en: "Enterprise" },
};
