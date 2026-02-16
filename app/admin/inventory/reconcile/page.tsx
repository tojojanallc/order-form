'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function Reconcile() {
  const [eventSlug, setEventSlug] = useState('');
  const [eventStock, setEventStock] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only show ACTIVE events in the dropdown to keep it clean
    supabase.from('event_settings')
      .select('slug, event_name')
      .eq('status', 'active')
      .then(({ data }) => setEvents(data || []));
  }, []);

  const loadStock = async (slug: string) => {
    if (!slug) return;
    setEventSlug(slug);
    const { data } = await supabase.from('inventory').select('*, inventory_master(item_name)').eq('event_slug', slug);
    setEventStock(data || []);
  };

  const endAndArchiveEvent = async () => {
    if (!confirm("This will return all stock to Warehouse and ARCHIVE this event. Proceed?")) return;

    setLoading(true);
    try {
      // 1. Return Stock to Warehouse
      for (const item of eventStock) {
        if (item.count > 0) {
          const { data: master } = await supabase.from('inventory_master').select('quantity_on_hand').eq('sku', item.product_id).single();
          if (master) {
            await supabase.from('inventory_master').update({ quantity_on_hand: master.quantity_on_hand + item.count }).eq('sku', item.product_id);
            await supabase.from('inventory').update({ count: 0 }).eq('id', item.id);
          }
        }
      }

      // 2. Flip the Status to Archived
      const { error } = await supabase
        .from('event_settings')
        .update({ status: 'archived' })
        .eq('slug', eventSlug);

      if (error) throw error;

      alert("✅ Event Closed. Stock returned and data moved to Archive.");
      window.location.href = '/admin/events/history'; // Redirect to the vault

    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black p-8 max-w-5xl mx-auto border-x-4 border-black">
      <div className="flex justify-between items-center mb-8 border-b-4 border-black pb-4">
        <div>
          <Link href="/admin" className="text-blue-600 font-black uppercase text-xs hover:underline">← Dashboard</Link>
          <h1 className="text-4xl font-black uppercase mt-2">Finalize Event</h1>
        </div>
      </div>

      <div className="mb-8 p-6 bg-gray-100 border-2 border-black shadow-[4px_4px_0px_0px_black]">
        <label className="block text-sm font-black uppercase mb-2">Select Event to Close</label>
        <select className="w-full p-4 border-2 border-black font-bold text-xl bg-white" onChange={e => loadStock(e.target.value)}>
          <option value="">-- Active Events --</option>
          {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
        </select>
      </div>

      {eventStock.length > 0 && (
        <div className="border-4 border-black shadow-[8px_8px_0px_0px_black] bg-white">
          <table className="w-full text-left">
            <thead className="bg-black text-white">
              <tr>
                <th className="p-4 uppercase text-xs">Item</th>
                <th className="p-4 uppercase text-xs text-center">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black">
              {eventStock.map(s => (
                <tr key={s.id} className={s.count === 0 ? "opacity-30" : ""}>
                  <td className="p-4 font-black">{s.inventory_master?.item_name || s.product_id}</td>
                  <td className="p-4 text-center text-2xl font-black">{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-8 bg-gray-50 border-t-4 border-black">
            <button 
              onClick={endAndArchiveEvent}
              disabled={loading}
              className="w-full bg-red-600 text-white py-6 font-black uppercase text-2xl border-2 border-black shadow-[4px_4px_0px_0px_black] hover:bg-red-700 active:translate-y-1 active:shadow-none"
            >
              {loading ? 'ARCHIVING...' : 'End Event & Move to Archive'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}