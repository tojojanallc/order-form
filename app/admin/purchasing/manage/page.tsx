'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

// --- TYPES ---
interface Vendor {
  name: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  created_at: string;
  total_amount: number;
  status: 'ordered' | 'received' | 'cancelled' | 'draft';
  vendors: Vendor; // Assumes a relationship exists
}

export default function ManagePOsPage() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchPOs();
  }, []);

  const fetchPOs = async () => {
    setLoading(true);
    // Fetch POs and the related Vendor Name
    const { data, error } = await supabase
      .from('purchases')
      .select('*, vendors (name)')
      .order('created_at', { ascending: false });
      
    if (data) setPos(data);
    setLoading(false);
  };

  const cancelPO = async (id: string, poNumber: string) => {
    if (!confirm(`⚠️ ARE YOU SURE?\n\nCancel PO #${poNumber}? This cannot be undone.`)) return;

    const { error } = await supabase
      .from('purchases')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
        alert("Error: " + error.message);
    } else {
        fetchPOs(); // Refresh list
    }
  };

  const deleteDraft = async (id: string) => {
      if (!confirm("🗑️ Delete this record permanently?")) return;
      
      // Cascade delete items first (if no foreign key cascade is set)
      await supabase.from('purchase_items').delete().eq('purchase_id', id);
      await supabase.from('purchases').delete().eq('id', id);
      fetchPOs();
  };

  // Filter Logic
  const filtered = pos.filter(po => 
    po.po_number.toLowerCase().includes(search.toLowerCase()) || 
    po.vendors?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-end mb-10">
          <div>
            <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block hover:underline">← Dashboard</Link>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Purchase Orders</h1>
            <p className="text-gray-500 font-medium">Manage vendor relationships and incoming stock.</p>
          </div>
          
          <Link 
            href="/admin/purchasing/create" 
            className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-colors shadow-lg"
          >
            + Create New PO
          </Link>
        </div>

        {/* MAIN CARD */}
        <div className="bg-white rounded-[40px] border border-gray-200 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
          
          {/* TOOLBAR */}
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
             <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Search Records</span>
                <input 
                    placeholder="Search PO # or Vendor..." 
                    className="bg-white border border-gray-200 p-2 px-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 w-80 shadow-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
             </div>
             <div className="flex gap-4">
                <div className="bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest mr-2">Open Orders</span>
                    <span className="font-black text-blue-600">{pos.filter(p => p.status === 'ordered').length}</span>
                </div>
             </div>
          </div>

          {/* TABLE */}
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr className="text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
                  <th className="p-6">PO Number</th>
                  <th className="p-6">Vendor Details</th>
                  <th className="p-6">Order Date</th>
                  <th className="p-6 text-right">Total Value</th>
                  <th className="p-6 text-center">Status</th>
                  <th className="p-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                    <tr><td colSpan={6} className="p-20 text-center font-bold text-gray-300 animate-pulse">LOADING ORDERS...</td></tr>
                ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="p-20 text-center font-bold text-gray-400 italic">No matching orders found.</td></tr>
                ) : filtered.map(po => (
                  <tr key={po.id} className="group hover:bg-blue-50/30 transition-all">
                    
                    <td className="p-6">
                        <Link href={`/admin/purchasing/${po.id}`} className="font-mono font-black text-blue-600 hover:underline text-sm">
                            #{po.po_number}
                        </Link>
                    </td>

                    <td className="p-6">
                        <div className="font-bold text-sm uppercase text-slate-800">{po.vendors?.name || 'Unknown Vendor'}</div>
                    </td>
                    
                    <td className="p-6">
                        <span className="text-xs font-bold text-gray-500">{new Date(po.created_at).toLocaleDateString()}</span>
                    </td>

                    <td className="p-6 text-right">
                        <span className="text-sm font-black text-slate-900">${po.total_amount?.toFixed(2)}</span>
                    </td>

                    <td className="p-6 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
                            ${po.status === 'received' ? 'bg-green-100 text-green-700' : 
                              po.status === 'cancelled' ? 'bg-red-100 text-red-600' : 
                              'bg-orange-100 text-orange-600'}
                        `}>
                            {po.status}
                        </span>
                    </td>

                    <td className="p-6 text-right">
                       <div className="flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Actions only available if not yet received/finalized */}
                            {po.status === 'ordered' && (
                                <>
                                    <button 
                                        onClick={() => cancelPO(po.id, po.po_number)} 
                                        className="px-3 py-1.5 rounded-lg border border-orange-200 text-orange-600 font-bold text-[10px] uppercase hover:bg-orange-50"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={() => deleteDraft(po.id)} 
                                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 font-bold text-[10px] uppercase hover:bg-red-50"
                                    >
                                        Delete
                                    </button>
                                </>
                            )}
                            <Link 
                                href={`/admin/purchasing/${po.id}`}
                                className="px-3 py-1.5 rounded-lg bg-gray-100 text-slate-600 font-bold text-[10px] uppercase hover:bg-slate-200"
                            >
                                View
                            </Link>
                       </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}