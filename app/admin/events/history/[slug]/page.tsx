'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function EventReportPage({ params }: { params: { slug: string } }) {
  const [event, setEvent] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Debug State
  const [dbSlugs, setDbSlugs] = useState<string[]>([]);
  const [totalOrdersFound, setTotalOrdersFound] = useState(0);

  useEffect(() => {
    if (params?.slug) {
      fetchDetails(params.slug);
    }
  }, [params?.slug]);

  async function fetchDetails(targetSlug: string) {
    setLoading(true);

    try {
      // 1. Fetch Event Settings for Tojojana, LLC
      const { data: eventData } = await supabase
        .from('event_settings')
        .select('id, slug, event_name, status') 
        .eq('slug', targetSlug)
        .maybeSingle();

      if (eventData) setEvent(eventData);

      // 2. Fetch ALL Orders to debug matching
      const { data: allOrders, error: orderErr } = await supabase
        .from('orders')
        .select('*');

      if (orderErr) throw orderErr;

      if (allOrders) {
        setTotalOrdersFound(allOrders.length);
        
        // Find unique slugs in your DB to see what they are actually named
        const uniqueSlugs: string[] = Array.from(new Set(allOrders.map((o: any) => o.event_slug)));
        setDbSlugs(uniqueSlugs);

        // 3. Filter for the current page slug
        const matched = allOrders.filter((o: any) => o.event_slug === targetSlug);
        
        // 4. Fetch items for matched orders
        const { data: allItems } = await supabase.from('order_items').select('*');
        
        const joined = matched.map(order => ({
            ...order,
            order_items: allItems?.filter(item => item.order_id === order.id) || []
        }));

        setOrders(joined);
      }

    } catch (err: any) {
      console.error("Debug Error:", err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-black text-gray-300 animate-pulse uppercase">Searching Database...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        <div className="mb-8">
          <Link href="/admin/events/history" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block hover:underline">← Back to Archive</Link>
          <h1 className="text-5xl font-black tracking-tight">{event?.event_name || "Event Not Found"}</h1>
          <p className="text-gray-400 font-bold mt-1 uppercase text-[10px] tracking-widest">Looking for Slug: <span className="text-blue-600">{params.slug}</span></p>
        </div>

        {/* DEBUG PANEL: SHOWS WHY DATA MIGHT BE MISSING */}
        <div className="bg-amber-50 border-2 border-amber-200 p-8 rounded-[40px] mb-10">
            <h3 className="text-amber-800 font-black uppercase text-xs mb-4 flex items-center gap-2">
                <span>🔍</span> Connection Truth Panel
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Slugs currently in your 'orders' table:</p>
                    <div className="flex flex-wrap gap-2">
                        {dbSlugs.length > 0 ? dbSlugs.map(s => (
                            <span key={s} className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${s === params.slug ? 'bg-green-500 text-white border-green-600' : 'bg-white text-amber-700 border-amber-200'}`}>
                                {s || "NULL/EMPTY"}
                            </span>
                        )) : <span className="text-amber-900 italic text-sm">Table is empty</span>}
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Total Orders in DB</p>
                    <p className="text-3xl font-black text-amber-900">{totalOrdersFound}</p>
                </div>
            </div>
            {totalOrdersFound > 0 && orders.length === 0 && (
                <div className="mt-6 p-4 bg-white/50 rounded-2xl border border-amber-200 text-xs font-bold text-amber-800">
                    💡 <span className="uppercase">Insight:</span> You have orders in the database, but none of them are tagged with "{params.slug}". Click a green badge above to see what they are tagged with instead.
                </div>
            )}
        </div>

        {/* REVENUE STATS (Only shows if orders match) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div className="bg-slate-950 text-white p-8 rounded-[40px] shadow-2xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Matched Revenue</p>
                <p className="text-5xl font-black text-green-400">
                    ${orders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0).toFixed(2)}
                </p>
            </div>
            <div className="bg-white p-8 rounded-[40px] border border-gray-200 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Matched Orders</p>
                <p className="text-4xl font-black text-slate-900">{orders.length}</p>
            </div>
        </div>

        {/* DATA TABLE */}
        <div className="bg-white rounded-[48px] border border-gray-200 shadow-sm overflow-hidden min-h-[300px]">
             <table className="w-full text-left">
                <thead className="bg-white text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                    <tr>
                        <th className="p-8">Customer</th>
                        <th className="p-8">Order ID</th>
                        <th className="p-8 text-right">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {orders.length === 0 ? (
                        <tr><td colSpan={3} className="p-32 text-center font-black text-gray-300 uppercase italic">No Matched Data</td></tr>
                    ) : orders.map(order => (
                        <tr key={order.id}>
                            <td className="p-8 font-black uppercase text-sm">{order.customer_name}</td>
                            <td className="p-8 font-mono text-[10px] text-gray-400">{order.id}</td>
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