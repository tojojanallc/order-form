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

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setExpanded(e => ({ ...e, [key]: !e[key] }));

  const generate = async () => {
    if (!selectedSlug) return;
    setLoading(true);

    const [{ data: orders }, { data: ledger }, { data: inventory }, { data: settings }, { data: staffHrs }, { data: expData }] = await Promise.all([
      supabase.from('orders').select('*').eq('event_slug', selectedSlug).neq('status', 'refunded'),
      supabase.from('sales_ledger').select('*').eq('event_slug', selectedSlug),
      supabase.from('inventory').select('*').eq('event_slug', selectedSlug),
      supabase.from('event_settings').select('*').eq('slug', selectedSlug).single(),
      supabase.from('staff_hours').select('*').eq('event_slug', selectedSlug),
      supabase.from('event_expenses').select('*').eq('event_slug', selectedSlug),
    ]);

    if (!orders) { setLoading(false); return; }

    const paidOrders = orders.filter(o => o.payment_status === 'paid' || Number(o.total_price) === 0);
    const revenue = paidOrders.reduce((s, o) => s + Number(o.total_price || 0), 0);
    const cogs = (ledger || []).reduce((s, r) => s + (Number(r.cost_basis || 0) * Number(r.qty || 1)), 0);
    const staffCost = (staffHrs || []).reduce((s, r) => s + (Number(r.hours) * Number(r.rate || 0)), 0);
    const staffHoursTotal = (staffHrs || []).reduce((s, r) => s + Number(r.hours), 0);
    const otherExpenses = (expData || []).reduce((s, r) => s + Number(r.amount), 0);
    const grossProfit = revenue - cogs;
    const profit = grossProfit - staffCost - otherExpenses;

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

    // Revenue by day
    const revenueByDay: Record<string, number> = {};
    paidOrders.forEach(o => {
      const day = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      revenueByDay[day] = (revenueByDay[day] || 0) + Number(o.total_price || 0);
    });

    // Revenue by site
    const revenueBySite: Record<string, number> = {};
    paidOrders.forEach(o => {
      const site = o.site || 'Unknown';
      revenueBySite[site] = (revenueBySite[site] || 0) + Number(o.total_price || 0);
    });

    // COGS by product
    const cogsByProduct: Record<string, { units: number; cost: number }> = {};
    (ledger || []).forEach(r => {
      const name = r.product_name || r.product_id || 'Unknown';
      if (!cogsByProduct[name]) cogsByProduct[name] = { units: 0, cost: 0 };
      cogsByProduct[name].units += Number(r.qty || 1);
      cogsByProduct[name].cost += Number(r.cost_basis || 0) * Number(r.qty || 1);
    });

    // Staff detail
    const staffDetail = (staffHrs || []).map(r => ({
      name: r.staff_name,
      date: r.date,
      hours: Number(r.hours),
      rate: Number(r.rate || 0),
      cost: Number(r.hours) * Number(r.rate || 0),
      start_time: r.start_time,
      end_time: r.end_time,
    }));

    // Ship to home
    const shipOrders = orders.filter(o => o.status === 'pending_shipping' || o.status === 'shipped');

    setReport({
      eventName: settings?.event_name || selectedSlug,
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      totalOrders: paidOrders.length,
      totalItems: paidOrders.reduce((s, o) => s + (o.cart_data?.length || 0), 0),
      revenue, cogs, grossProfit, staffCost, staffHoursTotal, otherExpenses, profit,
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
      customerList: paidOrders.map(o => ({
        id: o.id,
        name: o.customer_name,
        phone: o.phone,
        total: Number(o.total_price || 0),
        items: (o.cart_data || []).length,
        site: o.site,
        status: o.status,
        date: o.created_at,
        cart: o.cart_data || [],
      })).sort((a, b) => a.name?.localeCompare(b.name)),
      // Detailed breakdowns
      revenueByDay: Object.entries(revenueByDay),
      revenueBySite: Object.entries(revenueBySite).sort((a, b) => b[1] - a[1]),
      cogsByProduct: Object.entries(cogsByProduct).sort((a, b) => b[1].cost - a[1].cost),
      staffDetail,
      expenseDetail: expData || [],
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
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <h3 className="font-black text-lg p-6 pb-0">💰 Financials</h3>
                {[
                  { key: 'revenue', label: 'Revenue', value: `$${report.revenue.toFixed(2)}`, color: 'text-green-700',
                    detail: (
                      <div className="px-6 pb-4 space-y-1">
                        {report.revenueByDay.map(([day, amt]: [string, any]) => (
                          <div key={day} className="flex justify-between text-sm py-1 border-b border-gray-50">
                            <span className="text-gray-500">{day}</span><span className="font-bold">${Number(amt).toFixed(2)}</span>
                          </div>
                        ))}
                        {report.revenueBySite.length > 1 && report.revenueBySite.map(([site, amt]: [string, any]) => (
                          <div key={site} className="flex justify-between text-sm py-1 border-b border-gray-50">
                            <span className="text-gray-500">📍 {site}</span><span className="font-bold">${Number(amt).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )
                  },
                  { key: 'cogs', label: 'Cost of Goods Sold', value: `$${report.cogs.toFixed(2)}`, color: 'text-red-600',
                    detail: (
                      <div className="px-6 pb-4 space-y-1">
                        {report.cogsByProduct.map(([name, data]: [string, any]) => (
                          <div key={name} className="flex justify-between text-sm py-1 border-b border-gray-50">
                            <span className="text-gray-500 truncate pr-2">{name}</span>
                            <span className="font-bold shrink-0">{data.units} × ${(data.cost / data.units).toFixed(2)} = ${data.cost.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )
                  },
                  { key: 'gross', label: 'Gross Profit', value: `$${report.grossProfit.toFixed(2)}`, color: 'text-blue-700', bold: true, noDetail: true },
                  { key: 'staff', label: `Staff Labor (${report.staffHoursTotal} hrs)`, value: `$${report.staffCost.toFixed(2)}`, color: 'text-red-600',
                    detail: (
                      <div className="px-6 pb-4 space-y-1">
                        {report.staffDetail.map((r: any, i: number) => (
                          <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-50">
                            <div>
                              <span className="font-bold text-gray-700">{r.name}</span>
                              <span className="text-gray-400 text-xs ml-2">{new Date(r.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                              {r.start_time && r.end_time && <span className="text-gray-400 text-xs ml-2">{r.start_time.slice(0,5)}–{r.end_time.slice(0,5)}</span>}
                            </div>
                            <span className="font-bold">{r.hours}h @ ${r.rate}/hr = ${r.cost.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )
                  },
                  ...(report.otherExpenses > 0 ? [{
                    key: 'expenses', label: 'Other Expenses', value: `$${report.otherExpenses.toFixed(2)}`, color: 'text-red-600',
                    detail: (
                      <div className="px-6 pb-4 space-y-1">
                        {report.expenseDetail.map((r: any) => (
                          <div key={r.id} className="flex justify-between text-sm py-1 border-b border-gray-50">
                            <div>
                              <span className="font-bold text-gray-700">{r.category}</span>
                              {r.description && <span className="text-gray-400 text-xs ml-2">{r.description}</span>}
                              <span className="text-gray-400 text-xs ml-2">{new Date(r.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                            <span className="font-bold">${Number(r.amount).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )
                  }] : []),
                  { key: 'net', label: 'Net Profit', value: `$${report.profit.toFixed(2)}`, color: report.profit >= 0 ? 'text-green-700' : 'text-red-600', bold: true, noDetail: true },
                  { key: 'margin', label: 'Net Margin', value: `${report.margin}%`, color: 'text-gray-700', noDetail: true },
                  { key: 'avg', label: 'Avg Order Value', value: `$${report.avgOrder.toFixed(2)}`, color: 'text-gray-700', noDetail: true },
                ].map(row => (
                  <div key={row.key}>
                    <div
                      className={`flex justify-between items-center px-6 py-3 border-b border-gray-50 ${!row.noDetail ? 'cursor-pointer hover:bg-gray-50' : ''} ${row.bold ? 'border-t-2 border-gray-200 bg-gray-50/50' : ''}`}
                      onClick={() => !row.noDetail && toggle(row.key)}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${row.bold ? 'font-black' : 'text-gray-500'}`}>{row.label}</span>
                        {!row.noDetail && <span className="text-gray-300 text-xs">{expanded[row.key] ? '▲' : '▼'}</span>}
                      </div>
                      <span className={`font-black text-sm ${row.color}`}>{row.value}</span>
                    </div>
                    {!row.noDetail && expanded[row.key] && (
                      <div className="bg-gray-50 border-b border-gray-100">{row.detail}</div>
                    )}
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

              {/* Customer List */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex justify-between items-center p-6 pb-0 mb-4">
                  <h3 className="font-black text-lg">👤 Customer Orders ({report.customerList.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-y border-gray-100">
                      <tr>
                        <th className="text-left p-3 text-xs font-black uppercase tracking-wider text-gray-400">#</th>
                        <th className="text-left p-3 text-xs font-black uppercase tracking-wider text-gray-400">Customer</th>
                        <th className="text-left p-3 text-xs font-black uppercase tracking-wider text-gray-400">Items</th>
                        <th className="text-left p-3 text-xs font-black uppercase tracking-wider text-gray-400">Site</th>
                        <th className="text-right p-3 text-xs font-black uppercase tracking-wider text-gray-400">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {report.customerList.map((o: any) => (
                        <tr key={o.id} className="hover:bg-gray-50">
                          <td className="p-3 text-gray-400 font-mono text-xs">{o.id}</td>
                          <td className="p-3">
                            <p className="font-bold text-gray-900">{o.name}</p>
                            {o.phone && o.phone !== 'N/A' && <p className="text-xs text-gray-400">{o.phone}</p>}
                          </td>
                          <td className="p-3">
                            {o.cart.map((item: any, i: number) => (
                              <p key={i} className="text-xs text-gray-600">{item.productName} — {item.size}</p>
                            ))}
                          </td>
                          <td className="p-3 text-xs text-gray-500">{o.site || '—'}</td>
                          <td className="p-3 text-right font-black text-green-700">${o.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
