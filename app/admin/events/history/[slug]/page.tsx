'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function EventReportPage({ params }: { params: { slug: string } }) {
  const [event, setEvent] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [debug, setDebug] = useState<any>({ eventError: null, orderError: null, rawOrders: 0 });
  
  const [revenue, setRevenue] = useState(0);

  useEffect(() => {
    if (params?.slug) {
      fetchDetails(params.slug);
    }
  }, [params?.slug]);

  async function fetchDetails(slug: string) {
    setLoading(true);

    // 1. Fetch Event
    const { data: eventData, error: eErr } = await supabase
      .from('event_settings')
      .select('*') 
      .eq('slug', slug)
      .maybeSingle();

    // 2. Fetch ALL Orders (Temporarily removing the slug filter to see if data exists)
    const { data: orderData, error: oErr } = await supabase
      .from('orders')
      .select('*, order_items(*)');

    setDebug({ 
        eventError: eErr?.message || 'None', 
        orderError: oErr?.message || 'None',
        rawOrders: orderData?.length || 0 
    });

    if (eventData) setEvent(eventData);

    // 3. Filter orders manually in JS to be 100% sure of the match
    if (orderData) {
      const filtered = orderData.filter((o: any) => o.event_slug === slug);
      setOrders(filtered);
      const totalRev = filtered.reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
      setRevenue(totalRev);
    }
    
    setLoading(false);
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-black text-gray-300 animate-pulse uppercase">Searching...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        <div className="mb-8">
          <Link href="/admin/events/history" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block">← Back to Archive</Link>
          <h1 className="text-5xl font-black tracking-tight">{event?.event_name || 'Unknown Event'}</h1>
          <p className="text-gray-400 font-bold text-[10px] tracking-widest uppercase mt-1">Slug: {params.slug}</p>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div className="bg-slate-950 text-white p-8 rounded-[40px] shadow-2xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Total Revenue</p>
                <p className="text-5xl font-black text-green-400">${revenue.toFixed(2)}</p>
            </div>
            <div className="bg-white p-8 rounded-[40px] border border-gray-200 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Orders Found for this Slug</p>
                <p className="text-4xl font-black text-slate-900">{orders.length}</p>
            </div>
        </div>

        {/* DEBUG PANEL - This is the "Truth" section */}
        <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[32px] mb-10">
            <h3 className="font-black text-amber-800 uppercase text-xs mb-4">🔧 Debugging Connection</h3>
            <div className="grid grid-cols-3 gap-4 text-[10px] font-mono font-bold uppercase text-amber-700">
                <div>Event Err: {debug.eventError}</div>
                <div>Order Err: {debug.orderError}</div>
                <div>Total Orders in DB: {debug.rawOrders}</div>
            </div>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-[48px] border border-gray-200 shadow-sm overflow-hidden">
             <table className="w-full text-left">
                <thead className="bg-white text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
                    <tr>
                        <th className="p-8">Customer</th>
                        <th className="p-8">Slug in DB</th>
                        <th className="p-8 text-right">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {orders.length === 0 ? (
                        <tr><td colSpan={3} className="p-20 text-center font-black text-gray-300 uppercase">No Matches Found</td></tr>
                    ) : orders.map(order => (
                        <tr key={order.id}>
                            <td className="p-8 font-black uppercase">{order.customer_name}</td>
                            <td className="p-8 font-mono text-blue-500">{order.event_slug}</td>
                            <td className="p-8 text-right font-black text-green-600">${order.total_price}</td>
                        </tr>
                    ))}
                </tbody>
             </table>
        </div>

      </div>
    </div>
  );
}