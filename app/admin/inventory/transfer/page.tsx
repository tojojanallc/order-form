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
  const [transferQty, setTransferQty] = useState<{ [key: string]: string }>({});
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => { fetchData(); }, []);

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
        const item = warehouse.find(w => `${w.sku}|${w.size}` === key);
        return { key, qty: parseInt(qty), item };
      });

    if (!selectedEvent) return alert("Select a target truck.");
    if (itemsToMove.length === 0) return alert("Enter quantities to load.");

    setIsProcessing(true);
    try {
      for (const batchItem of itemsToMove) {
        const { item, qty } = batchItem;
        if (!item) continue;

        // --- THE FIX: We pull selling_price from inventory_master ---
        const forcedPrice = parseFloat(item.selling_price) || 0;

        // 1. UPDATE THE GLOBAL CATALOG (products)
        const { error: prodError } = await supabase.from('products').upsert({
            id: item.sku,
            name: item.item_name,
            base_price: forcedPrice, // Maps to base_price in Kiosk
            type: item.type || 'apparel'
        }, { onConflict: 'id' });

        if (prodError) throw new Error(`Global Catalog Error: ${prodError.message}`);

        // 2. LOAD THE TRUCK (inventory)
        const { data: existing } = await supabase
          .from('inventory')
          .select('count')
          .eq('event_slug', selectedEvent)
          .eq('product_id', item.sku)
          .eq('size', item.size)
          .maybeSingle();

        await supabase.from('inventory').upsert({
            event_slug: selectedEvent,
            product_id: item.sku,
            size: item.size,
            count: (existing?.count || 0) + qty,
            active: true,
            cost_price: parseFloat(item.cost_price) || 0,
            override_price: forcedPrice
        }, { onConflict: 'event_slug,product_id,size' });

        // 3. DEDUCT FROM MASTER
        await supabase.from('inventory_master')
          .update({ quantity_on_hand: item.quantity_on_hand - qty })
          .eq('sku', item.sku)
          .eq('size', item.size);
      }

      alert("🚛 Truck Loaded & Prices Forced to Catalog!");
      setTransferQty({});
      fetchData();

    } catch (err: any) {
      alert("FAIL: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredWarehouse = warehouse.filter(i => 
    i.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-slate-900 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10">
            <h1 className="text-4xl font-black uppercase">Truck Transfer</h1>
            <button 
                onClick={processBulkTransfer}
                disabled={isProcessing || !selectedEvent}
                className="bg-emerald-500 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-emerald-400 disabled:opacity-30"
            >
                {isProcessing ? 'Working...' : 'Finalize Load 🚛'}
            </button>
        </div>

        <div className="grid grid-cols-12 gap-6 mb-8">
            <div className="col-span-4 bg-slate-900 p-6 rounded-3xl text-white">
                <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Target Event</p>
                <select 
                    className="w-full bg-slate-800 p-3 rounded-xl border-none font-black text-blue-400"
                    value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value)}
                >
                    <option value="">-- Select --</option>
                    {activeEvents.map(evt => <option key={evt.id} value={evt.slug}>{evt.event_name}</option>)}
                </select>
            </div>
            <div className="col-span-8 bg-white p-6 rounded-3xl border flex items-end">
                <input 
                    type="text" 
                    placeholder="Search Warehouse..." 
                    className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        <div className="bg-white rounded-[40px] border shadow-2xl overflow-hidden">
            <div className="grid grid-cols-12 bg-slate-100 p-5 px-10 text-[10px] font-black uppercase text-gray-400">
                <div className="col-span-6">Item</div>
                <div className="col-span-2 text-center">Stock</div>
                <div className="col-span-4 text-right">Qty</div>
            </div>
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                {filteredWarehouse.map((item) => {
                    const key = `${item.sku}|${item.size}`;
                    return (
                        <div key={key} className="grid grid-cols-12 p-6 px-10 items-center hover:bg-blue-50/50">
                            <div className="col-span-6">
                                <h3 className="text-lg font-black uppercase">{item.item_name}</h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase">{item.sku} • {item.size} • ${item.selling_price || '0.00'}</p>
                            </div>
                            <div className="col-span-2 text-center font-black text-xl">{item.quantity_on_hand}</div>
                            <div className="col-span-4 flex justify-end">
                                <input 
                                    type="number" 
                                    className={`w-24 p-3 rounded-xl text-center font-black ${transferQty[key] ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
                                    value={transferQty[key] || ''}
                                    onChange={(e) => setTransferQty({...transferQty, [key]: e.target.value})}
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
