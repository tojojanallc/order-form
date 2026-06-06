import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Lev Kiosk Setup',
  description: 'Configure this iPad',
  manifest: '/manifest-setup.json',
  appleWebApp: {
    capable: true,
    title: 'Kiosk Setup',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: '/apple-touch-icon-setup.png',
  },
};

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
