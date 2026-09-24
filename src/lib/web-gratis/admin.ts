/**
 * Ops-board auth: a shared bearer token (WEB_GRATIS_ADMIN_TOKEN) for Phil +
 * Sergio. Fails closed — with no token configured, every admin call is refused.
 */
import { timingSafeEqual } from "crypto";
import { fail } from "./http";

export function requireAdmin(request: Request): Response | null {
  const token = process.env.WEB_GRATIS_ADMIN_TOKEN?.trim();
  if (!token || token.length < 24) return fail(503, "server_error", "admin token not configured");
  const given = Buffer.from((request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim());
  const expected = Buffer.from(token);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return fail(401, "invalid", "unauthorized");
  }
  return null;
}

export const BOARD_VIEWS = [
  "nuevo",
  "en_construccion",
  "entregada",
  "compartida",
  "activa",
  "cerradas",
  "borrador",
  "todas",
] as const;
export type BoardView = (typeof BOARD_VIEWS)[number];

/** Which statuses each board tab shows. */
export function statusesFor(view: BoardView): string[] | null {
  switch (view) {
    case "cerradas":
      return ["pausada", "cancelada", "descartada"];
    case "todas":
      return null;
    default:
      return [view];
  }
}
