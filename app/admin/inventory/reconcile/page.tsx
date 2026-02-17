'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function ReconcilePage() {
  const [eventSlug, setEventSlug] = useState('');
  const [eventStock, setEventStock] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    fetchActiveEvents();
  }, []);

  const fetchActiveEvents = async () => {
    const { data } = await supabase
      .from('event_settings')
      .select('slug, event_name')
      .eq('status', 'active')
      .order('event_name');
    setEvents(data || []);
  };

  const loadStock = async (slug: string) => {
    if (!slug) {
        setEventSlug('');
        setEventStock([]);
        return;
    };
    setEventSlug(slug);
    setFetching(true);
    const { data } = await supabase
      .from('inventory')
      .select('*, inventory_master(item_name)')
      .eq('event_slug', slug)
      .order('product_id');
    
    setEventStock(data || []);
    setFetching(false);
  };

  const endAndArchiveEvent = async () => {
    if (!eventSlug) return alert("Please select an event.");
    
    const totalItems = eventStock.reduce((sum, item) => sum + (item.count || 0), 0);
    const confirmMsg = `FINAL RECONCILIATION:\n\nThis will return ${totalItems} items to the Master Warehouse and permanently ARCHIVE this event kiosk.\n\nAre you sure you want to proceed?`;
    
    if (!confirm(confirmMsg)) return;

    setLoading(true);
    try {
      // 1. Return Stock to Warehouse (Loop through items)
      // Note: We use product_id + size as the composite key for inventory_master
      for (const item of eventStock) {
        if (item.count > 0) {
          const { data: master } = await supabase
            .from('inventory_master')
            .select('quantity_on_hand')
            .eq('sku', item.product_id)
            .eq('size', item.size)
            .maybeSingle();

          if (master) {
            await supabase
                .from('inventory_master')
                .update({ quantity_on_hand: (master.quantity_on_hand || 0) + item.count })
                .eq('sku', item.product_id)
                .eq('size', item.size);
          }
        }
      }

      // 2. Clear Event Inventory
      await supabase.from('inventory').delete().eq('event_slug', eventSlug);

      // 3. Mark Event as Archived
      const { error } = await supabase
        .from('event_settings')
        .update({ status: 'archived' })
        .eq('slug', eventSlug);

      if (error) throw error;

      alert("✅ Reconciliation Complete. Event Archived.");
      window.location.href = '/admin/events/history';

    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      
      {/* HEADER */}
      <div className="max-w-6xl mx-auto mb-10">
        <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase hover:underline mb-1 inline-block tracking-widest">
            ← Dashboard
        </Link>
        <h1 className="text-4xl font-black tracking-tight">Unload Truck & Close</h1>
        <p className="text-gray-500 font-medium">Reconcile unsold stock back to Master Warehouse and archive the event.</p>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COL: SELECTION & ACTIONS (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* STEP 1: SELECT */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">1. Select Active Truck</label>
            <select 
              className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer" 
              value={eventSlug}
              onChange={e => loadStock(e.target.value)}
            >
              <option value="">-- Active Events --</option>
              {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
            </select>
          </div>

          {/* STEP 2: SUMMARY & RECONCILE */}
          {eventSlug && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">2. Finalize Reconciliation</label>
              
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                    <span className="text-sm font-medium text-gray-500">Unsold Skus</span>
                    <span className="font-bold">{eventStock.length}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Total Units to Return</span>
                    <span className="text-2xl font-black text-blue-600">
                        {eventStock.reduce((sum, i) => sum + (i.count || 0), 0)}
                    </span>
                </div>
              </div>

              <button 
                onClick={endAndArchiveEvent}
                disabled={loading}
                className="w-full bg-red-600 text-white py-4 rounded-xl font-black uppercase text-sm tracking-widest hover:bg-red-700 shadow-lg shadow-red-100 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Unload & Archive'}
              </button>
              
              <p className="text-[10px] text-gray-400 text-center mt-4 font-medium leading-relaxed">
                Warning: This action will zero out kiosk stock and cannot be undone.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COL: STOCK PREVIEW (8 Cols) */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <span className="font-black uppercase text-[10px] tracking-widest">Inventory Remaining on Truck</span>
              {eventSlug && <span className="text-[10px] font-bold bg-slate-800 px-2 py-1 rounded">Slug: {eventSlug}</span>}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-black uppercase text-gray-400">
                        <th className="p-5 tracking-widest">Item Description</th>
                        <th className="p-5 tracking-widest">Size</th>
                        <th className="p-5 text-right tracking-widest pr-10">Returning Qty</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {fetching ? (
                        <tr>
                            <td colSpan={3} className="p-20 text-center">
                                <div className="inline-block animate-spin text-2xl mb-2">🔄</div>
                                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Scanning Truck...</p>
                            </td>
                        </tr>
                    ) : eventStock.length > 0 ? (
                    eventStock.map(s => (
                        <tr key={s.id} className="hover:bg-blue-50/20 transition-colors">
                        <td className="p-5">
                            <div className="font-bold text-gray-900 uppercase text-sm">{s.inventory_master?.item_name || s.product_id}</div>
                            <div className="text-[10px] font-mono text-blue-500 font-bold">{s.product_id}</div>
                        </td>
                        <td className="p-5">
                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-black uppercase">
                                {s.size}
                            </span>
                        </td>
                        <td className="p-5 text-right pr-10">
                            <span className="text-xl font-black text-slate-900">{s.count}</span>
                        </td>
                        </tr>
                    ))
                    ) : (
                    <tr>
                        <td colSpan={3} className="p-20 text-center">
                            <div className="text-gray-300 text-4xl mb-2">🚛</div>
                            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">
                                {eventSlug ? 'No stock records found for this event.' : 'Select a truck to preview stock.'}
                            </p>
                        </td>
                    </tr>
                    )}
                </tbody>
                </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}