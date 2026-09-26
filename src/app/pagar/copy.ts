/**
 * Copy for the funnel's payment / redirect pages (es = usted register for El
 * Salvador and Colombia alike; en mirrors it). Prices come from config, same
 * promise as /web. Country-specific lines (the initiative tag and the alignment
 * with each government's vision) exist only for SV and CO; the footer
 * disclaimer is always shown, so it sits on every page that carries them.
 * The pay page's buttons are option A (we keep hosting it, full support); option
 * B (self-hosting: files handed over, no assistance) is one line + a WhatsApp link.
 */
import { countryFromE164, FREE_DAYS, MONTHLY_PRICE_USD, type SignupCountry } from "@/lib/web-gratis/config";

export type PayLang = "es" | "en";

/** Market of the business behind a page (null = not known: unknown code, Stripe's thank-you page). */
export type PayCountry = SignupCountry;

export function payLang(value: string | string[] | undefined, fallback: PayLang = "es"): PayLang {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "en" ? "en" : v === "es" ? "es" : fallback;
}

/** The signup's country column, else its WhatsApp prefix (rows saved before the column existed). */
export function payCountry(signup: { country?: string | null; whatsapp?: string | null } | null): PayCountry | null {
  if (!signup) return null;
  if (signup.country === "SV" || signup.country === "CO" || signup.country === "OTHER") return signup.country;
  return countryFromE164(signup.whatsapp ?? "");
}

/** BCP-47 tag for <main lang>. */
export function payLocale(lang: PayLang, country: PayCountry | null): string {
  if (lang === "en") return "en";
  return country === "SV" ? "es-SV" : country === "CO" ? "es-CO" : "es";
}

