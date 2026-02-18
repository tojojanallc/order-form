'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase'; 
import Link from 'next/link';

export default function WarehouseMasterPage() {
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
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
    category: '',
    color: '' // Added Color field
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
      category: item.category || '',
      color: item.color || ''
    });
  };

  const handleSave = async (id: string) => {
    const { error } = await supabase.from('inventory_master').update(editForm).eq('id', id);
    if (!error) { setEditingId(null); fetchWarehouseData(); }
  };

  const filtered = inventory.filter(i => 
    i.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.color?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      {/* HEADER SECTION */}
      <div className="max-w-full mx-auto mb-10 flex justify-between items-end">
        <div>
          <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase hover:underline mb-1 inline-block tracking-widest">← Dashboard</Link>
          <h1 className="text-4xl font-black tracking-tight">Warehouse Master</h1>
          <p className="text-gray-500 font-medium">Manage Attributes, Financials, and Stock.</p>
        </div>
        <div className="bg-white px-8 py-4 rounded-3xl border-2 border-green-100 shadow-sm text-right">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Inventory Value</p>
             <p className="text-4xl font-black text-green-600">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <input 
                placeholder="Search SKU, Name, or Color..." 
                className="w-full md:w-1/3 p-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
        
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase text-gray-400">
              <th className="p-5 w-20">Preview</th>
              <th className="p-5">Product & Attributes</th>
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
                <tr key={item.id} className="hover:bg-blue-50/20 transition-all">
                  <td className="p-5">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
                      {item.image_url && <img src={item.image_url} className="w-full h-full object-contain" />}
                    </div>
                  </td>
                  
                  {/* PRODUCT & ATTRIBUTES */}
                  <td className="p-5">
                    {isEditing ? (
                      <div className="space-y-2 max-w-xs">
                        <input className="w-full p-2 border rounded font-bold text-xs" value={editForm.item_name} onChange={e => setEditForm({...editForm, item_name: e.target.value})} placeholder="Item Name" />
                        <div className="flex gap-2">
                           <input className="w-full p-2 border rounded font-mono text-[10px]" value={editForm.sku} onChange={e => setEditForm({...editForm, sku: e.target.value})} placeholder="SKU" />
                           <input className="w-full p-2 border rounded text-[10px]" value={editForm.color} onChange={e => setEditForm({...editForm, color: e.target.value})} placeholder="Color" />
                        </div>
                        <input className="w-full p-2 border rounded text-[10px]" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} placeholder="Category" />
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold text-slate-900 leading-tight uppercase text-sm">{item.item_name}</div>
                        <div className="flex flex-wrap gap-2 items-center mt-1.5">
                           <span className="text-[10px] font-mono font-bold text-blue-500 uppercase">{item.sku}</span>
                           <span className="text-[10px] font-black text-gray-900 bg-gray-100 px-2 py-0.5 rounded uppercase">{item.size}</span>
                           <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-2 py-0.5 rounded shadow-sm">
                              <div className="w-2 h-2 rounded-full border border-gray-300" style={{ backgroundColor: item.color?.toLowerCase() }}></div>
                              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-tight">{item.color || 'No Color'}</span>
                           </div>
                           <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{item.category}</span>
                        </div>
                      </div>
                    )}
                  </td>

                  {/* FINANCIALS */}
                  <td className="p-5">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <input type="number" className="w-16 p-2 border rounded text-xs font-bold" value={editForm.cost_price} onChange={e => setEditForm({...editForm, cost_price: parseFloat(e.target.value)})} placeholder="Cost" />
                        <input type="number" className="w-16 p-2 border rounded text-xs font-bold" value={editForm.selling_price} onChange={e => setEditForm({...editForm, selling_price: parseFloat(e.target.value)})} placeholder="Retail" />
                      </div>
                    ) : (
                      <div className="text-[11px] font-bold">
                        <div className="text-gray-400">COST: <span className="text-slate-700">${item.cost_price.toFixed(2)}</span></div>
                        <div className="text-gray-400">SELL: <span className="text-green-600">${item.selling_price.toFixed(2)}</span></div>
                      </div>
                    )}
                  </td>

                  {/* STOCK */}
                  <td className="p-5 text-center">
                    {isEditing ? (
                        <input type="number" className="w-16 p-2 border rounded-xl font-black text-center" value={editForm.quantity_on_hand} onChange={e => setEditForm({...editForm, quantity_on_hand: parseInt(e.target.value)})} />
                    ) : (
                        <span className={`text-xl font-black ${item.quantity_on_hand < 10 ? 'text-red-600' : 'text-slate-900'}`}>{item.quantity_on_hand}</span>
                    )}
                  </td>

                  {/* LINE VALUE */}
                  <td className="p-5 text-right font-black text-slate-900">
                    ${lineValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>

                  <td className="p-5 text-right pr-10">
                    {isEditing ? (
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleSave(item.id)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase">Save</button>
                        <button onClick={() => setEditingId(null)} className="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => startEditing(item)} className="text-blue-500 hover:text-blue-700 font-black text-[10px] uppercase tracking-widest">Edit</button>
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