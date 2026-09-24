/**
 * /web — free-website onboarding copy. Spanish (El Salvador, usted) is the
 * default; English mirrors it. Prices and the share ask are stated plainly
 * before submit — the ad promised "sin trampas".
 */
import { FREE_DAYS, MM_INSTAGRAM, MONTHLY_PRICE_USD } from "@/lib/web-gratis/config";
import type { WebGratisErrorCode } from "@/lib/web-gratis/schema";

export type Lang = "es" | "en";

export interface Copy {
  langToggle: string;
  kicker: string;
  titleA: string;
  titleB: string;
  lede: string;
  chips: [string, string, string];
  referredBy: (name: string) => string;
  howTitle: string;
  how: { title: string; body: string }[];
  stepLabel: (n: number) => string;
  stepNames: [string, string, string];
  fields: {
    businessName: { label: string; placeholder: string };
    businessType: { label: string; hint: string; placeholder: string };
    city: { label: string; placeholder: string };
    whatsapp: { label: string; hint: string; placeholder: string; country: string; consent: string };
    services: { label: string; hint: string; placeholder: string };
    differentiator: { label: string; hint: string; placeholder: string };
    hours: { label: string; placeholder: string };
    instagram: { label: string; placeholder: string };
    facebook: { label: string; placeholder: string };
    siteGoal: { label: string; options: { value: "whatsapp" | "citas" | "mostrar"; label: string }[] };
    style: { label: string; hint: string; placeholder: string };
    logo: { label: string; hint: string; button: string; replace: string };
    photos: { label: string; hint: string; button: string; count: (n: number, max: number) => string };
  };
  optional: string;
  continue: string;
  back: string;
  saving: string;
  takes: string;
  terms: {
    title: string;
    lines: string[];
    acceptTerms: string;
    acceptShare: string;
  };
  submit: string;
  submitting: string;
  waitingUploads: string;
  fine: string;
  upload: {
    uploading: string;
    done: string;
    failed: string;
    retry: string;
    remove: string;
    tooLarge: string;
    unsupported: string;
    tooMany: string;
  };
  validation: {
    required: string;
    whatsapp: string;
    services: string;
    acceptTerms: string;
    acceptShare: string;
  };
  errors: Record<WebGratisErrorCode | "network", string>;
  whatsappHelp: string;
  done: {
    title: (name: string) => string;
    body: string;
    nextTitle: string;
    next: string[];
    confirm: string;
    referKicker: string;
    referTitle: string;
    referBody: string;
    yourLink: string;
    shareWhatsApp: string;
    copy: string;
    copied: string;
    facebook: string;
    more: string;
    storyTip: string;
    shareText: (business: string, link: string) => string;
    confirmText: (business: string, code: string) => string;
    another: string;
  };
  helpText: (business: string) => string;
  fallbackText: (d: { business: string; type: string; city: string; whatsapp: string; services: string }) => string;
  chipDays: (n: number) => string;
  nextDays: (n: number) => string;
  highDemand: string;
  footer: { disclaimer: string; privacy: string; verify: string };
  noscript: string;
}

