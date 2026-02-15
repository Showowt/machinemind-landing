// MACHINEMIND DESIGN TOKENS
// Dark luxury aesthetic - Single source of truth

export const tokens = {
  // ============================================
  // COLORS - Dark Luxury Palette
  // ============================================
  colors: {
    // Brand - Cyan Blue
    background: "#0d0d14",
    cyan: {
      50: "#ecfeff",
      100: "#cffafe",
      200: "#a5f3fc",
      300: "#67e8f9",
      400: "#22d3ee",
      500: "#00a6ed", // Primary accent
      600: "#0084c7",
      700: "#0369a1",
      800: "#075985",
      900: "#0c4a6e",
    },
    // Legacy alias
    gold: {
      50: "#ecfeff",
      100: "#cffafe",
      200: "#a5f3fc",
      300: "#67e8f9",
      400: "#00a6ed", // Now cyan
      500: "#00a6ed",
      600: "#0084c7",
      700: "#0369a1",
      800: "#075985",
      900: "#0c4a6e",
    },
    // Neutrals (Dark luxury scale)
    neutral: {
      50: "#fafafa",
      100: "#f4f4f5",
      200: "#e4e4e7",
      300: "#d4d4d8",
      400: "#a1a1aa",
      500: "#71717a",
      600: "#52525b",
      700: "#3f3f46",
      800: "#27272a",
      850: "#1c1c24",
      900: "#18181b",
      950: "#0f0f1a", // Same as background
    },
    // Semantic
    success: "#22c55e",
    warning: "#eab308",
    error: "#ef4444",
    info: "#3b82f6",
    // System status
    healthy: "#22c55e",
    degraded: "#eab308",
    down: "#ef4444",
  },

  // ============================================
  // SPACING (8px base scale)
  // ============================================
  spacing: {
    0: "0",
    1: "0.25rem", // 4px
    2: "0.5rem", // 8px
    3: "0.75rem", // 12px
    4: "1rem", // 16px
    5: "1.25rem", // 20px
    6: "1.5rem", // 24px
    8: "2rem", // 32px
    10: "2.5rem", // 40px
    12: "3rem", // 48px
    14: "3.5rem", // 56px - minimum touch target
    16: "4rem", // 64px
    20: "5rem", // 80px
    24: "6rem", // 96px
    32: "8rem", // 128px
  },

  // ============================================
  // TYPOGRAPHY
  // ============================================
  typography: {
    fontFamily: {
      heading: "var(--font-playfair), Georgia, serif",
      body: "var(--font-inter), system-ui, sans-serif",
      mono: "ui-monospace, monospace",
    },
    fontSize: {
      xs: ["0.75rem", { lineHeight: "1rem" }],
      sm: ["0.875rem", { lineHeight: "1.25rem" }],
      base: ["1rem", { lineHeight: "1.5rem" }],
      lg: ["1.125rem", { lineHeight: "1.75rem" }],
      xl: ["1.25rem", { lineHeight: "1.75rem" }],
      "2xl": ["1.5rem", { lineHeight: "2rem" }],
      "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
      "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
      "5xl": ["3rem", { lineHeight: "1.1" }],
      "6xl": ["3.75rem", { lineHeight: "1.1" }],
      "7xl": ["4.5rem", { lineHeight: "1.05" }],
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },

  // ============================================
  // BORDERS - Square edges, no rounded
  // ============================================
  borders: {
    radius: {
      none: "0", // All components use square edges
    },
    width: {
      DEFAULT: "1px",
      2: "2px",
    },
  },

  // ============================================
  // SHADOWS - None (flat design)
  // ============================================
  shadows: {
    none: "none",
  },

  // ============================================
  // TRANSITIONS
  // ============================================
  transitions: {
    duration: {
      fast: "150ms",
      DEFAULT: "200ms",
      slow: "300ms",
      slower: "500ms",
    },
    timing: {
      DEFAULT: "cubic-bezier(0.4, 0, 0.2, 1)",
      in: "cubic-bezier(0.4, 0, 1, 1)",
      out: "cubic-bezier(0, 0, 0.2, 1)",
      bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
    },
  },

  // ============================================
  // Z-INDEX
  // ============================================
  zIndex: {
    canvas: 1,
    content: 10,
    dropdown: 50,
    sticky: 100,
    modal: 200,
    popover: 300,
    tooltip: 400,
    toast: 500,
    whatsapp: 600,
  },

  // ============================================
  // BREAKPOINTS
  // ============================================
  breakpoints: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },

  // ============================================
  // COMPONENT-SPECIFIC TOKENS
  // ============================================
  components: {
    button: {
      minHeight: "56px", // WCAG touch target
      paddingX: "1.5rem",
      paddingY: "0.75rem",
    },
    input: {
      minHeight: "48px",
      paddingX: "1rem",
      paddingY: "0.75rem",
    },
    card: {
      padding: "1.5rem",
      borderColor: "rgba(0, 166, 237, 0.2)", // cyan-500/20
    },
    header: {
      height: "80px",
      mobileHeight: "72px",
    },
    section: {
      paddingY: "6rem",
      mobilePaddingY: "4rem",
    },
  },
} as const;

// Type exports
export type ColorScale = typeof tokens.colors.gold;
export type SpacingScale = typeof tokens.spacing;
export type BreakpointScale = typeof tokens.breakpoints;

// CSS variable helpers
export const cssVars = {
  background: "var(--mm-background)",
  gold: "var(--mm-gold)",
  text: "var(--mm-text)",
  textMuted: "var(--mm-text-muted)",
} as const;
