'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';
import * as XLSX from 'xlsx';

export default function ReconcilePage() {
  const [eventSlug, setEventSlug] = useState('');
  const [eventStock, setEventStock] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // --- STATS, EXPENSES & FEES ---
  const [totals, setTotals] = useState({ value: 0, units: 0, cogs: 0, fees: 0 });
  const [expenses, setExpenses] = useState({ staffing: 0, truck: 0, travel: 0, misc: 0 });

  useEffect(() => { fetchActiveEvents(); }, []);

  const fetchActiveEvents = async () => {
    const { data } = await supabase.from('event_settings').select('*').eq('status', 'active');
    setEvents(data || []);
  };

  const loadStockAndSales = async (slug: string) => {
    if (!slug) return;
    setEventSlug(slug);
    setFetching(true);
    const currentEvent = events.find(e => e.slug === slug);
    setSelectedEvent(currentEvent);

    const { data: invData } = await supabase.from('inventory').select('*, inventory_master(item_name, cost_price)').eq('event_slug', slug);
    const { data: salesData } = await supabase.from('orders').select('cart_data, total_price, payment_method').eq('event_slug', slug).neq('status', 'refunded');

    let totalValue = 0, totalUnits = 0, totalCogs = 0, totalCCFees = 0;
    const tally: any = {};

    salesData?.forEach(order => {
        const orderTotal = Number(order.total_price) || 0;
        if (order.payment_method !== 'cash' && orderTotal > 0) {
            totalCCFees += (orderTotal * 0.026) + 0.15;
        }

        (order.cart_data || []).forEach((item: any) => {
            const qty = item.quantity || 1;
            const invRecord = invData?.find(i => i.product_id === item.productId && i.size === item.size);
            const blankCost = invRecord?.inventory_master?.cost_price || 8.50;
            
            totalValue += (Number(item.finalPrice) || 0);
            totalUnits += qty;
            totalCogs += qty * (blankCost + 1.00); 

            const key = `${item.productId}_${item.size}`;
            tally[key] = (tally[key] || 0) + qty;
        });
    });

    setEventStock(invData?.map(item => ({
        ...item,
        sold: tally[`${item.product_id}_${item.size}`] || 0,
        initial: (item.count || 0) + (tally[`${item.product_id}_${item.size}`] || 0)
    })) || []);

    setTotals({ value: totalValue, units: totalUnits, cogs: totalCogs, fees: totalCCFees });
    setFetching(false);
  };

  const totalExpenses = expenses.staffing + expenses.truck + expenses.travel + expenses.misc;
  const netProfit = totals.value - totals.cogs - totals.fees - totalExpenses;

  const handleArchive = async () => {
    if (!confirm("Confirm Final Audit? This returns stock to Glendale and archives the meet.")) return;
    setLoading(true);
    try {
        await supabase.from('event_settings').update({
            status: 'archived',
            staffing_cost: expenses.staffing,
            truck_rental_cost: expenses.truck,
            travel_gas_cost: expenses.travel,
            misc_expenses: expenses.misc,
            total_processing_fees: totals.fees,
            total_invoiced_value: totals.value
        }).eq('slug', eventSlug);

        for (const item of eventStock) {
            if (item.count > 0) {
                const { data: master } = await supabase.from('inventory_master').select('quantity_on_hand').eq('sku', item.product_id).eq('size', item.size).single();
                if (master) {
                    await supabase.from('inventory_master').update({ quantity_on_hand: master.quantity_on_hand + item.count }).eq('sku', item.product_id).eq('size', item.size);
                }
            }
        }
        await supabase.from('inventory').delete().eq('event_slug', eventSlug);
        window.location.href = "/admin/events/history";
    } catch (err: any) { alert(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      
      {/* RESTORED HEADER WITH DASHBOARD LINK */}
      <div className="max-w-7xl mx-auto mb-10">
        <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase hover:underline mb-2 inline-block tracking-widest">
            ← Command Center
        </Link>
        <h1 className="text-5xl font-black tracking-tighter uppercase leading-none">Unload & Audit</h1>
        <p className="text-gray-400 font-bold mt-2 uppercase text-[10px] tracking-widest">Finalize meet financials and return inventory to Glendale</p>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT: AUDIT PANEL */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-3xl border shadow-sm">
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-4 tracking-widest">1. Choose Meet</label>
            <select className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" value={eventSlug} onChange={e => loadStockAndSales(e.target.value)}>
              <option value="">-- Active Trucks --</option>
              {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
            </select>
          </div>

          {eventSlug && (
            <>
              <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
                <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">2. Event Expenses</h2>
                <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[9px] font-black text-gray-400 uppercase">Staffing</label><input type="number" className="w-full p-3 bg-gray-50 border rounded-xl font-bold" value={expenses.staffing} onChange={e => setExpenses({...expenses, staffing: Number(e.target.value)})} /></div>
                    <div><label className="text-[9px] font-black text-gray-400 uppercase">Truck</label><input type="number" className="w-full p-3 bg-gray-50 border rounded-xl font-bold" value={expenses.truck} onChange={e => setExpenses({...expenses, truck: Number(e.target.value)})} /></div>
                    <div><label className="text-[9px] font-black text-gray-400 uppercase">Travel</label><input type="number" className="w-full p-3 bg-gray-50 border rounded-xl font-bold" value={expenses.travel} onChange={e => setExpenses({...expenses, travel: Number(e.target.value)})} /></div>
                    <div><label className="text-[9px] font-black text-gray-400 uppercase">Misc</label><input type="number" className="w-full p-3 bg-gray-50 border rounded-xl font-bold" value={expenses.misc} onChange={e => setExpenses({...expenses, misc: Number(e.target.value)})} /></div>
                </div>
              </div>

              <div className={`p-8 rounded-[40px] shadow-2xl text-white transition-all duration-500 ${netProfit > 0 ? 'bg-emerald-950' : 'bg-slate-900'}`}>
                <p className="text-[10px] font-black uppercase text-white/40 text-center mb-1">True Net Profit</p>
                <p className="text-5xl font-black text-center text-emerald-400 mb-8">${netProfit.toFixed(2)}</p>
                
                <div className="space-y-2 border-t border-white/10 pt-6">
                    <div className="flex justify-between text-[10px] font-bold uppercase text-white/30"><span>Invoiced/Retail Value</span><span>${totals.value.toFixed(2)}</span></div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-white/30"><span>Garment COGS</span><span>-${totals.cogs.toFixed(2)}</span></div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-orange-400"><span>Square CC Fees</span><span>-${totals.fees.toFixed(2)}</span></div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-white/30"><span>Manual Expenses</span><span>-${totalExpenses.toFixed(2)}</span></div>
                </div>

                <button onClick={handleArchive} disabled={loading} className="w-full mt-8 bg-red-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-700 shadow-xl transition-all">
                    {loading ? 'Finalizing...' : 'Unload Truck & Close Meet'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* RIGHT: STOCK VIEW */}
        <div className="lg:col-span-8">
            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden min-h-[500px]">
                <div className="p-6 bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest flex justify-between items-center">
                    <span>Stock Verification</span>
                    {eventSlug && <span className="text-blue-400">{totals.units} Units Pressed</span>}
                </div>
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase border-b tracking-widest">
                        <tr>
                            <th className="p-8">Garment</th>
                            <th className="p-8 text-center">Initial</th>
                            <th className="p-8 text-center">Sold</th>
                            <th className="p-8 text-right pr-12">Remaining</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {fetching ? (
                            <tr><td colSpan={4} className="p-32 text-center animate-pulse font-black text-gray-300 uppercase tracking-widest">Calculating Audit Data...</td></tr>
                        ) : eventStock.length > 0 ? (
                            eventStock.map(s => (
                                <tr key={s.id} className="hover:bg-blue-50/10 transition-colors">
                                    <td className="p-8">
                                        <div className="font-black text-sm uppercase text-slate-800 leading-none mb-1">{s.inventory_master?.item_name}</div>
                                        <div className="text-[10px] font-bold text-blue-500 uppercase tracking-tight">{s.size}</div>
                                    </td>
                                    <td className="p-8 text-center font-bold text-gray-300">{s.initial}</td>
                                    <td className="p-8 text-center font-black text-red-500">-{s.sold}</td>
                                    <td className="p-8 text-right font-black text-slate-900 text-xl pr-12">{s.count}</td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={4} className="p-32 text-center font-black text-gray-300 uppercase italic">Select a meet to view stock counts</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
}
