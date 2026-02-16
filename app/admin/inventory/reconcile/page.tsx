'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase';
import Link from 'next/link';

export default function Reconcile() {
  const [eventSlug, setEventSlug] = useState('');
  const [eventStock, setEventStock] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    supabase.from('event_settings').select('slug, event_name').then(({ data }) => setEvents(data || []));
  }, []);

  const loadStock = async (slug: string) => {
    setEventSlug(slug);
    const { data } = await supabase.from('inventory').select('*').eq('event_slug', slug);
    setEventStock(data || []);
  };

  const returnAllToWarehouse = async () => {
    if (!confirm("Confirm: Move all remaining event stock back to the Warehouse?")) return;

    for (const item of eventStock) {
      if (item.count > 0) {
        const { data: master } = await supabase.from('inventory_master').select('quantity_on_hand').eq('sku', item.product_id).single();
        await supabase.from('inventory_master').update({ quantity_on_hand: (master?.quantity_on_hand || 0) + item.count }).eq('sku', item.product_id);
        await supabase.from('inventory').update({ count: 0 }).eq('id', item.id);
      }
    }
    alert("✅ Event Reconciled. All stock returned to Warehouse!");
    loadStock(eventSlug);
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
        <label className="block text-sm font-black uppercase mb-2">Select Event to Close</label>
        <select className="w-full p-4 border-2 border-black rounded font-bold text-xl bg-white" onChange={e => loadStock(e.target.value)}>
          <option value="">-- Select Event --</option>
          {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
        </select>
      </div>

      {eventStock.length > 0 && (
        <div className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
          <table className="w-full text-left bg-white">
            <thead className="bg-black text-white">
              <tr>
                <th className="p-4 font-black uppercase text-xs">Product SKU</th>
                <th className="p-4 font-black uppercase text-xs">Size</th>
                <th className="p-4 font-black uppercase text-xs text-center">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black">
              {eventStock.map(s => (
                <tr key={s.id}>
                  <td className="p-4 font-black uppercase">{s.product_id}</td>
                  <td className="p-4 font-bold">{s.size}</td>
                  <td className="p-4 text-center text-2xl font-black">{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-6 bg-gray-50 border-t-4 border-black flex justify-end">
            <button onClick={returnAllToWarehouse} className="bg-red-600 text-white px-10 py-5 font-black uppercase text-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-red-700 transition-all active:translate-y-1 active:shadow-none">
              End Event & Return Stock
            </button>
          </div>
        </div>
      )}
    </div>
  );
}