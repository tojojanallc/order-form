'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase'; // Adjust dots based on your folder depth

export default function AdjustStock() {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [reason, setReason] = useState('Damaged / Spoilage');
  const [customAdj, setCustomAdj] = useState({}); // Stores the number you type

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    const { data } = await supabase.from('inventory_master').select('*').order('item_name');
    setItems(data || []);
  };

  const handleAdjust = async (sku, currentQty, adjustmentAmount) => {
    const change = Number(adjustmentAmount);
    if (change === 0) return;

    const newTotal = currentQty + change;
    if (newTotal < 0) return alert("Cannot have negative stock.");

    if (!confirm(`Confirm: Change stock by ${change} items?\nReason: ${reason}`)) return;

    // 1. Update Database
    const { error } = await supabase
      .from('inventory_master')
      .update({ quantity_on_hand: newTotal })
      .eq('sku', sku);

    if (error) {
      alert("Error updating stock: " + error.message);
    } else {
      alert("Stock Updated");
      setCustomAdj({ ...customAdj, [sku]: '' }); // Clear input
      fetchInventory();
    }
  };

  // Search Filter
  const filteredItems = items.filter(i => 
    (i.item_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
    (i.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen bg-white text-gray-900">
      <h1 className="text-3xl font-black mb-2 text-red-600">Stock Adjustments & Write-Offs</h1>
      <p className="mb-8 text-gray-500 font-bold">Fix counting errors, remove damaged goods, or manually correct inventory.</p>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 bg-gray-100 p-6 rounded-xl border-2 border-gray-200">
        <div className="flex-1">
          <label className="block text-xs font-black uppercase text-gray-500 mb-1">Search Item</label>
          <input 
            placeholder="Type name or SKU..." 
            className="w-full p-3 border-2 border-gray-300 rounded-lg font-bold"
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-64">
          <label className="block text-xs font-black uppercase text-gray-500 mb-1">Reason for Change</label>
          <select 
            className="w-full p-3 border-2 border-gray-300 rounded-lg font-bold bg-white"
            onChange={e => setReason(e.target.value)}
          >
            <option>Damaged / Spoilage</option>
            <option>Lost / Theft</option>
            <option>Inventory Correction (Count Error)</option>
            <option>Donation / Promo</option>
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-100 border-b-2 border-gray-200">
            <tr>
              <th className="p-4 font-black uppercase text-xs">Item Name</th>
              <th className="p-4 font-black uppercase text-xs">Size</th>
              <th className="p-4 font-black uppercase text-xs text-center">Current Stock</th>
              <th className="p-4 font-black uppercase text-xs text-right">Adjustment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredItems.map(item => (
              <tr key={item.sku} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 font-bold">{item.item_name}</td>
                <td className="p-4 text-sm font-bold text-gray-500">{item.size}</td>
                <td className="p-4 text-center text-xl font-mono font-black">{item.quantity_on_hand}</td>
                <td className="p-4 flex justify-end gap-2 items-center">
                  
                  {/* Manual Input */}
                  <input 
                      type="number" 
                      placeholder="+/-" 
                      className="w-24 p-2 border-2 border-gray-300 rounded text-right font-mono font-bold"
                      value={customAdj[item.sku] || ''}
                      onChange={(e) => setCustomAdj({ ...customAdj, [item.sku]: e.target.value })}
                  />
                  
                  {/* Apply Button */}
                  <button 
                      className="bg-black text-white font-black uppercase text-xs px-4 py-3 rounded hover:bg-gray-800 shadow-md"
                      onClick={() => handleAdjust(item.sku, item.quantity_on_hand, Number(customAdj[item.sku] || 0))}
                  >
                      Apply
                  </button>

                  {/* Quick Delete Button */}
                  <button 
                      className="ml-2 text-red-500 hover:text-red-700 font-bold text-xs underline"
                      onClick={() => {
                          setCustomAdj({ ...customAdj, [item.sku]: '-1' });
                          handleAdjust(item.sku, item.quantity_on_hand, -1);
                      }}
                  >
                      Trash 1
                  </button>

                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-gray-400 font-bold italic">No items found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}