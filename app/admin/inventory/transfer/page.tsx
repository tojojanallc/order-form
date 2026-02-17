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
  const [warehouseStock, setWarehouseStock] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  
  // Selection State
  const [targetSlug, setTargetSlug] = useState('');
  const [moveQuantities, setMoveQuantities] = useState<{[key: string]: string}>({}); // Stores inputs
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      // A. Get Active Events (excluding warehouse)
      const { data: eventData } = await supabase
        .from('event_settings')
        .select('slug, event_name')
        .neq('slug', 'warehouse')
        .eq('status', 'active');
      
      // B. Get Global Products (for names/images)
      const { data: prodData } = await supabase
        .from('products')
        .select('*');

      // C. Get Warehouse Inventory (Source)
      const { data: invData } = await supabase
        .from('inventory')
        .select('*')
        .eq('event_slug', 'warehouse')
        .gt('count', 0) // Only show items with stock
        .order('product_id', { ascending: true });

      setEvents(eventData || []);
      setProducts(prodData || []);
      setWarehouseStock(invData || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Helper: Get Product Name from ID
  const getProductDetails = (pid: string) => products.find(p => p.id === pid) || { name: pid, image_url: null };

  // 2. The Transfer Logic
  const handleTransfer = async (item: any) => {
    const qtyToMove = parseInt(moveQuantities[item.id] || '0');

    if (!targetSlug) return alert("⚠️ SELECT A DESTINATION EVENT FIRST");
    if (!qtyToMove || qtyToMove <= 0) return alert("⚠️ ENTER A VALID QUANTITY");
    if (qtyToMove > item.count) return alert("⚠️ NOT ENOUGH STOCK IN WAREHOUSE");

    const confirmMsg = `🚚 MOVE ${qtyToMove}x ${getProductDetails(item.product_id).name} (${item.size}) \n➡️ TO: ${targetSlug.toUpperCase()}?`;
    if (!confirm(confirmMsg)) return;

    setLoading(true);

    try {
      // A. Subtract from Warehouse
      const { error: subError } = await supabase
        .from('inventory')
        .update({ count: item.count - qtyToMove })
        .eq('id', item.id);

      if (subError) throw subError;

      // B. Add to Target Event
      // Check if row exists first
      const { data: existingTarget } = await supabase
        .from('inventory')
        .select('id, count')
        .eq('event_slug', targetSlug)
        .eq('product_id', item.product_id)
        .eq('size', item.size)
        .maybeSingle();

      if (existingTarget) {
        // Update existing row
        await supabase
          .from('inventory')
          .update({ count: existingTarget.count + qtyToMove, active: true }) // Force active
          .eq('id', existingTarget.id);
      } else {
        // Insert new row
        await supabase.from('inventory').insert({
          event_slug: targetSlug,
          product_id: item.product_id,
          size: item.size,
          count: qtyToMove,
          active: true, // Auto-activate
          cost_price: item.cost_price || 8.50,
          override_price: null // Use global price
        });
      }

      // C. Optimistic UI Update (Update local state without refetching)
      setWarehouseStock(prev => prev.map(i => 
        i.id === item.id ? { ...i, count: i.count - qtyToMove } : i
      ));
      setMoveQuantities(prev => ({ ...prev, [item.id]: '' })); // Clear input
      
    } catch (e: any) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  };

  // Filter items based on search
  const filteredStock = warehouseStock.filter(item => {
    const pName = getProductDetails(item.product_id).name.toLowerCase();
    return pName.includes(searchTerm.toLowerCase()) || item.size.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-white text-black p-6 font-sans">
      {/* HEADER */}
      <div className="max-w-6xl mx-auto mb-8 border-b-4 border-black pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Link href="/admin" className="text-blue-600 font-black uppercase text-xs hover:underline mb-2 block">← Back to Dashboard</Link>
          <h1 className="text-5xl font-black uppercase italic tracking-tighter">Inventory Transfer</h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">Warehouse ➔ Event Truck</p>
        </div>
        
        {/* DESTINATION SELECTOR */}
        <div className="w-full md:w-auto bg-yellow-100 p-4 border-4 border-black shadow-[4px_4px_0px_0px_black]">
          <label className="block text-xs font-black uppercase mb-1">Destination Event</label>
          <select 
            className="w-full md:w-64 p-2 border-2 border-black font-bold text-lg outline-none bg-white cursor-pointer"
            onChange={e => setTargetSlug(e.target.value)}
            value={targetSlug}
          >
            <option value="">-- SELECT DESTINATION --</option>
            {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
          </select>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* SEARCH BAR */}
        <div className="mb-6">
          <input 
            placeholder="🔍 SEARCH WAREHOUSE..." 
            className="w-full p-4 border-4 border-black font-bold text-xl outline-none placeholder:text-gray-300"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* INVENTORY GRID */}
        {loading ? (
          <div className="p-10 text-center font-black text-2xl animate-pulse">LOADING WAREHOUSE DATA...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStock.map(item => {
              const product = getProductDetails(item.product_id);
              const inputVal = moveQuantities[item.id] || '';
              
              return (
                <div key={item.id} className="border-4 border-black p-4 bg-white shadow-[4px_4px_0px_0px_black] hover:-translate-y-1 transition-transform flex flex-col justify-between">
                  
                  {/* CARD HEADER */}
                  <div className="flex gap-4 mb-4">
                    <div className="w-16 h-16 bg-gray-100 border-2 border-black flex-shrink-0 flex items-center justify-center">
                      {product.image_url ? 
                        <img src={product.image_url} className="w-full h-full object-contain" /> :
                        <span className="text-xs font-bold text-gray-400">NO IMG</span>
                      }
                    </div>
                    <div>
                      <h3 className="font-black text-lg leading-tight uppercase">{product.name}</h3>
                      <div className="inline-block bg-black text-white text-xs px-2 py-1 font-bold uppercase mt-1">
                        Size: {item.size}
                      </div>
                    </div>
                  </div>

                  {/* STOCK DISPLAY */}
                  <div className="bg-gray-100 p-3 border-2 border-black mb-4 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-500 uppercase">On Hand</span>
                    <span className="text-2xl font-black">{item.count}</span>
                  </div>

                  {/* ACTIONS */}
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      placeholder="QTY"
                      className="w-20 border-2 border-black p-2 font-bold text-center outline-none focus:bg-blue-50"
                      value={inputVal}
                      onChange={(e) => setMoveQuantities({...moveQuantities, [item.id]: e.target.value})}
                    />
                    <button 
                      onClick={() => handleTransfer(item)}
                      disabled={!targetSlug}
                      className={`flex-1 border-2 border-black font-black uppercase text-sm py-2 transition-all 
                        ${targetSlug ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-[2px_2px_0px_0px_black]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
                      `}
                    >
                      {targetSlug ? 'Load Truck 🚚' : 'Select Event'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {!loading && filteredStock.length === 0 && (
          <div className="p-12 border-4 border-black border-dashed text-center">
            <h2 className="text-2xl font-black text-gray-400 uppercase">Warehouse is Empty (or no match)</h2>
            <p className="font-bold text-gray-400 mt-2">Go to Global Catalog to add stock to Warehouse.</p>
          </div>
        )}
      </div>
    </div>
  );
}