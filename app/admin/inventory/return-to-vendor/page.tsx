'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ReturnToVendor() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  
  // Form State
  const [vendorId, setVendorId] = useState('');
  const [refNum, setRefNum] = useState('');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<any[]>([]);

  // Item Input State
  const [search, setSearch] = useState('');
  const [selectedSku, setSelectedSku] = useState('');
  const [qty, setQty] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: v } = await supabase.from('vendors').select('*').order('name');
    const { data: i } = await supabase.from('inventory_master').select('*').order('item_name');
    setVendors(v || []);
    setInventory(i || []);
  }

  const addToReturn = () => {
    const item = inventory.find(i => i.sku === selectedSku);
    const amount = Number(qty);

    if (!item) return alert("Select an item first.");
    if (!amount || amount <= 0) return alert("Enter a valid quantity.");
    if (amount > (item.quantity_on_hand || 0)) return alert(`Not enough stock. Only ${item.quantity_on_hand} available.`);

    const existing = cart.find(c => c.sku === selectedSku);
    if (existing) {
      setCart(cart.map(c => c.sku === selectedSku ? { ...c, qty: c.qty + amount } : c));
    } else {
      setCart([...cart, { 
        sku: item.sku, 
        name: item.item_name, 
        size: item.size, 
        color: item.color || 'No Color', // Ensures color visibility
        cost: item.cost_price || 0, 
        qty: amount 
      }]);
    }
    setQty('');
  };

  const removeFromReturn = (sku: string) => {
    setCart(cart.filter(c => c.sku !== sku));
  };

  const calculateTotalCredit = () => {
    return cart.reduce((sum, i) => sum + (i.qty * i.cost), 0);
  };

  const processReturn = async () => {
    if (!vendorId) return alert("Please select a vendor.");
    if (cart.length === 0) return alert("Return list is empty.");
    if (!confirm("This will permanently remove these items from inventory. Proceed?")) return;

    setLoading(true);

    try {
      const totalValue = calculateTotalCredit();

      // 1. Create Return Header
      const { data: ret, error: retErr } = await supabase
        .from('vendor_returns')
        .insert({
          vendor_id: vendorId,
          reference_num: refNum,
          notes: notes,
          total_value: totalValue
        })
        .select()
        .single();

      if (retErr) throw retErr;

      // 2. Process Items & Update Inventory
      for (const item of cart) {
        await supabase.from('vendor_return_items').insert({
          return_id: ret.id,
          sku: item.sku,
          quantity: item.qty,
          unit_cost: item.cost
        });

        // Deduct from Inventory Master
        const currentItem = inventory.find(i => i.sku === item.sku);
        await supabase
          .from('inventory_master')
          .update({ quantity_on_hand: (currentItem.quantity_on_hand || 0) - item.qty })
          .eq('sku', item.sku);
      }

      alert("✅ Return Processed & Inventory Adjusted!");
      router.push('/admin');
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredInventory = inventory.filter(i => 
    i.item_name?.toLowerCase().includes(search.toLowerCase()) || 
    i.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto">
        <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block">← Dashboard</Link>
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight">Return to Vendor</h1>
            <p className="text-gray-500 font-medium font-black uppercase text-[10px] tracking-widest">Inventory Management • Lev Custom Merch</p>
          </div>
          
          <div className="flex gap-4 w-full md:w-auto">
            <Link 
                href="/admin/inventory/return-to-vendor/history"
                className="bg-white border border-gray-200 px-6 py-4 rounded-3xl shadow-sm hover:border-blue-200 transition-all text-right group"
            >
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Audit Trail</p>
                <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600">Past Returns →</p>
            </Link>

            <div className="bg-white px-8 py-4 rounded-3xl shadow-sm border border-gray-100 text-right min-w-[200px]">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Projected Credit</p>
                <p className="text-3xl font-black text-red-500">-${calculateTotalCredit().toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
            {/* LEFT: INPUTS */}
            <div className="col-span-8 space-y-6">
                
                {/* 1. TRANSACTION INFO */}
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                    <h2 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-4">Transaction Details</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Vendor Target</label>
                            <select 
                                className="w-full p-3 bg-gray-50 rounded-xl font-bold border-none focus:ring-2 focus:ring-blue-500 appearance-none outline-none"
                                value={vendorId}
                                onChange={e => setVendorId(e.target.value)}
                            >
                                <option value="">Select Vendor...</option>
                                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Reference / RMA #</label>
                            <input 
                                className="w-full p-3 bg-gray-50 rounded-xl font-bold border-none focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="e.g. Nicolet-Return-01"
                                value={refNum}
                                onChange={e => setRefNum(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* 2. PRODUCT SELECTION */}
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm min-h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xs font-black uppercase text-gray-400 tracking-widest">Select Product to Return</h2>
                        <input 
                            placeholder="Filter Name/SKU..." 
                            className="bg-gray-50 p-2 px-4 rounded-lg text-xs font-bold outline-none border border-transparent focus:bg-blue-50"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-12 gap-4 items-end mb-6 bg-slate-50 p-5 rounded-[24px] border border-slate-100">
                        <div className="col-span-8">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Inventory Item</label>
                            <select 
                                className="w-full p-3 bg-white rounded-xl font-bold border border-slate-200 focus:ring-2 focus:ring-blue-500 h-[48px] outline-none"
                                value={selectedSku}
                                onChange={e => setSelectedSku(e.target.value)}
                            >
                                <option value="">-- Choose Item --</option>
                                {filteredInventory.map(i => (
                                    <option key={i.sku} value={i.sku}>
                                        {i.item_name} | {i.color || 'No Color'} | {i.size} (Stock: {i.quantity_on_hand})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Qty</label>
                            <input type="number" className="w-full p-3 bg-white rounded-xl font-bold border border-slate-200 h-[48px] outline-none" value={qty} onChange={e => setQty(e.target.value)} />
                        </div>
                        <div className="col-span-2">
                            <button onClick={addToReturn} className="w-full h-[48px] bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-red-500 transition-colors shadow-lg shadow-red-900/10">Add</button>
                        </div>
                    </div>

                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Reason for Return</label>
                    <textarea 
                        className="w-full p-4 bg-gray-50 rounded-2xl font-medium border-none focus:ring-2 focus:ring-blue-500 text-sm outline-none" 
                        placeholder="e.g. Overstock from meet, fabric defect, etc."
                        rows={3}
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                    />
                </div>
            </div>

            {/* RIGHT: RETURN SUMMARY */}
            <div className="col-span-4">
                <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-2xl sticky top-6">
                    <h2 className="text-xs font-black uppercase text-gray-500 tracking-widest mb-6 px-2">Return List</h2>
                    
                    {cart.length === 0 ? (
                        <div className="text-center py-24 px-6">
                            <p className="text-slate-700 font-bold italic text-sm">No items in the list. Select stock from the warehouse on the left.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 mb-8 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                            {cart.map((line, idx) => (
                                <div key={idx} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 relative group">
                                    <button 
                                      onClick={() => removeFromReturn(line.sku)} 
                                      className="absolute top-2 right-3 text-slate-600 hover:text-red-400 font-bold transition-colors"
                                    >
                                      ×
                                    </button>
                                    <div className="font-bold text-[11px] uppercase truncate pr-6">{line.name}</div>
                                    <div className="flex justify-between items-end mt-3">
                                        <div className="text-[9px] text-gray-500 font-black uppercase tracking-tight">
                                            {line.color} • {line.size} <br/>
                                            <span className="text-slate-400">{line.qty} Unit{line.qty > 1 ? 's' : ''}</span>
                                        </div>
                                        <div className="text-xs font-black text-red-400">-${(line.qty * line.cost).toFixed(2)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="border-t border-slate-800 pt-6 mt-4">
                        <button 
                            onClick={processReturn}
                            disabled={loading || cart.length === 0}
                            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${loading || cart.length === 0 ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-500/30'}`}
                        >
                            {loading ? 'Processing...' : 'Process Return →'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}