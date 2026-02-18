'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase'; 
import Link from 'next/link';

export default function ReceivePO() {
  const [openPOs, setOpenPOs] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [poItems, setPoItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchOpenPOs();
  }, []);

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

  const loadPO = async (po) => {
    setSelectedPO(po);
    const { data } = await supabase
      .from('purchase_items')
      .select('*, inventory_master(item_name, size)')
      .eq('purchase_id', po.id);
    setPoItems(data || []);
  };

  const receiveAll = async () => {
    if (!confirm(`Confirm receipt of PO ${selectedPO.po_number}? This will update the Master Warehouse counts.`)) return;

    setProcessing(true);
    try {
      for (const item of poItems) {
        const { data: current } = await supabase.from('inventory_master').select('quantity_on_hand').eq('sku', item.sku).single();
        await supabase.from('inventory_master').update({
            quantity_on_hand: (current?.quantity_on_hand || 0) + item.quantity,
            cost_per_unit: item.unit_cost 
        }).eq('sku', item.sku);
      }

      await supabase.from('purchases').update({ status: 'received' }).eq('id', selectedPO.id);

      alert("✅ Inventory Successfully Added to Warehouse!");
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
      
      {/* HEADER SECTION */}
      <div className="max-w-7xl mx-auto mb-10">
        <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase hover:underline mb-2 inline-block tracking-widest">
            ← Dashboard
        </Link>
        <div className="flex justify-between items-end">
            <div>
                <h1 className="text-5xl font-black tracking-tighter uppercase leading-none">Receive Stock</h1>
                <p className="text-gray-400 font-bold mt-2 uppercase text-[10px] tracking-widest">Inbound Inventory & Warehouse Intake</p>
            </div>
            {!selectedPO && (
                <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest">
                    {openPOs.length} Pending Shipments
                </div>
            )}
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto">
        {!selectedPO ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
                <div className="col-span-full p-20 text-center animate-pulse font-black text-gray-300 uppercase tracking-widest">Scanning Database...</div>
            ) : openPOs.length === 0 ? (
                <div className="col-span-full text-center p-20 bg-white border border-gray-200 rounded-[40px] shadow-sm">
                    <div className="text-5xl mb-4">📦</div>
                    <p className="text-gray-400 font-black uppercase tracking-widest mb-6">All shipments have been received.</p>
                    <Link href="/admin/purchasing/create" className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:opacity-90">
                        Create New Purchase Order
                    </Link>
                </div>
            ) : (
                openPOs.map(po => (
                    <div 
                        key={po.id} 
                        onClick={() => loadPO(po)} 
                        className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl hover:scale-[1.02] cursor-pointer transition-all group"
                    >
                        <div className="flex justify-between items-start mb-6">
                            <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                PO #{po.po_number}
                            </span>
                            <span className="text-2xl font-black text-slate-900">${po.total_amount?.toFixed(2)}</span>
                        </div>
                        <h3 className="text-xl font-black uppercase leading-tight group-hover:text-blue-600 transition-colors">{po.vendors?.name}</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mt-1 tracking-widest">Ordered: {new Date(po.created_at).toLocaleDateString()}</p>
                        
                        <div className="mt-8 pt-6 border-t border-gray-50 flex justify-between items-center">
                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Review Items →</span>
                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                📦
                            </div>
                        </div>
                    </div>
                ))
            )}
            </div>
        ) : (
            <div className="bg-white rounded-[40px] border border-gray-100 shadow-2xl overflow-hidden">
                {/* PO DETAIL HEADER */}
                <div className="p-10 bg-slate-900 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <button onClick={() => setSelectedPO(null)} className="text-blue-400 font-black text-[10px] uppercase hover:underline mb-2 tracking-widest">
                            ← Back to Shipments
                        </button>
                        <h2 className="text-4xl font-black tracking-tighter">PO #{selectedPO.po_number}</h2>
                        <p className="text-blue-200 font-bold uppercase text-xs tracking-widest">{selectedPO.vendors?.name}</p>
                    </div>
                    <button 
                        onClick={receiveAll} 
                        disabled={processing}
                        className="bg-emerald-500 text-white px-10 py-5 rounded-2xl font-black uppercase text-sm tracking-widest shadow-lg shadow-emerald-900/20 hover:bg-emerald-400 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {processing ? 'Processing...' : 'Accept & Add to Stock'}
                    </button>
                </div>
                
                {/* ITEMS TABLE */}
                <div className="p-4">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                                <th className="p-8">Garment / Sku</th>
                                <th className="p-8 text-center">Inbound Qty</th>
                                <th className="p-8 text-right">Unit Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {poItems.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="p-8">
                                    <div className="font-black text-slate-900 uppercase text-lg leading-none mb-1">
                                        {item.inventory_master?.item_name}
                                    </div>
                                    <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">
                                        Size: {item.inventory_master?.size} • {item.sku}
                                    </div>
                                </td>
                                <td className="p-8 text-center font-black text-3xl text-slate-800">{item.quantity}</td>
                                <td className="p-8 text-right font-black text-slate-400 text-lg">
                                    ${item.unit_cost.toFixed(2)}
                                </td>
                            </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* FOOTER SUMMARY */}
                <div className="bg-gray-50 p-8 border-t border-gray-100 flex justify-end">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Shipment Value</p>
                        <p className="text-3xl font-black text-slate-900">${selectedPO.total_amount?.toFixed(2)}</p>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}