'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase'; 
import Link from 'next/link';

export default function WarehouseMasterPage() {
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Updated Edit Form with Financials
  const [editForm, setEditForm] = useState({ 
    item_name: '', 
    sku: '', 
    image_url: '', 
    quantity_on_hand: 0,
    supplier: '',
    supplier_sku: '',
    cost_price: 0,
    selling_price: 0
  });

  useEffect(() => { fetchWarehouseData(); }, []);

  const fetchWarehouseData = async () => {
    setLoading(true);
    const { data } = await supabase.from('inventory_master').select('*').order('item_name', { ascending: true });
    if (data) setInventory(data);
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
      selling_price: item.selling_price || 0
    });
  };

  const handleSave = async (id: string) => {
    const { error } = await supabase.from('inventory_master').update(editForm).eq('id', id);
    if (!error) { setEditingId(null); fetchWarehouseData(); }
  };

  const filtered = inventory.filter(i => 
    i.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.supplier?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-full mx-auto mb-10">
        <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase hover:underline mb-1 inline-block tracking-widest">← Dashboard</Link>
        <h1 className="text-4xl font-black tracking-tight">Warehouse Master</h1>
        <p className="text-gray-500 font-medium">Manage Suppliers, Cost, and Retail Pricing.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <input 
                placeholder="Search SKU, Name, or Supplier..." 
                className="w-full md:w-1/3 p-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
        
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase text-gray-400">
              <th className="p-5 w-20">Preview</th>
              <th className="p-5">Product Details</th>
              <th className="p-5">Supplier Info</th>
              <th className="p-5">Financials (Cost/Sell)</th>
              <th className="p-5">Stock</th>
              <th className="p-5 text-right pr-10">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(item => {
              const isEditing = editingId === item.id;
              const margin = item.selling_price > 0 
                ? (((item.selling_price - item.cost_price) / item.selling_price) * 100).toFixed(0) 
                : 0;

              return (
                <tr key={item.id} className="hover:bg-blue-50/20 transition-all">
                  <td className="p-5">
                    <div className="w-12 h-12 bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                      {item.image_url ? <img src={item.image_url} className="w-full h-full object-contain" /> : null}
                    </div>
                  </td>
                  
                  {/* PRODUCT COLUMN */}
                  <td className="p-5">
                    {isEditing ? (
                      <div className="space-y-1">
                        <input className="w-full p-2 border rounded font-bold text-xs" value={editForm.item_name} onChange={e => setEditForm({...editForm, item_name: e.target.value})} />
                        <input className="w-full p-2 border rounded font-mono text-[10px]" value={editForm.sku} onChange={e => setEditForm({...editForm, sku: e.target.value})} />
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold text-slate-900 leading-tight uppercase text-sm">{item.item_name}</div>
                        <div className="text-[10px] font-mono font-bold text-blue-500 uppercase">{item.sku} <span className="text-gray-400 ml-2">Size: {item.size}</span></div>
                      </div>
                    )}
                  </td>

                  {/* SUPPLIER COLUMN */}
                  <td className="p-5">
                    {isEditing ? (
                      <div className="space-y-1">
                        <input placeholder="Supplier Name" className="w-full p-2 border rounded text-xs" value={editForm.supplier} onChange={e => setEditForm({...editForm, supplier: e.target.value})} />
                        <input placeholder="Vendor SKU" className="w-full p-2 border rounded text-xs" value={editForm.supplier_sku} onChange={e => setEditForm({...editForm, supplier_sku: e.target.value})} />
                      </div>
                    ) : (
                      <div className="text-xs">
                        <div className="font-bold text-gray-700">{item.supplier || 'No Supplier'}</div>
                        <div className="text-gray-400 font-mono text-[10px]">{item.supplier_sku || '--'}</div>
                      </div>
                    )}
                  </td>

                  {/* FINANCIALS COLUMN */}
                  <td className="p-5">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-[8px] font-bold uppercase text-gray-400">Cost</label>
                            <input type="number" className="w-full p-2 border rounded text-xs font-bold" value={editForm.cost_price} onChange={e => setEditForm({...editForm, cost_price: parseFloat(e.target.value)})} />
                        </div>
                        <div className="flex-1">
                            <label className="text-[8px] font-bold uppercase text-gray-400">Sell</label>
                            <input type="number" className="w-full p-2 border rounded text-xs font-bold" value={editForm.selling_price} onChange={e => setEditForm({...editForm, selling_price: parseFloat(e.target.value)})} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400">Cost:</span>
                            <span className="text-xs font-bold text-slate-700">${item.cost_price}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400">Sell:</span>
                            <span className="text-sm font-black text-green-600">${item.selling_price}</span>
                        </div>
                        <div className="text-[9px] font-black text-blue-500 uppercase mt-1">Margin: {margin}%</div>
                      </div>
                    )}
                  </td>

                  {/* STOCK COLUMN */}
                  <td className="p-5 text-center">
                    <span className={`text-xl font-black ${item.quantity_on_hand < 10 ? 'text-red-600' : 'text-slate-900'}`}>{item.quantity_on_hand}</span>
                  </td>

                  {/* ACTION COLUMN */}
                  <td className="p-5 text-right pr-10">
                    {isEditing ? (
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleSave(item.id)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase">Save</button>
                        <button onClick={() => setEditingId(null)} className="bg-gray-100 px-4 py-2 rounded-xl font-bold text-xs uppercase text-gray-500">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => startEditing(item)} className="text-blue-600 hover:text-blue-800 font-bold text-[10px] uppercase tracking-widest">Edit Details</button>
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