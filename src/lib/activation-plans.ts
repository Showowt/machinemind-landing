/**
 * Activation pricing — the single source of truth for /activate.
 *
 * Until 2026-10-18 the page and the API each hardcoded "$150/mo x2 then $179"
 * in a dozen places, a launch offer that was superseded by the $99/$199
 * structure on 2026-08-20. Prices live here now: the page renders them and the
 * API derives the amount it stores from the plan id, never from the client, so
 * the two can no longer disagree and a posted amount can never be forged.
 *
 * Client-safe: no secrets in this file.
 */

export type ActivationPlanId = "standard" | "premium";

export interface ActivationPlan {
  id: ActivationPlanId;
  /** Monthly price in USD. El Salvador is USD-only; Colombia sees USD too. */
  monthlyUsd: number;
  nameEs: string;
  taglineEs: string;
  features: string[];
  /** PayPal.me amounts are part of the URL, so they follow the price. */
  paypalUrl: string;
}

const SHARED_FEATURES = [
  "Chatbot IA entrenado en tu negocio",
  "Responde en segundos por WhatsApp, 24/7",
  "Pagina web profesional incluida",
  "Reportes y analiticas en tiempo real",
  "Setup completo en 48 horas",
  "Soporte directo con el equipo",
];

export const ACTIVATION_PLANS: Record<ActivationPlanId, ActivationPlan> = {
  standard: {
    id: "standard",
    monthlyUsd: 99,
    nameEs: "Estandar",
    taglineEs: "Sofia AI + pagina web",
    features: SHARED_FEATURES,
    paypalUrl: "https://paypal.me/MachineMind/99USD",
  },
  premium: {
    id: "premium",
    monthlyUsd: 199,
    nameEs: "Premium",
    // Premium renders first, so the tagline stands on its own — it cannot
    // refer back to a tier the visitor has not read yet.
    taglineEs: "Sofia AI + pagina web + reservas automaticas",
    features: [...SHARED_FEATURES, "Sistema de reservas y citas automatizadas"],
    paypalUrl: "https://paypal.me/MachineMind/199USD",
  },
};

/** Premium leads the page: it is the tier that includes reservations. */
export const DEFAULT_ACTIVATION_PLAN: ActivationPlanId = "premium";

/**
 * Display order — Premium first so the page anchors on the tier that includes
 * reservations, which is the one we lead with in conversation.
 */
export const ACTIVATION_PLAN_ORDER: ActivationPlanId[] = ["premium", "standard"];

export function isActivationPlanId(value: unknown): value is ActivationPlanId {
  return value === "standard" || value === "premium";
}

export function getActivationPlan(id: ActivationPlanId): ActivationPlan {
  return ACTIVATION_PLANS[id];
}

/** "$199 USD" — one formatter so page, receipt and Telegram alert agree. */
export function formatUsd(amount: number): string {
  return `$${amount} USD`;
}
