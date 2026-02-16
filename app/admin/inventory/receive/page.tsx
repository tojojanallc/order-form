'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase';

export default function ReceiveStock() {
  const [items, setItems] = useState([]);
  const [vendor, setVendor] = useState('');
  const [receipt, setReceipt] = useState([]); // List of items in this box

  useEffect(() => {
    supabase.from('inventory_master').select('*').then(({ data }) => setItems(data));
  }, []);

  const addToBox = (sku, qty, cost) => {
    const item = items.find(i => i.sku === sku);
    setReceipt([...receipt, { sku, qty, cost, name: item.item_name, size: item.size }]);
  };

  const submitPurchase = async () => {
    const total = receipt.reduce((sum, i) => sum + (i.qty * i.cost), 0);
    const { data: po } = await supabase.from('purchases').insert({ vendor, total_amount: total }).select().single();
    
    const lineItems = receipt.map(i => ({ purchase_id: po.id, sku: i.sku, quantity: i.qty, unit_cost: i.cost }));
    await supabase.from('purchase_items').insert(lineItems);
    
    alert("Stock Added to Warehouse!");
    setReceipt([]);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-black mb-6">Inbound: Vendor Shipment</h1>
      <input placeholder="Vendor Name (e.g. OneStop)" className="w-full p-3 border mb-4" onChange={e => setVendor(e.target.value)} />
      
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h3 className="font-bold mb-2">Add Item to Shipment</h3>
        <div className="flex gap-2">
          <select id="skuSelect" className="flex-1 p-2 border">
            {items.map(i => <option key={i.sku} value={i.sku}>{i.item_name} ({i.size})</option>)}
          </select>
          <input id="qtyIn" type="number" placeholder="Qty" className="w-20 p-2 border" />
          <input id="costIn" type="number" placeholder="Unit Cost" className="w-24 p-2 border" />
          <button onClick={() => addToBox(
            (document.getElementById('skuSelect') as HTMLSelectElement).value,
            Number((document.getElementById('qtyIn') as HTMLInputElement).value),
            Number((document.getElementById('costIn') as HTMLInputElement).value)
          )} className="bg-black text-white px-4 rounded">Add</button>
        </div>
      </div>

      <table className="w-full border mb-6">
        <thead className="bg-gray-50"><tr><th>Item</th><th>Qty</th><th>Cost</th><th>Subtotal</th></tr></thead>
        <tbody>
          {receipt.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="p-2">{r.name} ({r.size})</td>
              <td className="p-2 text-center">{r.qty}</td>
              <td className="p-2 text-center">${r.cost}</td>
              <td className="p-2 text-right">${r.qty * r.cost}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={submitPurchase} className="w-full py-4 bg-green-600 text-white font-bold rounded-xl">Save PO & Update Warehouse Stock</button>
    </div>
  );
}