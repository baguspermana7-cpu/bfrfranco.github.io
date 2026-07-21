import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Shell } from '@/components/layout/Shell';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'DCMOC - Data Center M&O Calculator',
  description: 'Advanced Operational Simulation Engine using ResistanceZero Pro standards.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        {/* Shared RZEngine v2.4.0 (site root — absolute path is NOT rewritten by
            basePath). Defer in <head> executes before Next's deferred body
            bundles, so window.RZEngine exists when store modules evaluate.
            Consumed via src/lib/rz-engine.ts (with local fallbacks). v2.4.0 adds
            the DC-OS Layer engines: reliability/site/commissioning/asset/
            construction/requirements/architecture. */}
        <script src="/rz-engine.min.js?v=2026-07-21-e" defer></script>
        {/* Shared RZExplain knowledge DB (window.RZ_EXPLAIN_DB, 802 entries) —
            consumed via src/lib/explain.ts + <Explain k="..."/> (SSR-guarded,
            renders nothing when absent). */}
        <script src="/js/rz-explain-db.js?v=2026-07-19-cc" defer></script>
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ThemeProvider defaultTheme="dark" storageKey="dcmoc-theme">
          <Shell>
            {children}
          </Shell>
        </ThemeProvider>
      </body>
    </html>
  );
}
