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
    fetchActiveEvents();
  }, []);

  const fetchActiveEvents = async () => {
    // We get all events, but we'll focus on closing 'active' ones
    const { data } = await supabase
      .from('event_settings')
      .select('slug, event_name')
      .eq('status', 'active');
    setEvents(data || []);
  };

  const loadStock = async (slug: string) => {
    if (!slug) return;
    setEventSlug(slug);
    const { data } = await supabase
      .from('inventory')
      .select('*, inventory_master(item_name)')
      .eq('event_slug', slug);
    
    setEventStock(data || []);
  };

  const endAndArchiveEvent = async () => {
    if (!eventSlug) return alert("Please select an event.");
    if (!confirm("This will zero out event stock and move this event to ARCHIVE. Proceed?")) return;

    setLoading(true);
    try {
      // 1. Return Stock to Warehouse (Loop through items)
      for (const item of eventStock) {
        if (item.count > 0) {
          const { data: master } = await supabase.from('inventory_master').select('quantity_on_hand').eq('sku', item.product_id).single();
          if (master) {
            await supabase.from('inventory_master').update({ quantity_on_hand: (master.quantity_on_hand || 0) + item.count }).eq('sku', item.product_id);
          }
        }
      }

      // 2. Clear Event Inventory
      await supabase.from('inventory').delete().eq('event_slug', eventSlug);

      // 3. Mark Event as Archived
      const { error } = await supabase
        .from('event_settings')
        .update({ status: 'archived' })
        .eq('slug', eventSlug);

      if (error) throw error;

      alert("✅ Event Closed and Archived.");
      window.location.href = '/admin/events/history';

    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black p-8 max-w-5xl mx-auto border-x-4 border-black">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-10 border-b-4 border-black pb-4">
        <div>
          <Link href="/admin" className="text-blue-600 font-black uppercase text-xs hover:underline">← Dashboard</Link>
          <h1 className="text-5xl font-black uppercase mt-2">Close Event</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COL: SELECTION */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gray-100 p-6 border-4 border-black shadow-[4px_4px_0px_0px_black]">
            <label className="block text-sm font-black uppercase mb-3">1. Select Event</label>
            <select 
              className="w-full p-4 border-2 border-black font-bold text-lg bg-white" 
              value={eventSlug}
              onChange={e => loadStock(e.target.value)}
            >
              <option value="">-- Active Events --</option>
              {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
            </select>
          </div>

          {eventSlug && (
            <div className="bg-red-50 p-6 border-4 border-black shadow-[4px_4px_0px_0px_black]">
              <label className="block text-sm font-black uppercase mb-3 text-red-600">2. Finalize</label>
              <button 
                onClick={endAndArchiveEvent}
                disabled={loading}
                className="w-full bg-red-600 text-white py-4 font-black uppercase text-xl border-2 border-black shadow-[4px_4px_0px_0px_black] hover:bg-red-700 active:shadow-none active:translate-y-1 transition-all"
              >
                {loading ? 'Processing...' : 'End & Archive'}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COL: STOCK PREVIEW */}
        <div className="lg:col-span-2">
          <div className="border-4 border-black bg-white shadow-[8px_8px_0px_0px_black] overflow-hidden">
            <div className="bg-black text-white p-4 font-black uppercase text-sm">
              Current Event Inventory Preview
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-4 border-black bg-gray-50 text-[10px] font-black uppercase">
                  <th className="p-4">Item</th>
                  <th className="p-4 text-center">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black">
                {eventStock.length > 0 ? (
                  eventStock.map(s => (
                    <tr key={s.id}>
                      <td className="p-4 font-bold uppercase text-sm">{s.inventory_master?.item_name || s.product_id}</td>
                      <td className="p-4 text-center font-black text-xl">{s.count}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="p-10 text-center text-gray-400 font-bold italic">
                      {eventSlug ? 'No stock records found for this event.' : 'Select an event to see stock.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}