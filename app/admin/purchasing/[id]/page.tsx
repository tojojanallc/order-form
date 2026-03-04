'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/supabase';

type POStatus = 'ordered' | 'received' | 'cancelled' | 'draft';

type PurchaseOrder = {
  id: string;
  po_number: string;
  created_at: string;
  total_amount: number;
  status: POStatus;
  vendors?: { name: string } | null;
};

type PurchaseItem = {
  id: string;
  sku: string;
  quantity: number;
  unit_cost: number;
  inventory_master?: { item_name: string; size: string; color: string } | null;
};

export default function PurchaseOrderViewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: poData, error: poErr } = await supabase
          .from('purchases')
          .select('*, vendors(name)')
          .eq('id', id)
          .maybeSingle();

        if (poErr) throw poErr;
        if (!poData) {
          setPo(null);
          setItems([]);
          return;
        }

        const { data: itemData, error: itemErr } = await supabase
          .from('purchase_items')
          .select('*, inventory_master(item_name, size, color)')
          .eq('purchase_id', id)
          .order('sku');

        if (itemErr) throw itemErr;

        setPo(poData as any);
        setItems((itemData as any) || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load PO');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const totalComputed = useMemo(() => {
    return items.reduce((sum, i) => sum + (Number(i.quantity || 0) * Number(i.unit_cost || 0)), 0);
  }, [items]);

  const cancelPO = async () => {
    if (!po) return;
    if (!confirm(`Cancel PO #${po.po_number}? This cannot be undone.`)) return;

    setProcessing(true);
    try {
      const { error: updErr } = await supabase
        .from('purchases')
        .update({ status: 'cancelled' })
        .eq('id', po.id);

      if (updErr) throw updErr;
      setPo({ ...po, status: 'cancelled' });
    } catch (e: any) {
      alert('Error cancelling PO: ' + (e?.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  const deletePO = async () => {
    if (!po) return;
    if (!confirm(`Delete PO #${po.po_number} permanently?`)) return;

    setProcessing(true);
    try {
      await supabase.from('purchase_items').delete().eq('purchase_id', po.id);
      await supabase.from('purchases').delete().eq('id', po.id);

      alert('✅ PO deleted');
      router.push('/admin/purchasing/manage');
    } catch (e: any) {
      alert('Error deleting PO: ' + (e?.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
        <div className="max-w-5xl mx-auto font-bold text-gray-400">LOADING PO...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
        <div className="max-w-5xl mx-auto">
          <Link href="/admin/purchasing/manage" className="text-blue-600 font-bold text-xs uppercase tracking-widest hover:underline">
            ← Back to Manage POs
          </Link>
          <div className="mt-6 bg-white p-6 rounded-3xl border border-gray-200">
            <div className="font-black text-red-600">Error</div>
            <div className="text-sm text-gray-600 mt-2">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
        <div className="max-w-5xl mx-auto">
          <Link href="/admin/purchasing/manage" className="text-blue-600 font-bold text-xs uppercase tracking-widest hover:underline">
            ← Back to Manage POs
          </Link>
          <div className="mt-6 bg-white p-6 rounded-3xl border border-gray-200 font-bold text-gray-500">
            PO not found.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <Link href="/admin/purchasing/manage" className="text-blue-600 font-bold text-xs uppercase tracking-widest hover:underline">
              ← Back to Manage POs
            </Link>
            <h1 className="text-4xl font-black tracking-tight mt-2">PO #{po.po_number}</h1>
            <p className="text-gray-500 font-medium">
              {po.vendors?.name || 'Unknown Vendor'} • {new Date(po.created_at).toLocaleDateString()}
            </p>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</div>
            <div className="mt-1 font-black">
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
                  ${po.status === 'received' ? 'bg-green-100 text-green-700' :
                    po.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                    'bg-orange-100 text-orange-600'}
                `}
              >
                {po.status}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[32px] border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <div className="font-black text-slate-900">Line Items</div>
            <div className="flex gap-2">
              {po.status === 'ordered' && (
                <>
                  <Link
                    href="/admin/purchasing/receive"
                    className="px-4 py-2 rounded-xl bg-gray-50 text-slate-700 font-black text-[10px] uppercase tracking-widest hover:bg-gray-200"
                  >
                    Receive Stock
                  </Link>

                  <button
                    onClick={cancelPO}
                    disabled={processing}
                    className="px-4 py-2 rounded-xl border border-orange-200 text-orange-600 font-black text-[10px] uppercase tracking-widest hover:bg-orange-50 disabled:opacity-50"
                  >
                    Cancel PO
                  </button>

                  <button
                    onClick={deletePO}
                    disabled={processing}
                    className="px-4 py-2 rounded-xl border border-red-200 text-red-600 font-black text-[10px] uppercase tracking-widest hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete PO
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white">
                <tr className="text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
                  <th className="p-6">SKU</th>
                  <th className="p-6">Item</th>
                  <th className="p-6">Size</th>
                  <th className="p-6">Color</th>
                  <th className="p-6 text-right">Qty</th>
                  <th className="p-6 text-right">Unit Cost</th>
                  <th className="p-6 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center font-bold text-gray-400 italic">
                      No items found for this PO.
                    </td>
                  </tr>
                ) : (
                  items.map((it) => {
                    const qty = Number(it.quantity || 0);
                    const unit = Number(it.unit_cost || 0);
                    const lineTotal = qty * unit;

                    return (
                      <tr key={it.id} className="hover:bg-blue-50/30 transition-all">
                        <td className="p-6 font-mono text-xs font-black text-slate-700">{it.sku}</td>
                        <td className="p-6 font-bold text-slate-900">{it.inventory_master?.item_name || 'Unknown Item'}</td>
                        <td className="p-6 text-sm font-bold text-gray-600">{it.inventory_master?.size || '—'}</td>
                        <td className="p-6 text-sm font-bold text-gray-600">{it.inventory_master?.color || '—'}</td>
                        <td className="p-6 text-right font-black">{qty}</td>
                        <td className="p-6 text-right font-black">${unit.toFixed(2)}</td>
                        <td className="p-6 text-right font-black text-slate-900">${lineTotal.toFixed(2)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-100">
                  <td colSpan={6} className="p-6 text-right text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Total
                  </td>
                  <td className="p-6 text-right text-xl font-black text-green-600">
                    ${(Number(po.total_amount ?? totalComputed)).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="text-xs text-gray-400 font-medium mt-4">
          Note: displayed total uses <code className="font-mono">purchases.total_amount</code> when present; otherwise it sums line items.
        </div>
      </div>
    </div>
  );
}
