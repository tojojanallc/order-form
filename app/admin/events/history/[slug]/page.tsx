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
      // 1. Fetch Event Info
      const { data: eventData } = await supabase
        .from('event_settings')
        .select('id, slug, event_name, status') 
        .eq('slug', slug)
        .maybeSingle();

      if (eventData) setEvent(eventData);

      // 2. Fetch Orders (Just the main order data)
      const { data: mainOrders, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('event_slug', slug);

      if (orderErr) throw orderErr;

      // 3. Fetch ALL Order Items (We will filter these in JS to avoid relationship errors)
      const { data: allItems, error: itemsErr } = await supabase
        .from('order_items')
        .select('*');

      if (itemsErr) throw itemsErr;

      // 4. Manual Join: Attach items to their respective orders
      if (mainOrders && allItems) {
        const joinedOrders = mainOrders.map(order => ({
            ...order,
            // Match items where item.order_id equals order.id
            // (Note: Confirm your column name is 'order_id' in order_items table)
            order_items: allItems.filter(item => item.order_id === order.id)
        }));

        setOrders(joinedOrders);

        // Calculate Totals
        const totalRev = joinedOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
        const totalItems = joinedOrders.reduce((sum, o) => sum + o.order_items.length, 0);
        
        setRevenue(totalRev);
        setItemsSold(totalItems);
      }

    } catch (err: any) {
      console.error("Critical Error:", err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-black uppercase text-gray-300 animate-pulse">Rebuilding Ledger...</div>;
  if (!event) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-black text-gray-400 uppercase">Event Not Found</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <div className="mb-8">
          <Link href="/admin/events/history" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block hover:underline">← Back to Archive</Link>
          <div className="flex justify-between items-end">
            <h1 className="text-5xl font-black tracking-tight text-slate-900">{event.event_name}</h1>
            <span className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                {event.status}
            </span>
          </div>
          <p className="text-gray-400 font-bold mt-1 uppercase text-[10px] tracking-widest">Slug: {event.slug}</p>
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

        {/* LEDGER TABLE */}
        <div className="bg-white rounded-[48px] border border-gray-200 shadow-sm overflow-hidden">
             <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Transaction History</h2>
             </div>
             <table className="w-full text-left">
                <thead className="bg-white text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
                    <tr>
                        <th className="p-8">Customer</th>
                        <th className="p-8">Items</th>
                        <th className="p-8 text-right">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {orders.length === 0 ? (
                        <tr><td colSpan={3} className="p-32 text-center font-black text-gray-300 uppercase">No Data Found</td></tr>
                    ) : orders.map(order => (
                        <tr key={order.id} className="hover:bg-blue-50/20 transition-colors">
                            <td className="p-8">
                                <div className="font-black text-sm text-slate-900 uppercase">{order.customer_name || 'Walk-in'}</div>
                                <div className="text-[10px] text-gray-400 font-bold">{new Date(order.created_at).toLocaleString()}</div>
                            </td>
                            <td className="p-8">
                                <div className="flex flex-col gap-1">
                                    {order.order_items?.map((item: any, idx: number) => (
                                        <div key={idx} className="text-xs font-bold text-slate-600">
                                            <span className="text-slate-300 mr-2">{item.quantity}×</span> 
                                            {item.item_name} <span className="text-[9px] text-gray-400">({item.size})</span>
                                        </div>
                                    ))}
                                </div>
                            </td>
                            <td className="p-8 text-right">
                                <div className="font-black text-green-600 text-lg">${Number(order.total_price).toFixed(2)}</div>
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