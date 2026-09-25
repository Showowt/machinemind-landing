/**
 * Free-website funnel — WhatsApp scripts for each stage (from Phil's DM script,
 * usted register). Client-safe: used by team notifications and the ops board to
 * open wa.me with the right message already written.
 */
import { FREE_DAYS, MM_INSTAGRAM, MONTHLY_PRICE_USD, referralLink, SITE_ORIGIN, WEB_GRATIS_PATH } from "./config";

export function waLink(e164: string, text: string): string {
  return `https://wa.me/${e164.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

const payLine = (payLink: string | null) =>
  payLink ? `Acá la activa 👉 ${payLink}` : "Le paso el enlace para activarla por acá mismo.";

export const scripts = {
  confirm: (business: string) =>
    `¡Recibido, ${business}! 🎉 Le saluda MachineMind. Ya empezamos a armar su web. Le confirmo por acá cuando esté lista (pocos días).`,

  rescue: (business: string) =>
    `¡Hola! Le saluda MachineMind. Vi que empezó el formulario para la web gratis de ${business}. ¿Le ayudo a terminarlo? Puede seguir aquí, su avance quedó guardado: ${SITE_ORIGIN}${WEB_GRATIS_PATH}`,

  delivered: (siteUrl: string | null) =>
    `¡Su web ya está lista! 🚀 ${siteUrl ?? "[link de su web]"} — échele un ojo y dígame si quiere ajustar algo.\n\nUn favor (es lo único que le pedimos por ser gratis 🙂): compártala en su historia de Instagram y Facebook y etiquétenos @${MM_INSTAGRAM}. A usted le da visibilidad y a nosotros nos ayuda a llegar a más negocios como el suyo. ¿Me confirma cuando la comparta?`,

  sharedThanks: (code: string) =>
    `¡Mil gracias! 🙌 La compartimos también desde nuestras cuentas.\n\nY si conoce a otro dueño de negocio, se la armamos gratis igual que la suya — y por cada uno que active su web, le damos un mes gratis a usted. Solo compártales su enlace personal: ${referralLink(code)}`,

  referralAsk: (code: string) =>
    `Si conoce a otro dueño de negocio, se la armamos gratis igual que la suya — y por cada uno que active su web, le damos un mes gratis a usted 🙌 Compártales su enlace personal: ${referralLink(code)}`,

  seedUpsell: () =>
    `Fíjese en el botón de WhatsApp de su web: por ahora contesta, pero lo bonito es cuando lo conectamos para que AGENDE la cita solo, aunque usted esté durmiendo. Eso lo vemos más adelante 😉`,

  day7: () => `¿Cómo le ha ido con la web? ¿Le han escrito clientes por ahí? 🙂`,

  day28: (payLink: string | null) =>
    `Recordatorio amistoso: su mes gratis termina en 2 días. Su web sigue en línea por solo $${MONTHLY_PRICE_USD}/mes — soporte, actualizaciones y que nunca se caiga. ¿Se la dejo activa? ${payLine(payLink)}`,

  day30: (business: string, payLink: string | null) =>
    `${business}, hoy se cumplen sus ${FREE_DAYS} días 🎉 Su web ya está trabajando para usted. Para mantenerla en línea con soporte y actualizaciones es solo $${MONTHLY_PRICE_USD}/mes, sin contrato, cancela cuando quiera. ${payLine(payLink)}\n\nY si quiere que además le agende citas sola por WhatsApp, le muestro cómo — es el siguiente paso 🙌`,

  lastCall: (payLink: string | null) =>
    `Su web se pausa mañana si no la activamos — ¿se la dejo en línea? ${payLine(payLink)}`,
};

export type ScriptKey = keyof typeof scripts;
