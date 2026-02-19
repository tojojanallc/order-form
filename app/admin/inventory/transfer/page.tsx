'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoadTruck() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [warehouse, setWarehouse] = useState<any[]>([]);
  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection State
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

  const handleQtyChange = (sku: string, value: string) => {
    setTransferQty(prev => ({ ...prev, [sku]: value }));
  };

  const processTransfer = async (item: any) => {
    const qty = parseInt(transferQty[item.sku] || '0');
    if (!selectedEvent) return alert("Please select a target event truck first.");
    if (qty <= 0) return alert("Enter a valid quantity to load.");
    if (qty > item.quantity_on_hand) return alert("Not enough stock in warehouse.");

    setIsProcessing(true);
    try {
      // 1. Check if item already exists on this event's inventory
      const { data: existingEventStock } = await supabase
        .from('inventory')
        .select('count')
        .eq('event_slug', selectedEvent)
        .eq('product_id', item.sku)
        .eq('size', item.size)
        .maybeSingle();

      // 2. UPSERT to Event Inventory (inventory table)
      const { error: upsertError } = await supabase
        .from('inventory')
        .upsert({
          event_slug: selectedEvent,
          product_id: item.sku,
          size: item.size,
          count: (existingEventStock?.count || 0) + qty,
          active: true, // Forces it to show in Event Stock and Kiosk
          cost_price: item.cost_price || 0
        }, { onConflict: 'event_slug,product_id,size' });

      if (upsertError) throw upsertError;

      // 3. DEDUCT from Master Warehouse (inventory_master table)
      const { error: deductError } = await supabase
        .from('inventory_master')
        .update({ quantity_on_hand: item.quantity_on_hand - qty })
        .eq('sku', item.sku);

      if (deductError) throw deductError;

      // 4. Update local state for immediate visual feedback
      setWarehouse(prev => prev.map(i => i.sku === item.sku ? { ...i, quantity_on_hand: i.quantity_on_hand - qty } : i));
      setTransferQty(prev => ({ ...prev, [item.sku]: '' }));
      
      alert(`✅ Loaded ${qty} units of ${item.item_name} (${item.size}) to ${selectedEvent}`);

    } catch (err: any) {
      alert("Transfer Failed: " + err.message);
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
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-12">
            <div>
                <Link href="/admin" className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] hover:underline">
                    ← Command Center
                </Link>
                <h1 className="text-4xl font-black tracking-tight text-slate-900 mt-1">Load Truck</h1>
            </div>
            <div className="flex items-center gap-4 bg-white p-2 px-5 rounded-3xl shadow-sm border border-gray-100">
                <div className="text-right">
                    <p className="text-[9px] font-black uppercase text-gray-400 leading-none">Security Active</p>
                    <p className="text-xs font-bold text-slate-900">{userEmail}</p>
                </div>
                <div className="h-10 w-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-xs font-black ml-2">LC</div>
            </div>
        </div>

        {/* CONTROLS AREA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
            {/* 1. Select Target Truck */}
            <div className="lg:col-span-4 bg-slate-900 p-8 rounded-[40px] shadow-2xl text-white">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4">Step 1: Target Destination</p>
                <select 
                    className="w-full bg-slate-800 p-4 rounded-2xl border-none outline-none font-black text-blue-400 text-lg appearance-none"
                    value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value)}
                >
                    <option value="">-- Choose Truck --</option>
                    {activeEvents.map(evt => (
                        <option key={evt.id} value={evt.slug}>{evt.event_name}</option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-4 font-medium italic">
                    All stock loaded will immediately be available for sales at the selected event.
                </p>
            </div>

            {/* 2. Search Warehouse */}
            <div className="lg:col-span-8 bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm flex flex-col justify-center">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-4">Step 2: Find Warehouse Stock</p>
                <div className="relative">
                    <input 
                        type="text"
                        placeholder="Search SKU, Item Name, or Color..."
                        className="w-full p-5 pl-14 bg-gray-50 rounded-3xl border-none outline-none font-bold text-lg focus:ring-2 focus:ring-blue-500 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <span className="absolute left-6 top-5 text-xl grayscale opacity-30">🔍</span>
                </div>
            </div>
        </div>

        {/* WAREHOUSE LIST */}
        <div className="bg-white rounded-[48px] border border-gray-100 shadow-2xl overflow-hidden">
            <div className="grid grid-cols-12 bg-slate-100 p-6 px-10 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                <div className="col-span-5">Warehouse Item</div>
                <div className="col-span-2 text-center">In Stock</div>
                <div className="col-span-5 text-right">Transfer to Truck</div>
            </div>

            <div className="divide-y divide-gray-50 max-h-[800px] overflow-y-auto">
                {loading ? (
                    <div className="p-32 text-center animate-pulse text-gray-300 font-black uppercase tracking-widest">Accessing Master Inventory...</div>
                ) : filteredWarehouse.map((item) => (
                    <div key={item.sku} className="grid grid-cols-12 p-6 px-10 items-center hover:bg-blue-50/50 transition-colors group">
                        {/* Item Info */}
                        <div className="col-span-5">
                            <h3 className="text-xl font-black text-slate-900 uppercase leading-none">{item.item_name}</h3>
                            <div className="flex gap-2 mt-2">
                                <span className="text-[9px] font-black bg-blue-50 text-blue-500 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-widest">{item.sku}</span>
                                <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200 uppercase tracking-widest">{item.color}</span>
                                <span className="text-[9px] font-black text-gray-400 uppercase self-center">Size {item.size}</span>
                            </div>
                        </div>

                        {/* Current Warehouse Stock */}
                        <div className="col-span-2 text-center">
                            <p className={`text-2xl font-black ${item.quantity_on_hand < 10 ? 'text-red-500 animate-pulse' : 'text-slate-900'}`}>
                                {item.quantity_on_hand}
                            </p>
                            <p className="text-[8px] font-black uppercase text-gray-400">Available</p>
                        </div>

                        {/* Load Control */}
                        <div className="col-span-5 flex justify-end items-center gap-4">
                            <div className="relative">
                                <input 
                                    type="number"
                                    placeholder="Qty"
                                    className="w-24 p-4 bg-gray-50 rounded-2xl border-none outline-none font-black text-center text-lg focus:ring-2 focus:ring-green-500 transition-all"
                                    value={transferQty[item.sku] || ''}
                                    onChange={(e) => handleQtyChange(item.sku, e.target.value)}
                                />
                            </div>
                            <button 
                                onClick={() => processTransfer(item)}
                                disabled={isProcessing || !selectedEvent || !transferQty[item.sku]}
                                className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] hover:bg-green-600 disabled:opacity-30 disabled:hover:bg-slate-900 transition-all flex items-center gap-3"
                            >
                                {isProcessing ? 'Moving...' : 'Load Truck 🚛'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
}
