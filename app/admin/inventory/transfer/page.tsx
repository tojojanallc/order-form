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
  const [moveQuantities, setMoveQuantities] = useState<{[key: string]: string}>({}); 
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
      const { data: prodData } = await supabase.from('products').select('*');

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

    if (!targetSlug) return alert("Please select a destination event first.");
    if (!qtyToMove || qtyToMove <= 0) return alert("Please enter a valid quantity.");
    if (qtyToMove > item.count) return alert("Not enough stock in warehouse.");

    const confirmMsg = `Confirm Move:\n\n${qtyToMove}x ${getProductDetails(item.product_id).name} (${item.size})\n➡️ ${targetSlug.toUpperCase()}`;
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
      const { data: existingTarget } = await supabase
        .from('inventory')
        .select('id, count')
        .eq('event_slug', targetSlug)
        .eq('product_id', item.product_id)
        .eq('size', item.size)
        .maybeSingle();

      if (existingTarget) {
        await supabase
          .from('inventory')
          .update({ count: existingTarget.count + qtyToMove, active: true }) 
          .eq('id', existingTarget.id);
      } else {
        await supabase.from('inventory').insert({
          event_slug: targetSlug,
          product_id: item.product_id,
          size: item.size,
          count: qtyToMove,
          active: true, // Auto-activate so it shows up in their list
          cost_price: item.cost_price || 8.50,
          override_price: null
        });
      }

      // C. Optimistic UI Update
      setWarehouseStock(prev => prev.map(i => 
        i.id === item.id ? { ...i, count: i.count - qtyToMove } : i
      ));
      setMoveQuantities(prev => ({ ...prev, [item.id]: '' })); 
      
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
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
        <div>
            <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase hover:underline mb-1 inline-block">
                ← Dashboard
            </Link>
            <h1 className="text-4xl font-black text-gray-900">Load Truck</h1>
            <p className="text-gray-500 mt-1">Transfer inventory from Warehouse to Event Kiosks.</p>
        </div>
        
        {/* DESTINATION CARD */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-5 w-full md:w-auto">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 flex-shrink-0">
                <span className="text-2xl">🚛</span>
            </div>
            <div className="flex-1">
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Destination Event</label>
                <select 
                    className="block w-full md:w-64 p-2.5 text-sm font-bold text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 cursor-pointer transition-all hover:bg-gray-100"
                    onChange={e => setTargetSlug(e.target.value)}
                    value={targetSlug}
                >
                    <option value="">-- Select Destination --</option>
                    {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
                </select>
            </div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="mb-8">
        <input 
            placeholder="🔍 Search warehouse items by name or size..." 
            className="w-full p-4 pl-6 rounded-2xl border border-gray-200 shadow-sm text-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* INVENTORY GRID */}
      {loading ? (
          <div className="text-center py-20">
              <div className="inline-block animate-spin text-4xl mb-4">🔄</div>
              <p className="text-gray-400 font-bold">Loading Warehouse Inventory...</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStock.map(item => {
                const product = getProductDetails(item.product_id);
                const inputVal = moveQuantities[item.id] || '';
                
                return (
                    <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all flex flex-col justify-between h-full group">
                        
                        {/* TOP: Image & Name */}
                        <div className="flex gap-4 items-start mb-6">
                            <div className="w-16 h-16 bg-gray-50 rounded-xl border border-gray-100 flex-shrink-0 flex items-center justify-center p-1">
                                {product.image_url ? (
                                    <img src={product.image_url} className="w-full h-full object-contain mix-blend-multiply" alt={product.name} />
                                ) : (
                                    <span className="text-2xl grayscale opacity-50">👕</span>
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 leading-tight mb-2 text-lg">{product.name}</h3>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 uppercase tracking-wide">
                                    Size: {item.size}
                                </span>
                            </div>
                        </div>

                        {/* MIDDLE: Stock Info */}
                        <div className="flex justify-between items-end border-b border-gray-50 pb-4 mb-4">
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Warehouse Stock</p>
                                <p className="text-3xl font-black text-gray-900">{item.count}</p>
                            </div>
                        </div>

                        {/* BOTTOM: Input & Button */}
                        <div className="flex gap-3">
                            <input 
                                type="number" 
                                placeholder="Qty"
                                className="w-24 p-3 bg-gray-50 border border-gray-200 rounded-xl text-center font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-900"
                                value={inputVal}
                                onChange={(e) => setMoveQuantities({...moveQuantities, [item.id]: e.target.value})}
                            />
                            <button 
                                onClick={() => handleTransfer(item)}
                                disabled={!targetSlug}
                                className={`flex-1 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2
                                    ${targetSlug 
                                        ? 'bg-gray-900 text-white hover:bg-gray-800 hover:shadow-md' 
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
                                `}
                            >
                                {targetSlug ? (
                                    <>Load Truck <span className="text-gray-400">→</span></>
                                ) : (
                                    'Select Event'
                                )}
                            </button>
                        </div>
                    </div>
                );
            })}
          </div>
      )}
      
      {!loading && filteredStock.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
            <h2 className="text-2xl font-bold text-gray-400 mb-2">Warehouse is Empty</h2>
            <p className="text-gray-400">Receive stock via "Purchasing" to add items here.</p>
          </div>
      )}
    </div>
  );
}