'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase';
import Link from 'next/link';

export default function VendorReturnHistory() {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReturnHistory();
  }, []);

  async function fetchReturnHistory() {
    const { data, error } = await supabase
      .from('vendor_returns')
      .select(`
        *,
        vendors (name),
        vendor_return_items (sku, quantity, unit_cost)
      `)
      .order('created_at', { ascending: false });

    if (!error) setReturns(data || []);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto">
        <Link href="/admin/inventory/return-to-vendor" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block">← Back to Returns</Link>
        
        <div className="flex justify-between items-end mb-10">
          <div>
            <h1 className="text-4xl font-black tracking-tight">Return History</h1>
            <p className="text-gray-500 font-medium font-black uppercase text-[10px] tracking-widest">Audit Trail • Tojojana, LLC</p>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-3xl" />)}
          </div>
        ) : (
          <div className="space-y-6">
            {returns.map((ret) => (
              <div key={ret.id} className="bg-white rounded-[32px] border border-gray-200 shadow-sm overflow-hidden">
                {/* HEADER ROW */}
                <div className="p-6 bg-slate-50 border-b border-gray-100 flex justify-between items-center">
                  <div>
                    <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mr-3">Return</span>
                    <span className="text-sm font-black text-slate-900">{ret.vendors?.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-gray-400">Date Processed</p>
                    <p className="text-xs font-bold">{new Date(ret.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* CONTENT ROW */}
                <div className="p-6 grid grid-cols-12 gap-6">
                  <div className="col-span-4">
                    <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Reference / RMA</p>
                    <p className="text-sm font-black text-blue-600">{ret.reference_num || 'No Ref'}</p>
                    
                    <div className="mt-4">
                      <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Notes</p>
                      <p className="text-xs text-gray-500 italic leading-relaxed">{ret.notes || 'No notes provided.'}</p>
                    </div>
                  </div>

                  <div className="col-span-5">
                     <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Items Sent Back</p>
                     <div className="space-y-2">
                        {ret.vendor_return_items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-xs bg-gray-50 p-2 rounded-xl">
                            <span className="font-bold">{item.sku}</span>
                            <span className="text-gray-500 font-medium">x{item.quantity} units</span>
                          </div>
                        ))}
                     </div>
                  </div>

                  <div className="col-span-3 flex flex-col justify-center items-end border-l border-gray-100 pl-6">
                    <p className="text-[10px] font-black uppercase text-gray-400">Total Credit Value</p>
                    <p className="text-3xl font-black text-red-500">-${Number(ret.total_value).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}

            {returns.length === 0 && (
              <div className="bg-white p-20 rounded-[40px] text-center border-2 border-dashed border-gray-200">
                <p className="text-gray-400 font-bold italic">No vendor returns found in the ledger.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}