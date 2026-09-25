/**
 * /web — free-website onboarding copy. Spanish (usted) is the default; English
 * mirrors it. Country-specific lines (initiative badge, alignment with each
 * government's vision, city and phone examples) live under `market`.
 *
 * Framing rule: MachineMind is a PRIVATE company. We say we are ALIGNED with
 * each government's vision of bringing businesses online — never that this is
 * a government program or that any government sponsors it. Every page that
 * shows the framing also shows `disclaimer`. Prices and the share ask are
 * stated plainly before submit — the ad promised "sin trampas".
 *
 * After the free days the business CHOOSES (Phil, 2026-09-24): MachineMind keeps
 * hosting it for MONTHLY_PRICE_USD a month with full support (the primary path),
 * or they host it themselves — we hand over the files and self-hosting includes
 * no assistance from us. Every line that explains the price states both options.
 */
import {
  FREE_DAYS,
  MARKET_INFO,
  MAX_DOCUMENTS,
  MAX_UPLOAD_MB,
  MM_INSTAGRAM,
  MM_WHATSAPP_DISPLAY,
  MONTHLY_PRICE_USD,
  type Market,
} from "@/lib/web-gratis/config";
import type { WebGratisErrorCode } from "@/lib/web-gratis/schema";

export type Lang = "es" | "en";

export interface MarketCopy {
  name: string;
  /** One line near the headline: alignment with the government's vision (never a sponsorship claim). */
  align: string;
  /** "Why we do this", shown above "how it works". */
  mission: string;
  cityPlaceholder: string;
  phonePlaceholder: string;
  shareText: (business: string, link: string) => string;
}

export interface Copy {
  langToggle: string;
  /** Initiative badge; the country name follows it. */
  badge: string;
  market: Record<Market, MarketCopy>;
  disclaimer: string;
  titleA: string;
  titleB: string;
  lede: string;
  chips: string[];
  heroCta: string;
  referredBy: (name: string) => string;
  initiativeTitle: string;
  howTitle: string;
  how: { title: string; body: string }[];
  howCta: string;
  stepLabel: (n: number) => string;
  stepNames: [string, string, string];
  stepShort: [string, string, string];
  countryPicker: { label: string; hint: string };
  fields: {
    businessName: { label: string; placeholder: string };
    businessType: { label: string; hint: string; placeholder: string };
    city: { label: string; quickLabel: string };
    whatsapp: { label: string; hint: string; country: string; consent: string };
    services: { label: string; hint: string; placeholder: string };
    differentiator: { label: string; hint: string; placeholder: string };
    hours: { label: string; placeholder: string };
    address: { label: string; hint: string; placeholder: string };
    instagram: { label: string; placeholder: string };
    facebook: { label: string; placeholder: string };
    existingWebsite: { label: string; hint: string; placeholder: string };
    contactEmail: { label: string; hint: string; placeholder: string };
    siteGoal: { label: string; options: { value: "whatsapp" | "citas" | "mostrar"; label: string }[] };
    style: { label: string; hint: string; placeholder: string };
    referredBy: { label: string; hint: string; placeholder: string };
    logo: { label: string; hint: string; button: string; replace: string };
    photos: { label: string; hint: string; button: string; count: (n: number, max: number) => string };
    documents: { label: string; hint: string; button: string; count: (n: number, max: number) => string };
    extraNotes: { label: string; hint: string; placeholder: string };
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
  priceLine: string;
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
    skipped: (n: number, max: number) => string;
  };
  validation: {
    required: string;
    whatsappSV: string;
    whatsappCO: string;
    services: string;
    email: string;
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
    moreTitle: string;
    moreBody: string;
    moreButton: string;
    moreText: (business: string) => string;
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
    confirmText: (business: string, code: string) => string;
    another: string;
  };
  fallbackText: (d: {
    business: string;
    type: string;
    city: string;
    country: string;
    whatsapp: string;
    services: string;
  }) => string;
  chipDays: (n: number) => string;
  nextDays: (n: number) => string;
  highDemand: string;
  footer: { privacy: string; verify: string };
  noscript: string;
}

const SV = MARKET_INFO.SV;
const CO = MARKET_INFO.CO;

