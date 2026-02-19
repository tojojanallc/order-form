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
    if (!confirm(`Confirm receipt of PO ${selectedPO.po_number}? master warehouse counts will be updated.`)) return;

    setProcessing(true);
    try {
      for (const item of poItems) {
        const { data: current } = await supabase.from('inventory_master').select('quantity_on_hand').eq('sku', item.sku).single();
        await supabase.from('inventory_master').update({
            quantity_on_hand: (current?.quantity_on_hand || 0) + item.quantity,
            cost_price: item.unit_cost // Sync the most recent cost
        }).eq('sku', item.sku);
      }

      await supabase.from('purchases').update({ status: 'received' }).eq('id', selectedPO.id);

      alert("✅ Stock Intake Complete!");
      setSelectedPO(null);
      fetchOpenPOs();

    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
        setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* TOP BAR: AUTH & BRANDING (Matches Command Center) */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {loading ? (
                <div className="col-span-full py-24 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Scanning Shipments...</p>
                </div>
            ) : openPOs.length === 0 ? (
                <div className="col-span-full text-center py-24 bg-white border border-gray-100 rounded-[40px] shadow-sm">
                    <div className="text-5xl mb-6">📦</div>
                    <p className="text-gray-400 font-black uppercase tracking-widest mb-6">All Purchase Orders are Received</p>
                    <Link href="/admin/purchasing/create" className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-600 transition-colors">
                        Create New PO
                    </Link>
                </div>
            ) : (
                openPOs.map(po => (
                    <div 
                        key={po.id} 
                        onClick={() => loadPO(po)} 
                        className="bg-white p-8 rounded-[40px] border border-gray-200 shadow-sm hover:shadow-xl hover:border-blue-300 cursor-pointer transition-all group flex flex-col justify-between min-h-[280px]"
                    >
                        <div>
                            <div className="flex justify-between items-start mb-6">
                                <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                    PO #{po.po_number}
                                </span>
                                <div className="text-right">
                                    <p className="text-[9px] font-black uppercase text-gray-400">Total</p>
                                    <p className="text-lg font-black text-slate-900">${po.total_amount?.toFixed(2)}</p>
                                </div>
                            </div>
                            <h3 className="text-2xl font-black uppercase leading-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                                {po.vendors?.name}
                            </h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mt-2 tracking-widest">
                                Ordered {new Date(po.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        
                        <div className="mt-8 flex items-center justify-between border-t border-gray-50 pt-6">
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Intake Shipment →</span>
                            <div className="h-10 w-10 bg-gray-50 rounded-2xl flex items-center justify-center text-xl group-hover:bg-blue-600 group-hover:text-white transition-all">📥</div>
                        </div>
                    </div>
                ))
            )}
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-[48px] border border-gray-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* PO DETAIL HEADER */}
                <div className="p-10 bg-slate-900 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div>
                        <button onClick={() => setSelectedPO(null)} className="text-blue-400 font-black text-[10px] uppercase hover:text-white mb-2 tracking-widest flex items-center gap-1 transition-colors">
                            ← Cancel & Back
                        </button>
                        <h2 className="text-5xl font-black tracking-tighter">PO #{selectedPO.po_number}</h2>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                            <p className="text-blue-200 font-bold uppercase text-xs tracking-widest">{selectedPO.vendors?.name}</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-3">
                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Est. Shipment Total: ${selectedPO.total_amount?.toFixed(2)}</p>
                        <button 
                            onClick={receiveAll} 
                            disabled={processing}
                            className="bg-emerald-500 text-white px-10 py-5 rounded-[24px] font-black uppercase text-sm tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {processing ? 'Updating Warehouse...' : 'Accept All into Stock'}
                        </button>
                    </div>
                </div>
                
                {/* ITEMS TABLE */}
                <div className="p-6">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] border-b border-gray-100">
                                <th className="p-8">Garment / Color / SKU</th>
                                <th className="p-8 text-center">Inbound Qty</th>
                                <th className="p-8 text-right">Unit Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {poItems.map(item => (
                            <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="p-8">
                                    <div className="font-black text-slate-900 uppercase text-xl leading-none mb-2">
                                        {item.inventory_master?.item_name}
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-gray-200">
                                            {item.inventory_master?.color || 'No Color'}
                                        </span>
                                        <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-blue-100">
                                            Size {item.inventory_master?.size}
                                        </span>
                                        <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest self-center ml-2">
                                            {item.sku}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-8 text-center">
                                    <div className="inline-block bg-slate-100 px-6 py-3 rounded-2xl font-black text-3xl text-slate-900">
                                        {item.quantity}
                                    </div>
                                </td>
                                <td className="p-8 text-right font-black text-slate-400 text-xl tracking-tight">
                                    ${item.unit_cost?.toFixed(2)}
                                </td>
                            </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* FINAL FOOTER */}
                <div className="bg-slate-50 p-10 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-white rounded-2xl border border-gray-200 flex items-center justify-center text-2xl shadow-sm">🛡️</div>
                        <p className="text-[10px] font-bold text-gray-400 leading-tight uppercase tracking-widest max-w-[200px]">
                            Accepting this shipment will automatically update current Master Warehouse counts for all SKUs listed.
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Valuation</p>
                        <p className="text-4xl font-black text-slate-900 tracking-tighter">${selectedPO.total_amount?.toFixed(2)}</p>
                    </div>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
