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

export const cleanCorporate = {
  id: "clean-corporate",
  label: "Clean Corporate",

  canvas: {
    width: 800,
    background: "#f8fafc",
    padding: "24px 32px",
  },

  header: {
    layout: "top-banner",
    background: "#eff6ff",
    titleFont: "Inter, sans-serif",
    titleSize: "28px",
    titleWeight: "700",
    titleColor: "#0f172a",
    titleTransform: "none",
    subtitleFont: "Inter, sans-serif",
    subtitleSize: "12px",
    subtitleColor: "#1d4ed8",
    subtitleTransform: "uppercase",
    subtitleLetterSpacing: "0.1em",
    sidebar: { enabled: false },
  },

  columnHeader: {
    background: "transparent",
    font: "Inter, sans-serif",
    fontSize: "10px",
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    paddingY: "10px",
  },

  row: {
    paddingY: "12px",
    paddingX: "12px",
    font: "Inter, sans-serif",
    fontSize: "13px",
    fontWeight: "500",
    color: "#0f172a",
    borderBottom: "1px solid #e2e8f0",
    oddBackground: "#ffffff",
    evenBackground: "#f1f5f9",
  },

  rankOverrides: {
    1: {
      background: "#dbeafe",
      borderLeft: "4px solid #2563eb",
      rankColor: "#1d4ed8",
      rankFontWeight: "700",
    },
    2: {
      background: "transparent",
      rankColor: "#475569",
      rankFontWeight: "700",
    },
    3: {
      background: "transparent",
      rankColor: "#64748b",
      rankFontWeight: "700",
    },
  },

  rank: {
    font: "Inter, sans-serif",
    fontSize: "14px",
    fontWeight: "600",
    color: "#475569",
    width: "36px",
  },

  footer: {
    enabled: true,
    layout: "centered",
    background: "transparent",
    font: "Inter, sans-serif",
    fontSize: "10px",
    color: "#64748b",
    paddingTop: "16px",
  },
};

export const minimalistDark = {
  id: "minimalist-dark",
  label: "Minimalist Dark",

  canvas: {
    width: 800,
    background: "#09090b",
    padding: "32px 32px",
  },

  header: {
    layout: "centered",
    background: "transparent",
    titleFont: "Inter, sans-serif",
    titleSize: "26px",
    titleWeight: "700",
    titleColor: "#fafafa",
    titleTransform: "none",
    subtitleFont: "Inter, sans-serif",
    subtitleSize: "11px",
    subtitleColor: "#a1a1aa",
    subtitleTransform: "uppercase",
    subtitleLetterSpacing: "0.15em",
    sidebar: { enabled: false },
  },

  columnHeader: {
    background: "transparent",
    font: "Inter, sans-serif",
    fontSize: "9px",
    fontWeight: "600",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: "0.15em",
    paddingY: "8px",
  },

  row: {
    paddingY: "14px",
    paddingX: "8px",
    font: "Inter, sans-serif",
    fontSize: "13px",
    fontWeight: "400",
    color: "#e4e4e7",
    borderBottom: "1px solid #27272a",
    oddBackground: "transparent",
    evenBackground: "transparent",
  },

  rankOverrides: {
    1: {
      background: "transparent",
      borderLeft: "2px solid #fafafa",
      rankColor: "#ffffff",
      rankFontWeight: "700",
    },
  },

  rank: {
    font: "Inter, sans-serif",
    fontSize: "13px",
    fontWeight: "400",
    color: "#71717a",
    width: "30px",
  },

  footer: {
    enabled: true,
    layout: "right",
    background: "transparent",
    font: "Inter, sans-serif",
    fontSize: "10px",
    color: "#71717a",
    paddingTop: "20px",
  },
};

export const minimalistLight = {
  id: "minimalist-light",
  label: "Minimalist Light",

  canvas: {
    width: 800,
    background: "#ffffff",
    padding: "32px 40px",
  },

  header: {
    layout: "sidebar-left",
    background: "transparent",
    titleFont: "Inter, sans-serif",
    titleSize: "28px",
    titleWeight: "700",
    titleColor: "#18181b",
    titleTransform: "none",
    subtitleFont: "Inter, sans-serif",
    subtitleSize: "11px",
    subtitleColor: "#71717a",
    subtitleTransform: "uppercase",
    subtitleLetterSpacing: "0.15em",
    sidebar: {
      enabled: true,
      text: null,
      color: "#18181b",
      font: "Inter, sans-serif",
      fontSize: "11px",
      fontWeight: "700",
      letterSpacing: "0.2em",
    },
  },

  columnHeader: {
    background: "transparent",
    font: "Inter, sans-serif",
    fontSize: "9px",
    fontWeight: "600",
    color: "#a1a1aa",
    textTransform: "uppercase",
    letterSpacing: "0.15em",
    paddingY: "10px",
  },

  row: {
    paddingY: "16px",
    paddingX: "8px",
    font: "Inter, sans-serif",
    fontSize: "13px",
    fontWeight: "400",
    color: "#18181b",
    borderBottom: "1px solid #e4e4e7",
    oddBackground: "transparent",
    evenBackground: "transparent",
  },

  rankOverrides: {
    1: {
      background: "transparent",
      borderLeft: "2px solid #18181b",
      rankColor: "#18181b",
      rankFontWeight: "700",
    },
  },

  rank: {
    font: "Inter, sans-serif",
    fontSize: "13px",
    fontWeight: "400",
    color: "#a1a1aa",
    width: "32px",
  },

  footer: {
    enabled: true,
    layout: "left",
    background: "transparent",
    font: "Inter, sans-serif",
    fontSize: "10px",
    color: "#a1a1aa",
    paddingTop: "20px",
  },
};

export const GFX_TEMPLATES = [darkOps, cleanSheet, cleanCorporate, minimalistDark, minimalistLight];

export const getTemplateById = (id) =>
  GFX_TEMPLATES.find((t) => t.id === id) ?? GFX_TEMPLATES[0];
