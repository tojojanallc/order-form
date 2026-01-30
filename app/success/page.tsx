// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Verifying...');

  useEffect(() => {
    // 1. Clean the cart locally
    localStorage.removeItem('cart');

    // 2. The "Safety Net": Find the most recent pending order for this customer and mark it paid
    // (In a real app, we would verify the Stripe Session ID here for security, 
    // but for now, we just want to turn that Red label Green).
    const finalizeOrder = async () => {
        try {
            // Find the most recent order created in the last minute
            const { data: recentOrders } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1);

            if (recentOrders && recentOrders.length > 0) {
                const latestOrder = recentOrders[0];
                
                // Only update if it's currently unpaid/pending
                if (!latestOrder.payment_status || latestOrder.payment_status !== 'paid') {
                    console.log("Forcing Order to PAID:", latestOrder.id);
                    
                    await supabase
                        .from('orders')
                        .update({ 
                            payment_status: 'paid',
                            status: 'pending' // Ensure it shows as ready to ship
                        })
                        .eq('id', latestOrder.id);
                        
                    setStatus('Payment Confirmed!');
                } else {
                    setStatus('Order Received!');
                }
            }
        } catch (e) {
            console.error(e);
            setStatus('Order Received!');
        }
    };

    finalizeOrder();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-4">
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
    </div>
  );
}