'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function EventReportPage({ params }: { params: { slug: string } }) {
  const [event, setEvent] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stats
  const [revenue, setRevenue] = useState(0);
  const [itemsSold, setItemsSold] = useState(0);

  useEffect(() => {
    fetchDetails();
  }, []);

  async function fetchDetails() {
    setLoading(true);

    // 1. Get Event Settings (The Add-ons & Info)
    const { data: eventData } = await supabase
      .from('event_settings')
      .select('*')
      .eq('slug', params.slug)
      .single();

    if (eventData) setEvent(eventData);

    // 2. Get Orders (The Revenue)
    // We select order items too so we can count total items sold
    const { data: orderData } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('event_slug', params.slug)
      .order('created_at', { ascending: false });

    if (orderData) {
      setOrders(orderData);
      
      // Calculate Totals
      const totalRev = orderData.reduce((sum, o) => sum + (o.total_price || 0), 0);
      const totalItems = orderData.reduce((sum, o) => sum + (o.order_items?.length || 0), 0);
      
      setRevenue(totalRev);
      setItemsSold(totalItems);
    }
    
    setLoading(false);
  }

  if (loading) return <div className="p-20 text-center font-black animate-pulse uppercase text-gray-300">Loading Report...</div>;
  if (!event) return <div className="p-20 text-center">Event not found.</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <div className="mb-8">
          <Link href="/admin/events/history" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block hover:underline">← Back to Archive</Link>
          <div className="flex justify-between items-end">
            <h1 className="text-4xl font-black tracking-tight text-slate-900">{event.event_name}</h1>
            <span className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest
                ${event.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}
            `}>
                {event.status}
            </span>
          </div>
          <p className="text-gray-500 font-medium mt-1">{event.location} • {new Date(event.start_date).toLocaleDateString()}</p>
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Revenue</p>
                <p className="text-4xl font-black text-green-400">${revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
            <div className="bg-white p-6 rounded-[32px] border border-gray-200 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Orders Processed</p>
                <p className="text-3xl font-black text-slate-900">{orders.length}</p>
            </div>
            <div className="bg-white p-6 rounded-[32px] border border-gray-200 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Items Sold</p>
                <p className="text-3xl font-black text-blue-600">{itemsSold}</p>
            </div>
            
            {/* CONFIG CARD */}
            <div className="bg-white p-6 rounded-[32px] border border-purple-100 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Active Add-ons</p>
                <div className="flex flex-wrap gap-2">
                    {event.enable_custom_names ? (
                        <span className="bg-purple-600 text-white px-2 py-1 rounded text-[10px] font-black uppercase">Custom Names</span>
                    ) : <span className="text-xs text-gray-300 font-bold">No Custom Names</span>}
                    
                    {event.enable_heat_sheets ? (
                         <span className="bg-orange-500 text-white px-2 py-1 rounded text-[10px] font-black uppercase">Heat Sheets</span>
                    ) : <span className="text-xs text-gray-300 font-bold">No Heat Sheets</span>}
                </div>
            </div>
        </div>

        {/* ON-SCREEN ORDER LIST */}
        <div className="bg-white rounded-[40px] border border-gray-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sales Ledger</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">{orders.length} Transactions</span>
             </div>
             
             <div className="max-h-[600px] overflow-y-auto">
                 <table className="w-full text-left">
                    <thead className="sticky top-0 bg-white shadow-sm z-10 text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
                        <tr>
                            <th className="p-6">Time</th>
                            <th className="p-6">Customer</th>
                            <th className="p-6">Items Purchased</th>
                            <th className="p-6 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {orders.length === 0 ? (
                            <tr><td colSpan={4} className="p-20 text-center font-bold text-gray-400 italic">No orders recorded for this event.</td></tr>
                        ) : orders.map(order => (
                            <tr key={order.id} className="hover:bg-blue-50/20 transition-colors">
                                <td className="p-6 whitespace-nowrap">
                                    <div className="font-bold text-xs text-slate-700">{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                    <div className="text-[10px] font-bold text-gray-400">{new Date(order.created_at).toLocaleDateString()}</div>
                                </td>
                                <td className="p-6">
                                    <div className="font-black text-sm text-slate-900 uppercase">{order.customer_name || 'Walk-in Customer'}</div>
                                    <div className="text-[10px] text-gray-400 font-bold">{order.customer_email}</div>
                                </td>
                                <td className="p-6">
                                    <div className="flex flex-col gap-1">
                                        {order.order_items?.map((item: any, idx: number) => (
                                            <div key={idx} className="text-xs font-bold text-slate-600">
                                                <span className="text-slate-400 mr-2">{item.quantity}x</span> 
                                                {item.item_name} <span className="text-[10px] text-gray-400 uppercase">({item.size})</span>
                                            </div>
                                        ))}
                                    </div>
                                </td>
                                <td className="p-6 text-right">
                                    <div className="font-black text-green-600">${order.total_price?.toFixed(2)}</div>
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