'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase';

export default function Reconcile() {
  const [eventSlug, setEventSlug] = useState('');
  const [eventStock, setEventStock] = useState([]);

  const loadStock = async (slug: string) => {
    setEventSlug(slug);
    const { data } = await supabase.from('inventory').select('*').eq('event_slug', slug);
    setEventStock(data || []);
  };

  const returnAllToWarehouse = async () => {
    for (const item of eventStock) {
      if (item.count > 0) {
        // 1. Add back to warehouse
        const { data: master } = await supabase.from('inventory_master').select('quantity_on_hand').eq('product_id', item.product_id).eq('size', item.size).single();
        await supabase.from('inventory_master').update({ quantity_on_hand: (master?.quantity_on_hand || 0) + item.count }).eq('product_id', item.product_id).eq('size', item.size);
        // 2. Set event stock to 0
        await supabase.from('inventory').update({ count: 0 }).eq('id', item.id);
      }
    }
    alert("Event Reconciled. All stock returned to Warehouse!");
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-black mb-6">Reconcile: Return to Warehouse</h1>
      <input placeholder="Enter Event Slug (e.g. halpin)" className="p-3 border mr-2" onChange={e => loadStock(e.target.value)} />
      
      <div className="mt-8">
        <table className="w-full text-left">
          <thead><tr><th>Item</th><th>Size</th><th>Remaining on Truck</th></tr></thead>
          <tbody>
            {eventStock.map(s => (
              <tr key={s.id} className="border-t">
                <td className="py-2">{s.product_id}</td>
                <td>{s.size}</td>
                <td className="font-bold">{s.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={returnAllToWarehouse} className="mt-8 bg-red-600 text-white px-8 py-4 rounded-xl font-bold">End Event & Return Stock</button>
      </div>
    </div>
  );
}