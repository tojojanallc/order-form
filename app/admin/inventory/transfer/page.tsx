'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase';

export default function LoadOut() {
  const [master, setMaster] = useState([]);
  const [events, setEvents] = useState([]);
  const [targetSlug, setTargetSlug] = useState('');

  useEffect(() => {
    supabase.from('inventory_master').select('*').then(({ data }) => setMaster(data));
    supabase.from('event_settings').select('slug, event_name').then(({ data }) => setEvents(data));
  }, []);

  const transfer = async (item, qty) => {
    if (!targetSlug) return alert("Select Event");
    
    // 1. Update Warehouse (Subtract)
    await supabase.from('inventory_master').update({ quantity_on_hand: item.quantity_on_hand - qty }).eq('sku', item.sku);
    
    // 2. Update Event Kiosk Stock (Add)
    const { data: existing } = await supabase.from('inventory').select('*').eq('event_slug', targetSlug).eq('product_id', item.product_id).eq('size', item.size).single();
    if (existing) {
      await supabase.from('inventory').update({ count: existing.count + qty }).eq('id', existing.id);
    } else {
      await supabase.from('inventory').insert({ event_slug: targetSlug, product_id: item.product_id, size: item.size, count: qty, active: true });
    }
    alert("Moved to Truck!");
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-black mb-6">Load Out: Warehouse to Truck</h1>
      <select className="w-full p-4 border mb-8 text-xl" onChange={e => setTargetSlug(e.target.value)}>
        <option>Select Destination Event...</option>
        {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
      </select>

      <div className="grid md:grid-cols-2 gap-4">
        {master.filter(m => m.quantity_on_hand > 0).map(item => (
          <div key={item.sku} className="p-4 border rounded-xl flex justify-between items-center bg-white shadow-sm">
            <div>
              <p className="font-bold">{item.item_name}</p>
              <p className="text-sm text-gray-500">{item.size} • Stock: {item.quantity_on_hand}</p>
            </div>
            <div className="flex gap-2">
              <input id={`t-${item.sku}`} type="number" defaultValue={12} className="w-16 border p-2" />
              <button onClick={() => transfer(item, Number((document.getElementById(`t-${item.sku}`) as HTMLInputElement).value))} className="bg-blue-600 text-white px-4 rounded">Load</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}