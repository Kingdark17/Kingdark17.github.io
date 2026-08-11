import type { Metadata } from 'next';
import { Cinzel, EB_Garamond, JetBrains_Mono } from 'next/font/google';

import './globals.css';

// As mesmas três famílias do jogo atual, mas auto-hospedadas pelo Next em vez
// de vindas do CDN do Google: o `<link>` do index.html custava um preconnect e
// um round-trip antes de qualquer texto aparecer.
const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['500', '700', '900'],
  variable: '--font-display',
  display: 'swap',
});

const garamond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-body',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RPG Legend',
  description: 'Jogo RPG/roguelike no navegador.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${cinzel.variable} ${garamond.variable} ${jetbrains.variable}`}>
        {children}
      </body>
    </html>
  );
}
