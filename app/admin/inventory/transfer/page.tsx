'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function LoadTruck() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [warehouse, setWarehouse] = useState<any[]>([]);
  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedEvent, setSelectedEvent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [transferQty, setTransferQty] = useState<{ [key: string]: string }>({});
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    checkUser();
    fetchData();
  }, []);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserEmail(user.email);
  }

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
      .map(([sku, qty]) => ({
        sku,
        qty: parseInt(qty),
        item: warehouse.find(i => i.sku === sku)
      }));

    if (!selectedEvent) return alert("Please select a target event truck.");
    if (itemsToMove.length === 0) return alert("Enter quantities to load.");

    setIsProcessing(true);
    try {
      for (const batchItem of itemsToMove) {
        const { sku, qty, item } = batchItem;

        // 1. SILENT SYNC TO GLOBAL (Ensure base_price exists)
        await supabase.from('products').upsert({
            id: sku,
            name: item.item_name,
            base_price: item.base_price || 0, // This is your "Main" price
            type: 'apparel'
        }, { onConflict: 'id' });

        // 2. GET CURRENT TRUCK STOCK
        const { data: existing } = await supabase
          .from('inventory')
          .select('count')
          .eq('event_slug', selectedEvent)
          .eq('product_id', sku)
          .eq('size', item.size)
          .maybeSingle();

        // 3. MOVE TO TRUCK
        // We set 'active: true' so ONLY these items show on the Kiosk
        // We leave 'override_price' NULL so it pulls the Global base_price
        await supabase.from('inventory').upsert({
            event_slug: selectedEvent,
            product_id: sku,
            size: item.size,
            count: (existing?.count || 0) + qty,
            active: true,
            cost_price: item.cost_price || 0,
            override_price: null // No override, use Global base_price instead
        }, { onConflict: 'event_slug,product_id,size' });

        // 4. DEDUCT FROM MASTER WAREHOUSE
        await supabase.from('inventory_master')
          .update({ quantity_on_hand: item.quantity_on_hand - qty })
          .eq('sku', sku);
      }

      alert(`✅ Load Successful! ${itemsToMove.length} items moved to ${selectedEvent}`);
      setTransferQty({});
      fetchData();

    } catch (err: any) {
      alert("Transfer Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER SECTION */}
        <div className="flex justify-between items-center mb-12">
            <div>
                <Link href="/admin" className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] hover:underline">← Command Center</Link>
                <h1 className="text-4xl font-black tracking-tight text-slate-900 mt-1">Load Truck</h1>
            </div>
            <button 
                onClick={processBulkTransfer}
                disabled={isProcessing || !selectedEvent}
                className="bg-slate-900 text-white px-10 py-5 rounded-[24px] font-black uppercase text-sm tracking-widest hover:bg-emerald-600 disabled:opacity-30 transition-all shadow-xl"
            >
                {isProcessing ? 'Processing...' : 'Finalize Bulk Load 🚛'}
            </button>
        </div>

        {/* TRUCK & SEARCH CONTROLS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
            <div className="lg:col-span-4 bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                <p className="text-[10px] font-black uppercase text-gray-400 mb-4 tracking-widest">Target Truck</p>
                <select 
                    className="w-full bg-gray-50 p-4 rounded-2xl border-none outline-none font-black text-slate-900 text-lg appearance-none"
                    value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value)}
                >
                    <option value="">-- Choose Truck --</option>
                    {activeEvents.map(evt => <option key={evt.id} value={evt.slug}>{evt.event_name}</option>)}
                </select>
            </div>
            <div className="lg:col-span-8 bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                <p className="text-[10px] font-black uppercase text-gray-400 mb-4 tracking-widest">Search Master Warehouse</p>
                <input 
                    type="text" 
                    placeholder="Search Enza, Decal, Hoodie..." 
                    className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold text-lg"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {/* WAREHOUSE GRID */}
        <div className="bg-white rounded-[48px] border border-gray-100 shadow-2xl overflow-hidden mb-20">
            <div className="grid grid-cols-12 bg-slate-900 p-6 px-10 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <div className="col-span-6">Warehouse Item & SKU</div>
                <div className="col-span-2 text-center">Available</div>
                <div className="col-span-4 text-right">Qty to Load</div>
            </div>
            <div className="divide-y divide-gray-50 max-h-[700px] overflow-y-auto">
                {warehouse.filter(i => i.item_name?.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                    <div key={item.sku} className="grid grid-cols-12 p-6 px-10 items-center hover:bg-blue-50/50 transition-all">
                        <div className="col-span-6">
                            <h3 className="text-xl font-black text-slate-900 uppercase leading-none">{item.item_name}</h3>
                            <p className="text-[10px] font-bold text-blue-500 mt-2">{item.sku} • {item.size} • Global Price: ${item.base_price}</p>
                        </div>
                        <div className="col-span-2 text-center text-2xl font-black">{item.quantity_on_hand}</div>
                        <div className="col-span-4 flex justify-end">
                            <input 
                                type="number" 
                                className={`w-32 p-4 rounded-2xl border-none outline-none font-black text-center text-xl transition-all ${transferQty[item.sku] ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-slate-400'}`}
                                value={transferQty[item.sku] || ''}
                                onChange={(e) => setTransferQty({...transferQty, [item.sku]: e.target.value})}
                                placeholder="0"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}
