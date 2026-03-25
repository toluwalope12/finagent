// app/layout.tsx
import type { Metadata } from 'next';
import { UserProvider } from '@auth0/nextjs-auth0/client';
import './globals.css';

export const metadata: Metadata = {
  title: 'FinAgent — Your Financial Story, Your Control',
  description: 'AI-powered credit dossiers for informal economy workers in Nigeria. Built with Auth0 Token Vault.',
  openGraph: {
    title: 'FinAgent',
    description: 'Financial dignity for 50 million Nigerians.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
