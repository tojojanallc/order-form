'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function ReceivePO() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [openPOs, setOpenPOs] = useState<any[]>([]);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [poItems, setPoItems] = useState<any[]>([]);
  const [sellPrices, setSellPrices] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserEmail(user.email ?? 'Admin') });
    fetchOpenPOs();
  }, []);

  async function fetchOpenPOs() {
    setLoading(true);
    // Pull from both kiosk purchases and portal lev_purchase_orders
    const [{ data: kioskPOs }, { data: portalPOs }] = await Promise.all([
      supabase.from('purchases').select('*, vendors(name)').eq('status', 'ordered').order('created_at', { ascending: false }),
      supabase.from('lev_purchase_orders').select('*, vendor, vendor_email, items, subtotal, shipping, total').in('status', ['ordered', 'submitted', 'pending']).order('created_at', { ascending: false }),
    ]);
    const combined = [
      ...(kioskPOs || []).map((p: any) => ({ ...p, _source: 'kiosk' })),
      ...(portalPOs || []).map((p: any) => ({ ...p, _source: 'portal', po_number: p.po_number, vendors: { name: p.vendor } })),
    ];
    setOpenPOs(combined);
    setLoading(false);
  }

  const loadPO = async (po: any) => {
    setSelectedPO(po);
    setSellPrices({});

    if (po._source === 'kiosk') {
      const { data } = await supabase.from('purchase_items').select('*, inventory_master(item_name, size, color, base_price)').eq('purchase_id', po.id);
      setPoItems((data || []).map((item: any) => ({
        sku: item.sku, description: item.inventory_master?.item_name || 'Item', size: item.inventory_master?.size,
        color: item.inventory_master?.color, quantity: item.quantity, unit_cost: item.unit_cost, _source: 'kiosk', _raw: item,
      })));
    } else {
      // Portal PO — expand sizeQtys into individual rows
      const rows: any[] = [];
      for (const li of (po.items || [])) {
        const sizeQtys = li.sizeQtys || {};
        const sizeCosts = li.sizeCosts || {};
        if (Object.keys(sizeQtys).length === 0) {
          rows.push({ sku: li.style || li.description?.slice(0, 10), description: li.description, size: 'OS', color: li.color || '', quantity: li.qty || 1, unit_cost: li.unit_cost || 0, _source: 'portal', _li: li });
        } else {
          for (const [sz, qty] of Object.entries(sizeQtys)) {
            if ((qty as number) <= 0) continue;
            rows.push({ sku: `${li.style || 'ITEM'}-${sz}`, description: li.description, size: sz, color: li.color || '', quantity: qty as number, unit_cost: sizeCosts[sz] || li.unit_cost || 0, _source: 'portal', _li: li });
          }
        }
      }
      setPoItems(rows);
    }
  };

  const receiveAll = async () => {
    if (!confirm(`Confirm receipt of PO ${selectedPO.po_number}?`)) return;
    setProcessing(true);
    try {
      for (const item of poItems) {
        const sellPrice = sellPrices[`${item.sku}-${item.size}`] || sellPrices[item.sku] || 0;

        // Upsert into global catalog
        await supabase.from('products').upsert({ id: item.sku, name: item.description, base_price: sellPrice, type: 'apparel' }, { onConflict: 'id' });

        // Add to inventory_master
        const { data: current } = await supabase.from('inventory_master').select('quantity_on_hand').eq('sku', item.sku).eq('size', item.size).maybeSingle();
        await supabase.from('inventory_master').upsert({
          sku: item.sku, item_name: item.description, size: item.size, color: item.color || '',
          quantity_on_hand: (current?.quantity_on_hand || 0) + item.quantity,
          cost_price: item.unit_cost, selling_price: sellPrice, base_price: sellPrice,
        }, { onConflict: 'sku,size' });
      }

      // Mark PO as received
      if (selectedPO._source === 'kiosk') {
        await supabase.from('purchases').update({ status: 'received' }).eq('id', selectedPO.id);
      } else {
        await supabase.from('lev_purchase_orders').update({ status: 'received' }).eq('id', selectedPO.id);
      }

      alert('✅ Stock received and added to warehouse!');
      setSelectedPO(null);
      setPoItems([]);
      fetchOpenPOs();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/admin" className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] hover:underline">← Back to Command Center</Link>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 mt-1">Receive Stock</h1>
          </div>
          <div className="flex items-center gap-4 bg-white p-2 px-5 rounded-3xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-slate-900">{userEmail}</p>
            <div className="h-8 w-[1px] bg-gray-100 mx-1"></div>
            <div className="h-10 w-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-xs font-black">LC</div>
          </div>
        </div>

        {!selectedPO ? (
          loading ? (
            <div className="text-center py-20 text-gray-400 font-black text-xl">Loading...</div>
          ) : openPOs.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📦</div>
              <div className="font-black text-2xl text-slate-900 mb-2">No POs to Receive</div>
              <div className="text-gray-400 text-sm">Create a PO in the <a href="https://portal.levcustom.com/admin/purchase-orders/new" target="_blank" className="text-blue-500 underline">Lev Portal</a></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {openPOs.map(po => (
                <div key={po.id} onClick={() => loadPO(po)} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-300 cursor-pointer transition-all flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">PO #{po.po_number}</span>
                      {po._source === 'portal' && <span className="bg-purple-50 text-purple-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">Portal</span>}
                    </div>
                    <h3 className="text-2xl font-black uppercase leading-tight">{po.vendors?.name || po.vendor}</h3>
                    <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-widest">
                      {new Date(po.created_at).toLocaleDateString()} · {(po.items || []).length} items
                    </p>
                  </div>
                  <div className="mt-8 border-t border-gray-50 pt-6 flex justify-between items-center">
                    <span className="text-xs font-black text-slate-900">${Number(po.total || po.total_amount || 0).toFixed(2)}</span>
                    <div className="h-10 w-10 bg-gray-50 rounded-2xl flex items-center justify-center text-xl">📥</div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-[48px] border border-gray-200 shadow-2xl overflow-hidden">
              <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
                <div>
                  <button onClick={() => { setSelectedPO(null); setPoItems([]) }} className="text-blue-400 font-black text-[10px] uppercase mb-2 hover:text-white transition-colors">← Cancel</button>
                  <h2 className="text-5xl font-black tracking-tighter uppercase">PO #{selectedPO.po_number}</h2>
                  <p className="text-blue-200 font-bold uppercase text-xs tracking-widest">{selectedPO.vendors?.name || selectedPO.vendor}</p>
                </div>
                <button onClick={receiveAll} disabled={processing}
                  className="bg-emerald-500 text-white px-10 py-5 rounded-[24px] font-black uppercase text-sm tracking-widest shadow-lg hover:bg-emerald-400 active:scale-95 transition-all disabled:opacity-50">
                  {processing ? 'Processing...' : 'Accept All into Stock ✓'}
                </button>
              </div>
              <div className="p-4">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] border-b border-gray-100">
                      <th className="p-8">Item</th>
                      <th className="p-8 text-center">Size</th>
                      <th className="p-8 text-center">Qty</th>
                      <th className="p-8 text-center">Unit Cost</th>
                      <th className="p-8 text-right">Set Sell Price ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {poItems.map((item, i) => (
                      <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-8">
                          <div className="font-black text-slate-900 uppercase text-lg leading-tight mb-1">{item.description}</div>
                          <div className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">{item.color} · {item.sku}</div>
                        </td>
                        <td className="p-8 text-center font-black text-xl text-slate-900">{item.size}</td>
                        <td className="p-8 text-center font-black text-3xl text-slate-900">{item.quantity}</td>
                        <td className="p-8 text-center font-black text-slate-400 text-lg">${Number(item.unit_cost).toFixed(2)}</td>
                        <td className="p-8 text-right">
                          <div className="relative inline-block">
                            <span className="absolute left-4 top-4 font-black text-slate-300">$</span>
                            <input type="number" className="w-32 p-4 pl-8 bg-gray-50 rounded-2xl border-none outline-none font-black text-xl text-right focus:ring-2 focus:ring-blue-500 transition-all"
                              value={sellPrices[`${item.sku}-${item.size}`] || sellPrices[item.sku] || ''}
                              onChange={e => setSellPrices(p => ({ ...p, [`${item.sku}-${item.size}`]: parseFloat(e.target.value) || 0 }))}
                              placeholder="0.00" />
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
