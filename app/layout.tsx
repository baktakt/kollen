import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Kollen — Privatekonomi',
  description: 'Din personliga ekonomiöversikt',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv" suppressHydrationWarning>
      <body className="font-sans bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
