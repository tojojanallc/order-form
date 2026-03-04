'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; // Updated to match your pathing
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreatePO() {
  const router = useRouter();
  
  // Data State
  const [vendors, setVendors] = useState<any[]>([]);
  const [masterItems, setMasterItems] = useState<any[]>([]);
  
  // Form State
  const [vendorId, setVendorId] = useState('');
  const [isNewVendor, setIsNewVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [poNumber, setPoNumber] = useState('Generating...');
  const [cart, setCart] = useState<any[]>([]);

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
    const dateStr = new Date().toISOString().slice(2, 7).replace('-', ''); 
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

  const generateSku = (name: string, size: string, color: string) => `${name} | ${size} | ${color}`;

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
        if (!newItem.name) return alert("Item Name is required.");
        const generatedSku = generateSku(newItem.name, newItem.size, newItem.color);
        const duplicate = masterItems.find(i => i.sku === generatedSku);
        if (duplicate) return alert("Item already exists. Switch to 'Existing Item'.");

        setCart([...cart, {
            sku: generatedSku,
            name: newItem.name,
            size: newItem.size,
            color: newItem.color,
            category: newItem.category,
            qty: quantity,
            cost: unitCost,
            isNew: true 
        }]);
    }
    setQty('');
  };

  const removeItem = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const submitPO = async () => {
    if (cart.length === 0) return alert("PO is empty");
    if (!vendorId) return alert("Select a Vendor");

    try {
        const newItems = cart.filter(r => r.isNew);
        for (const item of newItems) {
            await supabase.from('inventory_master').upsert({
                sku: item.sku,
                item_name: item.name,
                size: item.size,
                color: item.color,
                category: item.category,
                cost_price: item.cost, // Uses cost_price for your Asset Value logic
                quantity_on_hand: 0
            }, { onConflict: 'sku' });
        }

        const total = cart.reduce((sum, i) => sum + (i.qty * i.cost), 0);
        const { data: po, error } = await supabase.from('purchases').insert({
            po_number: poNumber,
            vendor_id: vendorId,
            total_amount: total,
            status: 'ordered'
        }).select().single();

        if (error) throw error;

        const lines = cart.map(i => ({
            purchase_id: po.id,
            sku: i.sku,
            quantity: i.qty,
            unit_cost: i.cost
        }));
        await supabase.from('purchase_items').insert(lines);

        alert(`✅ PO ${poNumber} Created!`);
        router.push('/admin');

    } catch (err: any) {
        alert("Error creating PO: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block">← Dashboard</Link>
        <div className="flex justify-between items-end mb-10">
          <div>
            <h1 className="text-4xl font-black tracking-tight">Create Purchase Order</h1>
            <p className="text-gray-500 font-medium">Lev Custom Merch • {new Date().toLocaleDateString()}</p>
          </div>
          <div className="bg-white px-6 py-4 rounded-3xl shadow-sm border border-gray-100 text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">PO Number</p>
              <p className="text-3xl font-black text-blue-900">{poNumber}</p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
            
            {/* LEFT: FORM FIELDS */}
            <div className="col-span-8 space-y-6">
                
                {/* 1. VENDOR SELECTION */}
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xs font-black uppercase text-gray-400 tracking-widest">Vendor Selection</h2>
                        <button onClick={() => setIsNewVendor(!isNewVendor)} className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-800">
                            {isNewVendor ? 'Cancel' : '+ New Vendor'}
                        </button>
                    </div>

                    {isNewVendor ? (
                        <div className="flex gap-2">
                            <input 
                                className="flex-1 p-3 bg-gray-50 rounded-xl font-bold border-none focus:ring-2 focus:ring-blue-500" 
                                placeholder="Vendor Name (e.g. SanMar)" 
                                value={newVendorName}
                                onChange={e => setNewVendorName(e.target.value)}
                            />
                            <button onClick={handleAddVendor} className="bg-slate-900 text-white px-6 rounded-xl font-black text-[10px] uppercase">Save</button>
                        </div>
                    ) : (
                        <select 
                            className="w-full p-3 bg-gray-50 rounded-xl font-bold border-none focus:ring-2 focus:ring-blue-500 appearance-none" 
                            value={vendorId} 
                            onChange={e => setVendorId(e.target.value)}
                        >
                            <option value="">-- Choose Vendor --</option>
                            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                    )}
                </div>

                {/* 2. ITEM INPUT */}
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm min-h-[300px]">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xs font-black uppercase text-gray-400 tracking-widest">Line Items</h2>
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                            <button onClick={() => setMode('existing')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${mode === 'existing' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-400'}`}>Existing</button>
                            <button onClick={() => setMode('new')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${mode === 'new' ? 'bg-blue-600 shadow-sm text-white' : 'text-gray-400'}`}>+ New</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-4 items-end">
                        <div className="col-span-12 lg:col-span-6">
                            {mode === 'existing' ? (
                                <>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Search Master Inventory</label>
                                    <select 
                                        className="w-full p-3 bg-gray-50 rounded-xl font-bold border-none focus:ring-2 focus:ring-blue-500 h-[48px]"
                                        value={selectedSku}
                                        onChange={e => setSelectedSku(e.target.value)}
                                    >
                                        {masterItems.map(i => <option key={i.sku} value={i.sku}>{i.item_name} ({i.size})</option>)}
                                    </select>
                                </>
                            ) : (
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-3">
                                        <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Product Name</label>
                                        <input className="w-full p-3 bg-blue-50/50 rounded-xl font-bold border-none focus:ring-2 focus:ring-blue-500 h-[48px]" placeholder="e.g. Gildan 5000" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Size</label>
                                        <select className="w-full p-3 bg-blue-50/50 rounded-xl font-bold border-none h-[48px]" value={newItem.size} onChange={e => setNewItem({...newItem, size: e.target.value})}>
                                            {['XS','S','M','L','XL','2XL','3XL','OS'].map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Color</label>
                                        <input className="w-full p-3 bg-blue-50/50 rounded-xl font-bold border-none h-[48px]" placeholder="Navy" value={newItem.color} onChange={e => setNewItem({...newItem, color: e.target.value})} />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="col-span-4 lg:col-span-2">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Qty</label>
                            <input type="number" className="w-full p-3 bg-gray-50 rounded-xl font-bold border-none h-[48px]" value={qty} onChange={e => setQty(e.target.value)} />
                        </div>
                        <div className="col-span-4 lg:col-span-2">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cost ($)</label>
                            <input type="number" className="w-full p-3 bg-gray-50 rounded-xl font-bold border-none h-[48px]" value={cost} onChange={e => setCost(e.target.value)} />
                        </div>
                        <div className="col-span-4 lg:col-span-2">
                            <button onClick={addItem} className="w-full h-[48px] bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-blue-600 transition-colors shadow-lg shadow-blue-900/10">Add</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT: ORDER SUMMARY */}
            <div className="col-span-4">
                <div className="bg-slate-900 text-white p-6 rounded-[30px] shadow-2xl sticky top-6">
                    <h2 className="text-xs font-black uppercase text-gray-500 tracking-widest mb-6">Order Summary</h2>
                    
                    {cart.length === 0 ? (
                        <div className="text-center py-20 text-gray-700 italic text-sm">No items in PO.</div>
                    ) : (
                        <div className="space-y-3 mb-8 max-h-[400px] overflow-y-auto pr-2">
                            {cart.map((line, idx) => (
                                <div key={idx} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 relative group">
                                    <button onClick={() => removeItem(idx)} className="absolute top-2 right-3 text-slate-600 hover:text-red-400 transition-colors">×</button>
                                    <div className="font-bold text-[11px] uppercase truncate pr-4">{line.name}</div>
                                    <div className="flex justify-between items-center mt-2">
                                        <div className="text-[9px] text-gray-500 font-bold uppercase">{line.size}{line.color ? ` • ${line.color}` : ''} • {line.qty} Units</div>
                                        <div className="text-xs font-black text-green-400">${(line.qty * line.cost).toFixed(2)}</div>
                                    </div>
                                    {line.isNew && (
                                        <div className="mt-2 text-[7px] font-black text-blue-400 uppercase tracking-widest">✨ New Inventory SKU</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="border-t border-slate-800 pt-6 mt-4">
                        <div className="flex justify-between items-center mb-6 px-2">
                            <span className="text-[10px] font-black uppercase text-gray-500">PO Total</span>
                            <span className="text-2xl font-black text-green-500">
                                ${cart.reduce((sum, i) => sum + (i.qty * i.cost), 0).toFixed(2)}
                            </span>
                        </div>
                        <button 
                            onClick={submitPO} 
                            disabled={cart.length === 0}
                            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${cart.length === 0 ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20'}`}
                        >
                            Generate PO
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
