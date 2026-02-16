'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase';
import Link from 'next/link';

export default function ManagePOs() {
  const [pos, setPos] = useState([]);

  useEffect(() => {
    fetchPOs();
  }, []);

  const fetchPOs = async () => {
    const { data } = await supabase
      .from('purchases')
      .select('*, vendors(name)')
      .order('created_at', { ascending: false });
    setPos(data || []);
  };

  const cancelPO = async (id, poNumber) => {
    if (!confirm(`Are you sure you want to CANCEL PO ${poNumber}? This cannot be undone.`)) return;

    // Mark status as 'cancelled'
    const { error } = await supabase
      .from('purchases')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
        alert("Error: " + error.message);
    } else {
        alert(`PO ${poNumber} Cancelled.`);
        fetchPOs();
    }
  };

  const deleteDraft = async (id) => {
      if (!confirm("Delete this draft permanently?")) return;
      // Hard delete for mistakes
      await supabase.from('purchase_items').delete().eq('purchase_id', id);
      await supabase.from('purchases').delete().eq('id', id);
      fetchPOs();
  };

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen bg-gray-50">
      <div className="flex justify-between items-center mb-8">
        <div>
            <Link href="/admin" className="text-gray-500 font-bold hover:underline">← Back to Dashboard</Link>
            <h1 className="text-3xl font-black text-gray-900 mt-2">Manage Purchase Orders</h1>
        </div>
        <Link href="/admin/purchasing/create" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 shadow">
            + Create New PO
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="p-4 font-black uppercase text-xs text-gray-500">PO Number</th>
              <th className="p-4 font-black uppercase text-xs text-gray-500">Vendor</th>
              <th className="p-4 font-black uppercase text-xs text-gray-500">Date</th>
              <th className="p-4 font-black uppercase text-xs text-gray-500">Total</th>
              <th className="p-4 font-black uppercase text-xs text-gray-500 text-center">Status</th>
              <th className="p-4 font-black uppercase text-xs text-gray-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pos.map(po => (
              <tr key={po.id} className="hover:bg-gray-50">
                <td className="p-4 font-bold text-blue-900">{po.po_number}</td>
                <td className="p-4 font-medium">{po.vendors?.name}</td>
                <td className="p-4 text-sm text-gray-500">{new Date(po.created_at).toLocaleDateString()}</td>
                <td className="p-4 font-mono font-bold">${po.total_amount.toFixed(2)}</td>
                <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-black uppercase ${
                        po.status === 'received' ? 'bg-green-100 text-green-700' : 
                        po.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                        'bg-orange-100 text-orange-700'
                    }`}>
                        {po.status}
                    </span>
                </td>
                <td className="p-4 text-right flex justify-end gap-2">
                    {/* ONLY SHOW CANCEL/DELETE IF IT'S NOT RECEIVED YET */}
                    {po.status === 'ordered' && (
                        <>
                            <button 
                                onClick={() => cancelPO(po.id, po.po_number)} 
                                className="text-orange-600 font-bold text-xs hover:underline border border-orange-200 px-3 py-1 rounded bg-orange-50"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => deleteDraft(po.id)} 
                                className="text-red-600 font-bold text-xs hover:underline border border-red-200 px-3 py-1 rounded bg-red-50"
                            >
                                Delete
                            </button>
                        </>
                    )}
                </td>
              </tr>
            ))}
            {pos.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400 font-bold italic">No Purchase Orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}