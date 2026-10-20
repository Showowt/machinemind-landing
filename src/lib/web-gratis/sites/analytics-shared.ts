/** Client-safe contract for the bounded JA aggregate analytics pilot. */
export const JA_ANALYTICS_SITE_ID = "65005b57-c4bd-4837-8420-8fb6c2d9e283";
export const JA_ANALYTICS_SIGNUP_ID = "1afdbfc5-8703-4ecd-9405-fa2aebb4d708";
export const JA_QA_PATH_PREFIX = "/__mm_qa__/ja/";
export const JA_QA_RUN_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
export function isJaQaRunId(value: string): boolean {
  // JavaScript `$` can match before a trailing newline; require the whole input.
  return JA_QA_RUN_RE.exec(value)?.[0] === value;
}
export const JA_QA_WINDOW_DAYS = 7;
export const SITE_EVENT_KINDS = ["view", "whatsapp_click", "call_click", "map_click", "social_click", "email_click"] as const;
export type SiteEventKind = (typeof SITE_EVENT_KINDS)[number];

export interface JaQaRunStats {
  siteId: typeof JA_ANALYTICS_SITE_ID;
  runId: string;
  synthetic: true;
  excludedFromBusinessTotals: true;
  windowStart: string;
  windowEnd: string;
  observedAt: string;
  counts: Record<SiteEventKind, number>;
  latestAt: string | null;
}

export function isJaAnalyticsBinding(siteId: string, signupId: string): boolean {
  return siteId === JA_ANALYTICS_SITE_ID && signupId === JA_ANALYTICS_SIGNUP_ID;
}
