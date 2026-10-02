import { Inter, Outfit } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800', '900'] });
// Lev's heading font (same as portal.levcustom.com)
const outfit = Outfit({ subsets: ['latin'], weight: ['600', '700', '800', '900'], variable: '--font-lev-heading' });

export const metadata = {
  title: "Lev Custom Merch Kiosk",
  description: "Self-service kiosk for custom gear",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lev Kiosk",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a2342",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${outfit.variable} antialiased`}>{children}</body>
    </html>
  );
}
