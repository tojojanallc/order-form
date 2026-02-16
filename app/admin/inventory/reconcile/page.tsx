'use client';
import { useState, useEffect } from 'react';
// Use the absolute alias to fix the build error
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function Reconcile() {
  const [eventSlug, setEventSlug] = useState('');
  const [eventStock, setEventStock] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch events for the high-contrast dropdown
    supabase.from('event_settings').select('slug, event_name').then(({ data }) => setEvents(data || []));
  }, []);

  const loadStock = async (slug: string) => {
    if (!slug) return;
    setEventSlug(slug);
    const { data, error } = await supabase
      .from('inventory')
      .select('*, inventory_master(item_name)')
      .eq('event_slug', slug);
    
    if (error) alert("Error loading stock: " + error.message);
    setEventStock(data || []);
  };

  const returnAllToWarehouse = async () => {
    const itemsToProcess = eventStock.filter(s => s.count > 0);
    if (itemsToProcess.length === 0) return alert("No items with stock found to return.");
    
    if (!confirm(`Confirm: Move stock for ${itemsToProcess.length} items back to Warehouse?`)) return;

    setLoading(true);
    let successCount = 0;

    for (const item of itemsToProcess) {
      try {
        // 1. Fetch current Warehouse stock
        const { data: master, error: fetchErr } = await supabase
          .from('inventory_master')
          .select('quantity_on_hand')
          .eq('sku', item.product_id)
          .single();

        if (fetchErr || !master) continue; 

        // 2. Update Warehouse Total
        const { error: updateMasterErr } = await supabase
          .from('inventory_master')
          .update({ quantity_on_hand: (master.quantity_on_hand || 0) + item.count })
          .eq('sku', item.product_id);

        if (updateMasterErr) throw updateMasterErr;

        // 3. Zero out the Event count
        const { error: updateEventErr } = await supabase
          .from('inventory')
          .update({ count: 0 })
          .eq('id', item.id);

        if (updateEventErr) throw updateEventErr;
        
        successCount++;
      } catch (err) {
        console.error("Failed to reconcile:", err);
      }
    }

    setLoading(false);
    alert(`Reconciliation Complete: ${successCount} items returned to Warehouse.`);
    loadStock(eventSlug);
  };

  return (
    <div className="min-h-screen bg-white text-black p-8 max-w-5xl mx-auto border-x-4 border-black">
      <div className="flex justify-between items-center mb-8 border-b-4 border-black pb-4">
        <div>
          <Link href="/admin" className="text-blue-600 font-black uppercase text-xs hover:underline">← Dashboard</Link>
          <h1 className="text-4xl font-black uppercase mt-2">Reconcile Event</h1>
        </div>
      </div>

      <div className="mb-8 p-6 bg-gray-100 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <label className="block text-sm font-black uppercase mb-2">Event Selection</label>
        <select 
          className="w-full p-4 border-2 border-black rounded font-bold text-xl bg-white" 
          value={eventSlug}
          onChange={e => loadStock(e.target.value)}
        >
          <option value="">-- Choose Event to Close --</option>
          {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
        </select>
      </div>

      <div className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-black text-white">
            <tr>
              <th className="p-4 font-black uppercase text-xs">Product</th>
              <th className="p-4 font-black uppercase text-xs text-center">Remaining</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black">
            {eventStock.map(s => (
              <tr key={s.id} className={s.count === 0 ? "bg-gray-50 opacity-40" : ""}>
                <td className="p-4 font-black uppercase">
                  {s.inventory_master?.item_name || s.product_id}
                  <div className="text-[10px] text-gray-400">{s.product_id}</div>
                </td>
                <td className="p-4 text-center text-2xl font-black">{s.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-6 bg-gray-50 border-t-4 border-black flex justify-end">
          <button 
            onClick={returnAllToWarehouse} 
            disabled={loading}
            className="bg-red-600 text-white px-10 py-5 font-black uppercase text-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-red-700 disabled:bg-gray-400"
          >
            {loading ? 'Processing...' : 'End Event & Return Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}