const es: Copy = {
  langToggle: "English",
  badge: "Iniciativa de Digitalización de Negocios 2026",
  market: {
    SV: {
      name: SV.name,
      align: "Nos alineamos con la visión del Gobierno de El Salvador de digitalizar a los negocios del país.",
      mission: `Queremos que cada negocio de El Salvador esté en internet. Por eso diseñamos su página web gratis. Después de los ${FREE_DAYS} días gratis, usted decide: la seguimos alojando por $${MONTHLY_PRICE_USD} USD al mes con soporte completo, o la aloja usted mismo.`,
      cityPlaceholder: "Ej: San Salvador, colonia Escalón",
      phonePlaceholder: SV.phoneExample,
      shareText: (business, link) =>
        `¡Mire esto! MachineMind le hace la página web GRATIS a negocios salvadoreños 🇸🇻 Yo ya pedí la mía para ${business}. Regístrese aquí, toma 2 minutos: ${link}`,
    },
    CO: {
      name: CO.name,
      align: "Nos alineamos con la visión de transformación digital del Gobierno de Colombia.",
      mission: `Queremos que cada negocio de Colombia esté en internet. Por eso diseñamos su página web gratis. Después de los ${FREE_DAYS} días gratis, usted decide: la seguimos alojando por $${MONTHLY_PRICE_USD} USD al mes con soporte completo, o la aloja usted mismo.`,
      cityPlaceholder: "Ej: Medellín, El Poblado",
      phonePlaceholder: CO.phoneExample,
      shareText: (business, link) =>
        `¡Mire esto! MachineMind le hace la página web GRATIS a negocios colombianos 🇨🇴 Yo ya pedí la mía para ${business}. Regístrese aquí, toma 2 minutos: ${link}`,
    },
  },
  disclaimer:
    "MachineMind es una empresa privada. Esta iniciativa no es un programa del gobierno ni cuenta con su patrocinio; compartimos su visión de digitalizar los negocios.",
  titleA: "Su página web,",
  titleB: "gratis.",
  lede: `Cuéntenos de su negocio y se la armamos. Lista en pocos días, sin costo para empezar y sin letra pequeña. Después de los ${FREE_DAYS} días gratis, usted decide cómo seguir.`,
  chips: [
    "Diseño $0",
    "Lista en días",
    `${FREE_DAYS} días gratis`,
    `Luego: $${MONTHLY_PRICE_USD} USD/mes con hosting y soporte completo, o alójela usted mismo`,
  ],
  heroCta: "Quiero mi web gratis",
  referredBy: (name) => `${name} le recomendó esta iniciativa.`,
  initiativeTitle: "La iniciativa",
  howTitle: "Así funciona",
  how: [
    { title: "Llene este formulario", body: "Dos minutos. Nombre, servicios y, si los tiene, logo, fotos y documentos." },
    { title: "Armamos su web", body: "En pocos días se la mandamos por WhatsApp para que la revise." },
    { title: "La comparte", body: `En su historia de Instagram o Facebook, etiquetando a @${MM_INSTAGRAM}.` },
    {
      title: `${FREE_DAYS} días gratis`,
      body: `Después, usted decide: nosotros la seguimos alojando por $${MONTHLY_PRICE_USD} USD al mes, con soporte completo de su web (cambios, actualizaciones y ayuda cuando la necesite), o la aloja usted mismo: le entregamos los archivos y el alojamiento propio no incluye nuestra asistencia. Sin contrato.`,
    },
  ],
  howCta: "Empezar ahora",
  stepLabel: (n) => `Paso ${n} de 3`,
  stepNames: ["Su negocio", "Su contenido", "Archivos y envío"],
  stepShort: ["Negocio", "Contenido", "Archivos"],
  countryPicker: {
    label: "¿Dónde está su negocio?",
    hint: "Así le mostramos ejemplos de su país.",
  },
  fields: {
    businessName: { label: "Nombre del negocio", placeholder: "Ej: Barbería El Corte" },
    businessType: { label: "¿A qué se dedica?", hint: "En una frase", placeholder: "Ej: Barbería para caballeros" },
    city: { label: "Ciudad o zona", quickLabel: "Ciudades frecuentes" },
    whatsapp: {
      label: "WhatsApp del negocio",
      hint: "Por aquí le confirmamos todo",
      country: "Código de país",
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
    address: {
      label: "Dirección o link de Google Maps",
      hint: "Para que sus clientes lleguen fácil.",
      placeholder: "Dirección, o pegue el link de Maps",
    },
    instagram: { label: "Instagram", placeholder: "@sunegocio" },
    facebook: { label: "Facebook", placeholder: "facebook.com/sunegocio" },
    existingWebsite: {
      label: "¿Ya tiene página web?",
      hint: "La actualizamos gratis o le hacemos una nueva.",
      placeholder: "Ej: www.sunegocio.com",
    },
    contactEmail: {
      label: "Correo del negocio",
      hint: "Si quiere que aparezca en su web.",
      placeholder: "contacto@sunegocio.com",
    },
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
    referredBy: {
      label: "¿Quién le recomendó?",
      hint: "Si un negocio amigo le pasó el dato, a él le regalamos un mes.",
      placeholder: "Nombre del negocio o su código",
    },
    logo: {
      label: "Logo",
      hint: "JPG, PNG, SVG, PDF, AI, EPS o PSD. Si no tiene, se lo diseñamos sin costo.",
      button: "Subir logo",
      replace: "Cambiar logo",
    },
    photos: {
      label: "Fotos de su negocio o su trabajo",
      hint: "De 3 a 5 fotos. Del celular está bien. Si no tiene, usamos imágenes profesionales de su rubro.",
      button: "Agregar fotos",
      count: (n, max) => `${n} de ${max}`,
    },
    documents: {
      label: "Documentos",
      hint: `Menú, lista de precios, catálogo, brochure… PDF, Word, Excel, PowerPoint, texto o fotos. Hasta ${MAX_DOCUMENTS} archivos de ${MAX_UPLOAD_MB} MB cada uno.`,
      button: "Agregar documentos",
      count: (n, max) => `${n} de ${max}`,
    },
    extraNotes: {
      label: "¿Algo más que debamos saber?",
      hint: "Promociones, ideas, lo que quiera que aparezca.",
      placeholder: "Ej: tenemos servicio a domicilio los fines de semana",
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
      `Después, usted decide. Si quiere que la sigamos alojando: $${MONTHLY_PRICE_USD} USD al mes, con soporte completo de su web (cambios, actualizaciones y ayuda cuando la necesite). Sin contrato: cancele cuando quiera.`,
      "Si prefiere alojarla usted mismo: le entregamos los archivos de su web. El alojamiento propio no incluye nuestra asistencia.",
      `Lo único que le pedimos: cuando esté lista, compártala en su historia de Instagram o Facebook y etiquete a @${MM_INSTAGRAM}.`,
    ],
    acceptTerms: `Entiendo: la web es gratis, los primeros ${FREE_DAYS} días en línea son gratis y después elijo: que MachineMind la siga alojando por $${MONTHLY_PRICE_USD} USD al mes con soporte completo, o alojarla yo mismo (me entregan los archivos, sin asistencia de MachineMind). Sin contrato.`,
    acceptShare: `Cuando mi web esté lista, la comparto en mi historia y etiqueto a @${MM_INSTAGRAM}.`,
  },
  priceLine: `Hoy $0 · ${FREE_DAYS} días gratis · luego $${MONTHLY_PRICE_USD} USD/mes con hosting y soporte completo, o alójela usted mismo`,
  submit: "Enviar y empezar mi web",
  submitting: "Enviando…",
  waitingUploads: "Esperando que terminen de subir sus archivos…",
  fine: "Al enviar, acepta que le escribamos por WhatsApp sobre su web. Usamos su información solo para crear su web; no la vendemos ni la compartimos.",
  upload: {
    uploading: "Subiendo",
    done: "Listo",
    failed: "No se subió",
    retry: "Reintentar",
    remove: "Quitar",
    tooLarge: `Pesa más de ${MAX_UPLOAD_MB} MB`,
    unsupported: "Formato no admitido aquí",
    tooMany: "Ya alcanzó el máximo de archivos",
    skipped: (n, max) =>
      `El máximo es ${max}: ${n === 1 ? "un archivo no se agregó" : `${n} archivos no se agregaron`}. Puede enviarlos por WhatsApp al terminar.`,
  },
  validation: {
    required: "Este dato es necesario.",
    whatsappSV: `Revise el número: en El Salvador son 8 dígitos (ej: ${SV.phoneExample}).`,
    whatsappCO: `Revise el número: en Colombia el celular tiene 10 dígitos y empieza por 3 (ej: ${CO.phoneExample}).`,
    services: "Escriba al menos un servicio o producto.",
    email: "Revise el correo: debe verse así, contacto@sunegocio.com (o déjelo vacío).",
    acceptTerms: "Marque esta casilla para continuar.",
    acceptShare: "Marque esta casilla para continuar.",
  },
  errors: {
    invalid: "Revise los campos marcados.",
    invalid_whatsapp: "Revise el número de WhatsApp y el código de país.",
    invalid_email: "Revise el correo del negocio (o déjelo vacío).",
    rate_limited: "Demasiados intentos desde esta conexión. Espere unos minutos o escríbanos por WhatsApp.",
    duplicate: "Ya tenemos una solicitud para este negocio con ese WhatsApp. Le escribiremos pronto.",
    draft_not_found: "Se perdió su avance. Toque Continuar otra vez.",
    unsupported_type: "Ese formato no se puede subir aquí. Pruebe con otro archivo o envíelo por WhatsApp.",
    too_large: `El archivo pesa más de ${MAX_UPLOAD_MB} MB. Puede enviarlo por WhatsApp.`,
    too_many_files: "Ya alcanzó el máximo de archivos. Envíe el resto por WhatsApp al terminar.",
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
      `${FREE_DAYS} días gratis con su web en línea. Después usted decide: $${MONTHLY_PRICE_USD} USD al mes con hosting y soporte completo, o la aloja usted mismo.`,
    ],
    confirm: "Confirmar por WhatsApp",
    moreTitle: "¿Se le olvidó algo?",
    moreBody: `Envíe fotos, su logo, el menú o cualquier documento por WhatsApp al ${MM_WHATSAPP_DISPLAY}. Se agrega solo a los materiales de su web.`,
    moreButton: "Enviar archivos por WhatsApp",
    moreText: (business) => `Hola, soy de ${business}. Les envío fotos y documentos para mi web.`,
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
    confirmText: (business, code) =>
      `Hola, acabo de enviar el formulario de mi web gratis. Negocio: ${business}. Código: ${code}`,
    another: "Enviar otra solicitud",
  },
  fallbackText: (d) =>
    [
      "Hola, quiero mi web gratis (el formulario no me dejó enviar).",
      d.business && `Negocio: ${d.business}`,
      d.type && `Rubro: ${d.type}`,
      d.city && `Ciudad: ${d.city}`,
      d.country && `País: ${d.country}`,
      d.whatsapp && `WhatsApp: ${d.whatsapp}`,
      d.services && `Servicios: ${d.services}`,
    ]
      .filter(Boolean)
      .join("\n"),
  chipDays: (n) => `Lista en ${n} días`,
  nextDays: (n) => `En unos ${n} días su web queda lista y se la mandamos por WhatsApp.`,
  highDemand: "Estamos recibiendo muchas solicitudes: su web entra en fila y le avisamos por WhatsApp apenas empecemos.",
  footer: {
    privacy: "Su información se usa solo para crear su web.",
    verify: "Verifique que habla con MachineMind",
  },
  noscript: "Para llenar el formulario active JavaScript, o escríbanos por WhatsApp.",
};

