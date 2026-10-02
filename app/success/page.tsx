'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// 1. The Logic Component (Wrapped in Suspense below)
function SuccessContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Verifying...');
  const [orderId, setOrderId] = useState('');
  const onPhone = searchParams.get('phone') === '1';   // paid on the customer's own phone (kiosk QR code)
  const cancelled = searchParams.get('cancelled') === '1';

  useEffect(() => {
    if (typeof window !== 'undefined' && !onPhone) localStorage.removeItem('cart');
    if (cancelled) { setStatus('Payment cancelled'); return; }
    // Confirm this exact checkout with Stripe (marks only its own order paid)
    const sessionId = searchParams.get('session_id');
    if (!sessionId) { setStatus('Order Received!'); return; }
    fetch(`/api/phone-pay?session=${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(d => { setStatus(d.paid ? 'Payment Confirmed!' : 'Order Received!'); if (d.orderId) setOrderId(String(d.orderId)); })
      .catch(() => setStatus('Order Received!'));
  }, [searchParams]);

  if (onPhone) return (
    <div className="bg-white p-10 rounded-3xl shadow-xl max-w-lg w-full">
        <div className="text-6xl mb-4">{cancelled ? '↩️' : '🎉'}</div>
        <h1 className="text-3xl font-black text-[#0a2342] mb-2">{cancelled ? 'No charge made' : status === 'Verifying...' ? 'Confirming…' : "You're paid!"}</h1>
        {orderId && <p className="text-2xl font-mono font-black text-[#0a2342] bg-gray-100 inline-block px-4 py-1 rounded-xl mb-4">#{orderId}</p>}
        <p className="text-gray-500 text-lg">{cancelled ? 'Head back to the kiosk to try again.' : "The kiosk will show you're all set. We'll text you when your gear is ready."}</p>
        <img src="https://levcustom.com/logo_black.png" alt="Lev Custom Merch" className="h-10 mx-auto mt-8 opacity-80" onError={e => { e.currentTarget.style.display = 'none'; }} />
    </div>
  );

  return (
    <div className="bg-white p-10 rounded-xl shadow-xl max-w-lg w-full">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-3xl font-black text-blue-900 mb-2">Thank You!</h1>
        <p className="text-xl text-gray-600 font-bold mb-6">{status}</p>
        <p className="text-gray-500 mb-8">
          Your order has been sent to the printer.
        </p>
        <Link href="/" className="bg-blue-600 text-white font-bold py-3 px-8 rounded hover:bg-blue-700 transition">
          Return Home
        </Link>
    </div>
  );
}

// 2. The Main Page Component (With Suspense Boundary)
export default function SuccessPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-4">
      <Suspense fallback={<div className="text-blue-900 font-bold text-xl">Loading confirmation...</div>}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}