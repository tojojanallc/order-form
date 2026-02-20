'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ProductionScreen() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Auto-refresh the screen every 15 seconds so the presser doesn't have to touch it
  useEffect(() => {
    fetchPendingOrders();
    const interval = setInterval(fetchPendingOrders, 15000);
    return () => clearInterval(interval);
  }, [slug]);

  async function fetchPendingOrders() {
    // We only want orders that are pending/paid, NOT completed
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('event_slug', slug)
      .in('status', ['pending', 'paid'])
      .order('created_at', { ascending: true }); // Ascending means Oldest First (FIFO)

    if (data) setOrders(data);
    setLoading(false);
  }

  async function markOrderComplete(orderId: string) {
    // 1. Instantly remove it from the presser's screen
    setOrders(current => current.filter(o => o.id !== orderId));

    // 2. Update the database status to 'ready'
    await supabase
      .from('orders')
      .update({ status: 'ready' })
      .eq('id', orderId);

    // 3. FIRE OFF THE TEXT MESSAGE
    try {
        const { data: orderData } = await supabase
            .from('orders')
            .select('customer_name, phone')
            .eq('id', orderId)
            .single();

        if (orderData && orderData.phone && orderData.phone !== 'N/A') {
            const message = `Hi ${orderData.customer_name}! Your order is ready for pickup. Please head to the Lev Custom Merch team and start wearing your new gear!`;
            
            await fetch('/api/send-sms', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ phone: orderData.phone, message: message }) 
            });
        }
    } catch (err) { 
        console.error("Error sending text:", err); 
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-black text-2xl uppercase tracking-widest">Loading Press Queue...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans selection:bg-blue-500">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase flex items-center gap-3">
            <span className="text-orange-500">🔥</span> Heat Press Queue
          </h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">Oldest orders are at the top</p>
        </div>
        <div className="flex gap-4">
            <button onClick={fetchPendingOrders} className="bg-slate-800 hover:bg-slate-700 px-6 py-3 rounded-xl font-bold uppercase text-sm transition-colors">
              🔄 Refresh
            </button>
            <Link href={`/admin/events/${slug}`} className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-bold uppercase text-sm transition-colors">
              Exit to Admin
            </Link>
        </div>
      </div>

      {/* QUEUE GRID */}
      {orders.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-3xl font-black text-slate-600 uppercase tracking-widest">Queue is Empty</p>
          <p className="text-slate-500 mt-2 font-bold">Time for a water break.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map((order) => {
            // Parse cart data safely
            const cartItems = typeof order.cart_data === 'string' ? JSON.parse(order.cart_data) : order.cart_data;
            const timeWaiting = Math.round((new Date().getTime() - new Date(order.created_at).getTime()) / 60000);

            return (
              <div key={order.id} className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden flex flex-col shadow-2xl">
                
                {/* ORDER HEADER */}
                <div className={`p-4 flex justify-between items-center ${timeWaiting > 15 ? 'bg-red-900/50 border-b border-red-500/30' : 'bg-slate-800 border-b border-slate-700'}`}>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Customer</p>
                    <p className="text-xl font-black truncate">{order.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Wait Time</p>
                    <p className={`text-xl font-black ${timeWaiting > 15 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {timeWaiting} min
                    </p>
                  </div>
                </div>

                {/* GARMENTS TO PRESS */}
                <div className="p-6 flex-grow flex flex-col gap-6">
                  {cartItems.map((item: any, i: number) => (
                    <div key={i} className="bg-slate-900 p-4 rounded-2xl border border-slate-700">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-xl font-black leading-tight">{item.productName}</h3>
                        <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-lg font-black shrink-0 ml-4">
                          {item.size}
                        </span>
                      </div>
                      
                      {/* ONLY SHOW DESIGNS (Ignore pricing/tax info here) */}
                      <div className="space-y-1 mt-2">
                        {item.customizations?.mainDesign && (
                          <div className="flex items-center gap-2 text-slate-300 font-bold">
                            <span className="text-slate-500">▶</span> Design: <span className="text-white">{item.customizations.mainDesign}</span>
                          </div>
                        )}
                        {item.customizations?.metallic && (
                          <div className="flex items-center gap-2 text-yellow-400 font-bold">
                            <span className="text-slate-500">▶</span> FOIL: {item.customizations.metallicName || 'Yes'}
                          </div>
                        )}
                        {item.customizations?.nameOnSleeve && (
                          <div className="flex items-center gap-2 text-emerald-400 font-bold">
                            <span className="text-slate-500">▶</span> SLEEVE: {item.customizations.nameOnSleeveText}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* THE GIANT DONE BUTTON */}
                <div className="p-4 pt-0">
                  <button 
                    onClick={() => markOrderComplete(order.id)}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 py-5 rounded-2xl font-black text-xl uppercase tracking-widest transition-transform active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                  >
                    ✓ Press Complete
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}