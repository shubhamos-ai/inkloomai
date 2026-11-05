import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Inkloom AI — Advertising Compliance & Brand Governance',
  description: 'Your personalised AI advertising manager. Ensure brand compliance, detect violations, and maintain brand consistency across all advertising materials.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
