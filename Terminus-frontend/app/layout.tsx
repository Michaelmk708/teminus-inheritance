import type { Metadata } from 'next';
import { Cormorant_Garamond, DM_Mono, Instrument_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
});

const instrument = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-instrument',
});

export const metadata: Metadata = {
  title: 'Terminus — Digital Inheritance Protocol',
  description:
    'A decentralized digital inheritance protocol. Where immutable cryptography meets human empathy.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${cormorant.variable} ${dmMono.variable} ${instrument.variable} font-sans bg-ink text-cream antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}