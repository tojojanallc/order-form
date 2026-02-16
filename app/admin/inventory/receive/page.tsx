'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase';
import Link from 'next/link'; // Import Link

export default function ReceivePO() {
  const [openPOs, setOpenPOs] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [poItems, setPoItems] = useState([]);

  useEffect(() => {
    fetchOpenPOs();
  }, []);

  const fetchOpenPOs = async () => {
    const { data } = await supabase
      .from('purchases')
      .select('*, vendors(name)')
      .eq('status', 'ordered')
      .order('created_at', { ascending: false });
    setOpenPOs(data || []);
  };

  const loadPO = async (po) => {
    setSelectedPO(po);
    const { data } = await supabase
      .from('purchase_items')
      .select('*, inventory_master(item_name, size)')
      .eq('purchase_id', po.id);
    setPoItems(data || []);
  };

  const receiveAll = async () => {
    if (!confirm(`Confirm receipt of PO ${selectedPO.po_number}? This will add stock to Warehouse.`)) return;

    try {
      for (const item of poItems) {
        // Manual SQL Update
        const { data: current } = await supabase.from('inventory_master').select('quantity_on_hand').eq('sku', item.sku).single();
        await supabase.from('inventory_master').update({
            quantity_on_hand: (current?.quantity_on_hand || 0) + item.quantity,
            cost_per_unit: item.unit_cost 
        }).eq('sku', item.sku);
      }

      await supabase.from('purchases').update({ status: 'received' }).eq('id', selectedPO.id);

      alert("Stock Received Successfully!");
      setSelectedPO(null);
      fetchOpenPOs();

    } catch (err) {
      alert("Error receiving stock: " + err.message);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen bg-gray-50">
      {/* HEADER WITH BACK BUTTON */}
      <div className="flex justify-between items-center mb-8">
        <div>
            <Link href="/admin" className="text-gray-500 font-bold hover:underline mb-2 inline-block">← Back to Dashboard</Link>
            <h1 className="text-3xl font-black text-gray-900">Receive Inbound Stock</h1>
        </div>
      </div>
      
      {!selectedPO ? (
        // LIST VIEW
        <div className="grid gap-4">
          <h2 className="font-bold text-gray-500 uppercase text-sm mb-2">Select a PO to Receive</h2>
          {openPOs.length === 0 && (
             <div className="text-center p-12 bg-white rounded-xl border border-dashed border-gray-300">
                <p className="text-gray-400 font-bold mb-4">No pending shipments found.</p>
                <Link href="/admin/purchasing/create" className="text-blue-600 font-bold hover:underline">Create a new Purchase Order</Link>
             </div>
          )}
          {openPOs.map(po => (
            <div key={po.id} onClick={() => loadPO(po)} className="bg-white p-6 rounded-xl border hover:border-blue-500 cursor-pointer shadow-sm flex justify-between items-center group transition-all">
               <div>
                 <div className="text-xl font-bold group-hover:text-blue-600">{po.po_number}</div>
                 <div className="text-gray-500 text-sm font-bold">{po.vendors?.name} • {new Date(po.created_at).toLocaleDateString()}</div>
               </div>
               <div className="font-black text-xl text-gray-700">${po.total_amount?.toFixed(2)}</div>
            </div>
          ))}
        </div>
      ) : (
        // DETAIL VIEW
        <div>
          <button onClick={() => setSelectedPO(null)} className="text-blue-600 font-bold mb-6 hover:underline">← Back to PO List</button>
          
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
             <div className="flex justify-between items-start mb-8 border-b pb-6">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 mb-1">{selectedPO.po_number}</h2>
                    <p className="text-gray-500 font-bold text-lg">{selectedPO.vendors?.name}</p>
                </div>
                <button 
                    onClick={receiveAll} 
                    className="bg-green-600 text-white px-8 py-4 rounded-xl font-black uppercase text-sm hover:bg-green-700 shadow-lg transition-transform active:scale-95"
                >
                   Verify & Receive Stock
                </button>
             </div>
             
             <table className="w-full text-left">
                <thead className="bg-gray-100 rounded-lg">
                    <tr>
                        <th className="p-4 font-black uppercase text-xs text-gray-600 rounded-l-lg">Item</th>
                        <th className="p-4 font-black uppercase text-xs text-gray-600 text-center">Qty Ordered</th>
                        <th className="p-4 font-black uppercase text-xs text-gray-600 text-right rounded-r-lg">Cost Basis</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                   {poItems.map(item => (
                     <tr key={item.id} className="hover:bg-gray-50">
                        <td className="p-4 font-bold text-lg text-gray-900">
                            {item.inventory_master?.item_name} <span className="text-gray-400 font-normal">({item.inventory_master?.size})</span>
                        </td>
                        <td className="p-4 font-mono text-lg font-bold text-center">{item.quantity}</td>
                        <td className="p-4 text-right font-mono text-gray-500">${item.unit_cost.toFixed(2)}</td>
                     </tr>
                   ))}
                </tbody>
             </table>
          </div>
        </div>
      )}
    </div>
  );
}