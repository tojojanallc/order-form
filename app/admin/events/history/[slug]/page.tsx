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
      // 1. Get Event Basic Info
      const { data: eventData } = await supabase.from('event_settings').select('event_name, slug').eq('slug', slug).maybeSingle();
      if (eventData) setEvent(eventData);

      // 2. Get Orders (No complex joins)
      const { data: mainOrders } = await supabase.from('orders').select('*').eq('event_slug', slug);
      
      // 3. Get Items separately
      const { data: allItems } = await supabase.from('order_items').select('*');

      if (mainOrders) {
        const joined = mainOrders.map(order => ({
            ...order,
            order_items: (allItems || []).filter(item => item.order_id === order.id)
        }));
        setOrders(joined);
      }
    } catch (err) {
      console.error("Database error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-black text-gray-300 animate-pulse uppercase">Searching...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-10">
          <Link href="/admin/events/history" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block">← Back</Link>
          <h1 className="text-5xl font-black tracking-tight">{event?.event_name || 'Event Details'}</h1>
          <p className="text-gray-400 font-bold text-[10px] tracking-widest uppercase mt-1">Inspecting Raw Cart Data</p>
        </div>

        <div className="bg-white rounded-[40px] border border-gray-200 shadow-sm overflow-hidden">
             <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
                    <tr>
                        <th className="p-8">Customer</th>
                        <th className="p-8">Item & Raw Metadata</th>
                        <th className="p-8 text-right">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {orders.length === 0 ? (
                        <tr><td colSpan={3} className="p-20 text-center font-black text-gray-400">NO ORDERS FOUND</td></tr>
                    ) : orders.map(order => (
                        <tr key={order.id}>
                            <td className="p-8">
                                <div className="font-black text-sm uppercase">{order.customer_name || 'Walk-in'}</div>
                                <div className="text-[10px] font-bold text-gray-400">{new Date(order.created_at).toLocaleTimeString()}</div>
                            </td>
                            <td className="p-8">
                                <div className="flex flex-col gap-4">
                                    {order.order_items?.map((item: any, i: number) => (
                                        <div key={i} className="border-l-4 border-indigo-500 pl-4 py-2">
                                            <div className="text-xs font-black text-slate-800 uppercase">
                                                {item.quantity}× {item.item_name} ({item.size})
                                            </div>
                                            
                                            {/* RAW DATA INSPECTOR - This will show us exactly what we need to pull */}
                                            <div className="mt-2 p-3 bg-slate-900 rounded-xl overflow-hidden">
                                                <p className="text-[9px] font-black text-indigo-400 uppercase mb-1">Raw Cart Data:</p>
                                                <pre className="text-[10px] text-green-400 font-mono whitespace-pre-wrap leading-tight">
                                                    {item.cart_data ? JSON.stringify(item.cart_data, null, 2) : "NULL - No data saved"}
                                                </pre>
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