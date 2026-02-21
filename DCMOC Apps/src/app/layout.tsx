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
