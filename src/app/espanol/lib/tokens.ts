// ── Español OS Design Tokens ──────────────────────��──────────────────────────

export const T = {
  bg:      "#0F0E0C",
  s1:      "#181613",
  s2:      "#221F1B",
  s3:      "#2C2924",
  border:  "#302D29",
  gold:    "#C9A84C",
  goldL:   "#E8C96A",
  goldD:   "#7A6230",
  cream:   "#EDE8E0",
  cream2:  "#A09485",
  cream3:  "#5A5248",
  green:   "#5EAB7A",
  red:     "#C97070",
  blue:    "#7B9CDE",
  orange:  "#DE9B5A",
  purple:  "#A87CC9",
} as const;

export type TokenKey = keyof typeof T;
