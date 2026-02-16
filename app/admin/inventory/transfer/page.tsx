'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase';
import Link from 'next/link';

export default function LoadOut() {
  const [master, setMaster] = useState([]);
  const [events, setEvents] = useState([]);
  const [targetSlug, setTargetSlug] = useState('');

  useEffect(() => {
    supabase.from('inventory_master').select('*').order('item_name').then(({ data }) => setMaster(data || []));
    supabase.from('event_settings').select('slug, event_name').then(({ data }) => setEvents(data || []));
  }, []);

  const transfer = async (item, qty) => {
    if (!targetSlug) return alert("Select Event First");
    if (qty <= 0) return alert("Enter valid quantity");
    
    // 1. Update Warehouse (Subtract)
    await supabase.from('inventory_master').update({ quantity_on_hand: item.quantity_on_hand - qty }).eq('sku', item.sku);
    
    // 2. Update Event Kiosk Stock (Add)
    const { data: existing } = await supabase.from('inventory').select('*').eq('event_slug', targetSlug).eq('product_id', item.sku).single();
    
    if (existing) {
      await supabase.from('inventory').update({ count: existing.count + qty }).eq('id', existing.id);
    } else {
      await supabase.from('inventory').insert({ event_slug: targetSlug, product_id: item.sku, size: item.size, count: qty, active: true });
    }
    alert("🚚 Moved to Truck!");
    // Refresh local state
    const { data: updatedMaster } = await supabase.from('inventory_master').select('*').order('item_name');
    setMaster(updatedMaster);
  };

  return (
    <div className="min-h-screen bg-white text-black p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8 border-b-4 border-black pb-4">
        <div>
          <Link href="/admin" className="text-blue-600 font-black uppercase text-xs hover:underline">← Dashboard</Link>
          <h1 className="text-4xl font-black uppercase mt-2">Load Truck</h1>
        </div>
      </div>

      <div className="mb-8 p-6 bg-gray-100 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <label className="block text-sm font-black uppercase mb-2">Destination Event</label>
        <select className="w-full p-4 border-2 border-black rounded font-bold text-xl bg-white" onChange={e => setTargetSlug(e.target.value)}>
          <option value="">-- Select Event --</option>
          {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
        </select>
      </div>

      <div className="grid gap-4">
        {master.filter(m => m.quantity_on_hand > 0).map(item => (
          <div key={item.sku} className="p-6 border-2 border-black flex justify-between items-center bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div>
              <p className="text-xl font-black uppercase">{item.item_name}</p>
              <p className="font-bold text-gray-500">SKU: {item.sku} | SIZE: {item.size}</p>
              <p className="mt-1 font-black">WAREHOUSE STOCK: {item.quantity_on_hand}</p>
            </div>
            <div className="flex gap-3">
              <input id={`t-${item.sku}`} type="number" defaultValue={12} className="w-24 border-2 border-black p-3 font-black text-center text-xl" />
              <button 
                onClick={() => transfer(item, Number((document.getElementById(`t-${item.sku}`) as HTMLInputElement).value))} 
                className="bg-black text-white px-8 py-3 font-black uppercase hover:bg-blue-600 transition-colors"
              >
                Load
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}