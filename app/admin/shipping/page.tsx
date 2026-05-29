'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function ShippingDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'shipped' | 'all'>('pending');
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => { fetchOrders(); }, [filter]);

  const fetchOrders = async () => {
    setLoading(true);
    let query = supabase
      .from('orders')
      .select('*')
      .not('shipping_address', 'is', null)
      .order('created_at', { ascending: false });
    if (filter === 'pending') query = query.eq('status', 'pending_shipping');
    if (filter === 'shipped') query = query.eq('status', 'shipped');
    const { data } = await query;
    setOrders(data || []);
    setLoading(false);
  };

  const markShipped = async (orderId: string) => {
    setSaving(prev => ({ ...prev, [orderId]: true }));
    const tracking = trackingInputs[orderId] || '';
    await supabase.from('orders').update({
      status: 'shipped',
      ...(tracking ? { tracking_number: tracking } : {})
    }).eq('id', orderId);
    await fetchOrders();
    setSaving(prev => ({ ...prev, [orderId]: false }));
  };

  const pendingCount = orders.filter(o => o.status === 'pending_shipping').length;

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/admin" className="text-[10px] font-black uppercase text-blue-600 tracking-widest hover:underline">← Command Center</Link>
            <h1 className="text-4xl font-black tracking-tight mt-1">🚚 Ship to Home</h1>
          </div>
          <div className="flex gap-2">
            {(['pending', 'shipped', 'all'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${filter === f ? 'bg-slate-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                {f === 'pending' ? `Pending${pendingCount > 0 && filter !== 'pending' ? ` (${pendingCount})` : ''}` : f}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        {filter === 'pending' && !loading && (
          <div className={`mb-6 p-4 rounded-2xl font-bold text-sm ${orders.length > 0 ? 'bg-orange-50 border border-orange-200 text-orange-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
            {orders.length > 0 ? `⚠️ ${orders.length} order${orders.length > 1 ? 's' : ''} waiting to be shipped` : '✅ All caught up! No pending shipments.'}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 font-bold text-gray-400 animate-pulse">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 font-bold text-gray-400">No orders found.</div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const shippingItems = (order.cart_data || []).filter((i: any) => i.needsShipping);
              const allItems = order.cart_data || [];
              return (
                <div key={order.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${order.status === 'pending_shipping' ? 'border-orange-200' : 'border-gray-200'}`}>
                  {/* Order header */}
                  <div className={`px-6 py-4 flex justify-between items-center ${order.status === 'pending_shipping' ? 'bg-orange-50' : 'bg-gray-50'}`}>
                    <div>
                      <p className="font-black text-lg">{order.customer_name}</p>
                      <p className="text-xs text-gray-500">{order.email} · {order.phone} · {new Date(order.created_at).toLocaleDateString()}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{order.event_name} · #{String(order.id).slice(0, 8)}</p>
                    </div>
                    <span className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider ${order.status === 'pending_shipping' ? 'bg-orange-200 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                      {order.status === 'pending_shipping' ? '⏳ Pending' : '✅ Shipped'}
                    </span>
                  </div>

                  <div className="px-6 py-4">
                    {/* Ship-to address */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 text-sm">
                      <p className="font-black text-blue-800 text-xs uppercase tracking-wider mb-1">Ship To</p>
                      <p className="text-slate-700 font-medium">{order.shipping_address}<br/>{order.shipping_city}, {order.shipping_state} {order.shipping_zip}</p>
                    </div>

                    {/* Items to ship */}
                    <p className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Items to Ship</p>
                    <div className="space-y-2 mb-4">
                      {(shippingItems.length > 0 ? shippingItems : allItems).map((item: any, i: number) => (
                        <div key={i} className="flex justify-between items-start text-sm bg-gray-50 rounded-xl px-4 py-3">
                          <div>
                            <p className="font-bold">{item.productName} <span className="text-gray-500">· {item.size}</span></p>
                            {item.customizations?.mainDesign && <p className="text-xs text-gray-500">Design: {item.customizations.mainDesign}</p>}
                            {(item.customizations?.logos || []).length > 0 && (
                              <p className="text-xs text-gray-500">Add-Ons: {item.customizations.logos.map((l: any) => l.type).join(', ')}</p>
                            )}
                            {(item.customizations?.names || []).length > 0 && (
                              <p className="text-xs text-gray-500">Names: {item.customizations.names.map((n: any) => n.text).join(', ')}</p>
                            )}
                          </div>
                          <span className="font-black text-blue-700">${Number(item.finalPrice || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Tracking + Mark Shipped */}
                    {order.status === 'pending_shipping' && (
                      <div className="flex gap-2 mt-2">
                        <input
                          className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-300"
                          placeholder="Tracking number (optional)"
                          value={trackingInputs[order.id] || ''}
                          onChange={e => setTrackingInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                        />
                        <button
                          onClick={() => markShipped(order.id)}
                          disabled={saving[order.id]}
                          className="bg-green-600 hover:bg-green-700 text-white font-black px-6 py-2 rounded-xl text-sm disabled:opacity-50 transition-all">
                          {saving[order.id] ? 'Saving...' : '✅ Mark Shipped'}
                        </button>
                      </div>
                    )}

                    {order.status === 'shipped' && order.tracking_number && (
                      <p className="text-xs text-gray-500 mt-2">📦 Tracking: <span className="font-bold">{order.tracking_number}</span></p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
