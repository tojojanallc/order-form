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
      // 1. Fetch Event Header Info
      const { data: eventData } = await supabase
        .from('event_settings')
        .select('event_name, slug, status') 
        .eq('slug', slug)
        .maybeSingle();

      if (eventData) setEvent(eventData);

      // 2. Fetch Orders specifically for this event
      const { data: eventOrders, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('event_slug', slug)
        .order('created_at', { ascending: false });

      if (orderErr) throw orderErr;

      if (eventOrders) {
        setOrders(eventOrders);
        // Calculate Total Revenue from this meet
        const total = eventOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
        setRevenue(total);
      }
    } catch (err: any) {
      console.error("Error loading report:", err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin text-4xl mb-4">🔄</div>
        <p className="font-black uppercase tracking-widest text-gray-400">Loading History...</p>
      </div>
    </div>
  );

  if (!event) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center font-black text-gray-400 uppercase">
      Event Not Found
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER SECTION */}
        <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <Link href="/admin/events/history" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block hover:underline">
              ← Back to Archive
            </Link>
            <h1 className="text-5xl font-black tracking-tighter text-slate-900 leading-none">{event.event_name}</h1>
            <p className="text-gray-400 font-bold mt-2 uppercase text-[10px] tracking-widest">
                Event Performance Audit • {event.slug}
            </p>
          </div>
          
          <div className="bg-slate-950 text-white p-8 rounded-[40px] shadow-2xl text-right min-w-[300px]">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Meet Revenue</p>
            <p className="text-5xl font-black text-green-400">
                ${revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}
            </p>
          </div>
        </div>

        {/* MAIN LEDGER */}
        <div className="bg-white rounded-[48px] border border-gray-200 shadow-sm overflow-hidden">
             <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sales Ledger</h2>
                <div className="flex gap-4">
                    <span className="text-[10px] font-black text-slate-300 uppercase">{orders.length} Total Transactions</span>
                </div>
             </div>
             
             <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-white text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
                        <tr>
                            <th className="p-8">Customer / Time</th>
                            <th className="p-8">Swag Configuration</th>
                            <th className="p-8 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {orders.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="p-32 text-center font-black text-gray-300 uppercase italic tracking-widest">
                                    No sales data found for this event
                                </td>
                            </tr>
                        ) : orders.map(order => (
                            <tr key={order.id} className="hover:bg-blue-50/20 transition-colors">
                                {/* 1. Customer Info */}
                                <td className="p-8 whitespace-nowrap">
                                    <div className="font-black text-sm text-slate-900 uppercase leading-none mb-1">
                                        {order.customer_name || 'Walk-in Customer'}
                                    </div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                        {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {new Date(order.created_at).toLocaleDateString()}
                                    </div>
                                </td>
                                
                                {/* 2. Cart Items & Customizations */}
                                <td className="p-8">
                                    <div className="flex flex-col gap-4">
                                        {Array.isArray(order.cart_data) && order.cart_data.map((item: any, i: number) => (
                                            <div key={i} className="border-l-4 border-blue-500 pl-4 py-1">
                                                <div className="text-xs font-black text-slate-800 uppercase flex items-center gap-2">
                                                    <span className="text-blue-500">{item.quantity || 1}×</span> 
                                                    {item.productName || item.item_name}
                                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] text-slate-500 font-black">
                                                        {item.size}
                                                    </span>
                                                </div>

                                                {/* BADGES FOR PERSONALIZATION */}
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {/* Main Design */}
                                                    {item.customizations?.mainDesign && (
                                                        <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-gray-200">
                                                            {item.customizations.mainDesign}
                                                        </span>
                                                    )}

                                                    {/* Custom Names */}
                                                    {item.customizations?.names?.map((n: any, idx: number) => (
                                                        <span key={idx} className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-purple-200 shadow-sm">
                                                            NAME: {n.text}
                                                        </span>
                                                    ))}

                                                    {/* Back Name List */}
                                                    {item.customizations?.backList && (
                                                        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-orange-200 shadow-sm">
                                                            + Back Name List
                                                        </span>
                                                    )}

                                                    {/* Accents / Logos */}
                                                    {item.customizations?.logos?.map((l: any, idx: number) => (
                                                        <span key={idx} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-blue-100">
                                                            {l.type}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </td>

                                {/* 3. Revenue */}
                                <td className="p-8 text-right">
                                    <div className="font-black text-green-600 text-xl tracking-tighter">
                                        ${(Number(order.total_price) || 0).toFixed(2)}
                                    </div>
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