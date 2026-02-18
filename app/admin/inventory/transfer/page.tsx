'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

// --- TYPES TO CLEAR VISUAL STUDIO ERRORS ---
interface WarehouseItem {
  id: string;
  item_name: string;
  sku: string;
  size: string;
  color: string;
  category: string;
  quantity_on_hand: number;
  selling_price: number;
  cost_price: number;
}

interface TruckItem {
  id: string;
  sku: string;
  item_name: string;
  size: string;
  count: number;
  price: number;
}

interface EventOption {
  slug: string;
  name: string;
}

export default function InventoryTransferPage() {
  // State management with explicit Types
  const [warehouse, setWarehouse] = useState<WarehouseItem[]>([]);
  const [truckInventory, setTruckInventory] = useState<TruckItem[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [transferQuantities, setTransferQuantities] = useState<Record<string, number>>({});
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => { 
    fetchInitialData(); 
  }, []);

  // Refresh truck manifest whenever the target event changes
  useEffect(() => {
    if (selectedEvent) fetchTruckData();
    else setTruckInventory([]);
  }, [selectedEvent]);

  async function fetchInitialData() {
    setLoading(true);
    const { data: wh } = await supabase.from('inventory_master').select('*').order('item_name');
    const { data: ev } = await supabase.from('events').select('slug, name');
    if (wh) setWarehouse(wh);
    if (ev) setEvents(ev);
    setLoading(false);
  }

  async function fetchTruckData() {
    const { data } = await supabase.from('inventory').select('*').eq('event_slug', selectedEvent);
    if (data) setTruckInventory(data);
  }

  const handleQtyChange = (id: string, val: string) => {
    const num = parseInt(val) || 0;
    setTransferQuantities(prev => ({ ...prev, [id]: num }));
    
    if (num > 0 && !selectedIds.includes(id)) {
      setSelectedIds(prev => [...prev, id]);
    } else if (num <= 0) {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleBulkTransfer = async () => {
    if (!selectedEvent) return alert("Please select a target event first!");
    setLoading(true);

    // Loop through all items that have a quantity entered
    for (const id of selectedIds) {
      const item = warehouse.find(i => i.id === id);
      const qtyToMove = transferQuantities[id] || 0;

      if (!item || qtyToMove <= 0) continue;
      
      // Safety check: Don't allow moving more than what's in the warehouse
      if (item.quantity_on_hand < qtyToMove) {
        alert(`Insufficient stock for ${item.sku}. Only ${item.quantity_on_hand} available.`);
        continue;
      }

      // 1. Update the Truck (Event Inventory Table)
      const existing = truckInventory.find(i => i.sku === item.sku);
      if (existing) {
        await supabase.from('inventory').update({ count: existing.count + qtyToMove }).eq('id', existing.id);
      } else {
        await supabase.from('inventory').insert({
          event_slug: selectedEvent,
          item_name: item.item_name,
          sku: item.sku,
          size: item.size,
          color: item.color,
          price: item.selling_price,
          count: qtyToMove
        });
      }

      // 2. Subtract from the Warehouse Master catalog
      await supabase.from('inventory_master')
        .update({ quantity_on_hand: item.quantity_on_hand - qtyToMove })
        .eq('id', item.id);
    }

    // Reset local state and refresh data from Supabase
    setTransferQuantities({});
    setSelectedIds([]);
    await fetchInitialData();
    await fetchTruckData();
    alert("Bulk transfer successful!");
  };

  const filteredWH = warehouse.filter(i => 
    i.item_name?.toLowerCase().includes(search.toLowerCase()) || 
    i.sku?.toLowerCase().includes(search.toLowerCase()) ||
    i.color?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex justify-between items-end mb-10">
          <div>
            <Link href="/admin/inventory" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block hover:underline">← Back to Warehouse Master</Link>
            <h1 className="text-4xl font-black tracking-tighter uppercase">Inventory Transfer</h1>
            <p className="text-gray-500 font-medium">Move Lev Custom Merch stock to active trucks.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <select 
                className="p-4 bg-white border-2 border-slate-900 rounded-2xl font-black outline-none shadow-sm cursor-pointer hover:border-blue-600 transition-colors"
                value={selectedEvent}
                onChange={e => setSelectedEvent(e.target.value)}
            >
                <option value="">-- CHOOSE TARGET EVENT --</option>
                {events.map(e => <option key={e.slug} value={e.slug}>{e.name}</option>)}
            </select>

            {selectedIds.length > 0 && (
                <button 
                    onClick={handleBulkTransfer}
                    className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-green-600 transition-all shadow-lg active:scale-95 animate-in fade-in zoom-in"
                >
                    Execute Transfer ({selectedIds.length})
                </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
          {/* SOURCE: Warehouse Catalog (Left) */}
          <div className="col-span-8 bg-white rounded-[40px] border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[700px]">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Warehouse Source (Tojojana LLC)</span>
                <input 
                    placeholder="Search by name, SKU, or color..." 
                    className="bg-white border border-gray-200 p-3 px-5 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 w-96 shadow-inner"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
             </div>
             
             <div className="overflow-y-auto flex-1 max-h-[700px]">
                <table className="w-full text-left">
                    <thead className="sticky top-0 bg-white shadow-sm text-[10px] font-black uppercase text-gray-400 z-10">
                        <tr>
                            <th className="p-6">Product Details</th>
                            <th className="p-6">WHSE Stock</th>
                            <th className="p-6 text-right w-48">Qty to Transfer</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredWH.map(item => (
                            <tr key={item.id} className={`group hover:bg-blue-50/30 transition-all ${selectedIds.includes(item.id) ? 'bg-blue-50/50' : ''}`}>
                                <td className="p-6">
                                    <div className="font-bold text-sm uppercase leading-tight text-slate-800">{item.item_name}</div>
                                    <div className="flex gap-2 mt-1">
                                      <span className="text-[10px] font-mono text-blue-500 font-bold">{item.sku}</span>
                                      <span className="text-[10px] font-black text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded uppercase">{item.size}</span>
                                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{item.color}</span>
                                    </div>
                                </td>
                                <td className="p-6">
                                    <span className={`text-xl font-black ${item.quantity_on_hand < 10 ? 'text-red-500' : 'text-slate-900'}`}>{item.quantity_on_hand}</span>
                                </td>
                                <td className="p-6 text-right">
                                    <input 
                                        type="number" 
                                        placeholder="0"
                                        min="0"
                                        max={item.quantity_on_hand}
                                        value={transferQuantities[item.id] || ''}
                                        onChange={(e) => handleQtyChange(item.id, e.target.value)}
                                        className="w-24 p-3 rounded-2xl border-2 border-gray-100 text-center font-black focus:border-blue-600 outline-none transition-all"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
          </div>

          {/* DESTINATION: Live Truck Manifest (Right) */}
          <div className="col-span-4 bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl h-fit sticky top-8 border border-slate-800">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Truck Manifest</h3>
                {selectedEvent && (
                  <span className="text-[9px] bg-blue-600 px-3 py-1 rounded-full font-black uppercase tracking-widest animate-pulse">On-Truck</span>
                )}
            </div>

            {!selectedEvent ? (
                <div className="py-24 text-center text-slate-700 italic border-2 border-dashed border-slate-800 rounded-[32px]">
                    Select a target event above to view current manifest.
                </div>
            ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {truckInventory.length === 0 ? (
                        <div className="text-center py-20 text-slate-600 font-bold uppercase text-xs tracking-widest">No items currently on truck.</div>
                    ) : (
                        truckInventory.map(item => (
                            <div key={item.id} className="flex justify-between items-center bg-slate-800/40 p-5 rounded-[24px] border border-slate-800/60 hover:bg-slate-800/80 transition-colors">
                                <div>
                                    <div className="font-black uppercase text-[11px] leading-tight text-white">{item.item_name}</div>
                                    <div className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">{item.sku} • {item.size}</div>
                                </div>
                                <div className="text-3xl font-black text-blue-400">{item.count}</div>
                            </div>
                        ))}
                        
                        <div className="pt-6 border-t border-slate-800 mt-4">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Total Kiosk Value</span>
                                <span className="text-2xl font-black text-green-500">
                                  ${truckInventory.reduce((acc, curr) => acc + (curr.price * curr.count), 0).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}