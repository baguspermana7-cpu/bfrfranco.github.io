import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: "class",
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/modules/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                // resistancezero SEMANTIC instrument palette (design.md §5) —
                // color signals STATE, not decoration. Enables bg-rz-* /
                // text-rz-* / border-rz-* utilities.
                rz: {
                    base: "var(--rz-bg-base)",
                    elevated: "var(--rz-bg-elevated)",
                    overlay: "var(--rz-bg-overlay)",
                    signal: "var(--rz-accent-signal)",   // caution / estimate / CTA / active
                    data: "var(--rz-accent-data)",       // engine-sourced / confirmed / online
                    info: "var(--rz-accent-info)",       // derived / measured / headers
                    alert: "var(--rz-accent-alert)",     // risk / restricted / delete
                    mint: "var(--rz-accent-mint)",       // user input (neutral interactive)
                },
            },
            borderColor: {
                "rz-1": "var(--rz-line-tier-1)",
                "rz-2": "var(--rz-line-tier-2)",
                "rz-3": "var(--rz-line-tier-3)",
            },
            fontFamily: {
                sans: ["var(--font-ibm-plex-sans)", "Segoe UI", "system-ui", "-apple-system", "sans-serif"],
                mono: ["var(--font-jetbrains-mono)", "SF Mono", "Cascadia Code", "Consolas", "monospace"],
            },
        },
    },
    plugins: [],
};
export default config;
