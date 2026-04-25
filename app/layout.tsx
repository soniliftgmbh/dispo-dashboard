import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider, themeInitScript } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Anna — Disposition | Sonilift',
  description: 'Wartungsplanung Disposition',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-bg-subtle text-ink antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
