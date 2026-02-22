import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WF - Multi-Tenant SaaS Platform',
  description: 'Multi-tenant SaaS platform with AI-powered insights',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
