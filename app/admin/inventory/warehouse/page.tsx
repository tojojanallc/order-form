'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase'; 
import Link from 'next/link';

export default function WarehouseMasterPage() {
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [totalValue, setTotalValue] = useState(0);

  // Form state for editing existing items
  const [editForm, setEditForm] = useState({ 
    item_name: '', sku: '', size: '', color: '', category: '', 
    quantity_on_hand: 0, cost_price: 0, selling_price: 0, 
    supplier: '', supplier_sku: '', image_url: '' 
  });

  useEffect(() => { fetchWarehouseData(); }, []);

  const fetchWarehouseData = async () => {
    setLoading(true);
    const { data } = await supabase.from('inventory_master').select('*').order('item_name', { ascending: true });
    
    if (data) {
      setInventory(data);
      const total = data.reduce((sum, item) => sum + ((item.quantity_on_hand || 0) * (item.cost_price || 0)), 0);
      setTotalValue(total);
    }
    setLoading(false);
  };

  const categories = ['All', ...new Set(inventory.map(item => item.category).filter(Boolean))];

  const startEditing = (item: any) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const handleSave = async (id: any) => {
    const { error } = await supabase.from('inventory_master').update(editForm).eq('id', id);
    if (!error) {
      setEditingId(null);
      fetchWarehouseData();
    } else {
      alert("Error updating item: " + error.message);
    }
  };

  const filtered = inventory.filter(i => {
    const matchesSearch = i.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         i.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         i.color?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || i.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) return <div className="p-20 text-center font-black animate-pulse">LOADING WAREHOUSE DATA...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      {/* Header with Stats */}
      <div className="max-w-full mx-auto mb-10 flex justify-between items-end">
        <div>
          <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase hover:underline mb-1 inline-block tracking-widest">← Dashboard</Link>
          <h1 className="text-4xl font-black tracking-tight">Warehouse Master</h1>
          <p className="text-gray-500 font-medium">Lev Custom Merch Central Inventory</p>
        </div>
        <div className="flex gap-4">
            <div className="bg-white px-6 py-3 rounded-2xl border border-gray-200 shadow-sm text-right">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active SKUs</p>
                <p className="text-2xl font-black">{inventory.length}</p>
            </div>
            <div className="bg-white px-8 py-3 rounded-2xl border-2 border-green-100 shadow-sm text-right">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Asset Value</p>
                <p className="text-2xl font-black text-green-600">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
        {/* Filters Bar */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row gap-4">
            <input 
                placeholder="Search Name, SKU, or Color..." 
                className="flex-1 p-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
            <select 
                className="p-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px] shadow-sm"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
            >
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
        </div>
        
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase text-gray-400">
              <th className="p-5 w-20">Preview</th>
              <th className="p-5">Product Details</th>
              <th className="p-5">Financials</th>
              <th className="p-5 text-center">Stock</th>
              <th className="p-5 text-right">Line Value</th>
              <th className="p-5 text-right pr-10">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(item => {
              const isEditing = editingId === item.id;
              const lineValue = (item.quantity_on_hand || 0) * (item.cost_price || 0);

              return (
                <tr key={item.id} className="hover:bg-blue-50/20 transition-all group">
                  <td className="p-5">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
                      {item.image_url && <img src={item.image_url} className="w-full h-full object-contain" alt={item.item_name} />}
                    </div>
                  </td>
                  
                  <td className="p-5">
                    {isEditing ? (
                      <div className="space-y-2 max-w-xs">
                        <input className="w-full p-2 border rounded font-bold text-xs" value={editForm.item_name} onChange={e => setEditForm({...editForm, item_name: e.target.value})} />
                        <div className="flex gap-2">
                           <input className="w-full p-2 border rounded font-mono text-[10px]" value={editForm.sku} onChange={e => setEditForm({...editForm, sku: e.target.value})} />
                           <input className="w-1/2 p-2 border rounded text-[10px]" value={editForm.color} onChange={e => setEditForm({...editForm, color: e.target.value})} placeholder="Color" />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold text-slate-900 leading-tight uppercase text-sm">{item.item_name}</div>
                        <div className="flex flex-wrap gap-2 items-center mt-1.5">
                           <span className="text-[10px] font-mono font-bold text-blue-500 uppercase">{item.sku}</span>
                           <span className="text-[10px] font-black text-gray-900 bg-gray-100 px-2 py-0.5 rounded uppercase">{item.size}</span>
                           <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-2 py-0.5 rounded shadow-sm">
                              <div className="w-2 h-2 rounded-full border border-gray-300" style={{ backgroundColor: item.color?.toLowerCase().replace(' ', '') }}></div>
                              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-tight">{item.color}</span>
                           </div>
                           <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{item.category}</span>
                        </div>
                      </div>
                    )}
                  </td>

                  <td className="p-5">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <input type="number" step="0.01" className="w-20 p-2 border rounded text-xs font-bold" value={editForm.cost_price} onChange={e => setEditForm({...editForm, cost_price: parseFloat(e.target.value)})} />
                        <input type="number" step="0.01" className="w-20 p-2 border rounded text-xs font-bold" value={editForm.selling_price} onChange={e => setEditForm({...editForm, selling_price: parseFloat(e.target.value)})} />
                      </div>
                    ) : (
                      <div className="text-[11px] font-bold">
                        <div className="text-gray-400">COST: <span className="text-slate-700">${item.cost_price?.toFixed(2)}</span></div>
                        <div className="text-gray-400">SELL: <span className="text-green-600">${item.selling_price?.toFixed(2)}</span></div>
                      </div>
                    )}
                  </td>

                  <td className="p-5 text-center">
                    {isEditing ? (
                        <input type="number" className="w-16 p-2 border rounded-xl font-black text-center" value={editForm.quantity_on_hand} onChange={e => setEditForm({...editForm, quantity_on_hand: parseInt(e.target.value)})} />
                    ) : (
                        <span className={`text-xl font-black ${item.quantity_on_hand < 10 ? 'text-red-600' : 'text-slate-900'}`}>{item.quantity_on_hand}</span>
                    )}
                  </td>

                  <td className="p-5 text-right font-black text-slate-900">
                    ${lineValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>

                  <td className="p-5 text-right pr-10">
                    {isEditing ? (
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleSave(item.id)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase shadow-md hover:bg-blue-700">Save</button>
                        <button onClick={() => setEditingId(null)} className="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => startEditing(item)} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-700 font-black text-[10px] uppercase tracking-widest">Edit Details</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}