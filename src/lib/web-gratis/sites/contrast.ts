/**
 * WCAG 2.x contrast math + the palette fixer for generated client sites.
 *
 * Pure and client-safe: the ops board imports it for the live contrast warning
 * while Phil edits colors, and the generator runs `fixPalette` on every palette
 * the model returns (and on every palette edit) before it is saved.
 *
 * The fixer never touches the brand colors (primary / accent / bg): it only
 * nudges the colors text is drawn in (text, muted, primaryText) toward black or
 * white until they reach AA, and — only when no text color can pass on both
 * backgrounds at once — pulls `surface` toward `bg`.
 */

export interface PaletteColors {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  primaryText: string;
  accent: string;
}

/** WCAG AA for normal-size text. */
export const AA_TEXT = 4.5;
/** WCAG AA for large text and UI component boundaries. */
export const AA_LARGE = 3;

const HEX_RE = /^#([0-9a-f]{6})$/i;

export function isHex(value: string): boolean {
  return HEX_RE.test(value);
}

function toRgb(hex: string): [number, number, number] {
  const m = HEX_RE.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: readonly number[]): string {
  return `#${rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("")}`;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two colors (1 … 21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Linear mix of `from` toward `to` (t = 0 → from, t = 1 → to), in sRGB. */
export function mix(from: string, to: string, t: number): string {
  const a = toRgb(from);
  const b = toRgb(to);
  return toHex(a.map((c, i) => c + (b[i] - c) * t));
}

const BLACK = "#000000";
const WHITE = "#ffffff";

function worst(color: string, against: readonly string[]): number {
  return Math.min(...against.map((bg) => contrastRatio(color, bg)));
}

/**
 * The closest color to `fg` (moving toward black or white) that reaches `min`
 * against every color in `against`. When neither direction can, returns the
 * endpoint (black or white) with the better worst-case ratio.
 */
export function ensureContrast(fg: string, against: readonly string[], min: number): { color: string; ok: boolean } {
  const start = fg.toLowerCase();
  if (worst(start, against) >= min) return { color: start, ok: true };
  let best: { color: string; t: number } | null = null;
  for (const target of [BLACK, WHITE]) {
    for (let step = 1; step <= 50; step++) {
      const t = step / 50;
      const candidate = mix(start, target, t);
      if (worst(candidate, against) >= min) {
        if (!best || t < best.t) best = { color: candidate, t };
        break;
      }
    }
  }
  if (best) return { color: best.color, ok: true };
  const endpoint = worst(BLACK, against) >= worst(WHITE, against) ? BLACK : WHITE;
  return { color: endpoint, ok: worst(endpoint, against) >= min };
}

export interface ContrastCheck {
  pair: "text/bg" | "text/surface" | "muted/bg" | "muted/surface" | "primaryText/primary" | "primary/bg" | "accent/bg";
  ratio: number;
  min: number;
  ok: boolean;
  /** Only text pairs are enforced; the brand pairs are advisory. */
  enforced: boolean;
}

/** Every pair the renderer relies on, with its ratio (rounded to 2 decimals). */
export function paletteReport(p: PaletteColors): ContrastCheck[] {
  const row = (pair: ContrastCheck["pair"], a: string, b: string, min: number, enforced: boolean): ContrastCheck => {
    const ratio = Math.round(contrastRatio(a, b) * 100) / 100;
    return { pair, ratio, min, ok: ratio >= min, enforced };
  };
  return [
    row("text/bg", p.text, p.bg, AA_TEXT, true),
    row("text/surface", p.text, p.surface, AA_TEXT, true),
    row("muted/bg", p.muted, p.bg, AA_TEXT, true),
    row("muted/surface", p.muted, p.surface, AA_TEXT, true),
    row("primaryText/primary", p.primaryText, p.primary, AA_TEXT, true),
    row("primary/bg", p.primary, p.bg, AA_LARGE, false),
    row("accent/bg", p.accent, p.bg, AA_LARGE, false),
  ];
}

/**
 * Bring a palette to WCAG AA for every text pair. Returns the fixed palette
 * (all colors lower-case) and a Spanish line per change, for the team.
 */
export function fixPalette(input: PaletteColors): { palette: PaletteColors; fixes: string[] } {
  const p: PaletteColors = {
    bg: input.bg.toLowerCase(),
    surface: input.surface.toLowerCase(),
    text: input.text.toLowerCase(),
    muted: input.muted.toLowerCase(),
    primary: input.primary.toLowerCase(),
    primaryText: input.primaryText.toLowerCase(),
    accent: input.accent.toLowerCase(),
  };
  const fixes: string[] = [];
  const note = (label: string, from: string, to: string, against: string) => {
    if (from !== to) fixes.push(`${label} ${from} → ${to} (contraste ${contrastRatio(to, against).toFixed(2)}:1)`);
  };

  // Text must read on both page and card backgrounds. If no text color can,
  // the card background moves toward the page background (never the brand colors).
  let text = ensureContrast(p.text, [p.bg, p.surface], AA_TEXT);
  if (!text.ok) {
    const onBg = ensureContrast(p.text, [p.bg], AA_TEXT).color;
    let surface = p.surface;
    for (let step = 1; step <= 20 && contrastRatio(onBg, surface) < AA_TEXT; step++) surface = mix(p.surface, p.bg, step / 20);
    note("Fondo de tarjetas", p.surface, surface, onBg);
    p.surface = surface;
    text = ensureContrast(onBg, [p.bg, p.surface], AA_TEXT);
  }
  note("Texto", p.text, text.color, p.bg);
  p.text = text.color;

  const muted = ensureContrast(p.muted, [p.bg, p.surface], AA_TEXT);
  note("Texto secundario", p.muted, muted.color, p.bg);
  p.muted = muted.color;

  const onPrimary = ensureContrast(p.primaryText, [p.primary], AA_TEXT);
  note("Texto de botones", p.primaryText, onPrimary.color, p.primary);
  p.primaryText = onPrimary.color;

  return { palette: p, fixes };
}
