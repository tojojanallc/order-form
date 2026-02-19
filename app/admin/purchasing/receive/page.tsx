'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ReceivePO() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [openPOs, setOpenPOs] = useState<any[]>([]);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [poItems, setPoItems] = useState<any[]>([]);
  const [sellPrices, setSellPrices] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    checkUser();
    fetchOpenPOs();
  }, []);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserEmail(user.email ?? 'Admin');
  }

  const fetchOpenPOs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('purchases')
      .select('*, vendors(name)')
      .eq('status', 'ordered')
      .order('created_at', { ascending: false });
    setOpenPOs(data || []);
    setLoading(false);
  };

  const loadPO = async (po: any) => {
    setSelectedPO(po);
    const { data } = await supabase
      .from('purchase_items')
      .select('*, inventory_master(item_name, size, color, base_price)')
      .eq('purchase_id', po.id);
    
    setPoItems(data || []);
    
    // Pre-populate sell prices from existing inventory if available
    const initialPrices: { [key: string]: number } = {};
    data?.forEach(item => {
      initialPrices[item.sku] = item.inventory_master?.base_price || 0;
    });
    setSellPrices(initialPrices);
  };

  const handlePriceChange = (sku: string, price: string) => {
    setSellPrices(prev => ({ ...prev, [sku]: parseFloat(price) || 0 }));
  };

  const receiveAll = async () => {
    if (!confirm(`Confirm receipt of PO ${selectedPO.po_number}?`)) return;

    setProcessing(true);
    try {
      for (const item of poItems) {
        const { data: current } = await supabase
          .from('inventory_master')
          .select('quantity_on_hand')
          .eq('sku', item.sku)
          .maybeSingle();

        // UPSERT includes the new Sell Price (base_price)
        const { error: invError } = await supabase
          .from('inventory_master')
          .upsert({
              sku: item.sku,
              item_name: item.inventory_master?.item_name || 'New Item',
              size: item.inventory_master?.size,
              color: item.inventory_master?.color,
              quantity_on_hand: (current?.quantity_on_hand || 0) + item.quantity,
              cost_price: item.unit_cost,
              base_price: sellPrices[item.sku] // NEW: Sets the retail price
          }, { onConflict: 'sku' });

        if (invError) throw invError;
      }

      await supabase.from('purchases').update({ status: 'received' }).eq('id', selectedPO.id);

      alert("✅ Stock Intake Complete! Prices and quantities updated.");
      setSelectedPO(null);
      fetchOpenPOs();

    } catch (err: any) {
      alert("Sync Error: " + err.message);
    } finally {
        setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER SECTION (Matches Command Center) */}
        <div className="flex justify-between items-center mb-8">
            <div>
                <Link href="/admin" className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] hover:underline">
                    ← Back to Command Center
                </Link>
                <h1 className="text-4xl font-black tracking-tight text-slate-900 mt-1">Receive Stock</h1>
            </div>
            <div className="flex items-center gap-4 bg-white p-2 px-5 rounded-3xl shadow-sm border border-gray-100">
                <p className="text-xs font-bold text-slate-900">{userEmail}</p>
                <div className="h-8 w-[1px] bg-gray-100 mx-1"></div>
                <div className="h-10 w-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-xs font-black">LC</div>
            </div>
        </div>

        {!selectedPO ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {openPOs.map(po => (
                <div key={po.id} onClick={() => loadPO(po)} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-300 cursor-pointer transition-all flex flex-col justify-between h-full">
                    <div>
                        <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest mb-4 inline-block">PO #{po.po_number}</span>
                        <h3 className="text-2xl font-black uppercase leading-tight">{po.vendors?.name}</h3>
                        <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-widest">Ordered {new Date(po.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="mt-8 border-t border-gray-50 pt-6 flex justify-between items-center">
                        <span className="text-xs font-black text-slate-900">${po.total_amount?.toFixed(2)}</span>
                        <div className="h-10 w-10 bg-gray-50 rounded-2xl flex items-center justify-center text-xl">📥</div>
                    </div>
                </div>
            ))}
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-[48px] border border-gray-200 shadow-2xl overflow-hidden">
                <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
                    <div>
                        <button onClick={() => setSelectedPO(null)} className="text-blue-400 font-black text-[10px] uppercase mb-2 hover:text-white transition-colors">← Cancel</button>
                        <h2 className="text-5xl font-black tracking-tighter uppercase">PO #{selectedPO.po_number}</h2>
                        <p className="text-blue-200 font-bold uppercase text-xs tracking-widest">{selectedPO.vendors?.name}</p>
                    </div>
                    <button 
                        onClick={receiveAll} 
                        disabled={processing}
                        className="bg-emerald-500 text-white px-10 py-5 rounded-[24px] font-black uppercase text-sm tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {processing ? 'Processing...' : 'Accept All into Stock'}
                    </button>
                </div>
                
                <div className="p-4">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] border-b border-gray-100">
                                <th className="p-8">Garment / SKU</th>
                                <th className="p-8 text-center">Inbound Qty</th>
                                <th className="p-8 text-center">Unit Cost</th>
                                <th className="p-8 text-right">Set Sell Price ($)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {poItems.map(item => (
                            <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="p-8">
                                    <div className="font-black text-slate-900 uppercase text-lg leading-tight mb-1">{item.inventory_master?.item_name || 'New Item'}</div>
                                    <div className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">
                                        {item.inventory_master?.color} • {item.inventory_master?.size} • {item.sku}
                                    </div>
                                </td>
                                <td className="p-8 text-center font-black text-3xl text-slate-900">{item.quantity}</td>
                                <td className="p-8 text-center font-black text-slate-400 text-lg">${item.unit_cost?.toFixed(2)}</td>
                                <td className="p-8 text-right">
                                    <div className="flex justify-end">
                                        <div className="relative">
                                            <span className="absolute left-4 top-4 font-black text-slate-300">$</span>
                                            <input 
                                                type="number"
                                                className="w-32 p-4 pl-8 bg-gray-50 rounded-2xl border-none outline-none font-black text-xl text-right focus:ring-2 focus:ring-blue-500 transition-all"
                                                value={sellPrices[item.sku] || ''}
                                                onChange={(e) => handlePriceChange(item.sku, e.target.value)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                </td>
                            </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
