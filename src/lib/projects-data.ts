// MachineMind Portfolio Projects Data

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
  // FLAGSHIP PROJECTS
  // ============================================
  {
    slug: "movvia",
    nameEs: "Movvia",
    nameEn: "Movvia",
    taglineEs: "Concierge de lujo para Cartagena",
    taglineEn: "Luxury concierge for Cartagena",
    descriptionEs:
      "Plataforma completa de hospitalidad con reservas, experiencias de lujo, checkout y gestión de restaurantes.",
    descriptionEn:
      "Complete hospitality platform with bookings, luxury experiences, checkout, and restaurant management.",
    category: "flagship",
    subcategory: "hospitality",
    techStack: [
      "Next.js 16",
      "Supabase",
      "Tailwind",
      "Wompi",
      "Twilio",
      "Claude AI",
    ],
    liveUrl: "https://movvia.vercel.app",
    colorAccent: "#d4af37",
    isActive: true,
    isFeatured: true,
  },
  {
    slug: "simmer-down",
    nameEs: "Simmer Down Pizza",
    nameEn: "Simmer Down Pizza",
    taglineEs: "Pizzería con Sofia AI integrado",
    taglineEn: "Pizzeria with integrated Sofia AI",
    descriptionEs:
      "Sistema de pedidos con partículas de fuego, easter eggs, menú secreto Konami y etiquetas dietéticas.",
    descriptionEn:
      "Ordering system with fire particles, easter eggs, Konami secret menu, and dietary tags.",
    category: "flagship",
    subcategory: "restaurant",
    techStack: ["Next.js 16", "Supabase", "Zustand", "Framer Motion", "Canvas"],
    liveUrl: "https://simmer-down.vercel.app",
    colorAccent: "#f97316",
    isActive: true,
    isFeatured: true,
  },
  {
    slug: "aegis-shield",
    nameEs: "AEGIS Shield",
    nameEn: "AEGIS Shield",
    taglineEs: "Control de acceso militar con IA",
    taglineEn: "Military access control with AI",
    descriptionEs:
      "Sistema de control de acceso militar con DBIDS, Sentinel AI y gestión de políticas de fecha.",
    descriptionEn:
      "Military access control system with DBIDS, Sentinel AI, and date-based policy management.",
    category: "flagship",
    subcategory: "security",
    techStack: ["Next.js 14", "Supabase", "DBIDS", "Sentinel AI", "bcrypt"],
    liveUrl: null,
    colorAccent: "#1c4a5e",
    isActive: true,
    isFeatured: true,
  },

  // ============================================
  // DEMO PROJECTS
  // ============================================
  {
    slug: "demo-100luxury",
    nameEs: "100 Luxury",
    nameEn: "100 Luxury",
    taglineEs: "Marca de hospitalidad de lujo",
    taglineEn: "Luxury hospitality brand",
    category: "demo",
    subcategory: "hospitality",
    techStack: ["Next.js 16", "Tailwind"],
    liveUrl: "https://demo-100luxury.vercel.app",
    colorAccent: "#d4af37",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-aerotransfer",
    nameEs: "AeroTransfer",
    nameEn: "AeroTransfer",
    taglineEs: "Servicio de charter y transfers",
    taglineEn: "Charter and transfer service",
    category: "demo",
    subcategory: "transport",
    techStack: ["Next.js 16", "Tailwind", "Framer Motion"],
    liveUrl: "https://demo-aerotransfer.vercel.app",
    colorAccent: "#2563eb",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-benzdriver",
    nameEs: "BenzDriver",
    nameEn: "BenzDriver",
    taglineEs: "Transporte premium ejecutivo",
    taglineEn: "Premium executive transport",
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
    category: "demo",
    subcategory: "nightlife",
    techStack: ["Next.js 16", "Tailwind"],
    liveUrl: "https://demo-blacksound.vercel.app",
    colorAccent: "#9333ea",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-fourseasons-bogota",
    nameEs: "Four Seasons Bogotá",
    nameEn: "Four Seasons Bogotá",
    taglineEs: "Demo de hotel de lujo con Claude AI",
    taglineEn: "Luxury hotel demo with Claude AI",
    category: "demo",
    subcategory: "hospitality",
    techStack: ["Next.js 16", "Claude AI SDK", "Tailwind"],
    liveUrl: "https://demo-fourseasons-bogota.vercel.app",
    colorAccent: "#d4af37",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-jota-pardo",
    nameEs: "Jota Pardo",
    nameEn: "Jota Pardo",
    taglineEs: "Servicios de concierge personal",
    taglineEn: "Personal concierge services",
    category: "demo",
    subcategory: "concierge",
    techStack: ["Next.js 16", "Tailwind"],
    liveUrl: "https://demo-jota-pardo.vercel.app",
    colorAccent: "#0ea5e9",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-medellinvip",
    nameEs: "Medellín VIP",
    nameEn: "Medellín VIP",
    taglineEs: "Turismo VIP en Medellín",
    taglineEn: "VIP tourism in Medellín",
    category: "demo",
    subcategory: "tourism",
    techStack: ["Next.js 16", "Tailwind"],
    liveUrl: "https://demo-medellinvip.vercel.app",
    colorAccent: "#f59e0b",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-osaka-nikkei",
    nameEs: "Osaka Nikkei Bogotá",
    nameEn: "Osaka Nikkei Bogotá",
    taglineEs: "Restaurante japonés con Sofia AI",
    taglineEn: "Japanese restaurant with Sofia AI",
    category: "demo",
    subcategory: "restaurant",
    techStack: ["Next.js 16", "Sofia AI", "Tailwind"],
    liveUrl: "https://demo-osaka-nikkei.vercel.app",
    colorAccent: "#dc2626",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "demo-angelica-valencia",
    nameEs: "Angelica Valencia",
    nameEn: "Angelica Valencia",
    taglineEs: "Concierge personal de lujo",
    taglineEn: "Luxury personal concierge",
    category: "demo",
    subcategory: "concierge",
    techStack: ["Next.js 16", "Tailwind"],
    liveUrl: "https://demo-angelica-valencia.vercel.app",
    colorAccent: "#ec4899",
    isActive: true,
    isFeatured: false,
  },

  // ============================================
  // AUTOMATION PLATFORMS
  // ============================================
  {
    slug: "outreach-engine",
    nameEs: "Outreach Engine",
    nameEn: "Outreach Engine",
    taglineEs: "Generación de leads y marketing automatizado",
    taglineEn: "Lead generation and automated marketing",
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
    taglineEs: "Analítica y monitoreo en tiempo real",
    taglineEn: "Real-time analytics and monitoring",
    category: "automation",
    subcategory: "analytics",
    techStack: ["Next.js 16", "Supabase", "Zustand", "date-fns"],
    liveUrl: null,
    colorAccent: "#8b5cf6",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "voxlink",
    nameEs: "VoxLink",
    nameEn: "VoxLink",
    taglineEs: "Plataforma de comunicación voz/video",
    taglineEn: "Voice/video communication platform",
    category: "automation",
    subcategory: "communication",
    techStack: ["Next.js 14", "Daily.co", "PeerJS", "WebRTC"],
    liveUrl: null,
    colorAccent: "#06b6d4",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "contentengine",
    nameEs: "Content Engine",
    nameEn: "Content Engine",
    taglineEs: "Sistema de gestión de contenido",
    taglineEn: "Content management system",
    category: "automation",
    subcategory: "content",
    techStack: ["Next.js 16", "Supabase", "date-fns"],
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
    taglineEs: "Generador de sitios web desde config",
    taglineEn: "Website generator from config",
    category: "automation",
    subcategory: "tools",
    techStack: ["Node.js", "Templates"],
    liveUrl: null,
    colorAccent: "#3b82f6",
    isActive: true,
    isFeatured: false,
  },

  // ============================================
  // ENTERPRISE SOLUTIONS
  // ============================================
  {
    slug: "cartagena-concierge",
    nameEs: "Cartagena Concierge",
    nameEn: "Cartagena Concierge",
    taglineEs: "Sistema de reservas turísticas",
    taglineEn: "Tourist booking system",
    category: "enterprise",
    subcategory: "tourism",
    techStack: ["Next.js 16", "Supabase", "Framer Motion"],
    liveUrl: null,
    colorAccent: "#0891b2",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "concierge-command-center",
    nameEs: "Concierge Command Center",
    nameEn: "Concierge Command Center",
    taglineEs: "Dashboard unificado de concierges",
    taglineEn: "Unified concierge dashboard",
    category: "enterprise",
    subcategory: "management",
    techStack: ["Next.js 16", "Supabase"],
    liveUrl: null,
    colorAccent: "#6366f1",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "openclaw",
    nameEs: "OpenClaw",
    nameEn: "OpenClaw",
    taglineEs: "Gateway multi-canal para WhatsApp",
    taglineEn: "Multi-channel WhatsApp gateway",
    category: "enterprise",
    subcategory: "messaging",
    techStack: ["TypeScript", "Baileys", "RPC", "Node.js 22+"],
    liveUrl: null,
    colorAccent: "#16a34a",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "lavanderia-oriental",
    nameEs: "Lavandería Oriental",
    nameEn: "Lavandería Oriental",
    taglineEs: "Sistema de gestión de lavandería",
    taglineEn: "Laundry management system",
    category: "enterprise",
    subcategory: "services",
    techStack: ["Express", "React", "Drizzle", "PostgreSQL", "OpenAI"],
    liveUrl: null,
    colorAccent: "#0ea5e9",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "csj-modernizacion",
    nameEs: "CSJ Modernización",
    nameEn: "CSJ Modernization",
    taglineEs: "Plataforma de modernización judicial",
    taglineEn: "Judicial modernization platform",
    category: "enterprise",
    subcategory: "government",
    techStack: ["Next.js 16", "Tailwind"],
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
    category: "enterprise",
    subcategory: "government",
    techStack: ["Next.js 14", "React 18", "Tailwind"],
    liveUrl: null,
    colorAccent: "#1e3a5f",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "wuilo",
    nameEs: "Wuilo",
    nameEn: "Wuilo",
    taglineEs: "Plataforma de servicios",
    taglineEn: "Services platform",
    category: "enterprise",
    subcategory: "services",
    techStack: ["Next.js 16", "Supabase"],
    liveUrl: null,
    colorAccent: "#7c3aed",
    isActive: true,
    isFeatured: false,
  },
  {
    slug: "xclusive-platform",
    nameEs: "XClusive Platform",
    nameEn: "XClusive Platform",
    taglineEs: "Plataforma de membresía premium",
    taglineEn: "Premium membership platform",
    category: "enterprise",
    subcategory: "membership",
    techStack: ["Next.js 16", "Supabase", "date-fns"],
    liveUrl: null,
    colorAccent: "#be123c",
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
