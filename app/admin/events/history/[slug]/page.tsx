'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function EventReportPage({ params }: { params: { slug: string } }) {
  const [event, setEvent] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [revenue, setRevenue] = useState(0);

  useEffect(() => {
    if (params?.slug) {
      fetchDetails(params.slug);
    }
  }, [params?.slug]);

  async function fetchDetails(slug: string) {
    setLoading(true);

    try {
      // 1. Get Event Info
      const { data: eventData } = await supabase
        .from('event_settings')
        .select('id, slug, event_name, status') 
        .eq('slug', slug)
        .maybeSingle();
      if (eventData) setEvent(eventData);

      // 2. Get Orders (Directly)
      const { data: mainOrders, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('event_slug', slug);

      if (orderErr) throw orderErr;

      // 3. Get ALL Items in a separate bucket to prevent join errors
      const { data: allItems } = await supabase.from('order_items').select('*');

      // 4. Safe Merge
      if (mainOrders) {
        const joined = mainOrders.map(order => ({
            ...order,
            // Match items manually; if allItems is null, default to empty array
            order_items: (allItems || []).filter(item => item.order_id === order.id)
        }));

        setOrders(joined);
        const total = joined.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
        setRevenue(total);
      }

    } catch (err) {
      console.error("Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-black text-gray-300 animate-pulse uppercase tracking-widest">Loading Ledger...</div>;
  if (!event) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-black text-gray-400">EVENT NOT FOUND</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        <div className="mb-10 flex justify-between items-end">
          <div>
            <Link href="/admin/events/history" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block">← Back to Archive</Link>
            <h1 className="text-5xl font-black tracking-tight">{event.event_name}</h1>
            <p className="text-gray-400 font-bold text-[10px] tracking-widest uppercase mt-1">Slug: {event.slug}</p>
          </div>
          <div className="bg-slate-950 text-white p-6 rounded-[32px] shadow-xl text-right min-w-[250px]">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Revenue</p>
                <p className="text-4xl font-black text-green-400">${revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
          </div>
        </div>

        {/* SALES TABLE */}
        <div className="bg-white rounded-[40px] border border-gray-200 shadow-sm overflow-hidden">
             <table className="w-full text-left">
                <thead className="bg-white text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
                    <tr>
                        <th className="p-8">Customer</th>
                        <th className="p-8">Purchased Items</th>
                        <th className="p-8 text-right">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {orders.length === 0 ? (
                        <tr><td colSpan={3} className="p-32 text-center font-black text-gray-300 uppercase italic">No Matches Found</td></tr>
                    ) : orders.map(order => (
                        <tr key={order.id} className="hover:bg-blue-50/20 transition-colors">
                            <td className="p-8">
                                <div className="font-black text-sm text-slate-900 uppercase">{order.customer_name || 'Walk-in'}</div>
                                <div className="text-[10px] font-bold text-gray-400">{new Date(order.created_at).toLocaleTimeString()}</div>
                            </td>
                            <td className="p-8">
                                <div className="flex flex-col gap-2">
                                    {order.order_items?.map((item: any, i: number) => (
                                        <div key={i} className="text-xs font-bold text-slate-700">
                                            <span className="text-blue-500 mr-2">{item.quantity}×</span> 
                                            {item.item_name}
                                            
                                            {/* CUSTOMIZATIONS: Check common column names */}
                                            <div className="flex gap-2 mt-1">
                                                {item.custom_name && (
                                                    <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[9px] uppercase font-black">
                                                        Name: {item.custom_name}
                                                    </span>
                                                )}
                                                {(item.heat_sheet === true || item.heat_sheets === true) && (
                                                    <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[9px] uppercase font-black">
                                                        + Heat Sheet
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </td>
                            <td className="p-8 text-right font-black text-green-600 text-lg">
                                ${Number(order.total_price).toFixed(2)}
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
        </div>
      </div>
    </div>
  );
}