/**
 * Copy for the funnel's payment / redirect pages (es = El Salvador, usted;
 * en mirrors it). Prices are stated plainly, same promise as /web.
 */
import { MONTHLY_PRICE_USD } from "@/lib/web-gratis/config";

export type PayLang = "es" | "en";

export function payLang(value: string | string[] | undefined, fallback: PayLang = "es"): PayLang {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "en" ? "en" : v === "es" ? "es" : fallback;
}

export const PAY_COPY = {
  es: {
    toggle: "English",
    kicker: "Su web · MachineMind",
    titleLead: "Mantenga su web",
    titleAccent: "en línea.",
    lede: (business: string) =>
      `La web de ${business} sigue trabajando para usted: hosting, soporte y cambios cuando los necesite.`,
    per: "al mes",
    chips: ["Sin contrato", "Cancela cuando quiera", "Soporte y cambios"],
    payCard: "Pagar con tarjeta",
    payPaypal: "Pagar con PayPal",
    cardSoon: "El pago con tarjeta estará disponible muy pronto. Mientras tanto puede pagar por PayPal o escribirnos por WhatsApp.",
    paypalTitle: "Si paga por PayPal",
    paypalSteps: [
      `Pague $${MONTHLY_PRICE_USD} con el botón de PayPal.`,
      "Envíenos el comprobante por WhatsApp con el botón de abajo.",
      "Le confirmamos por WhatsApp y su web queda activa.",
    ],
    sendReceipt: "Enviar comprobante por WhatsApp",
    receiptText: (code: string) => `Pagué por PayPal — código ${code}`,
    secure: "Pago con tarjeta procesado por Stripe. MachineMind nunca ve ni guarda los datos de su tarjeta.",
    activeTitle: "Su web ya está activa ✓",
    activeBody: (business: string) => `Gracias por confiar en nosotros. La web de ${business} sigue en línea con soporte incluido.`,
    activeHelp: "¿Necesita un cambio? Escríbanos",
    buildingTitle: "Su web aún está en construcción",
    buildingBody: (business: string) =>
      `No tiene que pagar nada todavía. Primero le entregamos la web de ${business} y la usa gratis 30 días; le avisamos por WhatsApp apenas esté lista.`,
    buildingHelp: "Preguntar por mi web",
    paidBuildingTitle: "Pago recibido ✓",
    paidBuildingBody: (business: string) =>
      `Gracias. Estamos terminando la web de ${business} y le avisamos por WhatsApp apenas esté lista.`,
    pausedTitleLead: "Reactive su web",
    pausedTitleAccent: "hoy.",
    pausedLede: (business: string) =>
      `La web de ${business} está en pausa. Reactívela y vuelve a estar en línea, con hosting, soporte y cambios cuando los necesite.`,
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
    thanksBody: "Su web queda activa. Stripe le envía el recibo a su correo. Si tiene cualquier duda, escríbanos por WhatsApp y le respondemos ahí mismo.",
    thanksNext: "¿Quiere que su WhatsApp también agende citas solo? Pregúntenos por el chat — es el siguiente paso.",
    thanksCta: "Abrir el chat de WhatsApp",
    prontoTitle: "Su web está en camino",
    prontoBody: (business: string | null) =>
      business
        ? `Estamos terminando la web de ${business}. Le avisamos por WhatsApp apenas esté lista.`
        : "Estamos terminando esta web. Le avisamos por WhatsApp apenas esté lista.",
    prontoCta: "Preguntar por WhatsApp",
    disclaimer: "MachineMind es una empresa privada. Este programa no está afiliado ni patrocinado por el Gobierno de El Salvador.",
    verify: "Verifique nuestros canales oficiales",
  },
  en: {
    toggle: "Español",
    kicker: "Your website · MachineMind",
    titleLead: "Keep your website",
    titleAccent: "online.",
    lede: (business: string) =>
      `${business}'s website keeps working for you: hosting, support and changes whenever you need them.`,
    per: "a month",
    chips: ["No contract", "Cancel anytime", "Support and changes"],
    payCard: "Pay by card",
    payPaypal: "Pay with PayPal",
    cardSoon: "Card payments will be available very soon. Meanwhile you can pay with PayPal or message us on WhatsApp.",
    paypalTitle: "If you pay with PayPal",
    paypalSteps: [
      `Pay $${MONTHLY_PRICE_USD} with the PayPal button.`,
      "Send us the receipt on WhatsApp with the button below.",
      "We confirm on WhatsApp and your site stays active.",
    ],
    sendReceipt: "Send receipt on WhatsApp",
    receiptText: (code: string) => `I paid with PayPal — code ${code}`,
    secure: "Card payments are processed by Stripe. MachineMind never sees or stores your card details.",
    activeTitle: "Your website is active ✓",
    activeBody: (business: string) => `Thank you for trusting us. ${business}'s website stays online with support included.`,
    activeHelp: "Need a change? Message us",
    buildingTitle: "Your website is still being built",
    buildingBody: (business: string) =>
      `There's nothing to pay yet. We deliver ${business}'s website first and you use it free for 30 days; we'll message you on WhatsApp as soon as it's ready.`,
    buildingHelp: "Ask about my website",
    paidBuildingTitle: "Payment received ✓",
    paidBuildingBody: (business: string) =>
      `Thank you. We're finishing ${business}'s website and will message you on WhatsApp as soon as it's ready.`,
    pausedTitleLead: "Reactivate your website",
    pausedTitleAccent: "today.",
    pausedLede: (business: string) =>
      `${business}'s website is paused. Reactivate it and it's back online, with hosting, support and changes whenever you need them.`,
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
    thanksBody: "Your website stays active. Stripe emails you the receipt. Any question, message us on WhatsApp and we'll answer right there.",
    thanksNext: "Want your WhatsApp to book appointments on its own too? Ask us in the chat — it's the next step.",
    thanksCta: "Open the WhatsApp chat",
    prontoTitle: "Your website is on its way",
    prontoBody: (business: string | null) =>
      business
        ? `We're finishing ${business}'s website. We'll message you on WhatsApp as soon as it's ready.`
        : "We're finishing this website. We'll message you on WhatsApp as soon as it's ready.",
    prontoCta: "Ask on WhatsApp",
    disclaimer: "MachineMind is a private company. This program is not affiliated with or sponsored by the Government of El Salvador.",
    verify: "Verify our official channels",
  },
} as const;

export type PayCopy = (typeof PAY_COPY)[PayLang];
