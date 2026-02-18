'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase'; 
import Link from 'next/link';

export default function WarehouseMasterPage() {
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Totals for the header
  const [totalValue, setTotalValue] = useState(0);

  const [editForm, setEditForm] = useState({ 
    item_name: '', 
    sku: '', 
    image_url: '', 
    quantity_on_hand: 0,
    supplier: '',
    supplier_sku: '',
    cost_price: 0,
    selling_price: 0,
    category: ''
  });

  useEffect(() => { fetchWarehouseData(); }, []);

  const fetchWarehouseData = async () => {
    setLoading(true);
    const { data } = await supabase.from('inventory_master').select('*').order('item_name', { ascending: true });
    
    if (data) {
      setInventory(data);
      // Calculate Total Warehouse Value
      const total = data.reduce((sum, item) => sum + ((item.quantity_on_hand || 0) * (item.cost_price || 0)), 0);
      setTotalValue(total);
    }
    setLoading(false);
  };

  const startEditing = (item: any) => {
    setEditingId(item.id);
    setEditForm({
      item_name: item.item_name,
      sku: item.sku,
      image_url: item.image_url || '',
      quantity_on_hand: item.quantity_on_hand,
      supplier: item.supplier || '',
      supplier_sku: item.supplier_sku || '',
      cost_price: item.cost_price || 0,
      selling_price: item.selling_price || 0,
      category: item.category || ''
    });
  };

  const handleSave = async (id: string) => {
    const { error } = await supabase.from('inventory_master').update(editForm).eq('id', id);
    if (!error) { setEditingId(null); fetchWarehouseData(); }
  };

  const filtered = inventory.filter(i => 
    i.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-full mx-auto mb-10">
        <div className="flex justify-between items-end">
          <div>
            <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase hover:underline mb-1 inline-block tracking-widest">← Dashboard</Link>
            <h1 className="text-4xl font-black tracking-tight">Warehouse Master</h1>
            <p className="text-gray-500 font-medium">Financial Asset & Catalog Management.</p>
          </div>
          
          {/* OVERALL VALUE DISPLAY */}
          <div className="bg-white px-8 py-4 rounded-3xl border-2 border-green-100 shadow-sm text-right">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Inventory Value (Cost)</p>
             <p className="text-4xl font-black text-green-600">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <input 
                placeholder="Search catalog..." 
                className="w-full md:w-1/3 p-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Showing {filtered.length} Items
            </div>
        </div>
        
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase text-gray-400">
              <th className="p-5 w-20">Preview</th>
              <th className="p-5">Product Details</th>
              <th className="p-5">Financials</th>
              <th className="p-5">Stock</th>
              <th className="p-5 text-right">Line Value (Cost)</th>
              <th className="p-5 text-right pr-10">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(item => {
              const lineValue = (item.quantity_on_hand || 0) * (item.cost_price || 0);
              const isEditing = editingId === item.id;

              return (
                <tr key={item.id} className="hover:bg-blue-50/20 transition-all">
                  <td className="p-5">
                    <div className="w-12 h-12 bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                      {item.image_url && <img src={item.image_url} className="w-full h-full object-contain" />}
                    </div>
                  </td>
                  
                  <td className="p-5">
                    {isEditing ? (
                      <div className="space-y-1">
                        <input className="w-full p-2 border rounded font-bold text-xs" value={editForm.item_name} onChange={e => setEditForm({...editForm, item_name: e.target.value})} />
                        <div className="flex gap-2">
                           <input placeholder="SKU" className="w-full p-2 border rounded font-mono text-[10px]" value={editForm.sku} onChange={e => setEditForm({...editForm, sku: e.target.value})} />
                           <input placeholder="Category" className="w-full p-2 border rounded text-[10px]" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold text-slate-900 leading-tight uppercase text-sm">{item.item_name}</div>
                        <div className="flex gap-2 items-center mt-1">
                           <span className="text-[10px] font-mono font-bold text-blue-500 uppercase">{item.sku}</span>
                           <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-black uppercase">{item.category || 'General'}</span>
                        </div>
                      </div>
                    )}
                  </td>

                  <td className="p-5">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <div>
                            <label className="text-[8px] font-bold uppercase text-gray-400">Cost</label>
                            <input type="number" className="w-full p-2 border rounded text-xs font-bold" value={editForm.cost_price} onChange={e => setEditForm({...editForm, cost_price: parseFloat(e.target.value)})} />
                        </div>
                        <div>
                            <label className="text-[8px] font-bold uppercase text-gray-400">Retail</label>
                            <input type="number" className="w-full p-2 border rounded text-xs font-bold" value={editForm.selling_price} onChange={e => setEditForm({...editForm, selling_price: parseFloat(e.target.value)})} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400">Cost:</span>
                            <span className="text-xs font-bold text-slate-700">${item.cost_price.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400">Retail:</span>
                            <span className="text-sm font-black text-green-600">${item.selling_price.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </td>

                  <td className="p-5">
                    {isEditing ? (
                        <input type="number" className="w-20 p-2 border rounded-xl font-black text-center" value={editForm.quantity_on_hand} onChange={e => setEditForm({...editForm, quantity_on_hand: parseInt(e.target.value)})} />
                    ) : (
                        <div className="flex flex-col items-center">
                            <span className={`text-xl font-black ${item.quantity_on_hand < 10 ? 'text-red-600' : 'text-slate-900'}`}>{item.quantity_on_hand}</span>
                            <span className="text-[8px] font-bold text-gray-400 uppercase">Units</span>
                        </div>
                    )}
                  </td>

                  {/* LINE VALUE DISPLAY */}
                  <td className="p-5 text-right">
                    <span className="text-lg font-black text-slate-900">
                        ${lineValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </td>

                  <td className="p-5 text-right pr-10">
                    {isEditing ? (
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleSave(item.id)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase">Save</button>
                        <button onClick={() => setEditingId(null)} className="bg-gray-100 px-4 py-2 rounded-xl font-bold text-xs uppercase text-gray-500">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => startEditing(item)} className="text-blue-600 hover:text-blue-800 font-bold text-[10px] uppercase tracking-widest">Edit</button>
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