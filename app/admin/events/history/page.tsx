'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';
import * as XLSX from 'xlsx'; // You might need to run: npm install xlsx

interface EventSummary {
  id: string;
  slug: string;
  event_name: string;
  start_date: string;
  status: string;
  total_revenue: number;
  orders_count: number;
}

export default function EventHistoryPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    setLoading(true);
    
    // 1. Get all events
    const { data: eventData } = await supabase
      .from('event_settings')
      .select('*')
      .order('start_date', { ascending: false });

    if (!eventData) return setLoading(false);

    // 2. Calculate Revenue (Fixing the table name to 'orders')
    const summaries = await Promise.all(eventData.map(async (ev) => {
        // ERROR WAS HERE: changed .from('order') to .from('orders')
        const { data: orderData } = await supabase
            .from('orders') 
            .select('total_price')
            .eq('event_slug', ev.slug);

        const revenue = orderData?.reduce((sum, o) => sum + (o.total_price || 0), 0) || 0;
        const count = orderData?.length || 0;

        return {
            ...ev,
            total_revenue: revenue,
            orders_count: count
        };
    }));

    setEvents(summaries);
    setLoading(false);
  }

  // --- NEW: DOWNLOAD EXCEL FUNCTION ---
  const downloadReport = async (eventSlug: string, eventName: string) => {
    // 1. Fetch full order details for this event
    const { data: fullOrders, error } = await supabase
        .from('orders') // Targeted plural 'orders'
        .select(`
            id, 
            created_at, 
            customer_name, 
            customer_email, 
            total_price,
            order_items (
                sku, 
                item_name, 
                size, 
                color, 
                quantity, 
                price
            )
        `)
        .eq('event_slug', eventSlug);

    if (error) return alert("Error loading orders: " + error.message);
    if (!fullOrders || fullOrders.length === 0) return alert("No orders found for this event.");

    // 2. Flatten Data for Excel (One row per item)
    const excelRows = fullOrders.flatMap(order => 
        order.order_items.map((item: any) => ({
            "Order Date": new Date(order.created_at).toLocaleDateString(),
            "Customer": order.customer_name || 'Walk-in',
            "Email": order.customer_email,
            "SKU": item.sku,
            "Product": item.item_name,
            "Size": item.size,
            "Color": item.color,
            "Qty": item.quantity,
            "Unit Price": item.price,
            "Line Total": item.quantity * item.price,
            "Order Total": order.total_price // helpful for validation
        }))
    );

    // 3. Generate File
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Data");
    XLSX.writeFile(workbook, `${eventName}_Sales_Report.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-end mb-10">
          <div>
            <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block hover:underline">← Dashboard</Link>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Event Archive</h1>
            <p className="text-gray-500 font-medium">Performance history for Schroeder, Nicolet, and other meets.</p>
          </div>
        </div>

        {/* LIST */}
        <div className="bg-white rounded-[40px] border border-gray-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-gray-100 flex gap-4 bg-gray-50/50">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Past & Current Events</span>
             </div>
             
             <table className="w-full text-left">
                <thead className="text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100 bg-white">
                    <tr>
                        <th className="p-6">Event Name</th>
                        <th className="p-6">Date</th>
                        <th className="p-6 text-center">Status</th>
                        <th className="p-6 text-right">Orders</th>
                        <th className="p-6 text-right">Total Revenue</th>
                        <th className="p-6 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {loading ? (
                        <tr><td colSpan={6} className="p-20 text-center font-bold text-gray-300 animate-pulse">LOADING HISTORY...</td></tr>
                    ) : events.map(ev => (
                        <tr key={ev.id} className="group hover:bg-blue-50/30 transition-all">
                            <td className="p-6">
                                <div className="font-bold text-lg text-slate-900">{ev.event_name}</div>
                                <div className="text-[10px] font-mono text-blue-500 font-bold uppercase">{ev.slug}</div>
                            </td>
                            <td className="p-6">
                                <span className="font-bold text-gray-500 text-sm">{new Date(ev.start_date).toLocaleDateString()}</span>
                            </td>
                            <td className="p-6 text-center">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
                                    ${ev.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}
                                `}>
                                    {ev.status}
                                </span>
                            </td>
                            <td className="p-6 text-right font-bold text-slate-700">
                                {ev.orders_count}
                            </td>
                            <td className="p-6 text-right">
                                <span className="font-black text-xl text-green-600">${ev.total_revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </td>
                            <td className="p-6 text-right">
                                <div className="flex gap-2 justify-end">
                                    <button 
                                        onClick={() => downloadReport(ev.slug, ev.event_name)}
                                        className="px-4 py-2 rounded-xl bg-white border border-green-200 text-green-600 font-black text-[10px] uppercase tracking-widest hover:bg-green-50 transition-colors shadow-sm"
                                    >
                                        Export Excel
                                    </button>
                                    <Link 
                                        href={`/admin/events/${ev.slug}`}
                                        className="px-4 py-2 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-colors shadow-sm"
                                    >
                                        View
                                    </Link>
                                </div>
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