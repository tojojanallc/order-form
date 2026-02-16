'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase';
import Link from 'next/link';

export default function ReceivePO() {
  const [openPOs, setOpenPOs] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [poItems, setPoItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOpenPOs();
  }, []);

  const fetchOpenPOs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('purchases')
      .select('*, vendors(name)')
      .eq('status', 'ordered')
      .order('created_at', { ascending: false });
    setOpenPOs(data || []);
    setLoading(false);
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
    if (!confirm(`Confirm receipt of PO ${selectedPO.po_number}? This adds stock to Warehouse.`)) return;

    try {
      for (const item of poItems) {
        const { data: current } = await supabase.from('inventory_master').select('quantity_on_hand').eq('sku', item.sku).single();
        await supabase.from('inventory_master').update({
            quantity_on_hand: (current?.quantity_on_hand || 0) + item.quantity,
            cost_per_unit: item.unit_cost 
        }).eq('sku', item.sku);
      }

      await supabase.from('purchases').update({ status: 'received' }).eq('id', selectedPO.id);

      alert("✅ Stock Received Successfully!");
      setSelectedPO(null);
      fetchOpenPOs();

    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* TOP NAVIGATION */}
        <div className="mb-8">
          <Link href="/admin" className="text-blue-600 font-black uppercase text-sm hover:underline flex items-center gap-2">
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-black text-black mt-4">Receive Inbound Stock</h1>
        </div>
        
        {!selectedPO ? (
          <div className="grid gap-4">
            <h2 className="font-bold text-gray-500 uppercase text-xs tracking-widest">Select an Open PO</h2>
            
            {loading && <p className="text-gray-400 font-bold">Loading shipments...</p>}
            
            {!loading && openPOs.length === 0 && (
               <div className="text-center p-16 bg-white rounded-2xl border-2 border-dashed border-gray-300">
                  <p className="text-gray-400 font-bold text-lg mb-4">No shipments waiting to be received.</p>
                  <Link href="/admin/purchasing/create" className="bg-black text-white px-6 py-3 rounded-lg font-bold inline-block">
                    Create a New PO
                  </Link>
               </div>
            )}

            {openPOs.map(po => (
              <div key={po.id} onClick={() => loadPO(po)} className="bg-white p-6 rounded-xl border-2 border-transparent hover:border-blue-500 cursor-pointer shadow-sm flex justify-between items-center transition-all group">
                 <div>
                   <div className="text-2xl font-black text-black group-hover:text-blue-600">{po.po_number}</div>
                   <div className="text-gray-600 font-bold">{po.vendors?.name} • {new Date(po.created_at).toLocaleDateString()}</div>
                 </div>
                 <div className="text-right">
                    <div className="text-2xl font-black text-gray-900">${po.total_amount?.toFixed(2)}</div>
                    <div className="text-xs font-black uppercase text-orange-600 bg-orange-50 px-2 py-1 rounded mt-1">Pending</div>
                 </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-2xl shadow-xl border-2 border-gray-200">
             <div className="flex justify-between items-start mb-10 border-b-2 border-gray-100 pb-8">
                <div>
                    <button onClick={() => setSelectedPO(null)} className="text-blue-600 font-black text-xs uppercase hover:underline mb-2">← Back to List</button>
                    <h2 className="text-4xl font-black text-black">{selectedPO.po_number}</h2>
                    <p className="text-xl font-bold text-gray-500">{selectedPO.vendors?.name}</p>
                </div>
                <button 
                    onClick={receiveAll} 
                    className="bg-green-600 text-white px-10 py-5 rounded-xl font-black uppercase text-lg hover:bg-green-700 shadow-2xl transition-transform active:scale-95"
                >
                   Accept & Add to Stock
                </button>
             </div>
             
             <table className="w-full text-left">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="p-4 font-black uppercase text-xs text-black rounded-l-lg">Item Name</th>
                        <th className="p-4 font-black uppercase text-xs text-black text-center">Qty Ordered</th>
                        <th className="p-4 font-black uppercase text-xs text-black text-right rounded-r-lg">Unit Cost</th>
                    </tr>
                </thead>
                <tbody className="divide-y-2 divide-gray-50">
                   {poItems.map(item => (
                     <tr key={item.id}>
                        <td className="p-6 font-black text-xl text-black">
                            {item.inventory_master?.item_name} <span className="text-gray-400 font-bold ml-2">({item.inventory_master?.size})</span>
                        </td>
                        <td className="p-6 font-mono text-2xl font-black text-center text-blue-900">{item.quantity}</td>
                        <td className="p-6 text-right font-mono font-bold text-gray-600 text-lg">${item.unit_cost.toFixed(2)}</td>
                     </tr>
                   ))}
                </tbody>
             </table>
          </div>
        )}
      </div>
    </div>
  );
}