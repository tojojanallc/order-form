'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../supabase';
import Link from 'next/link';

export default function Reconcile() {
  const [eventSlug, setEventSlug] = useState('');
  const [eventStock, setEventStock] = useState([]);
  const [events, setEvents] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Fetch all events to populate the dropdown
    supabase.from('event_settings').select('slug, event_name').then(({ data }) => setEvents(data || []));
  }, []);

  const loadStock = async (slug: string) => {
    if (!slug) return;
    setEventSlug(slug);
    // Join with master to get the name for better visibility
    const { data, error } = await supabase
        .from('inventory')
        .select('*, inventory_master(item_name)')
        .eq('event_slug', slug);
    
    if (error) console.error("Load Error:", error);
    setEventStock(data || []);
  };

  const returnAllToWarehouse = async () => {
    const itemsToMove = eventStock.filter(s => s.count > 0);
    
    if (itemsToMove.length === 0) {
        return alert("No stock found to return for this event.");
    }

    if (!confirm(`Move ${itemsToMove.length} product lines back to Warehouse?`)) return;

    setIsProcessing(true);
    try {
      for (const item of itemsToMove) {
        console.log(`Returning ${item.count} of ${item.product_id} to warehouse...`);

        // 1. Get current warehouse count
        const { data: master, error: fetchError } = await supabase
            .from('inventory_master')
            .select('quantity_on_hand')
            .eq('sku', item.product_id)
            .single();

        if (fetchError) {
            console.error(`Could not find SKU ${item.product_id} in Master`, fetchError);
            continue;
        }

        // 2. Add event stock to warehouse
        const { error: updateMasterError } = await supabase
            .from('inventory_master')
            .update({ quantity_on_hand: (master?.quantity_on_hand || 0) + item.count })
            .eq('sku', item.product_id);

        if (updateMasterError) throw updateMasterError;

        // 3. Zero out the event stock
        const { error: updateEventError } = await supabase
            .from('inventory')
            .update({ count: 0 })
            .eq('id', item.id);

        if (updateEventError) throw updateEventError;
      }

      alert("✅ Reconciliation Complete. Master Warehouse updated.");
      loadStock(eventSlug); // Refresh the list
    } catch (err: any) {
      console.error("Reconcile Failed:", err);
      alert("Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8 border-b-4 border-black pb-4">
        <div>
          <Link href="/admin" className="text-blue-600 font-black uppercase text-xs hover:underline">← Dashboard</Link>
          <h1 className="text-4xl font-black uppercase mt-2">Reconcile Event</h1>
        </div>
      </div>

      <div className="mb-8 p-6 bg-gray-100 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <label className="block text-sm font-black uppercase mb-2 text-gray-600">Choose Event to Close</label>
        <select 
            className="w-full p-4 border-2 border-black rounded font-bold text-xl bg-white" 
            onChange={e => loadStock(e.target.value)}
            value={eventSlug}
        >
          <option value="">-- Select Event --</option>
          {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
        </select>
      </div>

      {eventStock.length > 0 ? (
        <div className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
          <table className="w-full text-left">
            <thead className="bg-black text-white">
              <tr>
                <th className="p-4 font-black uppercase text-xs">Product / SKU</th>
                <th className="p-4 font-black uppercase text-xs">Size</th>
                <th className="p-4 font-black uppercase text-xs text-center">In Kiosk</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-gray-100">
              {eventStock.map(s => (
                <tr key={s.id} className={s.count > 0 ? "bg-white" : "bg-gray-50 opacity-50"}>
                  <td className="p-4 font-black">
                    {s.inventory_master?.item_name || s.product_id}
                    <div className="text-xs text-gray-400">{s.product_id}</div>
                  </td>
                  <td className="p-4 font-bold text-gray-600">{s.size}</td>
                  <td className="p-4 text-center text-2xl font-black">{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="p-6 border-t-4 border-black bg-gray-50 flex justify-between items-center">
            <div className="text-sm font-bold text-gray-500">
                Total lines to return: {eventStock.filter(s => s.count > 0).length}
            </div>
            <button 
                onClick={returnAllToWarehouse} 
                disabled={isProcessing}
                className={`bg-red-600 text-white px-10 py-5 font-black uppercase text-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-red-700 transition-all active:translate-y-1 active:shadow-none ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isProcessing ? 'Processing...' : 'End Event & Return Stock'}
            </button>
          </div>
        </div>
      ) : eventSlug && (
        <div className="p-10 text-center border-2 border-dashed border-gray-300 rounded-xl">
            <p className="text-gray-400 font-bold">No inventory records found for this event slug.</p>
        </div>
      )}
    </div>
  );
}