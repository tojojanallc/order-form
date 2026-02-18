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
      // 1. Fetch Event Header
      const { data: eventData } = await supabase
        .from('event_settings')
        .select('id, slug, event_name, status') 
        .eq('slug', slug)
        .maybeSingle();

      if (eventData) setEvent(eventData);

      // 2. Fetch Orders for this event
      const { data: mainOrders, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('event_slug', slug)
        .order('created_at', { ascending: false });

      if (orderErr) throw orderErr;

      // 3. Fetch Order Items (where the customization data lives)
      // We pull everything including potential columns like 'custom_name' or 'metadata'
      const { data: allItems, error: itemsErr } = await supabase
        .from('order_items')
        .select('*');

      if (itemsErr) throw itemsErr;

      if (mainOrders && allItems) {
        const joinedOrders = mainOrders.map(order => ({
            ...order,
            order_items: allItems.filter(item => item.order_id === order.id)
        }));

        setOrders(joinedOrders);

        // Calculate Totals
        const totalRev = joinedOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
        const totalUnits = joinedOrders.reduce((sum, o) => sum + o.order_items.length, 0);
        
        setRevenue(totalRev);
        setItemsSold(totalUnits);
      }

    } catch (err: any) {
      console.error("Fetch Error:", err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-black uppercase text-gray-300 animate-pulse">Updating Ledger...</div>;
  if (!event) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-black text-gray-400">Event Not Found</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <Link href="/admin/events/history" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block hover:underline">← Back to Archive</Link>
            <h1 className="text-5xl font-black tracking-tight text-slate-900">{event.event_name}</h1>
            <p className="text-gray-400 font-bold mt-1 uppercase text-[10px] tracking-widest">Event Detail Report • {event.slug}</p>
          </div>
          <div className="text-right">
             <span className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                {event.status}
             </span>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-slate-950 text-white p-8 rounded-[40px] shadow-2xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Total Revenue</p>
                <p className="text-5xl font-black text-green-400">${revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
            <div className="bg-white p-8 rounded-[40px] border border-gray-200 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Orders</p>
                <p className="text-4xl font-black text-slate-900">{orders.length}</p>
            </div>
            <div className="bg-white p-8 rounded-[40px] border border-gray-200 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Units Sold</p>
                <p className="text-4xl font-black text-blue-600">{itemsSold}</p>
            </div>
        </div>

        {/* ENHANCED SALES LEDGER */}
        <div className="bg-white rounded-[48px] border border-gray-200 shadow-sm overflow-hidden min-h-[500px]">
             <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Transaction History</h2>
                <div className="flex gap-4">
                    <span className="text-[10px] font-black text-purple-500 uppercase">● Customization Alert</span>
                </div>
             </div>
             
             <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-white text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
                        <tr>
                            <th className="p-8">Customer / Time</th>
                            <th className="p-8">Items & Customizations</th>
                            <th className="p-8 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {orders.map(order => (
                            <tr key={order.id} className="hover:bg-blue-50/20 transition-colors">
                                <td className="p-8">
                                    <div className="font-black text-sm text-slate-900 uppercase leading-none mb-1">{order.customer_name || 'Walk-in'}</div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                        {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {new Date(order.created_at).toLocaleDateString()}
                                    </div>
                                </td>
                                
                                <td className="p-8">
                                    <div className="flex flex-col gap-3">
                                        {order.order_items?.map((item: any, idx: number) => (
                                            <div key={idx} className="bg-gray-50/50 border border-gray-100 p-3 rounded-2xl relative">
                                                <div className="text-xs font-black text-slate-800 flex items-center gap-2">
                                                    <span className="text-blue-500">{item.quantity}×</span> 
                                                    {item.item_name}
                                                    <span className="text-[9px] bg-slate-900 text-white px-1.5 py-0.5 rounded uppercase font-black">{item.size}</span>
                                                </div>

                                                {/* CUSTOMIZATION DISPLAY */}
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {/* Check for 'custom_name' column */}
                                                    {item.custom_name && (
                                                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border border-purple-200">
                                                            Name: {item.custom_name}
                                                        </span>
                                                    )}
                                                    {/* Check for 'heat_sheet' flag */}
                                                    {item.heat_sheet && (
                                                        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border border-orange-200">
                                                            + Heat Sheet
                                                        </span>
                                                    )}
                                                    {/* Generic Metadata fallback (if you store stuff in a JSON column) */}
                                                    {item.metadata && Object.entries(item.metadata).map(([key, val]: any) => (
                                                        <span key={key} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase border border-blue-100">
                                                            {key}: {val}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </td>

                                <td className="p-8 text-right">
                                    <div className="font-black text-green-600 text-xl">${Number(order.total_price).toFixed(2)}</div>
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