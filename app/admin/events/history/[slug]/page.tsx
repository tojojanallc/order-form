'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function EventReportPage({ params }: { params: { slug: string } }) {
  const [event, setEvent] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params?.slug) fetchDetails(params.slug);
  }, [params?.slug]);

  async function fetchDetails(slug: string) {
    setLoading(true);
    try {
      const { data: eventData } = await supabase.from('event_settings').select('*').eq('slug', slug).maybeSingle();
      if (eventData) setEvent(eventData);

      const { data: mainOrders } = await supabase.from('orders').select('*').eq('event_slug', slug).order('created_at', { ascending: false });
      const { data: allItems } = await supabase.from('order_items').select('*');

      if (mainOrders && allItems) {
        const joined = mainOrders.map(order => ({
            ...order,
            order_items: allItems.filter(item => item.order_id === order.id)
        }));
        setOrders(joined);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  // HELPER: Recursively finds "Name" or "Add-on" fields inside the cart_data JSON
  const extractCartDetails = (item: any) => {
    const details: string[] = [];
    const data = item.cart_data || {};

    // 1. Look for known keys in the root of cart_data
    const keysToWatch = ['custom_name', 'name_addon', 'player_name', 'heat_sheet', 'customization'];
    
    keysToWatch.forEach(key => {
      if (data[key]) details.push(`${key.replace('_', ' ').toUpperCase()}: ${data[key]}`);
    });

    // 2. If cart_data has a nested 'customizations' or 'selections' object, look there too
    const nested = data.customizations || data.options || data.selections || {};
    if (typeof nested === 'object') {
      Object.entries(nested).forEach(([key, val]) => {
        if (val && typeof val !== 'object') {
          details.push(`${key.toUpperCase()}: ${val}`);
        }
      });
    }

    return details;
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-black text-gray-300 animate-pulse uppercase tracking-widest">Parsing Cart Data...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <div className="mb-10">
          <Link href="/admin/events/history" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block hover:underline">← Back to Archive</Link>
          <h1 className="text-5xl font-black tracking-tight text-slate-900">{event?.event_name || 'Event Details'}</h1>
          <p className="text-gray-400 font-bold text-[10px] tracking-widest uppercase mt-1">Order Configuration Audit</p>
        </div>

        {/* SALES TABLE */}
        <div className="bg-white rounded-[40px] border border-gray-200 shadow-sm overflow-hidden min-h-[500px]">
             <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
                    <tr>
                        <th className="p-8">Customer</th>
                        <th className="p-8">Item Config & Cart Data</th>
                        <th className="p-8 text-right">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {orders.map(order => (
                        <tr key={order.id} className="hover:bg-blue-50/10 transition-colors">
                            <td className="p-8">
                                <div className="font-black text-sm text-slate-900 uppercase leading-none mb-1">{order.customer_name || 'Walk-in'}</div>
                                <div className="text-[10px] font-bold text-gray-400">{new Date(order.created_at).toLocaleTimeString()}</div>
                            </td>
                            <td className="p-8">
                                <div className="flex flex-col gap-4">
                                    {order.order_items?.map((item: any, i: number) => {
                                        const extra = extractCartDetails(item);
                                        return (
                                            <div key={i} className="border-l-4 border-indigo-500 pl-4 py-1">
                                                <div className="text-xs font-black text-slate-800">
                                                    {item.quantity}× {item.item_name} <span className="text-gray-400 uppercase ml-1">({item.size})</span>
                                                </div>
                                                
                                                {/* DATA FROM CART_DATA */}
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {extra.map((detail, idx) => (
                                                        <span key={idx} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-indigo-100">
                                                            {detail}
                                                        </span>
                                                    ))}
                                                    {extra.length === 0 && (
                                                        <span className="text-[9px] text-gray-300 font-bold uppercase italic">No Custom Data Found</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
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