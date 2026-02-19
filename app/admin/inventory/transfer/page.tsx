'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function LoadTruck() {
  const [warehouse, setWarehouse] = useState<any[]>([]);
  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedEvent, setSelectedEvent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  // KEY FIX: Using sku-size as the key to prevent data collisions
  const [transferQty, setTransferQty] = useState<{ [key: string]: string }>({});
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: inv } = await supabase.from('inventory_master').select('*').order('item_name');
    const { data: evts } = await supabase.from('event_settings').select('*').eq('status', 'active');
    setWarehouse(inv || []);
    setActiveEvents(evts || []);
    setLoading(false);
  }

  const processBulkTransfer = async () => {
    const itemsToMove = Object.entries(transferQty)
      .filter(([_, qty]) => parseInt(qty) > 0)
      .map(([key, qty]) => {
        const [sku, size] = key.split('|');
        return {
          sku,
          size,
          qty: parseInt(qty),
          item: warehouse.find(i => i.sku === sku && i.size === size)
        };
      });

    if (!selectedEvent) return alert("Select a destination truck first.");
    if (itemsToMove.length === 0) return alert("Enter a quantity to load.");

    setIsProcessing(true);
    try {
      for (const batchItem of itemsToMove) {
        const { sku, size, qty, item } = batchItem;

        // 1. THE MISSION: Populate 'products' table 'base_price'
        // We use the item's SKU as the ID. If it doesn't work, we'll see the error.
        const { error: prodError } = await supabase.from('products').upsert({
            id: sku,                    
            name: item.item_name,
            base_price: item.base_price || 0, // This is what you were missing
            type: item.type || 'apparel'     // Required field
        }, { onConflict: 'id' });

        if (prodError) throw new Error(`Global Price Sync Failed for ${sku}: ${prodError.message}`);

        // 2. Load the specific Truck record
        const { data: existing } = await supabase
          .from('inventory')
          .select('count')
          .eq('event_slug', selectedEvent)
          .eq('product_id', sku)
          .eq('size', size)
          .maybeSingle();

        await supabase.from('inventory').upsert({
            event_slug: selectedEvent,
            product_id: sku,
            size: size,
            count: (existing?.count || 0) + qty,
            active: true,
            cost_price: item.cost_price || 0,
            override_price: item.base_price || 0 // Sync the local truck price too
        }, { onConflict: 'event_slug,product_id,size' });

        // 3. Deduct from Warehouse
        await supabase.from('inventory_master')
          .update({ quantity_on_hand: item.quantity_on_hand - qty })
          .eq('sku', sku)
          .eq('size', size);
      }

      alert(`✅ Loaded ${itemsToMove.length} items. Global prices are now synced!`);
      setTransferQty({});
      fetchData();

    } catch (err: any) {
      alert("System Error: " + err.message);
      console.error("Critical Sync Failure:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredWarehouse = warehouse.filter(i => 
    i.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1400px] mx-auto">
        
        <div className="flex justify-between items-center mb-10">
            <div>
                <Link href="/admin" className="text-[10px] font-black uppercase text-blue-600 tracking-widest">← Dashboard</Link>
                <h1 className="text-4xl font-black tracking-tight mt-1">Truck Transfer</h1>
            </div>
            
            <button 
                onClick={processBulkTransfer}
                disabled={isProcessing || !selectedEvent}
                className="bg-emerald-500 text-white px-10 py-5 rounded-[24px] font-black uppercase text-xs tracking-widest shadow-xl hover:bg-emerald-400 disabled:opacity-30 transition-all"
            >
                {isProcessing ? 'Syncing Tables...' : 'Finalize Bulk Load 🚛'}
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
            <div className="lg:col-span-4 bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl">
                <p className="text-[10px] font-black uppercase text-slate-500 mb-3 tracking-widest">Destination Meet</p>
                <select 
                    className="w-full bg-slate-800 p-4 rounded-2xl border-none outline-none font-black text-blue-400 text-lg"
                    value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value)}
                >
                    <option value="">-- Select Event --</option>
                    {activeEvents.map(evt => <option key={evt.id} value={evt.slug}>{evt.event_name}</option>)}
                </select>
            </div>
            <div className="lg:col-span-8 bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm flex items-end">
                <input 
                    type="text" 
                    placeholder="Search Enza, Decal, Hoodie..." 
                    className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold text-lg"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        <div className="bg-white rounded-[48px] border border-gray-100 shadow-2xl overflow-hidden mb-20">
            <div className="grid grid-cols-12 bg-slate-100 p-6 px-10 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                <div className="col-span-6">Warehouse Item & SKU</div>
                <div className="col-span-2 text-center">Available</div>
                <div className="col-span-4 text-right">Qty to Move</div>
            </div>

            <div className="divide-y divide-gray-50 max-h-[700px] overflow-y-auto">
                {filteredWarehouse.map((item) => {
                    const itemKey = `${item.sku}|${item.size}`;
                    return (
                        <div key={itemKey} className="grid grid-cols-12 p-6 px-10 items-center hover:bg-blue-50/50 transition-colors">
                            <div className="col-span-6">
                                <h3 className="text-xl font-black text-slate-800 uppercase leading-none">{item.item_name}</h3>
                                <div className="flex gap-2 mt-2">
                                    <span className="text-[9px] font-black bg-blue-50 text-blue-500 px-2 py-0.5 rounded border border-blue-100 uppercase">{item.sku}</span>
                                    <span className="text-[9px] font-black text-gray-400 uppercase self-center">Size {item.size} • Retail: ${item.base_price || '0.00'}</span>
                                </div>
                            </div>
                            <div className="col-span-2 text-center text-2xl font-black text-slate-900">{item.quantity_on_hand}</div>
                            <div className="col-span-4 flex justify-end">
                                <input 
                                    type="number" 
                                    className={`w-32 p-4 rounded-2xl border-none outline-none font-black text-center text-xl transition-all ${transferQty[itemKey] ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-slate-400'}`}
                                    value={transferQty[itemKey] || ''}
                                    onChange={(e) => setTransferQty({...transferQty, [itemKey]: e.target.value})}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
}
