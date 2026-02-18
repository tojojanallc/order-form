'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';
import * as XLSX from 'xlsx'; 

export default function EventReportPage({ params }: { params: { slug: string } }) {
  const [event, setEvent] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState(0);

  useEffect(() => {
    if (params?.slug) fetchDetails(params.slug);
  }, [params?.slug]);

  async function fetchDetails(slug: string) {
    setLoading(true);
    try {
      // 1. Fetch Event Settings to check Payment Mode (Retail vs Hosted)
      const { data: eventData } = await supabase
        .from('event_settings')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (eventData) setEvent(eventData);

      // 2. Fetch all orders specifically for this meet
      const { data: eventOrders, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('event_slug', slug)
        .order('created_at', { ascending: false });

      if (orderErr) throw orderErr;

      if (eventOrders) {
        setOrders(eventOrders);
        const total = eventOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
        setRevenue(total);
      }
    } catch (err: any) {
      console.error("Report Loading Error:", err.message);
    } finally {
      setLoading(false);
    }
  }

  // --- SEARCH FILTER: Matches Customer Name OR Custom Names inside the JSON ---
  const filteredOrders = orders.filter(order => {
    const term = searchTerm.toLowerCase();
    const customerMatch = (order.customer_name || '').toLowerCase().includes(term);
    
    const cart = Array.isArray(order.cart_data) ? order.cart_data : [];
    const customNameMatch = cart.some((item: any) => {
        const names = item.customizations?.names?.map((n: any) => n.text.toLowerCase()) || [];
        return names.some((name: string) => name.includes(term));
    });

    return customerMatch || customNameMatch;
  });

  // --- EXCEL EXPORT: Flattens the cart JSON for easy spreadsheet use ---
  const exportToExcel = () => {
    const reportData: any[] = [];

    filteredOrders.forEach(order => {
      const cart = Array.isArray(order.cart_data) ? order.cart_data : [];
      cart.forEach((item: any) => {
        reportData.push({
          'Date': new Date(order.created_at).toLocaleDateString(),
          'Customer': order.customer_name || 'Walk-in',
          'Item': item.productName || item.item_name,
          'Size': item.size,
          'Main Design': item.customizations?.mainDesign || '',
          'Custom Names': item.customizations?.names?.map((n: any) => n.text).join(', ') || '',
          'Back Roster': item.customizations?.backList ? 'YES' : 'NO',
          'Total Order Price': order.total_price
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Event Sales");
    XLSX.writeFile(workbook, `${event?.slug}_Sales_Export.xlsx`);
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-black text-gray-400 animate-pulse uppercase tracking-widest">Generating Meet Report...</div>;

  const isHosted = event?.payment_mode === 'hosted';

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER & CONTROLS */}
        <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="flex-1">
            <Link href="/admin/events/history" className="text-blue-600 font-bold text-xs uppercase mb-1 inline-block hover:underline tracking-widest">
              ← Back to Event History
            </Link>
            <h1 className="text-5xl font-black tracking-tighter text-slate-900 mb-6">{event?.event_name}</h1>
            
            <div className="relative max-w-xl group">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl">🔍</span>
                <input 
                    type="text"
                    placeholder="Search Parent or Athlete names..."
                    className="w-full pl-14 pr-6 py-5 bg-white border-2 border-gray-100 rounded-[28px] font-bold text-slate-800 shadow-sm focus:border-blue-500 outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-4">
              <button 
                onClick={exportToExcel}
                className="bg-white border border-gray-200 px-6 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-green-50 hover:text-green-600 transition-all shadow-sm"
              >
                📊 Download Spreadsheet
              </button>

              {/* DYNAMIC REVENUE DISPLAY */}
              <div className={`p-8 rounded-[40px] shadow-2xl text-right min-w-[320px] ${isHosted ? 'bg-indigo-900' : 'bg-slate-950'}`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                    {isHosted ? 'Total Invoiced Value' : 'Net Meet Revenue'}
                </p>
                <p className={`text-5xl font-black ${isHosted ? 'text-indigo-300' : 'text-green-400'}`}>
                    ${revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </p>
                {isHosted && (
                    <p className="text-[9px] font-bold text-indigo-400 uppercase mt-2 tracking-widest italic">
                        * Tracked for Party Mode Host Billing
                    </p>
                )}
              </div>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="bg-white rounded-[48px] border border-gray-200 shadow-sm overflow-hidden min-h-[500px]">
             <table className="w-full text-left">
                <thead className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
                    <tr>
                        <th className="p-8">Customer & Date</th>
                        <th className="p-8">Garment Configuration</th>
                        <th className="p-8 text-right">Total Price</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {filteredOrders.length === 0 ? (
                        <tr><td colSpan={3} className="p-32 text-center font-black text-gray-300 uppercase italic">No matches for your search</td></tr>
                    ) : filteredOrders.map(order => (
                        <tr key={order.id} className="hover:bg-blue-50/10 transition-colors">
                            <td className="p-8">
                                <div className="font-black text-sm text-slate-900 uppercase">{order.customer_name || 'Walk-in'}</div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase">
                                    {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                            </td>
                            <td className="p-8">
                                <div className="flex flex-col gap-4">
                                    {order.cart_data?.map((item: any, i: number) => (
                                        <div key={i} className="border-l-4 border-blue-500 pl-4 py-1">
                                            <div className="text-xs font-black text-slate-800 uppercase flex items-center gap-2">
                                                <span className="text-blue-500">{item.quantity || 1}×</span> 
                                                {item.productName} ({item.size})
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {/* Athlete Names Badge */}
                                                {item.customizations?.names?.map((n: any, idx: number) => (
                                                    <span key={idx} className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-purple-200 shadow-sm">
                                                        NAME: {n.text}
                                                    </span>
                                                ))}

                                                {/* Back Roster Badge */}
                                                {item.customizations?.backList && (
                                                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-orange-200">
                                                        + Back Name List
                                                    </span>
                                                )}

                                                {/* Main Design & Accents */}
                                                {item.customizations?.mainDesign && (
                                                    <span className="bg-gray-100 text-gray-400 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                                                        {item.customizations.mainDesign}
                                                    </span>
                                                )}
                                                {item.customizations?.logos?.map((l: any, idx: number) => (
                                                    <span key={idx} className="bg-blue-50 text-blue-500 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-blue-100">
                                                        {l.type}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </td>
                            <td className="p-8 text-right font-black text-green-600 text-xl tracking-tighter">
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