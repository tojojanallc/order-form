'use client';
import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/supabase'; 
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

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
  }, [filter]);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserEmail(user.email);
  }

  async function fetchInventory() {
    setLoading(true);
    let query = supabase.from('inventory_master').select('*');
    if (filter === 'low') query = query.lt('quantity_on_hand', 10);
    const { data, error } = await query.order('item_name', { ascending: true });
    if (!error) setInventory(data || []);
    setLoading(false);
  }

  const updateQuantity = async (sku: string, newQty: number) => {
    const { error } = await supabase.from('inventory_master').update({ quantity_on_hand: newQty }).eq('sku', sku);
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
        
        {/* TOP BAR: AUTH & BRANDING (Matches Command Center) */}
        <div className="flex justify-between items-center mb-12">
            <div>
                <Link href="/admin" className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] hover:underline">
                    ← Command Center
                </Link>
                <h1 className="text-5xl font-black tracking-tight text-slate-900 mt-2">Master Warehouse</h1>
            </div>
            
            <div className="flex items-center gap-4 bg-white p-2 px-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="text-right">
                    <p className="text-[9px] font-black uppercase text-gray-400 leading-none">Access Verified</p>
                    <p className="text-xs font-bold text-slate-900">{userEmail}</p>
                </div>
                <div className="h-8 w-[1px] bg-gray-100 mx-1"></div>
                <div className="h-10 w-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-xs font-black">LC</div>
            </div>
        </div>

        {/* SEARCH & FILTERS SECTION */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
            <div className="relative w-full lg:max-w-xl">
                <input 
                    type="text"
                    placeholder="Search 1,300+ SKUs by name, color, or SKU..."
                    className="w-full p-6 pl-14 bg-white rounded-[32px] border border-gray-100 shadow-xl focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-lg transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <span className="absolute left-6 top-6 text-xl grayscale opacity-30">🔍</span>
            </div>

            <div className="flex items-center gap-4 w-full lg:w-auto">
                {filter === 'low' && (
                    <div className="bg-red-500 text-white px-6 py-4 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-500/20 flex items-center gap-3">
                        <span>⚠️ Low Stock View</span>
                        <button onClick={() => router.push('/admin/inventory/warehouse')} className="bg-red-700 hover:bg-red-800 p-1 rounded-lg">✕</button>
                    </div>
                )}
                <div className="bg-slate-900 px-8 py-5 rounded-[32px] shadow-xl text-right min-w-[220px]">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Items Listed</p>
                    <p className="text-3xl font-black text-blue-400">{filteredItems.length}</p>
                </div>
            </div>
        </div>

        {/* THE MAIN LIST - Styled like the Shop Orders card */}
        <div className="bg-white rounded-[48px] border border-gray-100 shadow-2xl overflow-hidden mb-20">
            {/* Header for the List */}
            <div className="grid grid-cols-12 bg-slate-900 p-8 px-10 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                <div className="col-span-5">Product Details</div>
                <div className="col-span-2 text-center">Attributes</div>
                <div className="col-span-3 text-center">Stock Control</div>
                <div className="col-span-2 text-right">Valuation</div>
            </div>

            <div className="divide-y divide-gray-50">
                {loading ? (
                    <div className="p-32 text-center animate-pulse">
                        <div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Opening Vault...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="p-32 text-center bg-gray-50">
                        <p className="text-2xl font-black text-slate-300 uppercase tracking-tighter">No SKUs found</p>
                        <p className="text-xs font-bold text-gray-400 mt-2 uppercase">Adjust your search or filter</p>
                    </div>
                ) : (
                    filteredItems.map((item) => (
                        <div key={item.sku} className="grid grid-cols-12 p-8 px-10 items-center hover:bg-blue-50/30 transition-all group">
                            {/* Product Info */}
                            <div className="col-span-5">
                                <h3 className="text-2xl font-black text-slate-900 uppercase leading-none group-hover:text-blue-600 transition-colors">
                                    {item.item_name}
                                </h3>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md border border-blue-100">
                                        {item.sku}
                                    </span>
                                </div>
                            </div>

                            {/* Attributes */}
                            <div className="col-span-2 flex flex-col items-center gap-2">
                                <span className="bg-slate-100 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-200">
                                    {item.color || 'No Color'}
                                </span>
                                <span className="text-sm font-black text-slate-400 uppercase tracking-widest">
                                    Size {item.size}
                                </span>
                            </div>

                            {/* Stock Control */}
                            <div className="col-span-3 flex justify-center">
                                <div className="flex items-center bg-gray-50 p-2 px-4 rounded-[24px] border border-gray-100 gap-6">
                                    <button 
                                        onClick={() => updateQuantity(item.sku, Math.max(0, item.quantity_on_hand - 1))}
                                        className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-slate-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all font-black text-xl"
                                    >
                                        -
                                    </button>
                                    <div className="text-center min-w-[60px]">
                                        <p className={`text-3xl font-black leading-none ${item.quantity_on_hand < 10 ? 'text-red-500 animate-pulse' : 'text-slate-900'}`}>
                                            {item.quantity_on_hand}
                                        </p>
                                        <p className="text-[8px] font-black uppercase text-gray-400 mt-1">On Hand</p>
                                    </div>
                                    <button 
                                        onClick={() => updateQuantity(item.sku, item.quantity_on_hand + 1)}
                                        className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-slate-400 hover:bg-green-500 hover:text-white hover:border-green-500 transition-all font-black text-xl"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {/* Valuation */}
                            <div className="col-span-2 text-right">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Unit Cost</p>
                                <p className="text-xl font-black text-slate-900 tracking-tight">
                                    ${Number(item.cost_price || 0).toFixed(2)}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            {/* Footer Summary Bar */}
            <div className="bg-slate-50 p-10 border-t border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-white rounded-2xl border border-gray-200 flex items-center justify-center text-2xl shadow-sm">📦</div>
                    <p className="text-[10px] font-bold text-gray-400 leading-tight uppercase tracking-widest max-w-[200px]">
                        Master Warehouse inventory data is live and affects all event trucks and direct shop sales.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Selected Asset Value</p>
                    <p className="text-4xl font-black text-slate-900 tracking-tighter">
                        ${filteredItems.reduce((acc, i) => acc + (i.quantity_on_hand * i.cost_price), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </p>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}

export default function WarehousePage() {
    return (
        <Suspense fallback={<div className="p-20 text-center font-black uppercase tracking-widest text-gray-400 animate-pulse">Initializing Warehouse...</div>}>
            <WarehouseContent />
        </Suspense>
    );
}
