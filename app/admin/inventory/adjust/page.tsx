'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

// --- TYPES TO MATCH YOUR OTHER PAGES ---
interface WarehouseItem {
  id: string;
  item_name: string;
  sku: string;
  size: string;
  color: string;
  category: string;
  quantity_on_hand: number;
}

export default function AdjustStockPage() {
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<WarehouseItem[]>([]);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('Damaged / Spoilage');
  const [adjustments, setAdjustments] = useState<Record<string, string>>({}); // Stores input as string to allow negative signs
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();
  }, []);

  // Filter logic
  useEffect(() => {
    const term = search.toLowerCase();
    const filtered = items.filter(i => 
      i.item_name?.toLowerCase().includes(term) || 
      i.sku?.toLowerCase().includes(term) ||
      i.color?.toLowerCase().includes(term)
    );
    setFilteredItems(filtered);
  }, [search, items]);

  const fetchInventory = async () => {
    setLoading(true);
    const { data } = await supabase.from('inventory_master').select('*').order('item_name');
    if (data) setItems(data);
    setLoading(false);
  };

  const handleAdjustmentChange = (id: string, value: string) => {
    setAdjustments(prev => ({ ...prev, [id]: value }));
  };

  const executeAdjustment = async (item: WarehouseItem) => {
    const changeAmount = parseInt(adjustments[item.id]);
    
    if (!changeAmount || changeAmount === 0) return alert("Please enter a valid number (e.g. -5 or 10)");
    
    const newTotal = item.quantity_on_hand + changeAmount;
    if (newTotal < 0) return alert("Error: Stock cannot go below zero.");

    const confirmMsg = `⚠️ CONFIRM ADJUSTMENT\n\nItem: ${item.item_name} (${item.size})\nChange: ${changeAmount > 0 ? '+' : ''}${changeAmount}\nReason: ${reason}\n\nNew Stock Level will be: ${newTotal}`;
    
    if (!confirm(confirmMsg)) return;

    // 1. Update Database
    const { error } = await supabase
      .from('inventory_master')
      .update({ quantity_on_hand: newTotal })
      .eq('id', item.id);

    if (error) {
      alert("Failed to update: " + error.message);
    } else {
      // Optional: Log this action to a 'logs' table if you want an audit trail later
      alert("✅ Stock Updated Successfully");
      setAdjustments(prev => {
        const next = { ...prev };
        delete next[item.id]; // Clear the input box
        return next;
      });
      fetchInventory(); // Refresh data
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-end mb-10">
          <div>
            <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block hover:underline">← Dashboard</Link>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Stock Adjustments</h1>
            <p className="text-gray-500 font-medium">Write-offs, donations, and manual inventory corrections.</p>
          </div>
          
          <div className="bg-white px-6 py-3 rounded-2xl border border-gray-200 shadow-sm text-right">
              <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Reason Code</label>
              <select 
                className="bg-gray-50 border-none font-bold text-slate-900 outline-none cursor-pointer rounded-lg p-1"
                value={reason}
                onChange={e => setReason(e.target.value)}
              >
                <option>Damaged / Spoilage</option>
                <option>Lost / Theft</option>
                <option>Inventory Correction (Count Error)</option>
                <option>Donation / Promo</option>
                <option>Return to Vendor</option>
              </select>
          </div>
        </div>

        {/* MAIN CARD */}
        <div className="bg-white rounded-[40px] border border-gray-200 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
          
          {/* TOOLBAR */}
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
             <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Inventory Search</span>
                <input 
                    placeholder="Search Name, SKU, or Color..." 
                    className="bg-white border border-gray-200 p-2 px-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 w-80 shadow-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
             </div>
             <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Showing {filteredItems.length} Items
             </div>
          </div>

          {/* TABLE */}
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr className="text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
                  <th className="p-6">Product Details</th>
                  <th className="p-6 text-center">Current Stock</th>
                  <th className="p-6 text-right w-48">Adjustment (+/-)</th>
                  <th className="p-6 text-right w-32">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                    <tr><td colSpan={4} className="p-20 text-center font-bold text-gray-300 animate-pulse">LOADING INVENTORY...</td></tr>
                ) : filteredItems.map(item => {
                  const inputVal = parseInt(adjustments[item.id] || '0');
                  const predictedStock = item.quantity_on_hand + inputVal;
                  const isNegative = inputVal < 0;
                  const hasChange = inputVal !== 0 && !isNaN(inputVal);

                  return (
                    <tr key={item.id} className={`group hover:bg-blue-50/30 transition-all ${hasChange ? 'bg-blue-50/20' : ''}`}>
                      <td className="p-6">
                        <div className="font-bold text-sm uppercase text-slate-800 leading-tight">{item.item_name}</div>
                        <div className="flex gap-2 mt-1.5 items-center">
                           <span className="text-[10px] font-mono font-bold text-blue-500 uppercase">{item.sku}</span>
                           <span className="bg-slate-900 text-white px-2 py-0.5 rounded text-[9px] font-black uppercase">{item.size}</span>
                           <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{item.color}</span>
                        </div>
                      </td>
                      
                      <td className="p-6 text-center">
                        <span className="text-xl font-black text-slate-900">{item.quantity_on_hand}</span>
                      </td>

                      <td className="p-6 text-right">
                         <div className="flex items-center justify-end gap-2">
                            {hasChange && (
                                <span className={`text-[10px] font-black mr-2 ${predictedStock < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                    New: {predictedStock}
                                </span>
                            )}
                            <input 
                                type="number" 
                                placeholder="0"
                                className={`w-20 p-2 text-right font-black border-2 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all
                                    ${isNegative ? 'border-red-100 text-red-600 bg-red-50' : 'border-gray-100 text-slate-900 bg-gray-50'}
                                `}
                                value={adjustments[item.id] || ''}
                                onChange={e => handleAdjustmentChange(item.id, e.target.value)}
                            />
                         </div>
                      </td>

                      <td className="p-6 text-right">
                        <button 
                            onClick={() => executeAdjustment(item)}
                            disabled={!hasChange}
                            className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm
                                ${hasChange 
                                    ? isNegative 
                                        ? 'bg-red-500 text-white hover:bg-red-600' 
                                        : 'bg-green-500 text-white hover:bg-green-600'
                                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'}
                            `}
                        >
                            {isNegative ? 'Deduct' : 'Add'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}