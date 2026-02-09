import './globals.css'; // <--- THIS WAS MISSING. It loads Tailwind/CSS.

export const metadata = {
  title: "Lev Custom Merch Kiosk",
  description: "Self-service kiosk for custom gear",
  manifest: "/manifest.json", 
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lev Kiosk",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, 
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}