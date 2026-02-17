'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase'; 
import Link from 'next/link';

export default function WarehouseMasterPage() {
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Bulk Upload State
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);

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
    const { data } = await supabase.from('inventory_master').select('*').order('item_name', { ascending: true });
    if (data) setInventory(data);
    setLoading(false);
  };

  // --- BULK SYNC LOGIC ---
  const handleBulkSync = async () => {
    const lines = bulkText.split('\n').filter(line => line.trim() !== '');
    let successCount = 0;
    setLoading(true);

    for (const line of lines) {
      const [sku, url] = line.split(',').map(item => item.trim());
      if (sku && url) {
        const { error } = await supabase
          .from('inventory_master')
          .update({ image_url: url })
          .eq('sku', sku);
        if (!error) successCount++;
      }
    }

    alert(`Successfully updated ${successCount} product images.`);
    setBulkText('');
    setShowBulk(false);
    fetchWarehouseData();
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
    const { error } = await supabase.from('inventory_master').update(editForm).eq('id', id);
    if (!error) { setEditingId(null); fetchWarehouseData(); }
  };

  const filtered = inventory.filter(i => 
    i.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto mb-10 flex justify-between items-end">
        <div>
          <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase hover:underline mb-1 inline-block tracking-widest">← Dashboard</Link>
          <h1 className="text-4xl font-black tracking-tight">Warehouse Master</h1>
          <p className="text-gray-500 font-medium">Global catalog management for Lev Custom Merch.</p>
        </div>
        <button 
            onClick={() => setShowBulk(!showBulk)}
            className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-sm"
        >
            {showBulk ? 'Close Tool' : 'Bulk Image Sync'}
        </button>
      </div>

      {/* BULK TOOL PANEL */}
      {showBulk && (
        <div className="max-w-7xl mx-auto mb-8 bg-blue-50 border-2 border-blue-100 p-6 rounded-3xl shadow-inner">
            <h3 className="font-black text-blue-900 uppercase text-xs tracking-widest mb-2">Mass Image Updater</h3>
            <p className="text-sm text-blue-700 mb-4 font-medium">Paste your data below (Format: SKU, URL). One pair per line.</p>
            <textarea 
                className="w-full h-40 p-4 rounded-2xl border-none focus:ring-2 focus:ring-blue-500 font-mono text-xs mb-4 shadow-sm"
                placeholder="PROD-101, https://image.link/photo.jpg&#10;PROD-102, https://image.link/photo2.jpg"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
            />
            <button 
                onClick={handleBulkSync}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700"
            >
                Run Sync Process
            </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6 flex items-center gap-4">
            <input 
                placeholder="Search catalog..." 
                className="flex-1 p-3 bg-gray-50 border-none rounded-xl font-bold text-gray-700 focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
            <div className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {filtered.length} Results
            </div>
        </div>

        {/* Data Grid */}
        <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase text-gray-400">
                <th className="p-5 tracking-widest w-20">Preview</th>
                <th className="p-5 tracking-widest">Product</th>
                <th className="p-5 tracking-widest">Size</th>
                <th className="p-5 tracking-widest">Warehouse Stock</th>
                <th className="p-5 text-right tracking-widest pr-10">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-blue-50/20 transition-all">
                  <td className="p-5">
                    <div className="w-12 h-12 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center border border-gray-100">
                      {item.image_url ? <img src={item.image_url} className="w-full h-full object-contain" /> : <span className="text-[8px] font-black text-gray-300">N/A</span>}
                    </div>
                  </td>
                  <td className="p-5">
                    {editingId === item.id ? (
                      <div className="space-y-2">
                        <input className="w-full p-2 border rounded-lg font-bold text-sm" value={editForm.item_name} onChange={e => setEditForm({...editForm, item_name: e.target.value})} />
                        <input className="w-full p-2 border rounded-lg font-mono text-xs" value={editForm.sku} onChange={e => setEditForm({...editForm, sku: e.target.value})} />
                        <input className="w-full p-2 border rounded-lg text-xs" value={editForm.image_url} onChange={e => setEditForm({...editForm, image_url: e.target.value})} placeholder="Image URL" />
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold text-slate-900 leading-tight uppercase">{item.item_name}</div>
                        <div className="text-[10px] font-mono font-bold text-blue-500 uppercase">{item.sku}</div>
                      </div>
                    )}
                  </td>
                  <td className="p-5"><span className="bg-slate-900 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">{item.size}</span></td>
                  <td className="p-5">
                    {editingId === item.id ? (
                        <input type="number" className="w-20 p-2 border rounded-xl font-black text-center" value={editForm.quantity_on_hand} onChange={e => setEditForm({...editForm, quantity_on_hand: parseInt(e.target.value)})} />
                    ) : (
                        <span className={`text-xl font-black ${item.quantity_on_hand < 10 ? 'text-red-600' : 'text-slate-900'}`}>{item.quantity_on_hand}</span>
                    )}
                  </td>
                  <td className="p-5 text-right pr-10">
                    {editingId === item.id ? (
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleSave(item.id)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase">Save</button>
                        <button onClick={() => setEditingId(null)} className="bg-gray-100 px-4 py-2 rounded-xl font-bold text-xs uppercase">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => startEditing(item)} className="text-gray-400 hover:text-blue-600 font-bold text-[10px] uppercase tracking-widest">Edit Details</button>
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