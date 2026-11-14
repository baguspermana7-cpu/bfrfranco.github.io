import { createContext, useContext, useState, useEffect, useMemo } from "react";

/* ══════════════════════════════════════════════
   DARK & LIGHT COLOR PALETTES
   Carefully designed for readability, contrast,
   and visual harmony in both modes
   ══════════════════════════════════════════════ */

// Values MIRROR css/rz-finance-suite.css (--fs-*): this is a built bundle and cannot read the runtime tokens.
// Graphite surfaces, 1px hairlines, ONE amber accent (--fs-amb). No violet anywhere (CLAUDE.md rejected #3;
// tools/test-rz-ops-theme.mjs T7 checks every painted colour by HUE). "pur" is the app's second-series
// key: it is blue now, the name stays so 23 call sites do not churn. "amb" is the warning orange so it
// stays distinct from the amber accent in the Bear/Consv/Base/Bull/Opti scenario sets.
const darkColors = {
  bg:   "#0e0f12",   // --fs-bg0
  sf:   "#16181d",   // --fs-bg2
  sf2:  "#121316",   // --fs-bg3
  sf3:  "#1c1f25",
  bd:   "#2a2d34",   // --fs-bd
  bd2:  "#3a3e47",
  acc:  "#fbbf24",   // --fs-amb (dark)
  accH: "#fcd34d",
  grn:  "#34d399",
  grnH: "#6ee7b7",
  red:  "#f87171",
  redH: "#fca5a5",
  amb:  "#fb923c",
  ambH: "#fdba74",
  pur:  "#60a5fa",   // second series (--fs-blu)
  purH: "#93c5fd",
  cyn:  "#22d3ee",
  cynH: "#67e8f9",
  pnk:  "#f472b6",
  t1:   "#f1f5f9",   // --fs-t1
  t2:   "#969eaa",   // --fs-t3
  t3:   "#808998",   // --fs-t4
  inp:  "#121316",
  ov:   "rgba(0,0,0,0.6)",
  sh:   "none",
  sh2:  "none",
  ttBg: "#16181d",
  grd:  "none",
};

const lightColors = {
  bg:   "#f8f9fa",   // --fs-bg0 (light)
  sf:   "#ffffff",
  sf2:  "#f1f5f9",
  sf3:  "#e2e8f0",
  bd:   "#e2e8f0",
  bd2:  "#cbd5e1",
  acc:  "#92400e",   // --fs-amb (light): AA as text on white
  accH: "#78350f",
  grn:  "#047857",
  grnH: "#065f46",
  red:  "#b91c1c",
  redH: "#991b1b",
  amb:  "#c2410c",
  ambH: "#9a3412",
  pur:  "#1d4ed8",
  purH: "#1e40af",
  cyn:  "#155e75",
  cynH: "#164e63",
  pnk:  "#be185d",
  t1:   "#0f172a",
  t2:   "#475569",
  t3:   "#5b6577",
  inp:  "#f1f5f9",
  ov:   "rgba(15,23,42,0.35)",
  sh:   "none",
  sh2:  "none",
  ttBg: "#ffffff",
  grd:  "none",
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      // Embedded in the rz-ops console: start on the console's theme (FINANCE_SUITE_STANDARD.md §Theme sync).
      if (window.parent !== window) {
        const host = localStorage.getItem("rz_admin_theme");
        if (host === "light" || host === "dark") return host;
      }
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
      if (e.origin !== window.location.origin) return;
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
    meta.content = mode === "dark" ? "#0e0f12" : "#f8f9fa";
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
