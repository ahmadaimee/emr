import type { Metadata } from 'next';
import { Geist_Mono, Instrument_Sans, Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', display: 'swap', weight: ['500', '600', '700'] });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Grove', template: '%s · Grove' },
  description: 'Practice management and revenue cycle',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${instrument.variable} ${geistMono.variable}`} data-density="compact" suppressHydrationWarning>
      <body style={{ ['--g-font-ui' as string]: 'var(--font-inter), system-ui, sans-serif', ['--g-font-display' as string]: 'var(--font-instrument), var(--font-inter), sans-serif', ['--g-font-mono' as string]: 'var(--font-geist-mono), ui-monospace, monospace' }}>
        {children}
      </body>
    </html>
  );
}
