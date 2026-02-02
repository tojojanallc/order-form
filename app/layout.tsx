export const metadata = {
  title: "Lev Custom Merch Kiosk",
  description: "Self-service kiosk for custom gear",
  manifest: "/manifest.json", // We will create this next
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lev Kiosk",
  },
  // This viewport setting prevents users from zooming in by accident
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false, 
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}