export const PAY_COPY = {
  es: {
    toggle: "English",
    kicker: "Su web · MachineMind",
    titleLead: "Mantenga su web",
    titleAccent: "en línea.",
    lede: (business: string) =>
      `Con nosotros, la web de ${business} sigue en línea con soporte completo: cambios, actualizaciones y ayuda cuando la necesite.`,
    per: "al mes",
    chips: ["Hosting y soporte completo", "Sin contrato", "Cancele cuando quiera"],
    payCard: "Pagar con tarjeta",
    payPaypal: "Pagar con PayPal",
    cardSoon: "El pago con tarjeta estará disponible muy pronto. Mientras tanto puede pagar por PayPal o escribirnos por WhatsApp.",
    selfHost: "¿Prefiere alojarla usted mismo? Le entregamos los archivos de su web; el alojamiento propio no incluye nuestra asistencia.",
    selfHostCta: "Pedirlos por WhatsApp",
    paypalTitle: "Si paga por PayPal",
    paypalSteps: [
      `Pague $${MONTHLY_PRICE_USD} USD con el botón de PayPal.`,
      "Envíenos el comprobante por WhatsApp con el botón de abajo.",
      "Le confirmamos por WhatsApp y su web queda activa.",
    ],
    sendReceipt: "Enviar comprobante por WhatsApp",
    receiptText: (code: string) => `Pagué por PayPal — código ${code}`,
    secure: "Pago con tarjeta procesado por Stripe. MachineMind nunca ve ni guarda los datos de su tarjeta.",
    activeTitle: "Su web ya está activa ✓",
    activeBody: (business: string) =>
      `Gracias por confiar en nosotros. La web de ${business} sigue en línea con soporte completo: cambios, actualizaciones y ayuda cuando la necesite.`,
    activeHelp: "¿Necesita un cambio? Escríbanos",
    renewalTitleLead: "Renueve su",
    renewalTitleAccent: "mensualidad.",
    renewalLede: (business: string, due: string, past: boolean) =>
      past
        ? `La mensualidad de la web de ${business} venció el ${due}. Renuévela para que siga en línea con soporte completo.`
        : `La mensualidad de la web de ${business} vence el ${due}. Renuévela para que siga en línea con soporte completo, sin interrupciones.`,
    buildingTitle: "Su web aún está en construcción",
    buildingBody: (business: string) =>
      `No tiene que pagar nada todavía. Primero le entregamos la web de ${business} y la usa gratis ${FREE_DAYS} días; le avisamos por WhatsApp apenas esté lista.`,
    buildingHelp: "Preguntar por mi web",
    paidBuildingTitle: "Pago recibido ✓",
    paidBuildingBody: (business: string) =>
      `Gracias. Estamos terminando la web de ${business} y le avisamos por WhatsApp apenas esté lista.`,
    pausedTitleLead: "Reactive su web",
    pausedTitleAccent: "hoy.",
    pausedLede: (business: string) =>
      `La web de ${business} está en pausa. Reactívela y vuelve a estar en línea, con hosting y soporte completo: cambios, actualizaciones y ayuda cuando la necesite.`,
    pausedLastStep: "Le confirmamos por WhatsApp y su web vuelve a estar en línea.",
    draftTitle: "Primero terminemos su solicitud",
    draftBody: "Todavía no recibimos el formulario completo de su web. Termínelo aquí (toma 2 minutos) y se la armamos gratis.",
    draftCta: "Terminar mi solicitud",
    errorTitle: "No pudimos cargar su información",
    errorBody: "Intente de nuevo en un momento o escríbanos por WhatsApp y le ayudamos.",
    help: "Escríbanos por WhatsApp",
    notFoundTitle: "No encontramos ese enlace",
    notFoundBody: "Revise que el enlace esté completo, o escríbanos por WhatsApp y le ayudamos con su web.",
    notFoundCta: "Pedir mi web gratis",
    thanksTitle: "¡Gracias! Recibimos su pago",
    thanksBody: "Su web queda activa, con soporte completo. Stripe le envía el recibo a su correo. Para cualquier cambio o duda, escríbanos por WhatsApp y le respondemos ahí mismo.",
    thanksNext: "¿Quiere que su WhatsApp también agende citas solo? Pregúntenos por el chat — es el siguiente paso.",
    thanksCta: "Abrir el chat de WhatsApp",
    prontoTitle: "Su web está en camino",
    prontoBody: (business: string | null) =>
      business
        ? `Estamos terminando la web de ${business}. Le avisamos por WhatsApp apenas esté lista.`
        : "Estamos terminando esta web. Le avisamos por WhatsApp apenas esté lista.",
    prontoCta: "Preguntar por WhatsApp",
    /** Pre-written WhatsApp messages (the business sends them to the funnel line). */
    waActivate: (code: string) => `Hola, quiero activar mi web. Código ${code}`,
    waSelfHost: (code: string) => `Quiero alojar mi web por mi cuenta. Código ${code}`,
    waHello: (business: string, code: string) => `Hola, soy ${business} (código ${code}).`,
    waHowIsIt: (business: string, code: string) => `Hola, soy ${business} (código ${code}). ¿Cómo va mi web?`,
    waHowIsItAnon: "Hola, quiero saber cómo va mi web.",
    waPaid: "¡Hola! Ya pagué mi web.",
    /** Small tag + one line under the price, only for SV / CO businesses. */
    initiative: {
      SV: "Iniciativa de Digitalización de Negocios 2026 · El Salvador",
      CO: "Iniciativa de Digitalización de Negocios 2026 · Colombia",
    },
    alignment: {
      SV: "Nos alineamos con la visión del Gobierno de El Salvador de digitalizar a los negocios del país.",
      CO: "Nos alineamos con la visión de transformación digital del Gobierno de Colombia.",
    },
    disclaimer:
      "MachineMind es una empresa privada. Esta iniciativa no es un programa del gobierno ni cuenta con su patrocinio; compartimos su visión de digitalizar los negocios.",
    verify: "Verifique que está hablando con MachineMind",
  },
  en: {
    toggle: "Español",
    kicker: "Your website · MachineMind",
    titleLead: "Keep your website",
    titleAccent: "online.",
    lede: (business: string) =>
      `With us, ${business}'s website stays online with full support: changes, updates and help whenever you need it.`,
    per: "a month",
    chips: ["Hosting and full support", "No contract", "Cancel anytime"],
    payCard: "Pay by card",
    payPaypal: "Pay with PayPal",
    cardSoon: "Card payments will be available very soon. Meanwhile you can pay with PayPal or message us on WhatsApp.",
    selfHost: "Prefer to host it yourself? We hand you your website files; self-hosting doesn't include our assistance.",
    selfHostCta: "Ask for them on WhatsApp",
    paypalTitle: "If you pay with PayPal",
    paypalSteps: [
      `Pay $${MONTHLY_PRICE_USD} USD with the PayPal button.`,
      "Send us the receipt on WhatsApp with the button below.",
      "We confirm on WhatsApp and your site stays active.",
    ],
    sendReceipt: "Send receipt on WhatsApp",
    receiptText: (code: string) => `I paid with PayPal — code ${code}`,
    secure: "Card payments are processed by Stripe. MachineMind never sees or stores your card details.",
    activeTitle: "Your website is active ✓",
    activeBody: (business: string) =>
      `Thank you for trusting us. ${business}'s website stays online with full support: changes, updates and help whenever you need it.`,
    activeHelp: "Need a change? Message us",
    renewalTitleLead: "Renew your",
    renewalTitleAccent: "monthly plan.",
    renewalLede: (business: string, due: string, past: boolean) =>
      past
        ? `${business}'s monthly plan was due on ${due}. Renew it to keep the website online with full support.`
        : `${business}'s monthly plan is due on ${due}. Renew it to keep the website online with full support, uninterrupted.`,
    buildingTitle: "Your website is still being built",
    buildingBody: (business: string) =>
      `There's nothing to pay yet. We deliver ${business}'s website first and you use it free for ${FREE_DAYS} days; we'll message you on WhatsApp as soon as it's ready.`,
    buildingHelp: "Ask about my website",
    paidBuildingTitle: "Payment received ✓",
    paidBuildingBody: (business: string) =>
      `Thank you. We're finishing ${business}'s website and will message you on WhatsApp as soon as it's ready.`,
    pausedTitleLead: "Reactivate your website",
    pausedTitleAccent: "today.",
    pausedLede: (business: string) =>
      `${business}'s website is paused. Reactivate it and it's back online, with hosting and full support: changes, updates and help whenever you need it.`,
    pausedLastStep: "We confirm on WhatsApp and your site is back online.",
    draftTitle: "Let's finish your request first",
    draftBody: "We haven't received your complete website form yet. Finish it here (2 minutes) and we'll build it for free.",
    draftCta: "Finish my request",
    errorTitle: "We couldn't load your information",
    errorBody: "Try again in a moment or message us on WhatsApp and we'll help.",
    help: "Message us on WhatsApp",
    notFoundTitle: "We couldn't find that link",
    notFoundBody: "Check that the link is complete, or message us on WhatsApp and we'll help with your website.",
    notFoundCta: "Get my free website",
    thanksTitle: "Thank you! Payment received",
    thanksBody: "Your website stays active, with full support. Stripe emails you the receipt. For any change or question, message us on WhatsApp and we'll answer right there.",
    thanksNext: "Want your WhatsApp to book appointments on its own too? Ask us in the chat — it's the next step.",
    thanksCta: "Open the WhatsApp chat",
    prontoTitle: "Your website is on its way",
    prontoBody: (business: string | null) =>
      business
        ? `We're finishing ${business}'s website. We'll message you on WhatsApp as soon as it's ready.`
        : "We're finishing this website. We'll message you on WhatsApp as soon as it's ready.",
    prontoCta: "Ask on WhatsApp",
    waActivate: (code: string) => `Hi, I'd like to activate my website. Code ${code}`,
    waSelfHost: (code: string) => `I'd like to host my website on my own. Code ${code}`,
    waHello: (business: string, code: string) => `Hi, this is ${business} (code ${code}).`,
    waHowIsIt: (business: string, code: string) => `Hi, this is ${business} (code ${code}). How is my website coming along?`,
    waHowIsItAnon: "Hi, I'd like to know how my website is coming along.",
    waPaid: "Hi! I just paid for my website.",
    initiative: {
      SV: "Business Digitalization Initiative 2026 · El Salvador",
      CO: "Business Digitalization Initiative 2026 · Colombia",
    },
    alignment: {
      SV: "We are aligned with the Government of El Salvador's vision of bringing every business online.",
      CO: "We are aligned with the Government of Colombia's digital-transformation vision.",
    },
    disclaimer:
      "MachineMind is a private company. This initiative is not a government program and is not sponsored by any government; we share its vision of bringing businesses online.",
    verify: "Check that you are talking to MachineMind",
  },
} as const;

export type PayCopy = (typeof PAY_COPY)[PayLang];