const es: Copy = {
  langToggle: "English",
  kicker: "El Salvador se moderniza",
  titleA: "Su página web,",
  titleB: "gratis.",
  lede: "Cuéntenos de su negocio y se la armamos. Lista en pocos días, sin costo para empezar y sin letra pequeña.",
  chips: ["Diseño $0", "Lista en días", "Sin contrato"],
  referredBy: (name) => `${name} le recomendó este programa.`,
  howTitle: "Así funciona",
  how: [
    { title: "Llena este formulario", body: "Dos minutos. Nombre, servicios, fotos si tiene." },
    { title: "Armamos su web", body: "En pocos días se la mandamos por WhatsApp para que la revise." },
    { title: "La comparte", body: `En su historia de Instagram o Facebook, etiquetando a @${MM_INSTAGRAM}.` },
    { title: `${FREE_DAYS} días gratis`, body: `Después, $${MONTHLY_PRICE_USD} al mes para mantenerla en línea. Sin contrato.` },
  ],
  stepLabel: (n) => `Paso ${n} de 3`,
  stepNames: ["Su negocio", "Su contenido", "Fotos y listo"],
  fields: {
    businessName: { label: "Nombre del negocio", placeholder: "Ej: Barbería El Corte" },
    businessType: { label: "¿A qué se dedica?", hint: "En una frase", placeholder: "Ej: Barbería para caballeros" },
    city: { label: "Ciudad o zona", placeholder: "Ej: San Salvador, colonia Escalón" },
    whatsapp: {
      label: "WhatsApp del negocio",
      hint: "Por aquí le confirmamos todo",
      placeholder: "7000 0000",
      country: "País",
      consent: "Al continuar, acepta que le escribamos por WhatsApp sobre su web.",
    },
    services: {
      label: "Sus servicios o productos principales",
      hint: "De 3 a 6, separados por coma",
      placeholder: "Ej: corte, barba, tinte, diseño de cejas",
    },
    differentiator: {
      label: "¿Qué lo hace diferente?",
      hint: "¿Por qué lo eligen a usted?",
      placeholder: "Lo que quiere que la gente sepa de su negocio",
    },
    hours: { label: "Horarios de atención", placeholder: "Ej: lunes a sábado, 9 a. m. a 7 p. m." },
    instagram: { label: "Instagram", placeholder: "@sunegocio" },
    facebook: { label: "Facebook", placeholder: "facebook.com/sunegocio" },
    siteGoal: {
      label: "¿Qué quiere que haga su web?",
      options: [
        { value: "whatsapp", label: "Que los clientes me escriban por WhatsApp" },
        { value: "citas", label: "Que agende citas o reservas sola (me cuentan luego)" },
        { value: "mostrar", label: "Solo mostrar mi negocio" },
      ],
    },
    style: {
      label: "Colores o estilo que le gustan",
      hint: "O el nombre de una web que le guste",
      placeholder: "Ej: elegante, negro con dorado",
    },
    logo: { label: "Logo", hint: "Si no tiene, se lo diseñamos sin costo.", button: "Subir logo", replace: "Cambiar logo" },
    photos: {
      label: "Fotos de su negocio o su trabajo",
      hint: "De 3 a 5 fotos. Del celular está bien. Si no tiene, usamos imágenes profesionales de su rubro.",
      button: "Agregar fotos",
      count: (n, max) => `${n} de ${max}`,
    },
  },
  optional: "Opcional",
  continue: "Continuar",
  back: "Atrás",
  saving: "Guardando…",
  takes: "Toma 2 minutos. Su avance se guarda solo.",
  terms: {
    title: "Sin letra pequeña",
    lines: [
      "Diseño y construcción de su web: $0.",
      `Primeros ${FREE_DAYS} días con su web en línea: $0.`,
      `Después: $${MONTHLY_PRICE_USD} al mes para mantenerla en línea, con soporte y cambios. Sin contrato: cancela cuando quiera.`,
      `Lo único que le pedimos: cuando esté lista, compártala en su historia de Instagram o Facebook y etiquete a @${MM_INSTAGRAM}.`,
    ],
    acceptTerms: `Entiendo: la web es gratis, los primeros ${FREE_DAYS} días en línea son gratis y después cuesta $${MONTHLY_PRICE_USD} al mes mantenerla, sin contrato.`,
    acceptShare: `Cuando mi web esté lista, la comparto en mi historia y etiqueto a @${MM_INSTAGRAM}.`,
  },
  submit: "Enviar y empezar mi web",
  submitting: "Enviando…",
  waitingUploads: "Esperando que terminen de subir las fotos…",
  fine: "Al enviar, acepta que le escribamos por WhatsApp sobre su web. Usamos su información solo para crear su web; no la vendemos ni la compartimos.",
  upload: {
    uploading: "Subiendo",
    done: "Listo",
    failed: "No se subió",
    retry: "Reintentar",
    remove: "Quitar",
    tooLarge: "Pesa más de 10 MB",
    unsupported: "Formato no admitido",
    tooMany: "Ya alcanzó el máximo de archivos",
  },
  validation: {
    required: "Este dato es necesario.",
    whatsapp: "Revise el número: en El Salvador son 8 dígitos (ej: 7000 0000).",
    services: "Escriba al menos un servicio o producto.",
    acceptTerms: "Marque esta casilla para continuar.",
    acceptShare: "Marque esta casilla para continuar.",
  },
  errors: {
    invalid: "Revise los campos marcados.",
    invalid_whatsapp: "Revise el número de WhatsApp.",
    rate_limited: "Demasiados intentos desde esta conexión. Espere unos minutos o escríbanos por WhatsApp.",
    duplicate: "Ya tenemos una solicitud para este negocio con ese WhatsApp. Le escribiremos pronto.",
    draft_not_found: "Se perdió su avance. Toque Continuar otra vez.",
    unsupported_type: "Formato no admitido. Use JPG, PNG, WEBP, HEIC o PDF.",
    too_large: "El archivo pesa más de 10 MB.",
    too_many_files: "Ya alcanzó el máximo de archivos.",
    save_failed: "No pudimos guardar su información. Intente de nuevo o escríbanos por WhatsApp.",
    server_error: "Algo falló de nuestro lado. Intente de nuevo o escríbanos por WhatsApp.",
    network: "Sin conexión. Revise su internet e intente de nuevo.",
  },
  whatsappHelp: "Escríbanos por WhatsApp",
  done: {
    title: (name) => `¡Recibido, ${name}!`,
    body: "Ya empezamos con su web. Le escribimos por WhatsApp para confirmar los detalles.",
    nextTitle: "Lo que sigue",
    next: [
      "Hoy revisamos su información.",
      "En pocos días su web queda lista y se la mandamos por WhatsApp.",
      `La comparte en su historia y etiqueta a @${MM_INSTAGRAM}.`,
      `${FREE_DAYS} días gratis con su web en línea. Después, $${MONTHLY_PRICE_USD} al mes si quiere mantenerla.`,
    ],
    confirm: "Confirmar por WhatsApp",
    referKicker: "Recomiende y gane",
    referTitle: "Un mes gratis por cada negocio que recomiende.",
    referBody: "Comparta su enlace con otros dueños de negocio. Cuando uno se registre con su enlace y active su web, usted recibe un mes gratis.",
    yourLink: "Su enlace personal",
    shareWhatsApp: "Compartir por WhatsApp",
    copy: "Copiar enlace",
    copied: "¡Copiado!",
    facebook: "Facebook",
    more: "Más opciones",
    storyTip: "Para Instagram: copie el enlace y agréguelo como sticker de enlace en su historia.",
    shareText: (business, link) =>
      `¡Mire esto! MachineMind le hace la página web GRATIS a negocios salvadoreños 🇸🇻 Yo ya pedí la mía para ${business}. Regístrese aquí, toma 2 minutos: ${link}`,
    confirmText: (business, code) =>
      `Hola, acabo de enviar el formulario de mi web gratis. Negocio: ${business}. Código: ${code}`,
    another: "Enviar otra solicitud",
  },
  helpText: (business) => `Hola, quiero mi web gratis.${business ? ` Negocio: ${business}.` : ""}`,
  fallbackText: (d) =>
    [
      "Hola, quiero mi web gratis (el formulario no me dejó enviar).",
      d.business && `Negocio: ${d.business}`,
      d.type && `Rubro: ${d.type}`,
      d.city && `Ciudad: ${d.city}`,
      d.whatsapp && `WhatsApp: ${d.whatsapp}`,
      d.services && `Servicios: ${d.services}`,
    ]
      .filter(Boolean)
      .join("\n"),
  chipDays: (n) => `Lista en ${n} días`,
  nextDays: (n) => `En unos ${n} días su web queda lista y se la mandamos por WhatsApp.`,
  highDemand: "Estamos recibiendo muchas solicitudes: su web entra en fila y le avisamos por WhatsApp apenas empecemos.",
  footer: {
    disclaimer: "MachineMind es una empresa privada. Este programa no está afiliado ni patrocinado por el Gobierno de El Salvador.",
    privacy: "Su información se usa solo para crear su web.",
    verify: "Verifique nuestros canales oficiales",
  },
  noscript: "Para llenar el formulario active JavaScript, o escríbanos por WhatsApp.",
};

