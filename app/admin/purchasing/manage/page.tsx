'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function ManagePOsPage() {
  const [pos, setPos] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [items, setItems] = useState<Record<number, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('purchase_orders').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setPos(data); setLoading(false); });
  }, []);

  const loadItems = async (poId: number) => {
    if (items[poId]) { setExpanded(expanded === poId ? null : poId); return; }
    const { data } = await supabase.from('purchase_order_items').select('*').eq('po_id', poId).order('product_name');
    if (data) setItems({ ...items, [poId]: data });
    setExpanded(poId);
  };

  const statusColor = (s: string) => ({ draft: 'bg-yellow-100 text-yellow-700', ordered: 'bg-blue-100 text-blue-700', received: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-600' }[s] || 'bg-gray-100 text-gray-600');

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase tracking-widest hover:underline">← Command Center</Link>
        <div className="flex justify-between items-center mt-2 mb-8">
          <h1 className="text-4xl font-black">📋 Purchase Orders</h1>
          <Link href="/admin/purchasing/ss" className="bg-slate-900 text-white font-black px-5 py-2 rounded-xl text-sm hover:bg-slate-700 transition-all">+ New S&S Order</Link>
        </div>

        {loading ? <p className="text-gray-400 animate-pulse">Loading...</p> : pos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400 font-bold">No purchase orders yet.</div>
        ) : (
          <div className="space-y-3">
            {pos.map(po => (
              <div key={po.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50" onClick={() => loadItems(po.id)}>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-black text-lg">{po.po_number}</p>
                      <p className="text-xs text-gray-400">{po.supplier} · {new Date(po.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      {po.event_slug && <p className="text-xs text-blue-500 mt-0.5">📅 {po.event_slug}</p>}
                      {po.notes && <p className="text-xs text-gray-400 mt-0.5">{po.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-black text-xl text-green-700">${Number(po.total_cost).toFixed(2)}</p>
                    </div>
                    <span className={`text-xs font-black px-3 py-1 rounded-full ${statusColor(po.status)}`}>{po.status}</span>
                    <span className="text-gray-400">{expanded === po.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {expanded === po.id && items[po.id] && (
                  <div className="border-t border-gray-100">
                    {/* Status update */}
                    <div className="px-5 py-3 bg-gray-50 border-b flex gap-2">
                      {['draft','ordered','received','cancelled'].map(s => (
                        <button key={s} onClick={async () => {
                          await supabase.from('purchase_orders').update({ status: s }).eq('id', po.id);
                          setPos(pos.map(p => p.id === po.id ? { ...p, status: s } : p));
                        }} className={`text-xs font-black px-3 py-1 rounded-full transition-all ${po.status === s ? statusColor(s) : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}>
                          {s}
                        </button>
                      ))}
                    </div>

                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left p-3 text-xs font-black uppercase tracking-wider text-gray-400">Product</th>
                          <th className="text-left p-3 text-xs font-black uppercase tracking-wider text-gray-400">Color</th>
                          <th className="text-center p-3 text-xs font-black uppercase tracking-wider text-gray-400">Size</th>
                          <th className="text-center p-3 text-xs font-black uppercase tracking-wider text-gray-400">Qty</th>
                          <th className="text-right p-3 text-xs font-black uppercase tracking-wider text-gray-400">Unit</th>
                          <th className="text-right p-3 text-xs font-black uppercase tracking-wider text-gray-400">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {items[po.id].map((item, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                {item.image_url && <img src={item.image_url} alt="" className="w-8 h-8 object-cover rounded shrink-0" />}
                                <span className="font-bold text-xs">{item.product_name}</span>
                              </div>
                            </td>
                            <td className="p-3 text-xs text-gray-600">{item.color_name}</td>
                            <td className="p-3 text-center font-black text-xs">{item.size}</td>
                            <td className="p-3 text-center font-black">{item.qty}</td>
                            <td className="p-3 text-right text-xs text-gray-500">${Number(item.unit_cost).toFixed(2)}</td>
                            <td className="p-3 text-right font-black text-green-700">${Number(item.total_cost).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-gray-200">
                        <tr>
                          <td colSpan={5} className="p-3 font-black text-right text-sm">Total</td>
                          <td className="p-3 font-black text-right text-green-700">${Number(po.total_cost).toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
