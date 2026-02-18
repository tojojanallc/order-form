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
      const { data: eventData } = await supabase.from('event_settings').select('event_name, slug, status').eq('slug', slug).maybeSingle();
      if (eventData) setEvent(eventData);

      const { data: mainOrders } = await supabase.from('orders').select('*').eq('event_slug', slug);
      const { data: allItems } = await supabase.from('order_items').select('*');

      if (mainOrders) {
        const joined = mainOrders.map(order => ({
            ...order,
            order_items: (allItems || []).filter(item => item.order_id === order.id)
        }));
        setOrders(joined);
        setRevenue(joined.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // HELPER FUNCTION: Extracts customizations regardless of column name
  const renderCustomizations = (item: any) => {
    const details = [];
    
    // 1. Check direct columns
    if (item.custom_name) details.push({ label: 'Name', value: item.custom_name });
    if (item.heat_sheet) details.push({ label: 'Heat Sheet', value: 'Yes' });
    
    // 2. Check JSON columns (often named 'customizations' or 'metadata' in these setups)
    const extraData = item.customizations || item.metadata || item.options || {};
    if (typeof extraData === 'object') {
        Object.entries(extraData).forEach(([key, val]) => {
            if (val) details.push({ label: key, value: String(val) });
        });
    }

    if (details.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {details.map((d, i) => (
          <span key={i} className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tight">
            {d.label}: {d.value}
          </span>
        ))}
      </div>
    );
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-black text-gray-300 animate-pulse uppercase">Searching...</div>;
  if (!event) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-black text-gray-400">EVENT NOT FOUND</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-10 flex justify-between items-end">
          <div>
            <Link href="/admin/events/history" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block hover:underline">← Back to Archive</Link>
            <h1 className="text-5xl font-black tracking-tight">{event.event_name}</h1>
            <p className="text-gray-400 font-bold text-[10px] tracking-widest uppercase mt-1">Slug: {event.slug}</p>
          </div>
          <div className="bg-slate-950 text-white p-6 px-10 rounded-[32px] shadow-2xl text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Revenue</p>
                <p className="text-4xl font-black text-green-400">${revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
          </div>
        </div>

        <div className="bg-white rounded-[48px] border border-gray-200 shadow-sm overflow-hidden min-h-[500px]">
             <table className="w-full text-left">
                <thead className="bg-white text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
                    <tr>
                        <th className="p-8">Customer / Time</th>
                        <th className="p-8">Purchased Items & Swag Details</th>
                        <th className="p-8 text-right">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {orders.map(order => (
                        <tr key={order.id} className="hover:bg-blue-50/10 transition-colors">
                            <td className="p-8">
                                <div className="font-black text-sm text-slate-900 uppercase leading-none mb-1">{order.customer_name || 'Walk-in'}</div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                    {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                            </td>
                            <td className="p-8">
                                <div className="flex flex-col gap-3">
                                    {order.order_items?.map((item: any, i: number) => (
                                        <div key={i} className="border-l-4 border-blue-500 pl-4 py-1">
                                            <div className="text-xs font-black text-slate-800">
                                                <span className="text-blue-500 mr-2">{item.quantity}×</span> 
                                                {item.item_name} <span className="text-[10px] text-gray-400 uppercase ml-2">({item.size})</span>
                                            </div>
                                            {/* RENDER THE CUSTOMIZATIONS HERE */}
                                            {renderCustomizations(item)}
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