const en: Copy = {
  langToggle: "Español",
  kicker: "El Salvador is modernizing",
  titleA: "Your website,",
  titleB: "free.",
  lede: "Tell us about your business and we'll build it. Ready in a few days, nothing to pay to start, no fine print.",
  chips: ["$0 design", "Ready in days", "No contract"],
  referredBy: (name) => `${name} recommended this program to you.`,
  howTitle: "How it works",
  how: [
    { title: "Fill in this form", body: "Two minutes. Name, services, photos if you have them." },
    { title: "We build your site", body: "In a few days we send it to you on WhatsApp to review." },
    { title: "You share it", body: `On your Instagram or Facebook story, tagging @${MM_INSTAGRAM}.` },
    { title: `${FREE_DAYS} days free`, body: `After that, $${MONTHLY_PRICE_USD} a month to keep it online. No contract.` },
  ],
  stepLabel: (n) => `Step ${n} of 3`,
  stepNames: ["Your business", "Your content", "Photos and done"],
  fields: {
    businessName: { label: "Business name", placeholder: "e.g. El Corte Barbershop" },
    businessType: { label: "What does it do?", hint: "In one sentence", placeholder: "e.g. Men's barbershop" },
    city: { label: "City or area", placeholder: "e.g. San Salvador, Escalón" },
    whatsapp: {
      label: "Business WhatsApp",
      hint: "We confirm everything here",
      placeholder: "7000 0000",
      country: "Country",
      consent: "By continuing, you agree that we can message you on WhatsApp about your website.",
    },
    services: {
      label: "Your main services or products",
      hint: "3 to 6, separated by commas",
      placeholder: "e.g. haircut, beard, color, brows",
    },
    differentiator: {
      label: "What makes you different?",
      hint: "Why do customers choose you?",
      placeholder: "What you want people to know about your business",
    },
    hours: { label: "Opening hours", placeholder: "e.g. Mon–Sat, 9 a.m. to 7 p.m." },
    instagram: { label: "Instagram", placeholder: "@yourbusiness" },
    facebook: { label: "Facebook", placeholder: "facebook.com/yourbusiness" },
    siteGoal: {
      label: "What should your website do?",
      options: [
        { value: "whatsapp", label: "Get customers to message me on WhatsApp" },
        { value: "citas", label: "Book appointments on its own (tell me later)" },
        { value: "mostrar", label: "Just show my business" },
      ],
    },
    style: {
      label: "Colors or style you like",
      hint: "Or the name of a website you like",
      placeholder: "e.g. elegant, black and gold",
    },
    logo: { label: "Logo", hint: "No logo? We'll design one at no cost.", button: "Upload logo", replace: "Change logo" },
    photos: {
      label: "Photos of your business or work",
      hint: "3 to 5 photos. Phone photos are fine. None? We'll use professional images for your trade.",
      button: "Add photos",
      count: (n, max) => `${n} of ${max}`,
    },
  },
  optional: "Optional",
  continue: "Continue",
  back: "Back",
  saving: "Saving…",
  takes: "Takes 2 minutes. Your progress saves automatically.",
  terms: {
    title: "No fine print",
    lines: [
      "Designing and building your website: $0.",
      `First ${FREE_DAYS} days with your site online: $0.`,
      `After that: $${MONTHLY_PRICE_USD} a month to keep it online, with support and changes. No contract: cancel anytime.`,
      `All we ask: when it's ready, share it on your Instagram or Facebook story and tag @${MM_INSTAGRAM}.`,
    ],
    acceptTerms: `I understand: the website is free, the first ${FREE_DAYS} days online are free, and after that it costs $${MONTHLY_PRICE_USD} a month to keep it, no contract.`,
    acceptShare: `When my website is ready, I'll share it on my story and tag @${MM_INSTAGRAM}.`,
  },
  submit: "Send and start my website",
  submitting: "Sending…",
  waitingUploads: "Waiting for your photos to finish uploading…",
  fine: "By sending, you agree that we can message you on WhatsApp about your website. We only use your information to build your site; we never sell or share it.",
  upload: {
    uploading: "Uploading",
    done: "Done",
    failed: "Didn't upload",
    retry: "Retry",
    remove: "Remove",
    tooLarge: "Larger than 10 MB",
    unsupported: "Unsupported format",
    tooMany: "You've reached the file limit",
  },
  validation: {
    required: "This is required.",
    whatsapp: "Check the number: El Salvador numbers have 8 digits (e.g. 7000 0000).",
    services: "Add at least one service or product.",
    acceptTerms: "Tick this box to continue.",
    acceptShare: "Tick this box to continue.",
  },
  errors: {
    invalid: "Please check the highlighted fields.",
    invalid_whatsapp: "Please check the WhatsApp number.",
    rate_limited: "Too many attempts from this connection. Wait a few minutes or message us on WhatsApp.",
    duplicate: "We already have a request for this business with that WhatsApp. We'll message you soon.",
    draft_not_found: "Your progress was lost. Tap Continue again.",
    unsupported_type: "Unsupported format. Use JPG, PNG, WEBP, HEIC or PDF.",
    too_large: "The file is larger than 10 MB.",
    too_many_files: "You've reached the file limit.",
    save_failed: "We couldn't save your information. Try again or message us on WhatsApp.",
    server_error: "Something failed on our side. Try again or message us on WhatsApp.",
    network: "No connection. Check your internet and try again.",
  },
  whatsappHelp: "Message us on WhatsApp",
  done: {
    title: (name) => `Got it, ${name}!`,
    body: "We've started on your website. We'll message you on WhatsApp to confirm the details.",
    nextTitle: "What happens next",
    next: [
      "Today we review your information.",
      "In a few days your site is ready and we send it to you on WhatsApp.",
      `You share it on your story and tag @${MM_INSTAGRAM}.`,
      `${FREE_DAYS} days free with your site online. After that, $${MONTHLY_PRICE_USD} a month if you want to keep it.`,
    ],
    confirm: "Confirm on WhatsApp",
    referKicker: "Refer and earn",
    referTitle: "One free month for every business you refer.",
    referBody: "Share your link with other business owners. When one signs up with your link and activates their site, you get a free month.",
    yourLink: "Your personal link",
    shareWhatsApp: "Share on WhatsApp",
    copy: "Copy link",
    copied: "Copied!",
    facebook: "Facebook",
    more: "More options",
    storyTip: "For Instagram: copy the link and add it as a link sticker on your story.",
    shareText: (business, link) =>
      `Check this out! MachineMind builds FREE websites for Salvadoran businesses 🇸🇻 I already asked for mine for ${business}. Sign up here, it takes 2 minutes: ${link}`,
    confirmText: (business, code) =>
      `Hi, I just sent the form for my free website. Business: ${business}. Code: ${code}`,
    another: "Send another request",
  },
  helpText: (business) => `Hi, I want my free website.${business ? ` Business: ${business}.` : ""}`,
  fallbackText: (d) =>
    [
      "Hi, I want my free website (the form would not let me send it).",
      d.business && `Business: ${d.business}`,
      d.type && `Trade: ${d.type}`,
      d.city && `City: ${d.city}`,
      d.whatsapp && `WhatsApp: ${d.whatsapp}`,
      d.services && `Services: ${d.services}`,
    ]
      .filter(Boolean)
      .join("\n"),
  chipDays: (n) => `Ready in ${n} days`,
  nextDays: (n) => `In about ${n} days your site is ready and we send it to you on WhatsApp.`,
  highDemand: "We are receiving a lot of requests: your site joins the queue and we will message you on WhatsApp as soon as we start.",
  footer: {
    disclaimer: "MachineMind is a private company. This program is not affiliated with or sponsored by the Government of El Salvador.",
    privacy: "Your information is only used to build your website.",
    verify: "Verify our official channels",
  },
  noscript: "To fill in the form please enable JavaScript, or message us on WhatsApp.",
};

export const COPY: Record<Lang, Copy> = { es, en };
