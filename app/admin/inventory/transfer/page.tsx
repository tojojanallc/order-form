'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function InventoryTransferPage() {
  const [loading, setLoading] = useState(true);
  const [masterInventory, setMasterInventory] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  
  // Selection & UI State
  const [targetSlug, setTargetSlug] = useState('');
  const [moveQuantities, setMoveQuantities] = useState<{[key: string]: string}>({}); 
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch Master Inventory and Active Events
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Get Active Events for the Truck Destination
      const { data: eventData } = await supabase
        .from('event_settings')
        .select('slug, event_name')
        .neq('slug', 'warehouse')
        .eq('status', 'active')
        .order('event_name');
      
      // Get all 1,300+ items from the Master Inventory table
      const { data: masterData } = await supabase
        .from('inventory_master')
        .select('*')
        .order('item_name', { ascending: true });

      setEvents(eventData || []);
      setMasterInventory(masterData || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  // 2. Handle the "Truck Load" logic
  const handleTransfer = async (item: any) => {
    const qtyToMove = parseInt(moveQuantities[item.id] || '0');

    if (!targetSlug) return alert("⚠️ SELECT A DESTINATION EVENT FIRST");
    if (!qtyToMove || qtyToMove <= 0) return alert("⚠️ ENTER A VALID QUANTITY");
    if (qtyToMove > item.quantity_on_hand) return alert("⚠️ NOT ENOUGH STOCK IN MASTER");

    const confirmMsg = `Confirm Load-Out:\n\nMoving ${qtyToMove}x ${item.item_name} (${item.size})\n➡️ Destination: ${targetSlug.toUpperCase()}`;
    if (!confirm(confirmMsg)) return;

    setLoading(true);

    try {
      // Step A: Subtract from inventory_master
      const { error: subError } = await supabase
        .from('inventory_master')
        .update({ quantity_on_hand: item.quantity_on_hand - qtyToMove })
        .eq('id', item.id);

      if (subError) throw subError;

      // Step B: Add to event kiosk (inventory table)
      // We check for an existing row for this SKU/Size/Event combo
      const { data: existing } = await supabase
        .from('inventory')
        .select('count')
        .eq('event_slug', targetSlug)
        .eq('product_id', item.sku)
        .eq('size', item.size)
        .maybeSingle();

      if (existing) {
        // Update existing row
        await supabase
          .from('inventory')
          .update({ count: existing.count + qtyToMove, active: true })
          .eq('event_slug', targetSlug)
          .eq('product_id', item.sku)
          .eq('size', item.size);
      } else {
        // Create new row for this event
        await supabase.from('inventory').insert({
          event_slug: targetSlug,
          product_id: item.sku,
          size: item.size,
          count: qtyToMove,
          active: true
        });
      }

      // Step C: Optimistic UI Update
      setMasterInventory(prev => prev.map(i => 
        i.id === item.id ? { ...i, quantity_on_hand: i.quantity_on_hand - qtyToMove } : i
      ));
      setMoveQuantities(prev => ({ ...prev, [item.id]: '' })); 
      alert("🚚 Units moved to truck!");
      
    } catch (e: any) {
      alert("Transfer Error: " + e.message);
    }
    setLoading(false);
  };

  // Filter logic for search
  const filtered = masterInventory.filter(i => 
    i.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-6">
        <div>
          <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase hover:underline mb-1 inline-block tracking-widest">
            ← Dashboard
          </Link>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Truck Load-Out</h1>
          <p className="text-gray-500 font-medium">Transfer stock from Master Inventory to an active Event Truck.</p>
        </div>

        {/* DESTINATION SELECTOR CARD */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-5 w-full md:w-auto">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 flex-shrink-0 border border-blue-100">
                <span className="text-2xl">🚛</span>
            </div>
            <div className="flex-1">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Active Destination</label>
                <select 
                    className="block w-full md:w-64 p-1 text-lg font-black text-gray-900 border-none focus:ring-0 outline-none bg-transparent cursor-pointer"
                    onChange={e => setTargetSlug(e.target.value)}
                    value={targetSlug}
                >
                    <option value="">Select Event...</option>
                    {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
                </select>
            </div>
        </div>
      </div>

      {/* SEARCH AND CONTROL BAR */}
      <div className="bg-white p-4 rounded-t-2xl border-t border-x border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-xl">🔍</span>
            <input 
                placeholder="Search by SKU or Product Name..." 
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all font-bold text-gray-700 placeholder:text-gray-300"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
        <div className="bg-gray-100 px-4 py-2 rounded-lg text-xs font-black text-gray-400 uppercase tracking-tighter">
            {filtered.length} Items Listed
        </div>
      </div>

      {/* SPREADSHEET TABLE */}
      <div className="bg-white border-x border-b border-gray-200 rounded-b-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Product / SKU</th>
                    <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Size</th>
                    <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Master On Hand</th>
                    <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right pr-8">Load Truck</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {loading ? (
                    <tr>
                        <td colSpan={4} className="p-20 text-center">
                            <div className="inline-block animate-spin text-3xl mb-4">🔄</div>
                            <p className="font-bold text-gray-400 uppercase tracking-widest">Syncing with Warehouse...</p>
                        </td>
                    </tr>
                ) : filtered.map(item => {
                    const lowStock = item.quantity_on_hand < 10;
                    return (
                        <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                            {/* Product Info */}
                            <td className="p-4">
                                <div className="font-black text-gray-900 leading-none mb-1 uppercase tracking-tight">{item.item_name}</div>
                                <div className="text-[10px] font-mono font-bold text-blue-500 tracking-tight uppercase">{item.sku}</div>
                            </td>

                            {/* Size Badge */}
                            <td className="p-4">
                                <span className="inline-block bg-gray-900 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                                    {item.size}
                                </span>
                            </td>

                            {/* High-Contrast Count */}
                            <td className="p-4">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-gray-400 uppercase leading-none mb-1">Available</span>
                                    <span className={`text-xl font-black leading-none ${lowStock ? 'text-red-600' : 'text-slate-900'}`}>
                                        {item.quantity_on_hand}
                                    </span>
                                </div>
                            </td>

                            {/* Load Action */}
                            <td className="p-4">
                                <div className="flex gap-3 justify-end items-center">
                                    <input 
                                        type="number" 
                                        placeholder="0"
                                        className="w-20 p-2 bg-gray-50 border-2 border-gray-100 rounded-xl text-center font-black text-gray-900 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner"
                                        value={moveQuantities[item.id] || ''}
                                        onChange={(e) => setMoveQuantities({...moveQuantities, [item.id]: e.target.value})}
                                    />
                                    <button 
                                        onClick={() => handleTransfer(item)}
                                        className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-sm
                                            ${targetSlug && moveQuantities[item.id]
                                                ? 'bg-gray-900 text-white hover:bg-blue-600 hover:shadow-md' 
                                                : 'bg-gray-100 text-gray-300 cursor-not-allowed'}
                                        `}
                                        disabled={!targetSlug || !moveQuantities[item.id]}
                                    >
                                        Load 🚚
                                    </button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
      </div>

      {/* EMPTY STATE */}
      {!loading && filtered.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200 mt-4">
            <h2 className="text-2xl font-black text-gray-300 uppercase tracking-tighter italic">No Warehouse Items Found</h2>
            <p className="text-gray-400 font-bold">Try adjusting your filter or check your master inventory list.</p>
          </div>
      )}
    </div>
  );
}