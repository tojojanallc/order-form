'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase'; 
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
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedSku, setSelectedSku] = useState('');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');

  // New Item State
  const [newItem, setNewItem] = useState({
    name: '',
    size: 'M',
    color: 'No Color',
    category: 'Apparel'
  });

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
    const dateStr = new Date().toISOString().slice(2, 7).replace('-', ''); // e.g., 2602
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

  const generateSku = (name, size, color) => `${name} | ${size} | ${color}`;

  const addItem = () => {
    const quantity = Number(qty);
    const unitCost = Number(cost);

    if (!quantity || quantity <= 0) return alert("Enter Valid Quantity");
    if (unitCost < 0) return alert("Enter Valid Cost");

    if (mode === 'existing') {
        const item = masterItems.find(i => i.sku === selectedSku);
        if (!item) return;

        setCart([...cart, { 
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
        
        // Check for duplicates
        const duplicate = masterItems.find(i => i.sku === generatedSku);
        if (duplicate) return alert("Item already exists in Master Inventory. Switch to 'Existing Item'.");

        setCart([...cart, {
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
    setQty('');
    // Keep cost/vendor populated for speed
  };

  const removeItem = (index) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const submitPO = async () => {
    if (cart.length === 0) return alert("PO is empty");
    if (!vendorId) return alert("Select a Vendor");

    try {
        // 1. Create NEW Items in Master Inventory (if any)
        const newItems = cart.filter(r => r.isNew);
        for (const item of newItems) {
            // Upsert ensures we don't crash if it was added twice
            const { error } = await supabase.from('inventory_master').upsert({
                sku: item.sku,
                item_name: item.name,
                size: item.size,
                color: item.color,
                category: item.category,
                cost_per_unit: item.cost,
                quantity_on_hand: 0
            }, { onConflict: 'sku' });
            
            if (error) throw new Error(`Failed to create item ${item.name}: ${error.message}`);
        }

        // 2. Create Purchase Header
        const total = cart.reduce((sum, i) => sum + (i.qty * i.cost), 0);
        const { data: po, error } = await supabase.from('purchases').insert({
            po_number: poNumber,
            vendor_id: vendorId,
            total_amount: total,
            status: 'ordered'
        }).select().single();

        if (error) throw error;

        // 3. Create Purchase Line Items
        const lines = cart.map(i => ({
            purchase_id: po.id,
            sku: i.sku,
            quantity: i.qty,
            unit_cost: i.cost
        }));
        await supabase.from('purchase_items').insert(lines);

        alert(`✅ PO ${poNumber} Created!`);
        router.push('/admin'); // Return to dashboard

    } catch (err: any) {
        console.error(err);
        alert("Error creating PO: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 p-8 max-w-5xl mx-auto">
      <div className="mb-8 border-b border-gray-300 pb-4 flex justify-between items-end">
        <div>
            <h1 className="text-4xl font-black mb-2 text-black">Create Purchase Order</h1>
            <p className="text-gray-600 font-bold">Draft an order for {new Date().toLocaleDateString()}</p>
        </div>
        <div className="text-right">
            <div className="text-xs font-black uppercase text-gray-500">PO Number</div>
            <div className="text-3xl font-black text-blue-900">{poNumber}</div>
        </div>
      </div>
      
      {/* VENDOR SELECTION */}
      <div className="mb-8 p-6 bg-gray-100 rounded-xl border-2 border-gray-200">
        <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-black uppercase text-black">Select Vendor</label>
            <button 
                onClick={() => setIsNewVendor(!isNewVendor)} 
                className="text-blue-700 text-sm font-black uppercase hover:underline"
            >
                {isNewVendor ? 'Cancel' : '+ Add New Vendor'}
            </button>
        </div>

        {isNewVendor ? (
          <div className="flex gap-4">
            <input 
              className="flex-1 p-4 border-2 border-blue-500 rounded-lg text-lg font-bold text-black" 
              placeholder="Enter Vendor Name (e.g. SanMar)" 
              value={newVendorName}
              onChange={e => setNewVendorName(e.target.value)}
            />
            <button onClick={handleAddVendor} className="bg-blue-600 text-white px-8 rounded-lg font-bold">SAVE VENDOR</button>
          </div>
        ) : (
          <select 
            className="w-full p-4 border-2 border-gray-400 rounded-lg text-xl font-bold text-black bg-white" 
            value={vendorId} 
            onChange={e => setVendorId(e.target.value)}
          >
            <option value="">-- Choose Vendor --</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        )}
      </div>

      {/* ADD ITEM CARD */}
      <div className="bg-white border-2 border-gray-800 rounded-xl p-6 mb-8 shadow-lg">
         <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-2xl text-black">Add Items</h3>
            
            {/* TOGGLE SWITCH */}
            <div className="flex border-2 border-black rounded-lg overflow-hidden">
                <button 
                    onClick={() => setMode('existing')}
                    className={`px-6 py-2 font-black text-sm uppercase ${mode === 'existing' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'}`}
                >
                    Existing Stock
                </button>
                <button 
                    onClick={() => setMode('new')}
                    className={`px-6 py-2 font-black text-sm uppercase ${mode === 'new' ? 'bg-blue-600 text-white' : 'bg-white text-black hover:bg-gray-100'}`}
                >
                    + New Product
                </button>
            </div>
         </div>

         <div className="flex flex-col md:flex-row gap-4 items-end">
            
            {/* --- MODE: EXISTING --- */}
            {mode === 'existing' && (
                <div className="flex-1 w-full">
                    <label className="block text-xs font-black uppercase mb-1 text-gray-500">Search Item</label>
                    <select 
                        className="w-full p-3 border-2 border-gray-400 rounded-lg font-bold text-black bg-white h-[52px]"
                        value={selectedSku}
                        onChange={e => setSelectedSku(e.target.value)}
                    >
                        {masterItems.map(i => <option key={i.sku} value={i.sku}>{i.item_name} ({i.size})</option>)}
                    </select>
                </div>
            )}

            {/* --- MODE: NEW --- */}
            {mode === 'new' && (
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 w-full">
                    <div>
                        <label className="block text-xs font-black uppercase mb-1 text-blue-800">New Item Name</label>
                        <input className="w-full p-3 border-2 border-blue-200 rounded font-bold text-black h-[52px]" placeholder="e.g. Vintage Hoodie" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase mb-1 text-blue-800">Size</label>
                        <select className="w-full p-3 border-2 border-blue-200 rounded font-bold text-black h-[52px]" value={newItem.size} onChange={e => setNewItem({...newItem, size: e.target.value})}>
                            {['XS','S','M','L','XL','2XL','3XL','OS'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase mb-1 text-blue-800">Color</label>
                        <input className="w-full p-3 border-2 border-blue-200 rounded font-bold text-black h-[52px]" placeholder="e.g. Navy" value={newItem.color} onChange={e => setNewItem({...newItem, color: e.target.value})} />
                    </div>
                </div>
            )}

            <div className="w-24">
               <label className="block text-xs font-black uppercase mb-1 text-gray-500">Qty</label>
               <input type="number" className="w-full p-3 border-2 border-gray-400 rounded-lg font-bold text-black h-[52px]" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} />
            </div>
            <div className="w-32">
               <label className="block text-xs font-black uppercase mb-1 text-gray-500">Unit Cost ($)</label>
               <input type="number" className="w-full p-3 border-2 border-gray-400 rounded-lg font-bold text-black h-[52px]" placeholder="0.00" value={cost} onChange={e => setCost(e.target.value)} />
            </div>
            <button onClick={addItem} className="h-[52px] px-8 bg-black text-white font-black uppercase rounded-lg hover:bg-gray-800 shadow-lg tracking-wide">
               Add
            </button>
         </div>
      </div>

      {/* ORDER SUMMARY */}
      <div className="border-2 border-gray-300 rounded-xl overflow-hidden mb-8">
        <table className="w-full text-left bg-white">
          <thead className="bg-gray-200 border-b-2 border-gray-300 text-black">
            <tr><th className="p-4 uppercase text-xs font-black">Item</th><th className="p-4 uppercase text-xs font-black text-center">Qty</th><th className="p-4 uppercase text-xs font-black text-center">Cost</th><th className="p-4 uppercase text-xs font-black text-right">Line Total</th><th className="p-4"></th></tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {cart.map((line, idx) => (
              <tr key={idx} className="text-black hover:bg-gray-50">
                <td className="p-4 font-bold text-lg">
                    {line.name} <span className="text-gray-500 text-sm">({line.size})</span>
                    {line.isNew && <span className="ml-2 bg-blue-600 text-white text-[10px] px-2 py-1 rounded uppercase font-black">New Product</span>}
                </td>
                <td className="p-4 text-center font-mono font-bold text-lg">{line.qty}</td>
                <td className="p-4 text-center font-mono">${line.cost.toFixed(2)}</td>
                <td className="p-4 text-right font-mono font-black text-lg">${(line.qty * line.cost).toFixed(2)}</td>
                <td className="p-4 text-right">
                    <button onClick={() => removeItem(idx)} className="text-red-600 font-black uppercase text-xs hover:underline">Remove</button>
                </td>
              </tr>
            ))}
            {cart.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400 font-bold italic">Cart is empty. Add items above.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex justify-end items-center gap-8">
         <div className="text-right">
            <div className="text-gray-500 font-black uppercase text-xs">Total PO Value</div>
            <div className="text-5xl font-black text-green-700 tracking-tight">
                ${cart.reduce((sum, i) => sum + (i.qty * i.cost), 0).toFixed(2)}
            </div>
         </div>
         <button 
            onClick={submitPO} 
            disabled={cart.length === 0}
            className={`px-10 py-5 rounded-xl font-black text-xl uppercase shadow-xl transition-all ${cart.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'}`}
        >
            Generate PO
         </button>
      </div>

    </div>
  );
}