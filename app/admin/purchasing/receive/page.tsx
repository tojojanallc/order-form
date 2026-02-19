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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/admin/login');
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
      .select('*, inventory_master(item_name, size, color)')
      .eq('purchase_id', po.id);
    setPoItems(data || []);
  };

  const receiveAll = async () => {
    if (!confirm(`Confirm receipt of PO ${selectedPO.po_number}? This will update master stock.`)) return;

    setProcessing(true);
    try {
      for (const item of poItems) {
        // 1. Get current stock (if any)
        const { data: current } = await supabase
          .from('inventory_master')
          .select('quantity_on_hand')
          .eq('sku', item.sku)
          .maybeSingle();

        // 2. THE FIX: Use .upsert() so it creates the SKU if it was missing
        // This ensures the Enza pants (and future items) are never skipped
        const { error: invError } = await supabase
          .from('inventory_master')
          .upsert({
              sku: item.sku,
              item_name: item.inventory_master?.item_name || 'New Item from PO',
              size: item.inventory_master?.size,
              color: item.inventory_master?.color,
              quantity_on_hand: (current?.quantity_on_hand || 0) + item.quantity,
              cost_price: item.unit_cost // Syncs latest cost to your asset cards
          }, { onConflict: 'sku' });

        if (invError) {
            console.error(`Error syncing SKU ${item.sku}:`, invError);
            throw invError;
        }
      }

      // 3. Mark the Purchase Order as officially received
      await supabase.from('purchases').update({ status: 'received' }).eq('id', selectedPO.id);

      alert("✅ Inventory Successfully Synced! New SKUs created as needed.");
      setSelectedPO(null);
      fetchOpenPOs();

    } catch (err: any) {
      alert("Critical Sync Error: " + err.message);
    } finally {
        setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* TOP BAR: AUTH & BRANDING */}
        <div className="flex justify-between items-center mb-8">
            <div>
                <Link href="/admin" className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] hover:underline">
                    ← Back to Command Center
                </Link>
                <h1 className="text-4xl font-black tracking-tight text-slate-900 mt-1">Receive Stock</h1>
            </div>
            
            <div className="flex items-center gap-4 bg-white p-2 px-5 rounded-3xl shadow-sm border border-gray-100">
                <div className="text-right">
                    <p className="text-[9px] font-black uppercase text-gray-400 leading-none">Security Active</p>
                    <p className="text-xs font-bold text-slate-900">{userEmail}</p>
                </div>
                <div className="h-8 w-[1px] bg-gray-100 mx-1"></div>
                <button 
                    onClick={handleSignOut}
                    className="text-[10px] font-black uppercase text-red-500 hover:text-white hover:bg-red-500 px-3 py-1.5 rounded-xl transition-all"
                >
                    Sign Out
                </button>
            </div>
        </div>

        {!selectedPO ? (
          /* GRID VIEW OF OPEN SHIPMENTS */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading ? (
                <div className="col-span-full py-20 text-center animate-pulse text-gray-400 font-black uppercase text-xs tracking-widest">Scanning Inbound Freight...</div>
            ) : openPOs.length === 0 ? (
                <div className="col-span-full text-center py-20 bg-white border border-gray-100 rounded-[40px] shadow-sm">
                    <p className="text-gray-400 font-black uppercase tracking-widest">No pending purchase orders found.</p>
                </div>
            ) : (
                openPOs.map(po => (
                    <div 
                        key={po.id} 
                        onClick={() => loadPO(po)} 
                        className="bg-white p-8 rounded-[40px] border border-gray-200 shadow-sm hover:shadow-xl hover:border-blue-300 cursor-pointer transition-all group flex flex-col justify-between h-full"
                    >
                        <div>
                            <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest mb-4 inline-block">PO #{po.po_number}</span>
                            <h3 className="text-2xl font-black uppercase leading-tight group-hover:text-blue-600 transition-colors">{po.vendors?.name}</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mt-2">Ordered {new Date(po.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="mt-8 border-t border-gray-50 pt-6 flex justify-between items-center">
                            <span className="text-xs font-black">${po.total_amount?.toFixed(2)}</span>
                            <div className="h-10 w-10 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">📥</div>
                        </div>
                    </div>
                ))
            )}
          </div>
        ) : (
          /* DETAILED PO VIEW */
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-[48px] border border-gray-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
                    <div>
                        <button onClick={() => setSelectedPO(null)} className="text-blue-400 font-black text-[10px] uppercase mb-2">← Back to Shipments</button>
                        <h2 className="text-5xl font-black tracking-tighter">PO #{selectedPO.po_number}</h2>
                        <p className="text-blue-200 font-bold uppercase text-xs tracking-widest">{selectedPO.vendors?.name}</p>
                    </div>
                    <button 
                        onClick={receiveAll} 
                        disabled={processing}
                        className="bg-emerald-500 text-white px-10 py-5 rounded-[24px] font-black uppercase text-sm tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {processing ? 'Syncing...' : 'Accept All into Stock'}
                    </button>
                </div>
                
                <div className="p-4">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
                                <th className="p-8">Garment / Color / SKU</th>
                                <th className="p-8 text-center">Qty</th>
                                <th className="p-8 text-right">Unit Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {poItems.map(item => (
                            <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="p-8">
                                    <div className="font-black text-slate-900 uppercase text-lg mb-1">{item.inventory_master?.item_name || 'New Item'}</div>
                                    <div className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">
                                        {item.inventory_master?.color} • {item.inventory_master?.size} • {item.sku}
                                    </div>
                                </td>
                                <td className="p-8 text-center font-black text-3xl">{item.quantity}</td>
                                <td className="p-8 text-right font-black text-slate-400">${item.unit_cost?.toFixed(2)}</td>
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
