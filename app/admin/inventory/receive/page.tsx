'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase';

export default function ReceiveStock() {
  const [existingItems, setExistingItems] = useState([]);
  const [vendor, setVendor] = useState('');
  const [receipt, setReceipt] = useState([]); 

  // Toggle State
  const [mode, setMode] = useState<'existing' | 'new'>('existing');

  // Form States
  const [selectedSku, setSelectedSku] = useState('');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  
  // New Item Form
  const [newItem, setNewItem] = useState({
    name: '',
    size: 'M',
    color: 'No Color',
    category: 'Apparel'
  });

  useEffect(() => {
    fetchMasterInventory();
  }, []);

  const fetchMasterInventory = async () => {
    const { data } = await supabase.from('inventory_master').select('*').order('item_name');
    setExistingItems(data || []);
    if(data && data.length > 0) setSelectedSku(data[0].sku);
  };

  const generateSku = (name: string, size: string, color: string) => {
    return `${name} | ${size} | ${color}`;
  };

  const addToShipment = () => {
    const quantity = Number(qty);
    const unitCost = Number(cost);

    if (!quantity || quantity <= 0) return alert("Please enter a valid Quantity.");
    if (unitCost < 0) return alert("Please enter a valid Cost.");

    if (mode === 'existing') {
        const item = existingItems.find(i => i.sku === selectedSku);
        if (!item) return;

        setReceipt([...receipt, {
            sku: item.sku,
            name: item.item_name,
            size: item.size,
            qty: quantity,
            cost: unitCost,
            isNew: false
        }]);
    } else {
        // Validation for New Item
        if (!newItem.name) return alert("Item Name is required.");
        
        const generatedSku = generateSku(newItem.name, newItem.size, newItem.color);
        
        // Check if this "New" item actually exists already
        const duplicate = existingItems.find(i => i.sku === generatedSku);
        if (duplicate) return alert("This item already exists! Please switch to 'Existing Item' mode.");

        setReceipt([...receipt, {
            sku: generatedSku,
            name: newItem.name,
            size: newItem.size,
            color: newItem.color,
            category: newItem.category,
            qty: quantity,
            cost: unitCost,
            isNew: true // FLAG TO CREATE LATER
        }]);
    }

    // Reset fields for next scan
    setQty('');
    // We keep cost/vendor populated as they likely don't change box-to-box
  };

  const removeLine = (index) => {
    const newReceipt = [...receipt];
    newReceipt.splice(index, 1);
    setReceipt(newReceipt);
  };

  const submitPurchase = async () => {
    if (receipt.length === 0) return alert("Shipment is empty.");
    if (!vendor) return alert("Please enter a Vendor Name.");

    try {
        // 1. Create NEW Items in Master Inventory first
        const newItems = receipt.filter(r => r.isNew);
        for (const item of newItems) {
            const { error } = await supabase.from('inventory_master').insert({
                sku: item.sku,
                item_name: item.name,
                size: item.size,
                color: item.color,
                category: item.category,
                cost_per_unit: item.cost, // Set initial cost
                quantity_on_hand: 0 // The trigger will add the qty, so start at 0
            });
            if (error) throw new Error(`Failed to create item ${item.name}: ${error.message}`);
        }

        // 2. Create Purchase Order Record
        const total = receipt.reduce((sum, i) => sum + (i.qty * i.cost), 0);
        const { data: po, error: poError } = await supabase
            .from('purchases')
            .insert({ vendor, total_amount: total })
            .select()
            .single();
        
        if (poError) throw poError;

        // 3. Create Purchase Line Items (This fires the Trigger to update stock)
        const lineItems = receipt.map(i => ({
            purchase_id: po.id,
            sku: i.sku,
            quantity: i.qty,
            unit_cost: i.cost
        }));

        const { error: linesError } = await supabase.from('purchase_items').insert(lineItems);
        if (linesError) throw linesError;

        alert("✅ Shipment Received! Inventory Updated.");
        setReceipt([]);
        setVendor('');
        fetchMasterInventory(); // Refresh list

    } catch (err: any) {
        console.error(err);
        alert("Error saving shipment: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 p-8 max-w-5xl mx-auto">
      <div className="mb-8 border-b border-gray-300 pb-4">
        <h1 className="text-4xl font-black mb-2 text-black">Inbound Shipment</h1>
        <p className="text-gray-600">Receive stock from vendors. Create new items or restock existing ones.</p>
      </div>

      {/* VENDOR INPUT */}
      <div className="mb-8">
        <label className="block text-sm font-bold uppercase mb-1 text-black">Vendor Name</label>
        <input 
            placeholder="e.g. Gildan, AlphaBroder, Amazon..." 
            className="w-full p-4 border-2 border-gray-400 rounded-lg text-xl font-bold text-black placeholder-gray-400 focus:border-blue-600 outline-none"
            value={vendor}
            onChange={e => setVendor(e.target.value)} 
        />
      </div>
      
      {/* ADD ITEM CARD */}
      <div className="bg-gray-50 border-2 border-gray-300 rounded-xl p-6 mb-8 shadow-sm">
        <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-xl text-black">Add to Shipment</h3>
            
            {/* TOGGLE SWITCH */}
            <div className="flex bg-white border border-gray-400 rounded-lg overflow-hidden">
                <button 
                    onClick={() => setMode('existing')}
                    className={`px-4 py-2 font-bold text-sm ${mode === 'existing' ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    Existing Item
                </button>
                <button 
                    onClick={() => setMode('new')}
                    className={`px-4 py-2 font-bold text-sm ${mode === 'new' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    + Create New
                </button>
            </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-end">
            
            {/* --- MODE: EXISTING --- */}
            {mode === 'existing' && (
                <div className="flex-1 w-full">
                    <label className="block text-xs font-bold uppercase mb-1 text-black">Select Item</label>
                    <select 
                        className="w-full p-3 border-2 border-gray-400 rounded-lg font-bold text-black bg-white"
                        value={selectedSku}
                        onChange={e => setSelectedSku(e.target.value)}
                    >
                        {existingItems.map(i => <option key={i.sku} value={i.sku}>{i.item_name} ({i.size})</option>)}
                    </select>
                </div>
            )}

            {/* --- MODE: NEW --- */}
            {mode === 'new' && (
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
                    <div className="col-span-2">
                        <label className="block text-xs font-bold uppercase mb-1 text-blue-800">New Item Name</label>
                        <input className="w-full p-3 border-2 border-blue-200 rounded font-bold text-black" placeholder="Item Name" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1 text-blue-800">Size</label>
                        <select className="w-full p-3 border-2 border-blue-200 rounded font-bold text-black" value={newItem.size} onChange={e => setNewItem({...newItem, size: e.target.value})}>
                            {['XS','S','M','L','XL','2XL','3XL','OS'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1 text-blue-800">Color</label>
                        <input className="w-full p-3 border-2 border-blue-200 rounded font-bold text-black" placeholder="Color" value={newItem.color} onChange={e => setNewItem({...newItem, color: e.target.value})} />
                    </div>
                </div>
            )}

            {/* SHARED FIELDS */}
            <div className="w-24">
                <label className="block text-xs font-bold uppercase mb-1 text-black">Qty</label>
                <input type="number" className="w-full p-3 border-2 border-gray-400 rounded-lg font-bold text-black" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} />
            </div>
            <div className="w-32">
                <label className="block text-xs font-bold uppercase mb-1 text-black">Unit Cost ($)</label>
                <input type="number" className="w-full p-3 border-2 border-gray-400 rounded-lg font-bold text-black" placeholder="0.00" value={cost} onChange={e => setCost(e.target.value)} />
            </div>
            
            <button onClick={addToShipment} className="h-[52px] px-6 bg-black text-white font-bold rounded-lg hover:bg-gray-800 shadow-lg">
                ADD
            </button>
        </div>
      </div>

      {/* RECEIPT TABLE */}
      <div className="border-2 border-gray-200 rounded-xl overflow-hidden mb-8">
        <table className="w-full text-left bg-white">
            <thead className="bg-gray-100 border-b border-gray-300 text-black">
                <tr>
                    <th className="p-4 uppercase text-xs font-bold">Item</th>
                    <th className="p-4 uppercase text-xs font-bold">Size</th>
                    <th className="p-4 uppercase text-xs font-bold text-center">Qty</th>
                    <th className="p-4 uppercase text-xs font-bold text-center">Cost</th>
                    <th className="p-4 uppercase text-xs font-bold text-right">Total</th>
                    <th className="p-4"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
                {receipt.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50 text-black">
                        <td className="p-4 font-bold">
                            {r.name} 
                            {r.isNew && <span className="ml-2 bg-blue-100 text-blue-800 text-[10px] px-2 py-1 rounded-full uppercase">New</span>}
                        </td>
                        <td className="p-4">{r.size}</td>
                        <td className="p-4 text-center font-mono">{r.qty}</td>
                        <td className="p-4 text-center font-mono">${r.cost.toFixed(2)}</td>
                        <td className="p-4 text-right font-mono font-bold">${(r.qty * r.cost).toFixed(2)}</td>
                        <td className="p-4 text-right">
                            <button onClick={() => removeLine(i)} className="text-red-600 font-bold hover:underline text-sm">Remove</button>
                        </td>
                    </tr>
                ))}
                {receipt.length === 0 && (
                    <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-400 italic font-bold">No items added to shipment yet.</td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>

      {/* FINAL SUBMIT */}
      <div className="flex justify-end items-center gap-6">
        <div className="text-right">
            <div className="text-gray-500 font-bold uppercase text-xs">Total PO Value</div>
            <div className="text-4xl font-black text-green-700">
                ${receipt.reduce((sum, i) => sum + (i.qty * i.cost), 0).toFixed(2)}
            </div>
        </div>
        <button 
            onClick={submitPurchase}
            disabled={receipt.length === 0}
            className={`px-8 py-4 rounded-xl font-bold text-xl shadow-xl transition-transform active:scale-95 ${receipt.length === 0 ? 'bg-gray-300 text-gray-500' : 'bg-green-600 text-white hover:bg-green-700'}`}
        >
            Complete & Save PO
        </button>
      </div>

    </div>
  );
}