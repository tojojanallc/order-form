'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';
import * as XLSX from 'xlsx'; 

export default function ReconcilePage() {
  const [eventSlug, setEventSlug] = useState('');
  const [eventStock, setEventStock] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [totals, setTotals] = useState({ value: 0, units: 0, cogs: 0 });
  const [showProfit, setShowProfit] = useState(false);

  useEffect(() => { fetchActiveEvents(); }, []);

  const fetchActiveEvents = async () => {
    const { data } = await supabase.from('event_settings').select('*').eq('status', 'active').order('event_name');
    setEvents(data || []);
  };

  const loadStockAndSales = async (slug: string) => {
    if (!slug) return;
    setEventSlug(slug);
    setFetching(true);
    const currentEvent = events.find(e => e.slug === slug);
    setSelectedEvent(currentEvent);

    // 1. Fetch current truck inventory + Master Cost
    const { data: invData } = await supabase
        .from('inventory')
        .select('*, inventory_master(item_name, cost_price)')
        .eq('event_slug', slug);
    
    // 2. Fetch all sales
    const { data: salesData } = await supabase
        .from('orders')
        .select('cart_data')
        .eq('event_slug', slug)
        .neq('status', 'refunded');

    const tally: any = {};
    let totalValue = 0;
    let totalUnits = 0;
    let calculatedCOGS = 0;

    salesData?.forEach(order => {
        const cart = Array.isArray(order.cart_data) ? order.cart_data : [];
        cart.forEach((item: any) => {
            const qty = item.quantity || 1;
            const price = Number(item.finalPrice) || 0;
            
            // --- DYNAMIC COST LOOKUP ---
            // We find the matching record from our inventory fetch to get the DB cost
            const invRecord = invData?.find(i => i.product_id === item.productId && i.size === item.size);
            
            // Use DB cost or fallback to $8.50 if not set
            const blankCost = invRecord?.inventory_master?.cost_price || 8.50; 
            const decorationFee = 1.00; // Ink, labor, and overhead
            
            calculatedCOGS += qty * (blankCost + decorationFee);
            totalValue += price;
            totalUnits += qty;

            const key = `${item.productId}_${item.size}`;
            tally[key] = (tally[key] || 0) + qty;
        });
    });

    const merged = invData?.map(item => {
        const sold = tally[`${item.product_id}_${item.size}`] || 0;
        return {
            ...item,
            sold: sold,
            initial: (item.count || 0) + sold,
            value: sold * (item.override_price || 30)
        };
    }) || [];
    
    setEventStock(merged);
    setTotals({ value: totalValue, units: totalUnits, cogs: calculatedCOGS });
    setFetching(false);
  };

  // ... (Keep existing endAndArchiveEvent and exportToExcel functions)

  const isHosted = selectedEvent?.payment_mode === 'hosted';
  const processingFee = isHosted ? 0 : (totals.value * 0.03); 
  const netProfit = totals.value - totals.cogs - processingFee;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto mb-10">
        <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase mb-1 inline-block">← Dashboard</Link>
        <h1 className="text-4xl font-black tracking-tight uppercase">Unload & Audit</h1>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Select Meet</label>
            <select className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" value={eventSlug} onChange={e => loadStockAndSales(e.target.value)}>
              <option value="">-- Active Trucks --</option>
              {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
            </select>
          </div>

          {eventSlug && (
            <div className={`p-8 rounded-[40px] shadow-2xl text-white transition-all duration-500 ${showProfit ? 'bg-emerald-900' : (isHosted ? 'bg-indigo-900' : 'bg-slate-950')}`}>
                <div className="flex justify-between items-center mb-6">
                    <p className="text-[10px] font-black uppercase text-white/40">{showProfit ? 'Profit Audit' : 'Revenue'}</p>
                    <button onClick={() => setShowProfit(!showProfit)} className="bg-white/10 px-3 py-1 rounded-full text-[9px] font-black uppercase">
                        {showProfit ? 'Show Revenue' : 'Show Profit'}
                    </button>
                </div>

                {showProfit ? (
                    <>
                        <p className="text-5xl font-black text-emerald-400">${netProfit.toFixed(2)}</p>
                        <div className="mt-6 space-y-2 border-t border-white/10 pt-6">
                            <div className="flex justify-between text-[10px] font-bold uppercase text-white/50">
                                <span>Total Inventory Cost</span>
                                <span>-${totals.cogs.toFixed(2)}</span>
                            </div>
                            <p className="text-[8px] text-white/30 italic">Cost based on Inventory Master records + $1.00 decoration</p>
                        </div>
                    </>
                ) : (
                    <p className={`text-5xl font-black ${isHosted ? 'text-indigo-300' : 'text-green-400'}`}>
                        ${totals.value.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </p>
                )}

                <button onClick={() => {/* archive logic */}} className="w-full mt-10 bg-red-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg">
                    Finalize & Return to Glendale
                </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-8">
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
                        <tr>
                            <th className="p-5">Item</th>
                            <th className="p-5 text-center">Sold</th>
                            <th className="p-5 text-right">Inventory Value</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {eventStock.map(s => (
                            <tr key={s.id}>
                                <td className="p-5">
                                    <div className="font-bold text-sm uppercase">{s.inventory_master?.item_name}</div>
                                    <div className="text-[10px] text-blue-500 font-bold">{s.size}</div>
                                </td>
                                <td className="p-5 text-center font-black text-red-500">-{s.sold}</td>
                                <td className="p-5 text-right font-black text-slate-900">${s.value.toFixed(2)}</td>
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