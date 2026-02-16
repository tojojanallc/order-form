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
    <div className="min-h-screen bg-white text-black p-8 max-w-5xl mx-auto">
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center mb-10 border-b-4 border-black pb-4">
        <div>
          <Link href="/admin" className="text-blue-600 font-black uppercase text-xs hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-4xl font-black uppercase mt-2">Receive Stock</h1>
        </div>
        <div className="text-right">
          <p className="text-xs font-black text-gray-400 uppercase">Module</p>
          <p className="font-bold">Inbound Inventory</p>
        </div>
      </div>
      
      {!selectedPO ? (
        <div className="grid gap-4">
          <h2 className="font-bold text-gray-500 uppercase text-xs tracking-widest ml-2">Shipments Awaiting Arrival</h2>
          
          {loading && <p className="p-10 text-center font-bold">Checking database...</p>}
          
          {!loading && openPOs.length === 0 && (
             <div className="text-center p-16 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl">
                <p className="text-gray-400 font-bold text-lg mb-4">All purchase orders are fully received.</p>
                <Link href="/admin/purchasing/create" className="bg-black text-white px-8 py-3 rounded font-bold uppercase text-sm">
                  Create New PO
                </Link>
             </div>
          )}

          {openPOs.map(po => (
            <div key={po.id} onClick={() => loadPO(po)} className="bg-white p-6 border-2 border-black hover:bg-gray-50 cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all flex justify-between items-center group">
               <div>
                 <div className="text-2xl font-black group-hover:text-blue-600">{po.po_number}</div>
                 <div className="text-lg font-bold uppercase">{po.vendors?.name}</div>
                 <div className="text-sm text-gray-500">{new Date(po.created_at).toLocaleDateString()}</div>
               </div>
               <div className="text-right">
                  <div className="text-2xl font-black">${po.total_amount?.toFixed(2)}</div>
                  <div className="mt-2 text-[10px] font-black bg-yellow-300 border border-black px-2 py-1 uppercase inline-block">Review PO</div>
               </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
           <div className="flex justify-between items-start mb-10 border-b-2 border-black pb-6">
              <div>
                  <button onClick={() => setSelectedPO(null)} className="text-blue-600 font-black text-xs uppercase hover:underline mb-2">← Back to PO List</button>
                  <h2 className="text-4xl font-black">{selectedPO.po_number}</h2>
                  <p className="text-xl font-bold text-gray-600 uppercase">{selectedPO.vendors?.name}</p>
              </div>
              <button 
                  onClick={receiveAll} 
                  className="bg-green-600 text-white px-10 py-5 font-black uppercase text-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-green-700 active:translate-y-1 active:shadow-none transition-all"
              >
                 Accept Shipment
              </button>
           </div>
           
           <table className="w-full text-left bg-white">
              <thead>
                  <tr className="bg-gray-100 border-b-2 border-black">
                      <th className="p-4 font-black uppercase text-xs">Item Description</th>
                      <th className="p-4 font-black uppercase text-xs text-center">Qty</th>
                      <th className="p-4 font-black uppercase text-xs text-right">Cost</th>
                  </tr>
              </thead>
              <tbody className="divide-y-2 border-b border-black">
                 {poItems.map(item => (
                   <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-6 font-black text-xl">
                          {item.inventory_master?.item_name} <span className="text-gray-400 font-bold ml-2">({item.inventory_master?.size})</span>
                      </td>
                      <td className="p-6 font-mono text-3xl font-black text-center">{item.quantity}</td>
                      <td className="p-6 text-right font-mono font-bold text-lg text-gray-600">${item.unit_cost.toFixed(2)}</td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}
    </div>
  );
}