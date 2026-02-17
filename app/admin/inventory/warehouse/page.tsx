'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function WarehouseMasterPage() {
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ 
    item_name: '', 
    sku: '', 
    image_url: '', 
    quantity_on_hand: 0 
  });

  useEffect(() => {
    fetchWarehouseData();
  }, []);

  const fetchWarehouseData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory_master')
      .select('*')
      .order('item_name', { ascending: true });
    
    if (data) setInventory(data);
    setLoading(false);
  };

  const startEditing = (item: any) => {
    setEditingId(item.id);
    setEditForm({
      item_name: item.item_name,
      sku: item.sku,
      image_url: item.image_url || '',
      quantity_on_hand: item.quantity_on_hand
    });
  };

  const handleSave = async (id: string) => {
    const { error } = await supabase
      .from('inventory_master')
      .update(editForm)
      .eq('id', id);

    if (error) {
      alert("Save failed: " + error.message);
    } else {
      setEditingId(null);
      fetchWarehouseData();
    }
  };

  const filtered = inventory.filter(i => 
    i.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-10">
        <div className="flex justify-between items-center">
          <div>
            <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase hover:underline mb-1 inline-block tracking-widest">
              ← Command Center
            </Link>
            <h1 className="text-4xl font-black tracking-tight">Warehouse Master</h1>
            <p className="text-gray-500">Manage global product details and total warehouse stock levels.</p>
          </div>
          <div className="flex gap-3">
             <Link href="/admin/inventory/transfer" className="bg-white text-gray-900 border border-gray-200 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 shadow-sm transition-all">
                Load Truck →
             </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Search & Stats Bar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row gap-6 items-center">
          <div className="relative flex-1 w-full">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input 
              placeholder="Search by SKU, Name, or Attribute..." 
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-8 px-4">
             <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Total Skus</p>
                <p className="text-xl font-black leading-none">{inventory.length}</p>
             </div>
             <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Low Stock</p>
                <p className="text-xl font-black text-red-600 leading-none">{inventory.filter(i => i.quantity_on_hand < 10).length}</p>
             </div>
          </div>
        </div>

        {/* Data Grid */}
        <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-5 text-[10px] font-black uppercase text-gray-400 tracking-wider w-16">Preview</th>
                <th className="p-5 text-[10px] font-black uppercase text-gray-400 tracking-wider">Product Information</th>
                <th className="p-5 text-[10px] font-black uppercase text-gray-400 tracking-wider">Size</th>
                <th className="p-5 text-[10px] font-black uppercase text-gray-400 tracking-wider">Master Stock</th>
                <th className="p-5 text-[10px] font-black uppercase text-gray-400 tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="p-20 text-center font-bold text-gray-300 animate-pulse uppercase tracking-widest">Accessing Secure Vault...</td></tr>
              ) : filtered.map(item => (
                <tr key={item.id} className={`hover:bg-blue-50/20 transition-all ${editingId === item.id ? 'bg-blue-50/50' : ''}`}>
                  <td className="p-5">
                    <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
                      {item.image_url ? (
                        <img src={item.image_url} className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-xs font-black text-gray-300">NO IMG</span>
                      )}
                    </div>
                  </td>
                  
                  <td className="p-5">
                    {editingId === item.id ? (
                      <div className="space-y-2">
                        <input 
                          className="w-full p-2 border rounded-lg font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500" 
                          value={editForm.item_name} 
                          onChange={e => setEditForm({...editForm, item_name: e.target.value})}
                        />
                        <div className="flex gap-2">
                           <input 
                             placeholder="SKU"
                             className="w-full p-2 border rounded-lg font-mono text-xs bg-white outline-none" 
                             value={editForm.sku} 
                             onChange={e => setEditForm({...editForm, sku: e.target.value})}
                           />
                           <input 
                             placeholder="Image URL"
                             className="w-full p-2 border rounded-lg text-xs bg-white outline-none" 
                             value={editForm.image_url} 
                             onChange={e => setEditForm({...editForm, image_url: e.target.value})}
                           />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold text-lg text-slate-900 mb-0.5">{item.item_name}</div>
                        <div className="text-[11px] font-mono font-bold text-blue-500 uppercase tracking-tighter">{item.sku}</div>
                      </div>
                    )}
                  </td>

                  <td className="p-5 text-center">
                     <span className="bg-slate-900 text-white px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">
                        {item.size}
                     </span>
                  </td>

                  <td className="p-5">
                    {editingId === item.id ? (
                      <input 
                        type="number"
                        className="w-24 p-2 border rounded-xl font-black text-center bg-white outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm.quantity_on_hand}
                        onChange={e => setEditForm({...editForm, quantity_on_hand: parseInt(e.target.value)})}
                      />
                    ) : (
                      <div className="flex flex-col">
                        <span className={`text-2xl font-black ${item.quantity_on_hand < 10 ? 'text-red-600' : 'text-slate-900'}`}>
                          {item.quantity_on_hand}
                        </span>
                        <span className="text-[9px] font-black text-gray-400 uppercase">On Hand</span>
                      </div>
                    )}
                  </td>

                  <td className="p-5 text-right">
                    {editingId === item.id ? (
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleSave(item.id)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-blue-700">SAVE</button>
                        <button onClick={() => setEditingId(null)} className="bg-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold text-xs hover:bg-gray-300">CANCEL</button>
                      </div>
                    ) : (
                      <button onClick={() => startEditing(item)} className="text-gray-400 hover:text-blue-600 p-2 transition-colors">
                        <span className="font-bold text-xs uppercase tracking-widest">Edit Details</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}