const en: Copy = {
  langToggle: "Español",
  badge: "Business Digitalization Initiative 2026",
  market: {
    SV: {
      name: SV.name,
      align: "We are aligned with the Government of El Salvador's vision of bringing every business online.",
      mission: `We want every business in El Salvador to be online. That's why we design your website for free. After the ${FREE_DAYS} free days, you decide: we keep hosting it for $${MONTHLY_PRICE_USD} USD a month with full support, or you host it yourself.`,
      cityPlaceholder: "e.g. San Salvador, Escalón",
      phonePlaceholder: SV.phoneExample,
      shareText: (business, link) =>
        `Check this out! MachineMind builds FREE websites for Salvadoran businesses 🇸🇻 I already asked for mine for ${business}. Sign up here, it takes 2 minutes: ${link}`,
    },
    CO: {
      name: CO.name,
      align: "We are aligned with the Government of Colombia's digital-transformation vision.",
      mission: `We want every business in Colombia to be online. That's why we design your website for free. After the ${FREE_DAYS} free days, you decide: we keep hosting it for $${MONTHLY_PRICE_USD} USD a month with full support, or you host it yourself.`,
      cityPlaceholder: "e.g. Medellín, El Poblado",
      phonePlaceholder: CO.phoneExample,
      shareText: (business, link) =>
        `Check this out! MachineMind builds FREE websites for Colombian businesses 🇨🇴 I already asked for mine for ${business}. Sign up here, it takes 2 minutes: ${link}`,
    },
  },
  disclaimer:
    "MachineMind is a private company. This initiative is not a government program and is not sponsored by any government; we share its vision of bringing businesses online.",
  titleA: "Your website,",
  titleB: "free.",
  lede: `Tell us about your business and we'll build it. Ready in a few days, nothing to pay to start, no fine print. After the ${FREE_DAYS} free days, you decide what's next.`,
  chips: [
    "$0 design",
    "Ready in days",
    `${FREE_DAYS} days free`,
    `Then: $${MONTHLY_PRICE_USD} USD/mo with hosting and full support, or host it yourself`,
  ],
  heroCta: "I want my free website",
  referredBy: (name) => `${name} recommended this initiative to you.`,
  initiativeTitle: "The initiative",
  howTitle: "How it works",
  how: [
    { title: "Fill in this form", body: "Two minutes. Name, services and, if you have them, logo, photos and documents." },
    { title: "We build your site", body: "In a few days we send it to you on WhatsApp to review." },
    { title: "You share it", body: `On your Instagram or Facebook story, tagging @${MM_INSTAGRAM}.` },
    {
      title: `${FREE_DAYS} days free`,
      body: `After that, you decide: we keep hosting it for $${MONTHLY_PRICE_USD} USD a month with full support for your website (changes, updates and help whenever you need it), or you host it yourself: we hand you the files, and self-hosting doesn't include our assistance. No contract.`,
    },
  ],
  howCta: "Start now",
  stepLabel: (n) => `Step ${n} of 3`,
  stepNames: ["Your business", "Your content", "Files and send"],
  stepShort: ["Business", "Content", "Files"],
  countryPicker: {
    label: "Where is your business?",
    hint: "So we show you examples from your country.",
  },
  fields: {
    businessName: { label: "Business name", placeholder: "e.g. El Corte Barbershop" },
    businessType: { label: "What does it do?", hint: "In one sentence", placeholder: "e.g. Men's barbershop" },
    city: { label: "City or area", quickLabel: "Common cities" },
    whatsapp: {
      label: "Business WhatsApp",
      hint: "We confirm everything here",
      country: "Country code",
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
    address: {
      label: "Address or Google Maps link",
      hint: "So customers can find you easily.",
      placeholder: "Address, or paste the Maps link",
    },
    instagram: { label: "Instagram", placeholder: "@yourbusiness" },
    facebook: { label: "Facebook", placeholder: "facebook.com/yourbusiness" },
    existingWebsite: {
      label: "Do you already have a website?",
      hint: "We'll update it for free or build you a new one.",
      placeholder: "e.g. www.yourbusiness.com",
    },
    contactEmail: {
      label: "Business email",
      hint: "If you want it on your website.",
      placeholder: "hello@yourbusiness.com",
    },
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
    referredBy: {
      label: "Who referred you?",
      hint: "If a business friend told you about us, they get a free month.",
      placeholder: "Business name or their code",
    },
    logo: {
      label: "Logo",
      hint: "JPG, PNG, SVG, PDF, AI, EPS or PSD. No logo? We'll design one at no cost.",
      button: "Upload logo",
      replace: "Change logo",
    },
    photos: {
      label: "Photos of your business or work",
      hint: "3 to 5 photos. Phone photos are fine. None? We'll use professional images for your trade.",
      button: "Add photos",
      count: (n, max) => `${n} of ${max}`,
    },
    documents: {
      label: "Documents",
      hint: `Menu, price list, catalog, brochure… PDF, Word, Excel, PowerPoint, text or photos. Up to ${MAX_DOCUMENTS} files, ${MAX_UPLOAD_MB} MB each.`,
      button: "Add documents",
      count: (n, max) => `${n} of ${max}`,
    },
    extraNotes: {
      label: "Anything else we should know?",
      hint: "Promotions, ideas, anything you want on your site.",
      placeholder: "e.g. we deliver on weekends",
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
      `After that, you decide. If you want us to keep hosting it: $${MONTHLY_PRICE_USD} USD a month, with full support for your website (changes, updates and help whenever you need it). No contract: cancel anytime.`,
      "If you'd rather host it yourself: we hand you your website files. Self-hosting doesn't include our assistance.",
      `All we ask: when it's ready, share it on your Instagram or Facebook story and tag @${MM_INSTAGRAM}.`,
    ],
    acceptTerms: `I understand: the website is free, the first ${FREE_DAYS} days online are free, and after that I choose: MachineMind keeps hosting it for $${MONTHLY_PRICE_USD} USD a month with full support, or I host it myself (I get the files, with no assistance from MachineMind). No contract.`,
    acceptShare: `When my website is ready, I'll share it on my story and tag @${MM_INSTAGRAM}.`,
  },
  priceLine: `$0 today · ${FREE_DAYS} days free · then $${MONTHLY_PRICE_USD} USD/mo with hosting and full support, or host it yourself`,
  submit: "Send and start my website",
  submitting: "Sending…",
  waitingUploads: "Waiting for your files to finish uploading…",
  fine: "By sending, you agree that we can message you on WhatsApp about your website. We only use your information to build your site; we never sell or share it.",
  upload: {
    uploading: "Uploading",
    done: "Done",
    failed: "Didn't upload",
    retry: "Retry",
    remove: "Remove",
    tooLarge: `Larger than ${MAX_UPLOAD_MB} MB`,
    unsupported: "Format not accepted here",
    tooMany: "You've reached the file limit",
    skipped: (n, max) =>
      `The limit is ${max}: ${n === 1 ? "1 file wasn't added" : `${n} files weren't added`}. You can send them on WhatsApp when you finish.`,
  },
  validation: {
    required: "This is required.",
    whatsappSV: `Check the number: El Salvador numbers have 8 digits (e.g. ${SV.phoneExample}).`,
    whatsappCO: `Check the number: Colombian mobiles have 10 digits and start with 3 (e.g. ${CO.phoneExample}).`,
    services: "Add at least one service or product.",
    email: "Check the email: it should look like hello@yourbusiness.com (or leave it empty).",
    acceptTerms: "Tick this box to continue.",
    acceptShare: "Tick this box to continue.",
  },
  errors: {
    invalid: "Please check the highlighted fields.",
    invalid_whatsapp: "Please check the WhatsApp number and country code.",
    invalid_email: "Please check the business email (or leave it empty).",
    rate_limited: "Too many attempts from this connection. Wait a few minutes or message us on WhatsApp.",
    duplicate: "We already have a request for this business with that WhatsApp. We'll message you soon.",
    draft_not_found: "Your progress was lost. Tap Continue again.",
    unsupported_type: "That format can't be uploaded here. Try another file or send it on WhatsApp.",
    too_large: `The file is larger than ${MAX_UPLOAD_MB} MB. You can send it on WhatsApp.`,
    too_many_files: "You've reached the file limit. Send the rest on WhatsApp when you finish.",
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
      `${FREE_DAYS} days free with your site online. Then you decide: $${MONTHLY_PRICE_USD} USD a month with hosting and full support, or you host it yourself.`,
    ],
    confirm: "Confirm on WhatsApp",
    moreTitle: "Forgot something?",
    moreBody: `Send photos, your logo, the menu or any document on WhatsApp to ${MM_WHATSAPP_DISPLAY}. It's added to your website materials automatically.`,
    moreButton: "Send files on WhatsApp",
    moreText: (business) => `Hi, this is ${business}. Here are photos and documents for my website.`,
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
    confirmText: (business, code) =>
      `Hi, I just sent the form for my free website. Business: ${business}. Code: ${code}`,
    another: "Send another request",
  },
  fallbackText: (d) =>
    [
      "Hi, I want my free website (the form would not let me send it).",
      d.business && `Business: ${d.business}`,
      d.type && `Trade: ${d.type}`,
      d.city && `City: ${d.city}`,
      d.country && `Country: ${d.country}`,
      d.whatsapp && `WhatsApp: ${d.whatsapp}`,
      d.services && `Services: ${d.services}`,
    ]
      .filter(Boolean)
      .join("\n"),
  chipDays: (n) => `Ready in ${n} days`,
  nextDays: (n) => `In about ${n} days your site is ready and we send it to you on WhatsApp.`,
  highDemand: "We are receiving a lot of requests: your site joins the queue and we will message you on WhatsApp as soon as we start.",
  footer: {
    privacy: "Your information is only used to build your website.",
    verify: "Verify you are talking to MachineMind",
  },
  noscript: "To fill in the form please enable JavaScript, or message us on WhatsApp.",
};

export const COPY: Record<Lang, Copy> = { es, en };
