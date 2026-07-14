import { createContext, useContext, useState, useEffect, useMemo } from "react";

/* ══════════════════════════════════════════════
   DARK & LIGHT COLOR PALETTES
   Carefully designed for readability, contrast,
   and visual harmony in both modes
   ══════════════════════════════════════════════ */

const darkColors = {
  // Backgrounds — RZ finance-suite canonical tokens (css/rz-finance-suite.css)
  bg:   "#0b1120",   // page (--fs-bg0)
  sf:   "#1e293b",   // card / surface (--fs-bg2)
  sf2:  "#0f172a",   // inset / well (--fs-bg3)
  sf3:  "#334155",   // raised
  // Borders
  bd:   "#334155",   // 1px hairline (--fs-bd)
  bd2:  "#475569",
  // Accent & semantic
  acc:  "#8b5cf6",
  accH: "#a78bfa",
  grn:  "#34d399",
  grnH: "#6ee7b7",
  red:  "#f87171",
  redH: "#fca5a5",
  amb:  "#fbbf24",
  ambH: "#fcd34d",
  pur:  "#8b5cf6",
  purH: "#a78bfa",
  cyn:  "#22d3ee",
  cynH: "#67e8f9",
  pnk:  "#f472b6",
  // Text
  t1:   "#f1f5f9",   // bright (--fs-t1)
  t2:   "#94a3b8",   // muted (--fs-t3)
  t3:   "#64748b",   // dim (--fs-t4)
  // Input
  inp:  "#0f172a",
  // Overlay
  ov:   "rgba(0,0,0,0.5)",
  // Shadow
  sh:   "0 2px 8px rgba(0,0,0,0.3)",
  sh2:  "0 8px 24px rgba(0,0,0,0.25)",
  // Chart tooltip
  ttBg: "#1e293b",
  // Gradient overlay for cards
  grd:  "linear-gradient(135deg, rgba(139,92,246,0.06) 0%, transparent 50%)",
};

const lightColors = {
  // Backgrounds — RZ finance-suite canonical light tokens
  bg:   "#f8fafc",   // page (--fs-bg0)
  sf:   "#ffffff",   // card / surface
  sf2:  "#f1f5f9",   // inset / well (--fs-bg3)
  sf3:  "#e2e8f0",
  // Borders
  bd:   "#e2e8f0",   // hairline (--fs-bd)
  bd2:  "#cbd5e1",
  // Accent & semantic — canonical accents; darker hover for contrast on white
  acc:  "#8b5cf6",
  accH: "#7c3aed",
  grn:  "#34d399",
  grnH: "#10b981",
  red:  "#f87171",
  redH: "#ef4444",
  amb:  "#fbbf24",
  ambH: "#f59e0b",
  pur:  "#8b5cf6",
  purH: "#7c3aed",
  cyn:  "#22d3ee",
  cynH: "#06b6d4",
  pnk:  "#ec4899",
  // Text — dark text on light backgrounds
  t1:   "#0f172a",   // bright (--fs-t1 light)
  t2:   "#475569",   // muted (--fs-t3 light)
  t3:   "#64748b",   // dim (--fs-t4 light)
  // Input
  inp:  "#f1f5f9",
  // Overlay
  ov:   "rgba(0,0,0,0.15)",
  // Shadow
  sh:   "0 1px 3px rgba(0,0,0,0.08)",
  sh2:  "0 4px 12px rgba(0,0,0,0.06)",
  // Chart tooltip
  ttBg: "#ffffff",
  // Gradient overlay for cards
  grd:  "linear-gradient(135deg, rgba(139,92,246,0.03) 0%, transparent 50%)",
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem("dca-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    // Default to system preference
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches) {
      return "light";
    }
    return "dark";
  });

  // Listen for theme sync from parent (admin console iframe host)
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'theme-sync') {
        const t = e.data.theme === 'light' ? 'light' : 'dark';
        setMode(t);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("dca-theme", mode); } catch {}
    document.documentElement.setAttribute("data-theme", mode);
    // Set meta theme-color for mobile browser chrome
    const meta = document.querySelector('meta[name="theme-color"]') || document.createElement("meta");
    meta.name = "theme-color";
    meta.content = mode === "dark" ? "#0b1120" : "#f8fafc";
    if (!meta.parentNode) document.head.appendChild(meta);
  }, [mode]);

  const toggle = () => setMode(m => m === "dark" ? "light" : "dark");

  const cs = useMemo(() => ({
    ...(mode === "dark" ? darkColors : lightColors),
    f: "'IBM Plex Sans',system-ui,-apple-system,sans-serif",
    m: "'IBM Plex Mono',ui-monospace,monospace",
    isDark: mode === "dark",
  }), [mode]);

  return (
    <ThemeContext.Provider value={{ cs, mode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export default ThemeContext;
