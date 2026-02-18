'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';
import * as XLSX from 'xlsx';

export default function EventHistoryPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    setLoading(true);
    setErrorMsg('');
    
    // 1. Try fetching 'event_settings' (Most likely correct based on your past code)
    let { data: eventData, error: eventError } = await supabase
      .from('event_settings')
      .select('*')
      .order('start_date', { ascending: false });

    // 2. Fallback: If 'event_settings' fails, try 'events'
    if (eventError) {
        console.warn("event_settings failed, trying 'events' table...");
        const retry = await supabase
            .from('events')
            .select('*')
            .order('start_date', { ascending: false });
        
        if (retry.error) {
            setErrorMsg(`Database Error: ${retry.error.message}`);
            setLoading(false);
            return;
        }
        eventData = retry.data;
    }

    if (!eventData || eventData.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
    }

    // 3. SAFE Revenue Calculation
    // We wrap this in a try/catch so it doesn't crash the page if 'orders' table is missing
    const summaries = await Promise.all(eventData.map(async (ev) => {
        let revenue = 0;
        let count = 0;

        try {
            // Try fetching from 'orders' table
            const { data: orders, error: orderErr } = await supabase
                .from('orders')
                .select('total_price')
                .eq('event_slug', ev.slug);
            
            if (!orderErr && orders) {
                revenue = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
                count = orders.length;
            }
        } catch (e) {
            console.error("Revenue calc failed for", ev.slug);
        }

        return {
            ...ev,
            total_revenue: revenue,
            orders_count: count
        };
    }));

    setEvents(summaries);
    setLoading(false);
  }

  // --- EXCEL DOWNLOAD (Safe Version) ---
  const downloadReport = async (eventSlug: string, eventName: string) => {
    // We try to grab the data. If 'orders' doesn't exist, this returns an error.
    const { data: fullOrders, error } = await supabase
        .from('orders') 
        .select(`
            id, created_at, customer_name, customer_email, total_price,
            order_items ( sku, item_name, size, color, quantity, price )
        `)
        .eq('event_slug', eventSlug);

    if (error) return alert(`Export Error: ${error.message}\n(Check if table 'orders' exists)`);
    if (!fullOrders || fullOrders.length === 0) return alert("No orders found to export.");

    // Flatten Data
    const excelRows = fullOrders.flatMap(order => {
        // Handle cases where order_items might be null
        const items = order.order_items || [];
        if (items.length === 0) return [{
            "Date": new Date(order.created_at).toLocaleDateString(),
            "Customer": order.customer_name,
            "Total": order.total_price,
            "Note": "No Items"
        }];

        return items.map((item: any) => ({
            "Date": new Date(order.created_at).toLocaleDateString(),
            "Customer": order.customer_name || 'Walk-in',
            "Email": order.customer_email,
            "SKU": item.sku,
            "Product": item.item_name,
            "Size": item.size,
            "Color": item.color,
            "Qty": item.quantity,
            "Unit Price": item.price,
            "Line Total": item.quantity * item.price
        }));
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales");
    XLSX.writeFile(workbook, `${eventName}_Report.xlsx`);
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
          {/* Refresh Button */}
          <button onClick={fetchHistory} className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-xs font-bold uppercase hover:bg-gray-100">
            Refresh Data
          </button>
        </div>

        {/* ERROR MESSAGE DISPLAY */}
        {errorMsg && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl mb-6 flex items-center gap-4">
                <span className="text-2xl">⚠️</span>
                <div>
                    <h3 className="font-black text-red-600 uppercase text-xs">Connection Error</h3>
                    <p className="text-sm text-red-800">{errorMsg}</p>
                </div>
            </div>
        )}

        {/* LIST */}
        <div className="bg-white rounded-[40px] border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
             
             <table className="w-full text-left">
                <thead className="text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100 bg-white">
                    <tr>
                        <th className="p-6">Event Name</th>
                        <th className="p-6">Date</th>
                        <th className="p-6 text-center">Status</th>
                        <th className="p-6 text-right">Orders</th>
                        <th className="p-6 text-right">Total Revenue</th>
                        <th className="p-6 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {loading ? (
                        <tr><td colSpan={6} className="p-20 text-center font-bold text-gray-300 animate-pulse">LOADING HISTORY...</td></tr>
                    ) : events.length === 0 ? (
                        <tr><td colSpan={6} className="p-20 text-center font-bold text-gray-400 italic">No events found in database.</td></tr>
                    ) : events.map(ev => (
                        <tr key={ev.id} className="group hover:bg-blue-50/30 transition-all">
                            <td className="p-6">
                                <div className="font-bold text-lg text-slate-900">{ev.event_name}</div>
                                <div className="text-[10px] font-mono text-blue-500 font-bold uppercase">{ev.slug}</div>
                            </td>
                            <td className="p-6">
                                <span className="font-bold text-gray-500 text-sm">{ev.start_date ? new Date(ev.start_date).toLocaleDateString() : 'N/A'}</span>
                            </td>
                            <td className="p-6 text-center">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
                                    ${ev.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}
                                `}>
                                    {ev.status || 'Archived'}
                                </span>
                            </td>
                            <td className="p-6 text-right font-bold text-slate-700">
                                {ev.orders_count || 0}
                            </td>
                            <td className="p-6 text-right">
                                <span className="font-black text-xl text-green-600">${(ev.total_revenue || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </td>
                            <td className="p-6 text-right">
                                <div className="flex gap-2 justify-end">
                                    <button 
                                        onClick={() => downloadReport(ev.slug, ev.event_name)}
                                        className="px-4 py-2 rounded-xl bg-white border border-green-200 text-green-600 font-black text-[10px] uppercase tracking-widest hover:bg-green-50 transition-colors shadow-sm"
                                    >
                                        Excel
                                    </button>
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