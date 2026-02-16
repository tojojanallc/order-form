'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase'; // Adjust path as needed
import { useRouter } from 'next/navigation';

export default function CreatePO() {
  const router = useRouter();
  
  // Data State
  const [vendors, setVendors] = useState([]);
  const [masterItems, setMasterItems] = useState([]);
  
  // Form State
  const [vendorId, setVendorId] = useState('');
  const [isNewVendor, setIsNewVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [poNumber, setPoNumber] = useState('Generating...');
  const [cart, setCart] = useState([]);

  // Item Input State
  const [selectedSku, setSelectedSku] = useState('');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');

  useEffect(() => {
    fetchData();
    generatePoNumber();
  }, []);

  const fetchData = async () => {
    const { data: v } = await supabase.from('vendors').select('*').order('name');
    const { data: i } = await supabase.from('inventory_master').select('*').order('item_name');
    setVendors(v || []);
    setMasterItems(i || []);
    if(i && i.length > 0) setSelectedSku(i[0].sku);
  };

  const generatePoNumber = async () => {
    const dateStr = new Date().toISOString().slice(2, 7).replace('-', ''); // e.g., 2402
    const { count } = await supabase.from('purchases').select('*', { count: 'exact', head: true });
    const nextNum = (count || 0) + 1;
    setPoNumber(`PO-${dateStr}-${String(nextNum).padStart(3, '0')}`);
  };

  const handleAddVendor = async () => {
    if(!newVendorName) return;
    const { data, error } = await supabase.from('vendors').insert({ name: newVendorName }).select().single();
    if (error) return alert(error.message);
    setVendors([...vendors, data]);
    setVendorId(data.id);
    setIsNewVendor(false);
  };

  const addItem = () => {
    const item = masterItems.find(i => i.sku === selectedSku);
    setCart([...cart, { sku: item.sku, name: item.item_name, size: item.size, qty: Number(qty), cost: Number(cost) }]);
    setQty('');
  };

  const submitPO = async () => {
    if (cart.length === 0) return alert("PO is empty");
    if (!vendorId) return alert("Select a Vendor");

    // 1. Create Purchase Header
    const total = cart.reduce((sum, i) => sum + (i.qty * i.cost), 0);
    const { data: po, error } = await supabase.from('purchases').insert({
      po_number: poNumber,
      vendor_id: vendorId,
      total_amount: total,
      status: 'ordered' // STOCK IS NOT ADDED YET
    }).select().single();

    if (error) return alert(error.message);

    // 2. Create Purchase Items
    const lines = cart.map(i => ({
      purchase_id: po.id,
      sku: i.sku,
      quantity: i.qty,
      unit_cost: i.cost
    }));
    await supabase.from('purchase_items').insert(lines);

    alert(`✅ PO ${poNumber} Created! Go to 'Receive Stock' when box arrives.`);
    router.push('/admin/purchasing/receive'); // Redirect to receive page
  };

  return (
    <div className="p-8 max-w-4xl mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-black mb-6">Create Purchase Order</h1>
      
      {/* VENDOR SECTION */}
      <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
        <div className="flex justify-between items-center mb-4">
          <label className="font-bold uppercase text-sm">Vendor</label>
          <button onClick={() => setIsNewVendor(!isNewVendor)} className="text-blue-600 text-sm font-bold">
            {isNewVendor ? 'Cancel New' : '+ Add New Vendor'}
          </button>
        </div>

        {isNewVendor ? (
          <div className="flex gap-2">
            <input 
              className="flex-1 p-3 border rounded" 
              placeholder="Enter Vendor Name" 
              value={newVendorName}
              onChange={e => setNewVendorName(e.target.value)}
            />
            <button onClick={handleAddVendor} className="bg-green-600 text-white px-4 rounded font-bold">Save</button>
          </div>
        ) : (
          <select 
            className="w-full p-3 border rounded font-bold" 
            value={vendorId} 
            onChange={e => setVendorId(e.target.value)}
          >
            <option value="">-- Select Vendor --</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        )}
      </div>

      {/* PO DETAILS */}
      <div className="bg-white p-6 rounded-xl shadow-sm mb-6 flex justify-between items-center">
        <div>
          <label className="block text-xs font-bold uppercase text-gray-500">PO Number</label>
          <div className="text-2xl font-black">{poNumber}</div>
        </div>
        <div className="text-right">
          <label className="block text-xs font-bold uppercase text-gray-500">Total Value</label>
          <div className="text-2xl font-black text-green-700">
            ${cart.reduce((sum, i) => sum + (i.qty * i.cost), 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* ADD ITEMS */}
      <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
         <h3 className="font-bold mb-4">Add Items to Order</h3>
         <div className="flex gap-2 items-end">
            <div className="flex-1">
               <label className="text-xs font-bold uppercase">Item</label>
               <select className="w-full p-2 border rounded" onChange={e => setSelectedSku(e.target.value)}>
                 {masterItems.map(i => <option key={i.sku} value={i.sku}>{i.item_name} ({i.size})</option>)}
               </select>
            </div>
            <div className="w-24">
               <label className="text-xs font-bold uppercase">Qty</label>
               <input type="number" className="w-full p-2 border rounded" value={qty} onChange={e => setQty(e.target.value)} />
            </div>
            <div className="w-24">
               <label className="text-xs font-bold uppercase">Cost</label>
               <input type="number" className="w-full p-2 border rounded" value={cost} onChange={e => setCost(e.target.value)} />
            </div>
            <button onClick={addItem} className="bg-black text-white px-6 py-2 rounded font-bold h-[42px]">Add</button>
         </div>
      </div>

      {/* CART REVIEW */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
        <table className="w-full text-left">
          <thead className="bg-gray-100">
            <tr><th className="p-3">Item</th><th className="p-3">Qty</th><th className="p-3">Cost</th><th className="p-3 text-right">Line Total</th></tr>
          </thead>
          <tbody>
            {cart.map((line, idx) => (
              <tr key={idx} className="border-t">
                <td className="p-3 font-medium">{line.name} ({line.size})</td>
                <td className="p-3">{line.qty}</td>
                <td className="p-3">${line.cost}</td>
                <td className="p-3 text-right font-bold">${(line.qty * line.cost).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={submitPO} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-xl hover:bg-blue-700">
        Create Purchase Order
      </button>

    </div>
  );
}