'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function EventReportPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('event_settings').select('slug, event_name').order('id', { ascending: false })
      .then(({ data }) => { if (data) setEvents(data); });
  }, []);

  const generate = async () => {
    if (!selectedSlug) return;
    setLoading(true);

    const [{ data: orders }, { data: ledger }, { data: inventory }, { data: settings }] = await Promise.all([
      supabase.from('orders').select('*').eq('event_slug', selectedSlug).neq('status', 'refunded'),
      supabase.from('sales_ledger').select('*').eq('event_slug', selectedSlug),
      supabase.from('inventory').select('*').eq('event_slug', selectedSlug),
      supabase.from('event_settings').select('*').eq('slug', selectedSlug).single(),
    ]);

    if (!orders) { setLoading(false); return; }

    const paidOrders = orders.filter(o => o.payment_status === 'paid' || Number(o.total_price) === 0);
    const revenue = paidOrders.reduce((s, o) => s + Number(o.total_price || 0), 0);
    const cogs = (ledger || []).reduce((s, r) => s + (Number(r.cost_basis || 0) * Number(r.qty || 1)), 0);
    const profit = revenue - cogs;

    // Product breakdown
    const productMap: Record<string, { units: number; revenue: number }> = {};
    paidOrders.forEach(o => {
      (o.cart_data || []).forEach((item: any) => {
        const name = item.productName || 'Unknown';
        if (!productMap[name]) productMap[name] = { units: 0, revenue: 0 };
        productMap[name].units++;
        productMap[name].revenue += Number(item.finalPrice || 0);
      });
    });

    // Size breakdown
    const sizeMap: Record<string, number> = {};
    paidOrders.forEach(o => {
      (o.cart_data || []).forEach((item: any) => {
        if (item.size) sizeMap[item.size] = (sizeMap[item.size] || 0) + 1;
      });
    });

    // Site breakdown
    const siteMap: Record<string, { orders: number; revenue: number }> = {};
    paidOrders.forEach(o => {
      const site = o.site || 'Unknown';
      if (!siteMap[site]) siteMap[site] = { orders: 0, revenue: 0 };
      siteMap[site].orders++;
      siteMap[site].revenue += Number(o.total_price || 0);
    });

    // Personalization breakdown
    let nameCount = 0, numberCount = 0, rosterCount = 0, metallicCount = 0, accentCount = 0;
    paidOrders.forEach(o => {
      (o.cart_data || []).forEach((item: any) => {
        nameCount += item.customizations?.names?.length || 0;
        numberCount += item.customizations?.numbers?.length || 0;
        if (item.customizations?.backList) rosterCount++;
        if (item.customizations?.metallic) metallicCount++;
        accentCount += item.customizations?.logos?.length || 0;
      });
    });

    // Remaining inventory
    const remainingInv = (inventory || []).filter(i => i.active && i.count > 0);

    // Payment methods
    const paymentMap: Record<string, number> = {};
    paidOrders.forEach(o => {
      const method = o.payment_method || 'unknown';
      paymentMap[method] = (paymentMap[method] || 0) + 1;
    });

    // Ship to home
    const shipOrders = orders.filter(o => o.status === 'pending_shipping' || o.status === 'shipped');

    setReport({
      eventName: settings?.event_name || selectedSlug,
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      totalOrders: paidOrders.length,
      totalItems: paidOrders.reduce((s, o) => s + (o.cart_data?.length || 0), 0),
      revenue, cogs, profit,
      margin: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
      avgOrder: paidOrders.length > 0 ? revenue / paidOrders.length : 0,
      products: Object.entries(productMap).sort((a, b) => b[1].units - a[1].units),
      sizes: Object.entries(sizeMap).sort((a, b) => b[1] - a[1]),
      sites: Object.entries(siteMap).sort((a, b) => b[1].revenue - a[1].revenue),
      personalization: { nameCount, numberCount, rosterCount, metallicCount, accentCount },
      remainingInv,
      paymentMap,
      shipOrders: shipOrders.length,
      shipPending: shipOrders.filter(o => o.status === 'pending_shipping').length,
    });

    setLoading(false);
  };

  const printReport = () => window.print();

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-900 p-6" id="report-root">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>

      <div className="max-w-4xl mx-auto">
        <div className="no-print mb-8">
          <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase tracking-widest hover:underline">← Command Center</Link>
          <h1 className="text-4xl font-black mt-2 mb-6">📋 End of Event Report</h1>
          <div className="flex gap-3">
            <select className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold bg-white focus:outline-none focus:border-blue-400"
              value={selectedSlug} onChange={e => setSelectedSlug(e.target.value)}>
              <option value="">— Select Event —</option>
              {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
            </select>
            <button onClick={generate} disabled={!selectedSlug || loading}
              className="bg-slate-900 hover:bg-slate-700 text-white font-black px-6 rounded-xl disabled:opacity-40 transition-all">
              {loading ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>

        {report && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-slate-900 text-white rounded-3xl p-8">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">End of Event Report</p>
                  <h2 className="text-4xl font-black mt-1">{report.eventName}</h2>
                  <p className="text-slate-400 mt-1">Generated {report.date}</p>
                </div>
                <button onClick={printReport} className="no-print bg-white/10 hover:bg-white/20 text-white font-black px-4 py-2 rounded-xl text-sm transition-all">
                  🖨️ Print
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                {[
                  { label: 'Orders', value: report.totalOrders },
                  { label: 'Items Sold', value: report.totalItems },
                  { label: 'Revenue', value: `$${report.revenue.toFixed(2)}` },
                  { label: 'Est. Profit', value: `$${report.profit.toFixed(2)}` },
                ].map(s => (
                  <div key={s.label} className="bg-white/10 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-black">{s.value}</p>
                    <p className="text-slate-400 text-xs uppercase tracking-widest mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Financial Summary */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-black text-lg mb-4">💰 Financials</h3>
                {[
                  ['Revenue', `$${report.revenue.toFixed(2)}`],
                  ['Cost of Goods', `$${report.cogs.toFixed(2)}`],
                  ['Gross Profit', `$${report.profit.toFixed(2)}`],
                  ['Margin', `${report.margin}%`],
                  ['Avg Order Value', `$${report.avgOrder.toFixed(2)}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-gray-500 text-sm">{label}</span>
                    <span className="font-black text-sm">{value}</span>
                  </div>
                ))}
              </div>

              {/* Personalization */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-black text-lg mb-4">✏️ Personalization</h3>
                {[
                  ['Names Added', report.personalization.nameCount],
                  ['Numbers Added', report.personalization.numberCount],
                  ['Roster List', report.personalization.rosterCount],
                  ['Metallic Star', report.personalization.metallicCount],
                  ['Accent Add-Ons', report.personalization.accentCount],
                  ['Ship to Home', report.shipOrders],
                  ['Pending Shipment', report.shipPending],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-gray-500 text-sm">{label}</span>
                    <span className="font-black text-sm">{value}</span>
                  </div>
                ))}
              </div>

              {/* Products */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-black text-lg mb-4">👕 Products Sold</h3>
                {report.products.map(([name, data]: [string, any]) => (
                  <div key={name} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700 truncate pr-2">{name}</span>
                    <div className="text-right shrink-0">
                      <span className="font-black text-sm">{data.units} units</span>
                      <span className="text-gray-400 text-xs ml-2">${data.revenue.toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sizes */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-black text-lg mb-4">📐 Size Breakdown</h3>
                {report.sizes.map(([size, count]: [string, number]) => {
                  const total = report.totalItems;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={size} className="flex items-center gap-3 py-1.5">
                      <span className="text-xs font-black text-gray-500 w-10 text-right">{size}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-black w-16 text-right">{count} <span className="text-gray-400">({pct}%)</span></span>
                    </div>
                  );
                })}
              </div>

              {/* Sites */}
              {report.sites.length > 1 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-black text-lg mb-4">📍 By Site</h3>
                  {report.sites.map(([site, data]: [string, any]) => (
                    <div key={site} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-700">{site}</span>
                      <div className="text-right">
                        <span className="font-black text-sm">{data.orders} orders</span>
                        <span className="text-gray-400 text-xs ml-2">${data.revenue.toFixed(0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Remaining Inventory */}
              {report.remainingInv.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-black text-lg mb-4">📦 Remaining Inventory</h3>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {report.remainingInv.sort((a: any, b: any) => b.count - a.count).map((i: any) => (
                      <div key={i.product_id} className="flex justify-between text-sm py-1 border-b border-gray-50">
                        <span className="text-gray-600 truncate pr-2 text-xs">{i.product_id.split('|')[0]?.trim()} — {i.size}</span>
                        <span className="font-black text-xs shrink-0">{i.count} left</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Methods */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-black text-lg mb-4">💳 Payment Methods</h3>
                {Object.entries(report.paymentMap).map(([method, count]: [string, any]) => (
                  <div key={method} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700 capitalize">{method.replace(/_/g, ' ')}</span>
                    <span className="font-black text-sm">{count} orders</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
