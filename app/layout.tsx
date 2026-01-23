// @ts-nocheck
import './globals.css';

export const metadata = {
  title: 'Swim Order Form',
  description: 'Order your custom swag',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}