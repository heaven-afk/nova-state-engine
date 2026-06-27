// /src/gfx-templates.js

export const darkOps = {
  id: "dark-ops",
  label: "Dark Ops",

  // Canvas
  canvas: {
    width: 800,
    background: "#0d0d1a",
    padding: "24px 32px",
  },

  // Header block
  header: {
    layout: "sidebar-left",         // "sidebar-left" | "centered" | "top-banner"
    background: "transparent",
    titleFont: "Rajdhani, sans-serif",
    titleSize: "32px",
    titleWeight: "700",
    titleColor: "#ffffff",
    titleTransform: "uppercase",
    subtitleFont: "Inter, sans-serif",
    subtitleSize: "11px",
    subtitleColor: "#9b9bb4",
    subtitleTransform: "uppercase",
    subtitleLetterSpacing: "0.2em",
    sidebar: {
      enabled: true,
      text: null,                   // null = use event name from UI controls
      color: "#c0392b",
      font: "Rajdhani, sans-serif",
      fontSize: "13px",
      fontWeight: "700",
      letterSpacing: "0.25em",
    },
  },

  // Column headers row
  columnHeader: {
    background: "transparent",
    font: "Inter, sans-serif",
    fontSize: "10px",
    fontWeight: "600",
    color: "#9b9bb4",
    textTransform: "uppercase",
    letterSpacing: "0.15em",
    paddingY: "8px",
  },

  // Data rows
  row: {
    paddingY: "14px",
    paddingX: "12px",
    font: "Inter, sans-serif",
    fontSize: "14px",
    fontWeight: "500",
    color: "#ffffff",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    oddBackground: "rgba(255,255,255,0.03)",
    evenBackground: "rgba(255,255,255,0.07)",
  },

  // Per-rank overrides (index = rank number, 1-based)
  rankOverrides: {
    1: {
      background: "rgba(192,57,43,0.08)",
      borderLeft: "3px solid #c0392b",
      rankColor: "#c0392b",
      rankFontWeight: "700",
      glowEffect: "0 0 24px rgba(192,57,43,0.25)",   // box-shadow on row
    },
    2: {
      background: "transparent",
      borderLeft: "3px solid #8e44ad",
      rankColor: "#8e44ad",
      rankFontWeight: "700",
    },
    3: {
      background: "transparent",
      borderLeft: "3px solid #8e44ad",
      rankColor: "#8e44ad",
      rankFontWeight: "700",
    },
  },

  // Rank number cell
  rank: {
    font: "Rajdhani, sans-serif",
    fontSize: "16px",
    fontWeight: "700",
    color: "#ffffff",             // default; overridden by rankOverrides
    width: "36px",
  },

  // Footer
  footer: {
    enabled: true,
    layout: "right",              // "right" | "centered" | "left"
    background: "transparent",
    font: "Inter, sans-serif",
    fontSize: "11px",
    color: "#9b9bb4",
    paddingTop: "16px",
  },
};

export const cleanSheet = {
  id: "clean-sheet",
  label: "Clean Sheet",

  canvas: {
    width: 800,
    background: "#1a0533",
    padding: "32px 40px",
  },

  header: {
    layout: "centered",
    background: "transparent",
    titleFont: "Bebas Neue, Oswald, sans-serif",
    titleSize: "40px",
    titleWeight: "400",
    titleColor: "#ffffff",
    titleTransform: "uppercase",
    subtitleFont: "Inter, sans-serif",
    subtitleSize: "12px",
    subtitleColor: "#f5c518",
    subtitleTransform: "uppercase",
    subtitleLetterSpacing: "0.2em",
    sidebar: { enabled: false },
  },

  columnHeader: {
    background: "transparent",
    font: "Inter, sans-serif",
    fontSize: "10px",
    fontWeight: "600",
    color: "#a78bbb",
    textTransform: "uppercase",
    letterSpacing: "0.15em",
    paddingY: "10px",
  },

  row: {
    paddingY: "18px",
    paddingX: "16px",
    font: "Inter, sans-serif",
    fontSize: "14px",
    fontWeight: "500",
    color: "#ffffff",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    oddBackground: "transparent",
    evenBackground: "rgba(255,255,255,0.03)",
  },

  rankOverrides: {
    1: {
      background: "rgba(245,197,24,0.08)",
      borderLeft: "3px solid #f5c518",
      rankColor: "#f5c518",
      rankFontWeight: "700",
      glowEffect: null,
    },
    2: {
      background: "transparent",
      rankColor: "#c0c0c0",
      rankFontWeight: "700",
    },
    3: {
      background: "transparent",
      rankColor: "#cd7f32",
      rankFontWeight: "700",
    },
  },

  rank: {
    font: "Bebas Neue, Oswald, sans-serif",
    fontSize: "20px",
    fontWeight: "400",
    color: "#ffffff",
    width: "40px",
  },

  footer: {
    enabled: true,
    layout: "centered",
    background: "transparent",
    font: "Inter, sans-serif",
    fontSize: "11px",
    color: "#a78bbb",
    paddingTop: "20px",
  },
};

export const GFX_TEMPLATES = [darkOps, cleanSheet];

export const getTemplateById = (id) =>
  GFX_TEMPLATES.find((t) => t.id === id) ?? GFX_TEMPLATES[0];
