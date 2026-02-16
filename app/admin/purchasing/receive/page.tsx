'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase';

export default function ReceivePO() {
  const [openPOs, setOpenPOs] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [poItems, setPoItems] = useState([]);

  useEffect(() => {
    fetchOpenPOs();
  }, []);

  const fetchOpenPOs = async () => {
    // Fetch POs with status 'ordered' and join Vendor name
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
      // 1. Loop through items and update Master Inventory
      for (const item of poItems) {
        // Increment Quantity AND Update Cost Basis to latest price
        await supabase.rpc('increment_master_inventory', { // We can do direct update if no RPC
           // Simpler Direct Update logic:
        });
        
        // Manual SQL Update equivalent
        const { data: current } = await supabase.from('inventory_master').select('quantity_on_hand').eq('sku', item.sku).single();
        await supabase.from('inventory_master').update({
            quantity_on_hand: (current?.quantity_on_hand || 0) + item.quantity,
            cost_per_unit: item.unit_cost 
        }).eq('sku', item.sku);
      }

      // 2. Mark PO as Received
      await supabase.from('purchases').update({ status: 'received' }).eq('id', selectedPO.id);

      alert("Stock Received Successfully!");
      setSelectedPO(null);
      fetchOpenPOs();

    } catch (err) {
      alert("Error receiving stock: " + err.message);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-black mb-6">Receive Inbound Stock</h1>
      
      {!selectedPO ? (
        // LIST VIEW
        <div className="grid gap-4">
          <h2 className="font-bold text-gray-500 uppercase text-sm">Open Purchase Orders</h2>
          {openPOs.length === 0 && <p>No open orders.</p>}
          {openPOs.map(po => (
            <div key={po.id} onClick={() => loadPO(po)} className="bg-white p-6 rounded-xl border hover:border-blue-500 cursor-pointer shadow-sm flex justify-between items-center group">
               <div>
                 <div className="text-xl font-bold group-hover:text-blue-600">{po.po_number}</div>
                 <div className="text-gray-500">{po.vendors?.name} • {new Date(po.created_at).toLocaleDateString()}</div>
               </div>
               <div className="font-bold text-xl">${po.total_amount}</div>
            </div>
          ))}
        </div>
      ) : (
        // DETAIL VIEW
        <div>
          <button onClick={() => setSelectedPO(null)} className="text-gray-500 font-bold mb-4">← Back to List</button>
          <div className="bg-white p-8 rounded-xl shadow-lg border">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black">{selectedPO.po_number} <span className="text-gray-400 font-normal">({selectedPO.vendors?.name})</span></h2>
                <button onClick={receiveAll} className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 shadow-lg">
                   Verify & Receive Stock
                </button>
             </div>
             
             <table className="w-full text-left">
                <thead className="bg-gray-100"><tr><th className="p-3">Item</th><th className="p-3">Qty Ordered</th><th className="p-3">Cost</th></tr></thead>
                <tbody>
                   {poItems.map(item => (
                     <tr key={item.id} className="border-t">
                        <td className="p-3 font-bold">{item.inventory_master?.item_name} ({item.inventory_master?.size})</td>
                        <td className="p-3 font-mono text-lg">{item.quantity}</td>
                        <td className="p-3">${item.unit_cost}</td>
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