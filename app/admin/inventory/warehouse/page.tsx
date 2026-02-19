'use client';
import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/supabase'; 
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// Component wrapped in Suspense to handle useSearchParams in Next.js
function WarehouseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filter = searchParams.get('filter');

  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    checkUser();
    fetchInventory();
  }, [filter]); // Re-fetch if the filter changes

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserEmail(user.email);
  }

  async function fetchInventory() {
    setLoading(true);
    let query = supabase.from('inventory_master').select('*');

    // Apply the "Low Stock" logic from the Dashboard Alert
    if (filter === 'low') {
      query = query.lt('quantity_on_hand', 10);
    }

    const { data, error } = await query.order('item_name', { ascending: true });
    
    if (!error) setInventory(data || []);
    setLoading(false);
  }

  const updateQuantity = async (sku: string, newQty: number) => {
    const { error } = await supabase
      .from('inventory_master')
      .update({ quantity_on_hand: newQty })
      .eq('sku', sku);

    if (!error) {
      setInventory(prev => prev.map(item => item.sku === sku ? { ...item, quantity_on_hand: newQty } : item));
    }
  };

  const filteredItems = inventory.filter(item => 
    item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.color?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
          <div>
            <Link href="/admin" className="text-[10px] font-black uppercase text-blue-600 tracking-widest hover:underline mb-2 inline-block">
                ← Back to Command Center
            </Link>
            <h1 className="text-5xl font-black tracking-tighter text-slate-900 uppercase">Master Warehouse</h1>
            <p className="text-gray-400 font-bold mt-1 uppercase text-[10px] tracking-[0.2em]">
                {filter === 'low' ? '⚠️ Filtering: Low Stock Items Only' : 'Full Inventory Management'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
              <div className="relative w-full sm:w-80">
                  <input 
                    type="text"
                    placeholder="Search SKU, Name, or Color..."
                    className="w-full p-4 pl-12 bg-white rounded-3xl border border-gray-100 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <span className="absolute left-5 top-4 opacity-30">🔍</span>
              </div>
              {filter && (
                  <button 
                    onClick={() => router.push('/admin/inventory/warehouse')}
                    className="bg-slate-900 text-white px-6 py-4 rounded-3xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-600 transition-colors"
                  >
                    Clear Filters
                  </button>
              )}
          </div>
        </div>

        {/* INVENTORY TABLE */}
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                        <th className="p-6 px-8">Product Details</th>
                        <th className="p-6 text-center">Color</th>
                        <th className="p-6 text-center">Size</th>
                        <th className="p-6 text-center">Current Stock</th>
                        <th className="p-6 text-right px-8">Unit Cost</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {loading ? (
                        <tr>
                            <td colSpan={5} className="p-20 text-center animate-pulse text-gray-300 font-black uppercase tracking-widest">
                                Loading Warehouse Data...
                            </td>
                        </tr>
                    ) : filteredItems.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="p-20 text-center text-gray-400 font-bold italic">
                                No items found matching your search or filter.
                            </td>
                        </tr>
                    ) : (
                        filteredItems.map((item) => (
                            <tr key={item.sku} className="group hover:bg-blue-50/30 transition-colors">
                                <td className="p-6 px-8">
                                    <p className="font-black text-slate-900 uppercase text-lg leading-tight">{item.item_name}</p>
                                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">{item.sku}</p>
                                </td>
                                <td className="p-6 text-center">
                                    <span className="bg-gray-100 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500">
                                        {item.color || 'N/A'}
                                    </span>
                                </td>
                                <td className="p-6 text-center font-bold text-slate-600">
                                    {item.size}
                                </td>
                                <td className="p-6">
                                    <div className="flex items-center justify-center gap-3">
                                        <button 
                                            onClick={() => updateQuantity(item.sku, Math.max(0, item.quantity_on_hand - 1))}
                                            className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center font-black text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
                                        >
                                            -
                                        </button>
                                        <div className={`text-2xl font-black w-16 text-center ${item.quantity_on_hand < 10 ? 'text-red-500 animate-pulse' : 'text-slate-900'}`}>
                                            {item.quantity_on_hand}
                                        </div>
                                        <button 
                                            onClick={() => updateQuantity(item.sku, item.quantity_on_hand + 1)}
                                            className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center font-black text-gray-400 hover:bg-green-50 hover:text-green-500 transition-all"
                                        >
                                            +
                                        </button>
                                    </div>
                                </td>
                                <td className="p-6 text-right px-8 font-black text-slate-400">
                                    ${Number(item.cost_price || 0).toFixed(2)}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>

        {/* FOOTER STATS */}
        <div className="mt-8 flex justify-between items-center px-8">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Showing {filteredItems.length} of {inventory.length} total SKUs
            </p>
            <div className="flex gap-6">
                <div className="text-right">
                    <p className="text-[9px] font-black text-gray-400 uppercase">Filtered Stock Total</p>
                    <p className="font-black text-slate-900">
                        {filteredItems.reduce((acc, i) => acc + (i.quantity_on_hand || 0), 0)} Units
                    </p>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}

// Main page component
export default function WarehousePage() {
    return (
        <Suspense fallback={<div className="p-20 text-center font-black uppercase">Initial Loading...</div>}>
            <WarehouseContent />
        </Suspense>
    );
}
