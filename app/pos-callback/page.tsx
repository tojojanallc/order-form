'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function PosCallback() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error' | 'cancelled'>('processing');
  const [message, setMessage] = useState('Processing payment...');
  const [orderId, setOrderId] = useState('');

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Parse Square POS callback — iOS sends data as JSON in ?data= param
        const dataParam = searchParams.get('data');
        const errorCode = searchParams.get('error_code');

        // Handle cancellation
        if (errorCode === 'CANCELED' || errorCode === 'USER_NOT_LOGGED_IN') {
          setStatus('cancelled');
          setMessage(errorCode === 'CANCELED' ? 'Payment was cancelled.' : 'Please log in to the Square POS app first.');
          return;
        }

        if (errorCode) {
          setStatus('error');
          setMessage(`Payment failed: ${errorCode.replace(/_/g, ' ')}`);
          return;
        }

        if (!dataParam) {
          setStatus('error');
          setMessage('No payment data received.');
          return;
        }

        const data = JSON.parse(decodeURIComponent(dataParam));

        // Check for errors in data object
        if (data.error_code) {
          if (data.error_code === 'CANCELED') {
            setStatus('cancelled');
            setMessage('Payment was cancelled.');
            return;
          }
          setStatus('error');
          setMessage(`Payment failed: ${data.error_code.replace(/_/g, ' ')}`);
          return;
        }

        // Success — get the order ID we stashed in localStorage before handoff
        const pendingOrderId = localStorage.getItem('pos_pending_order_id');
        const pendingOrderTotal = localStorage.getItem('pos_pending_order_total');
        const transactionId = data.transaction_id || data.client_transaction_id || 'unknown';

        if (pendingOrderId) {
          setOrderId(pendingOrderId);

          // Update order status to completed
          await supabase.from('orders').update({
            status: 'completed',
            payment_status: 'paid',
            payment_method: 'bluetooth_reader',
            square_transaction_id: transactionId,
          }).eq('id', pendingOrderId);

          // Print label
          try {
            await fetch('/api/printnode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: pendingOrderId, mode: 'cloud' }),
            });
          } catch (e) {
            console.error('Print failed:', e);
          }

          localStorage.removeItem('pos_pending_order_id');
          localStorage.removeItem('pos_pending_order_total');
        }

        setStatus('success');
        setMessage('Payment successful!');

      } catch (err: any) {
        console.error('Callback error:', err);
        setStatus('error');
        setMessage('Something went wrong processing the payment.');
      }
    };

    processCallback();
  }, []);

  const returnToKiosk = () => {
    // Return to the kiosk — preserve event slug and terminal from URL if stored
    const kioskUrl = localStorage.getItem('pos_kiosk_url') || '/';
    localStorage.removeItem('pos_kiosk_url');
    window.location.href = kioskUrl;
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center">

        {status === 'processing' && (
          <>
            <div className="text-5xl mb-4 animate-pulse">⏳</div>
            <h1 className="text-2xl font-black text-slate-900 mb-2">Processing</h1>
            <p className="text-gray-500">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-3xl font-black text-green-700 mb-2">Payment Complete!</h1>
            <p className="text-gray-500 mb-2">Label is printing.</p>
            {orderId && <p className="text-xs text-gray-400 font-mono mb-6">Order #{orderId}</p>}
            <button onClick={returnToKiosk}
              className="w-full bg-slate-900 hover:bg-slate-700 text-white font-black py-4 rounded-2xl text-lg transition-all">
              Next Customer ➡️
            </button>
          </>
        )}

        {status === 'cancelled' && (
          <>
            <div className="text-5xl mb-4">↩️</div>
            <h1 className="text-2xl font-black text-orange-600 mb-2">Cancelled</h1>
            <p className="text-gray-500 mb-6">{message}</p>
            <button onClick={returnToKiosk}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl text-lg transition-all">
              Go Back
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-black text-red-600 mb-2">Payment Failed</h1>
            <p className="text-gray-500 mb-6">{message}</p>
            <button onClick={returnToKiosk}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-2xl text-lg transition-all">
              Go Back & Retry
            </button>
          </>
        )}
      </div>
    </div>
  );
}
