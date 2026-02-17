'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../supabase'; // Adjusted path to your client
import Link from 'next/link';

export default function InventoryTransferPage() {
  const [loading, setLoading] = useState(true);
  const [masterInventory, setMasterInventory] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  
  // Selection & UI State
  const [targetSlug, setTargetSlug] = useState('');
  const [moveQuantities, setMoveQuantities] = useState<{[key: string]: string}>({}); 
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      // 1. Get Active Events
      const { data: eventData } = await supabase
        .from('event_settings')
        .select('slug, event_name')
        .neq('slug', 'warehouse')
        .eq('status', 'active');
      
      // 2. Get ALL Master Inventory (The 1300+ items)
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

  const handleTransfer = async (item: any) => {
    const qtyToMove = parseInt(moveQuantities[item.id] || '0');

    if (!targetSlug) return alert("Select a Destination Event first.");
    if (!qtyToMove || qtyToMove <= 0) return alert("Enter a valid quantity.");
    if (qtyToMove > item.quantity_on_hand) return alert("Not enough stock in Master.");

    if (!confirm(`Move ${qtyToMove} units of ${item.item_name} (${item.size}) to ${targetSlug.toUpperCase()}?`)) return;

    setLoading(true);

    try {
      // A. Subtract from Master
      const { error: subError } = await supabase
        .from('inventory_master')
        .update({ quantity_on_hand: item.quantity_on_hand - qtyToMove })
        .eq('id', item.id);

      if (subError) throw subError;

      // B. Upsert to Event Inventory (using SKU/Size/Slug as unique identifiers)
      const { data: existing } = await supabase
        .from('inventory')
        .select('count')
        .eq('event_slug', targetSlug)
        .eq('product_id', item.sku)
        .eq('size', item.size)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('inventory')
          .update({ count: existing.count + qtyToMove, active: true })
          .eq('event_slug', targetSlug)
          .eq('product_id', item.sku)
          .eq('size', item.size);
      } else {
        await supabase.from('inventory').insert({
          event_slug: targetSlug,
          product_id: item.sku,
          size: item.size,
          count: qtyToMove,
          active: true
        });
      }

      // C. Local Update
      setMasterInventory(prev => prev.map(i => 
        i.id === item.id ? { ...i, quantity_on_hand: i.quantity_on_hand - qtyToMove } : i
      ));
      setMoveQuantities(prev => ({ ...prev, [item.id]: '' })); 
      alert("Truck Loaded Successfully!");
      
    } catch (e: any) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  };

  const filtered = masterInventory.filter(i => 
    i.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase hover:underline">← Command Center</Link>
          <h1 className="text-3xl font-black text-gray-900 mt-1">Truck Load-Out</h1>
          <p className="text-gray-500 text-sm">Transferring from Master Inventory to Event Kiosks</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="text-right">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Truck</span>
                <select 
                    className="font-bold text-gray-900 border-none p-0 focus:ring-0 cursor-pointer text-lg"
                    value={targetSlug}
                    onChange={(e) => setTargetSlug(e.target.value)}
                >
                    <option value="">Select Event...</option>
                    {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
                </select>
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-xl">🚛</div>
        </div>
      </div>

      {/* Spreadsheet Control Bar */}
      <div className="bg-white p-4 rounded-t-2xl border border-gray-200 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input 
                placeholder="Filter by Product Name or SKU..." 
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
        <div className="text-sm font-bold text-gray-400 px-4">
            {filtered.length} Items Found
        </div>
      </div>

      {/* The "Spreadsheet" Table */}
      <div className="bg-white border-x border-b border-gray-200 rounded-b-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Product / SKU</th>
                    <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Size</th>
                    <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">On Hand</th>
                    <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider w-40 text-center">Load Truck</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
                {loading ? (
                    <tr><td colSpan={4} className="p-20 text-center font-bold text-gray-300 animate-pulse">Synchronizing Master Inventory...</td></tr>
                ) : filtered.map(item => (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="p-4">
                            <div className="font-bold text-gray-900">{item.item_name}</div>
                            <div className="text-xs text-gray-400 font-mono">{item.sku}</div>
                        </td>
                        <td className="p-4">
                            <span className="bg-white border border-gray-200 px-2 py-1 rounded text-xs font-black text-gray-600 uppercase">
                                {item.size}
                            </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-lg">
                            {item.quantity_on_hand}
                        </td>
                        <td className="p-4">
                            <div className="flex gap-2 justify-center">
                                <input 
                                    type="number" 
                                    placeholder="0"
                                    className="w-16 p-2 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    value={moveQuantities[item.id] || ''}
                                    onChange={(e) => setMoveQuantities({...moveQuantities, [item.id]: e.target.value})}
                                />
                                <button 
                                    onClick={() => handleTransfer(item)}
                                    className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-600 transition-colors disabled:opacity-20"
                                    disabled={!targetSlug || !moveQuantities[item.id]}
                                >
                                    Load
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}