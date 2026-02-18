'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';
import * as XLSX from 'xlsx'; // Make sure to: npm install xlsx

export default function EventReportPage({ params }: { params: { slug: string } }) {
  const [event, setEvent] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState(0);

  useEffect(() => {
    if (params?.slug) fetchDetails(params.slug);
  }, [params?.slug]);

  async function fetchDetails(slug: string) {
    setLoading(true);
    try {
      const { data: eventData } = await supabase.from('event_settings').select('*').eq('slug', slug).maybeSingle();
      if (eventData) setEvent(eventData);

      const { data: eventOrders } = await supabase.from('orders').select('*').eq('event_slug', slug).order('created_at', { ascending: false });
      if (eventOrders) {
        setOrders(eventOrders);
        setRevenue(eventOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0));
      }
    } catch (err: any) { console.error(err.message); }
    finally { setLoading(false); }
  }

  // --- EXCEL EXPORT LOGIC ---
  const exportToExcel = () => {
    const reportData: any[] = [];

    orders.forEach(order => {
      const cart = Array.isArray(order.cart_data) ? order.cart_data : [];
      
      cart.forEach((item: any) => {
        // Flatten customizations for the spreadsheet
        const customNames = item.customizations?.names?.map((n: any) => n.text).join(', ') || '';
        const logos = item.customizations?.logos?.map((l: any) => l.type).join(', ') || '';
        
        reportData.push({
          'Date': new Date(order.created_at).toLocaleDateString(),
          'Time': new Date(order.created_at).toLocaleTimeString(),
          'Customer Name': order.customer_name || 'Walk-in',
          'Item': item.productName || item.item_name,
          'Size': item.size,
          'Quantity': item.quantity || 1,
          'Main Design': item.customizations?.mainDesign || '',
          'Custom Names': customNames,
          'Back Name List': item.customizations?.backList ? 'YES' : 'NO',
          'Accents': logos,
          'Price Paid': item.finalPrice || 0,
          'Order ID': order.id
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Report");
    
    // Generate file name based on event
    const fileName = `${event?.event_name.replace(/\s+/g, '_')}_Sales_Report.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-black text-gray-400 animate-pulse uppercase">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <Link href="/admin/events/history" className="text-blue-600 font-bold text-xs uppercase mb-1 inline-block hover:underline">← Back</Link>
            <h1 className="text-5xl font-black tracking-tighter">{event.event_name}</h1>
            <div className="flex gap-3 mt-4">
                <button 
                    onClick={exportToExcel}
                    className="bg-white border border-gray-200 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-all flex items-center gap-2 shadow-sm"
                >
                    <span>📊</span> Download Excel Export
                </button>
            </div>
          </div>
          
          <div className="bg-slate-950 text-white p-8 rounded-[40px] shadow-2xl text-right min-w-[300px]">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Meet Revenue</p>
            <p className="text-5xl font-black text-green-400">${revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
          </div>
        </div>

        <div className="bg-white rounded-[48px] border border-gray-200 shadow-sm overflow-hidden">
             <table className="w-full text-left">
                <thead className="bg-white text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
                    <tr>
                        <th className="p-8">Customer</th>
                        <th className="p-8">Configuration</th>
                        <th className="p-8 text-right">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {orders.map(order => (
                        <tr key={order.id} className="hover:bg-blue-50/10 transition-colors">
                            <td className="p-8">
                                <div className="font-black text-sm uppercase">{order.customer_name || 'Walk-in'}</div>
                                <div className="text-[10px] font-bold text-gray-400">{new Date(order.created_at).toLocaleTimeString()}</div>
                            </td>
                            <td className="p-8">
                                <div className="flex flex-col gap-4">
                                    {order.cart_data?.map((item: any, i: number) => (
                                        <div key={i} className="border-l-4 border-blue-500 pl-4 py-1">
                                            <div className="text-xs font-black text-slate-800 uppercase">
                                                {item.quantity || 1}× {item.productName} ({item.size})
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {item.customizations?.names?.map((n: any, idx: number) => (
                                                    <span key={idx} className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-purple-200">
                                                        {n.text}
                                                    </span>
                                                ))}
                                                {item.customizations?.backList && (
                                                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-orange-200">
                                                        Back List
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </td>
                            <td className="p-8 text-right font-black text-green-600 text-lg">${Number(order.total_price).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
             </table>
        </div>
      </div>
    </div>
  );
}