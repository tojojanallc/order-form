'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function EventReportPage({ params }: { params: { slug: string } }) {
  const [event, setEvent] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [revenue, setRevenue] = useState(0);
  const [itemsSold, setItemsSold] = useState(0);

  useEffect(() => {
    if (params?.slug) {
      fetchDetails(params.slug);
    }
  }, [params?.slug]);

  async function fetchDetails(slug: string) {
    setLoading(true);

    try {
      // 1. Get Event Settings (Safe Select)
      const { data: eventData } = await supabase
        .from('event_settings')
        .select('id, slug, event_name, status') 
        .eq('slug', slug)
        .maybeSingle();

      if (eventData) setEvent(eventData);

      // 2. Get Orders (Plural 'orders')
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('event_slug', slug);

      if (orderError) {
        console.error("Order Fetch Error:", orderError.message);
      }

      if (orderData && orderData.length > 0) {
        setOrders(orderData);
        
        const totalRev = orderData.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
        const totalItems = orderData.reduce((sum, o) => {
            return sum + (o.order_items ? o.order_items.length : 0);
        }, 0);
        
        setRevenue(totalRev);
        setItemsSold(totalItems);
      }
    } catch (err) {
      console.error("Critical Page Error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-black uppercase text-gray-300 animate-pulse">Loading Report...</div>;
  if (!event) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-black text-gray-400">Event Not Found</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <div className="mb-8">
          <Link href="/admin/events/history" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block hover:underline">← Back to Archive</Link>
          <div className="flex justify-between items-end">
            <h1 className="text-5xl font-black tracking-tight text-slate-900">{event.event_name}</h1>
            <span className="px-4 py-2 rounded-xl bg-gray-200 text-gray-600 text-[10px] font-black uppercase tracking-widest">
                {event.status || 'Archived'}
            </span>
          </div>
          <p className="text-gray-400 font-bold mt-1 uppercase text-[10px] tracking-widest">Slug ID: {event.slug}</p>
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-slate-950 text-white p-8 rounded-[40px] shadow-2xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Total Revenue</p>
                <p className="text-5xl font-black text-green-400">${revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-gray-200 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Orders Processed</p>
                <p className="text-4xl font-black text-slate-900">{orders.length}</p>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-gray-200 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Items Sold</p>
                <p className="text-4xl font-black text-blue-600">{itemsSold}</p>
            </div>
        </div>

        {/* SALES LEDGER */}
        <div className="bg-white rounded-[48px] border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
             <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sales Ledger</h2>
                <span className="text-[10px] font-black text-gray-300 uppercase">{orders.length} Transactions</span>
             </div>
             
             <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-white text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
                        <tr>
                            <th className="p-8">Time</th>
                            <th className="p-8">Customer</th>
                            <th className="p-8">Items Purchased</th>
                            <th className="p-8 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {orders.length === 0 ? (
                            <tr><td colSpan={4} className="p-32 text-center font-black text-gray-300 uppercase tracking-widest italic">No orders recorded for this event.</td></tr>
                        ) : orders.map(order => (
                            <tr key={order.id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="p-8">
                                    <div className="font-bold text-xs text-slate-900">
                                        {order.created_at ? new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                                    </div>
                                    <div className="text-[10px] font-bold text-gray-400">
                                        {order.created_at ? new Date(order.created_at).toLocaleDateString() : ''}
                                    </div>
                                </td>
                                <td className="p-8">
                                    <div className="font-black text-sm text-slate-900 uppercase">{order.customer_name || 'Walk-in'}</div>
                                    <div className="text-[10px] text-gray-400 font-bold tracking-tight">{order.customer_email || ''}</div>
                                </td>
                                <td className="p-8">
                                    <div className="flex flex-col gap-1">
                                        {order.order_items?.map((item: any, idx: number) => (
                                            <div key={idx} className="text-xs font-bold text-slate-600 flex items-center gap-2">
                                                <span className="text-slate-300 text-[10px]">{item.quantity}×</span> 
                                                <span>{item.item_name}</span>
                                                <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-400 uppercase font-black">{item.size}</span>
                                            </div>
                                        ))}
                                    </div>
                                </td>
                                <td className="p-8 text-right">
                                    <div className="font-black text-green-600 text-lg">${(Number(order.total_price) || 0).toFixed(2)}</div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
             </div>
        </div>

      </div>
    </div>
  );
}