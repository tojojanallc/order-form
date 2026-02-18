'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';
import * as XLSX from 'xlsx'; 

export default function ReconcilePage() {
  const [eventSlug, setEventSlug] = useState('');
  const [eventStock, setEventStock] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null); // To check hosted vs retail
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [totals, setTotals] = useState({ value: 0, units: 0 });

  useEffect(() => {
    fetchActiveEvents();
  }, []);

  const fetchActiveEvents = async () => {
    const { data } = await supabase
      .from('event_settings')
      .select('*')
      .eq('status', 'active')
      .order('event_name');
    setEvents(data || []);
  };

  const loadStockAndSales = async (slug: string) => {
    if (!slug) {
        setEventSlug('');
        setEventStock([]);
        return;
    };
    setEventSlug(slug);
    setFetching(true);

    const currentEvent = events.find(e => e.slug === slug);
    setSelectedEvent(currentEvent);

    // 1. Fetch remaining inventory on truck
    const { data: invData } = await supabase
      .from('inventory')
      .select('*, inventory_master(item_name, cost_price)')
      .eq('event_slug', slug);
    
    // 2. Fetch all sales orders for this event
    const { data: salesData } = await supabase
      .from('orders')
      .select('cart_data, total_price')
      .eq('event_slug', slug)
      .neq('status', 'refunded');

    // 3. Tally Sales from Cart Data
    const tally: any = {};
    let totalMeetValue = 0;
    let totalUnitsSold = 0;

    salesData?.forEach(order => {
        const cart = Array.isArray(order.cart_data) ? order.cart_data : [];
        cart.forEach((item: any) => {
            const key = `${item.productId}_${item.size}`;
            tally[key] = (tally[key] || 0) + (item.quantity || 1);
            totalMeetValue += (Number(item.finalPrice) || 0);
            totalUnitsSold += (item.quantity || 1);
        });
    });

    // 4. Merge Inventory with Sales for the "Full Picture"
    const merged = invData?.map(item => {
        const sold = tally[`${item.product_id}_${item.size}`] || 0;
        return {
            ...item,
            sold: sold,
            initial: (item.count || 0) + sold, // Current + Sold = Start
            value: sold * (item.override_price || 30)
        };
    }) || [];
    
    setEventStock(merged);
    setTotals({ value: totalMeetValue, units: totalUnitsSold });
    setFetching(false);
  };

  const exportToExcel = () => {
    const data = eventStock.map(row => ({
        'Item': row.inventory_master?.item_name || row.product_id,
        'Size': row.size,
        'Started With': row.initial,
        'Units Sold': row.sold,
        'Remaining (Returned)': row.count,
        'Line Value': row.value
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reconciliation");
    XLSX.writeFile(wb, `${eventSlug}_Reconcile_Report.xlsx`);
  };

  const endAndArchiveEvent = async () => {
    if (!eventSlug) return;
    const confirmMsg = `This will return ${eventStock.reduce((sum, i) => sum + i.count, 0)} items to the Master Warehouse and ARCHIVE the event. Proceed?`;
    if (!confirm(confirmMsg)) return;

    setLoading(true);
    try {
      // 1. Return Stock to Warehouse
      for (const item of eventStock) {
        if (item.count > 0) {
          const { data: master } = await supabase.from('inventory_master').select('quantity_on_hand').eq('sku', item.product_id).eq('size', item.size).maybeSingle();
          if (master) {
            await supabase.from('inventory_master').update({ quantity_on_hand: (master.quantity_on_hand || 0) + item.count }).eq('sku', item.product_id).eq('size', item.size);
          }
        }
      }
      // 2. Cleanup & Archive
      await supabase.from('inventory').delete().eq('event_slug', eventSlug);
      await supabase.from('event_settings').update({ status: 'archived' }).eq('slug', eventSlug);

      alert("Reconciliation Complete.");
      window.location.href = '/admin/events/history';
    } catch (err: any) { alert(err.message); }
    finally { setLoading(false); }
  };

  const isHosted = selectedEvent?.payment_mode === 'hosted';

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto mb-10 flex justify-between items-end">
        <div>
          <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase hover:underline mb-1 inline-block tracking-widest">← Dashboard</Link>
          <h1 className="text-4xl font-black tracking-tight">Unload Truck & Close</h1>
        </div>
        {eventStock.length > 0 && (
            <button onClick={exportToExcel} className="bg-white border border-gray-200 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-50 shadow-sm">
                📊 Download Excel Report
            </button>
        )}
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">1. Select Active Truck</label>
            <select className="w-full p-3 bg-gray-50 border rounded-xl font-bold" value={eventSlug} onChange={e => loadStockAndSales(e.target.value)}>
              <option value="">-- Active Events --</option>
              {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
            </select>
          </div>

          {eventSlug && (
            <div className={`p-8 rounded-[32px] shadow-2xl text-white ${isHosted ? 'bg-indigo-900' : 'bg-slate-950'}`}>
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">
                    {isHosted ? 'Total Invoiced Value' : 'Retail Meet Revenue'}
                </p>
                <p className={`text-4xl font-black ${isHosted ? 'text-indigo-300' : 'text-green-400'}`}>
                    ${totals.value.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </p>
                <div className="mt-6 pt-6 border-t border-white/10">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Total Units Sold</p>
                    <p className="text-2xl font-black">{totals.units} Garments</p>
                </div>
                <button 
                  onClick={endAndArchiveEvent}
                  disabled={loading}
                  className="w-full mt-8 bg-red-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-red-700 shadow-lg active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? 'Archiving...' : 'Unload & Finalize'}
                </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 font-black uppercase text-[10px] tracking-widest">
                Reconciliation Details
            </div>
            <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
                    <tr>
                        <th className="p-5">Item / Size</th>
                        <th className="p-5 text-center">Started</th>
                        <th className="p-5 text-center">Sold</th>
                        <th className="p-5 text-right">Remaining</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {fetching ? (
                        <tr><td colSpan={4} className="p-20 text-center animate-pulse font-black text-gray-300 uppercase">Syncing Sales...</td></tr>
                    ) : eventStock.map(s => (
                        <tr key={s.id} className="hover:bg-blue-50/20 transition-colors">
                            <td className="p-5">
                                <div className="font-bold text-gray-900 uppercase text-sm">{s.inventory_master?.item_name || s.product_id}</div>
                                <div className="text-[10px] font-mono text-blue-500 font-bold">{s.size}</div>
                            </td>
                            <td className="p-5 text-center font-bold text-gray-400">{s.initial}</td>
                            <td className="p-5 text-center font-black text-red-500">-{s.sold}</td>
                            <td className="p-5 text-right font-black text-slate-900 text-lg pr-10">{s.count}</td>
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