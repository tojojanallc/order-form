'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function DailyRecPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [rec, setRec] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showFinancials, setShowFinancials] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [newExpense, setNewExpense] = useState({ category: 'Truck Rental', description: '', amount: '', date: new Date().toISOString().split('T')[0] });
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.from('event_settings').select('slug, event_name').order('id', { ascending: false })
      .then(({ data }) => { if (data) setEvents(data); });
    // Check session
    if (sessionStorage.getItem('admin_role') === 'admin') {
      setAuthed(true);
      setShowFinancials(true);
    }
  }, []);

  const login = async () => {
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: passcode }) });
    const data = await res.json();
    if (data.success && data.role === 'admin') { setAuthed(true); setShowFinancials(true); }
    else alert('Wrong password or insufficient permissions');
  };

  const generate = async () => {
    if (!selectedSlug) return;
    setLoading(true);

    const fromStr = `${dateFrom}T00:00:00.000Z`;
    const toStr = `${dateTo}T23:59:59.999Z`;

    const [{ data: orders }, { data: ledger }, { data: staffHrs }, { data: expData }, { data: allExpData }] = await Promise.all([
      supabase.from('orders').select('*').eq('event_slug', selectedSlug)
        .gte('created_at', fromStr).lte('created_at', toStr).neq('status', 'refunded'),
      supabase.from('sales_ledger').select('*').eq('event_slug', selectedSlug)
        .gte('created_at', fromStr).lte('created_at', toStr),
      supabase.from('staff_hours').select('*').eq('event_slug', selectedSlug)
        .gte('date', dateFrom).lte('date', dateTo),
      supabase.from('event_expenses').select('*').eq('event_slug', selectedSlug)
        .gte('date', dateFrom).lte('date', dateTo).order('date').order('category'),
      supabase.from('event_expenses').select('*').eq('event_slug', selectedSlug)
        .order('date').order('category'),
    ]);

    const paidOrders = (orders || []).filter(o => {
      const p = (o.payment_status || '').toLowerCase();
      return p === 'paid' || p === 'succeeded' || Number(o.total_price) === 0;
    });

    // Revenue
    const revenue = paidOrders.reduce((s, o) => s + Number(o.total_price || 0), 0);
    const pieces = paidOrders.reduce((s, o) => s + (Array.isArray(o.cart_data) ? o.cart_data.length : 0), 0);

    // COGS
    const cogs = (ledger || []).reduce((s, r) => s + (Number(r.cost_basis || 0) * Number(r.qty || 1)), 0);

    // Staff cost
    const staffCost = (staffHrs || []).reduce((s, r) => s + (Number(r.hours) * Number(r.rate || 0)), 0);
    const staffHoursTotal = (staffHrs || []).reduce((s, r) => s + Number(r.hours), 0);

    // Other expenses (date-filtered)
    const otherExpenses = (expData || []).reduce((s, r) => s + Number(r.amount), 0);
    const expensesByCategory: Record<string, number> = {};
    (expData || []).forEach(r => {
      expensesByCategory[r.category] = (expensesByCategory[r.category] || 0) + Number(r.amount);
    });

    // All event expenses (regardless of date)
    const allExpensesTotal = (allExpData || []).reduce((s, r) => s + Number(r.amount), 0);
    const allExpensesByCategory: Record<string, number> = {};
    (allExpData || []).forEach(r => {
      allExpensesByCategory[r.category] = (allExpensesByCategory[r.category] || 0) + Number(r.amount);
    });

    // Gross profit
    const grossProfit = revenue - cogs;
    const netProfit = revenue - cogs - staffCost - otherExpenses;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    // By payment method
    const paymentMap: Record<string, { count: number; amount: number }> = {};
    paidOrders.forEach(o => {
      const m = o.payment_method || 'unknown';
      if (!paymentMap[m]) paymentMap[m] = { count: 0, amount: 0 };
      paymentMap[m].count++;
      paymentMap[m].amount += Number(o.total_price || 0);
    });

    // By site
    const siteMap: Record<string, { orders: number; revenue: number; pieces: number }> = {};
    paidOrders.forEach(o => {
      const site = o.site || 'Unknown';
      if (!siteMap[site]) siteMap[site] = { orders: 0, revenue: 0, pieces: 0 };
      siteMap[site].orders++;
      siteMap[site].revenue += Number(o.total_price || 0);
      siteMap[site].pieces += Array.isArray(o.cart_data) ? o.cart_data.length : 0;
    });

    // By day
    const dayMap: Record<string, { orders: number; revenue: number; pieces: number }> = {};
    paidOrders.forEach(o => {
      const day = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dayMap[day]) dayMap[day] = { orders: 0, revenue: 0, pieces: 0 };
      dayMap[day].orders++;
      dayMap[day].revenue += Number(o.total_price || 0);
      dayMap[day].pieces += Array.isArray(o.cart_data) ? o.cart_data.length : 0;
    });

    // Staff breakdown
    const staffMap: Record<string, { hours: number; cost: number }> = {};
    (staffHrs || []).forEach(r => {
      if (!staffMap[r.staff_name]) staffMap[r.staff_name] = { hours: 0, cost: 0 };
      staffMap[r.staff_name].hours += Number(r.hours);
      staffMap[r.staff_name].cost += Number(r.hours) * Number(r.rate || 0);
    });

    // Top products
    const productMap: Record<string, number> = {};
    paidOrders.forEach(o => {
      (o.cart_data || []).forEach((item: any) => {
        const name = `${item.productName} (${item.size})`;
        productMap[name] = (productMap[name] || 0) + 1;
      });
    });

    setRec({
      revenue, pieces, cogs, grossProfit, staffCost, staffHoursTotal, netProfit, margin,
      orders: paidOrders.length,
      paymentMap,
      siteMap: Object.entries(siteMap).sort((a, b) => b[1].revenue - a[1].revenue),
      dayMap: Object.entries(dayMap),
      staffMap: Object.entries(staffMap).sort((a, b) => b[1].hours - a[1].hours),
      topProducts: Object.entries(productMap).sort((a, b) => b[1] - a[1]).slice(0, 10),
      otherExpenses, expensesByCategory,
      allExpensesTotal, allExpensesByCategory,
      netProfitWithAllExpenses: revenue - cogs - staffCost - allExpensesTotal,
      expenses: expData || [],
      allExpenses: allExpData || [],
      dateFrom, dateTo,
      eventName: events.find(e => e.slug === selectedSlug)?.event_name || selectedSlug,
    });
    setLoading(false);
  };

  const $ = (n: number) => showFinancials ? `$${n.toFixed(2)}` : '$•••••';

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8 font-sans">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8 w-full max-w-sm text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-black mb-2">Admin Only</h1>
          <p className="text-gray-400 text-sm mb-6">Enter your admin password to view the daily rec.</p>
          <input type="password" className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-bold mb-3 focus:outline-none focus:border-blue-400"
            placeholder="Password" value={passcode} onChange={e => setPasscode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()} />
          <button onClick={login} className="w-full bg-slate-900 text-white font-black py-3 rounded-xl hover:bg-slate-700 transition-all">Unlock</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-6">
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      <div className="max-w-4xl mx-auto">

        <div className="no-print mb-8">
          <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase tracking-widest hover:underline">← Command Center</Link>
          <h1 className="text-4xl font-black mt-2 mb-6">📊 Daily Sales Rec</h1>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="grid md:grid-cols-4 gap-3">
              <select className="border-2 border-gray-200 rounded-xl px-4 py-3 font-bold bg-white focus:outline-none focus:border-blue-400 md:col-span-2"
                value={selectedSlug} onChange={e => setSelectedSlug(e.target.value)}>
                <option value="">— Select Event —</option>
                {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <label className="text-xs font-black text-gray-400 uppercase whitespace-nowrap">From</label>
                <input type="date" className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-3 font-bold focus:outline-none focus:border-blue-400"
                  value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-black text-gray-400 uppercase whitespace-nowrap">To</label>
                <input type="date" className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-3 font-bold focus:outline-none focus:border-blue-400"
                  value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={generate} disabled={!selectedSlug || loading}
                className="flex-1 bg-slate-900 hover:bg-slate-700 text-white font-black py-3 rounded-xl disabled:opacity-40 transition-all">
                {loading ? 'Loading...' : 'Generate Rec'}
              </button>
              <button onClick={async () => {
                if (!selectedSlug) return;
                const { data } = await supabase.from('orders').select('created_at').eq('event_slug', selectedSlug).order('created_at').limit(1);
                const { data: last } = await supabase.from('orders').select('created_at').eq('event_slug', selectedSlug).order('created_at', { ascending: false }).limit(1);
                if (data?.[0]) setDateFrom(data[0].created_at.split('T')[0]);
                if (last?.[0]) setDateTo(last[0].created_at.split('T')[0]);
                setTimeout(generate, 100);
              }} disabled={!selectedSlug} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 rounded-xl disabled:opacity-40 transition-all text-sm">
                Full Event
              </button>
              {rec && <button onClick={() => window.print()} className="bg-gray-100 hover:bg-gray-200 text-slate-700 font-black px-5 rounded-xl transition-all">🖨️</button>}
            </div>
          </div>
        </div>

        {rec && (
          <div className="space-y-6">

            {/* Header */}
            <div className="bg-slate-900 text-white rounded-3xl p-8">
              <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Daily Sales Reconciliation</p>
              <h2 className="text-3xl font-black mt-1">{rec.eventName}</h2>
              <p className="text-slate-400 mt-1">
                {rec.dateFrom === rec.dateTo
                  ? new Date(rec.dateFrom + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                  : `${new Date(rec.dateFrom + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(rec.dateTo + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                }
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                {[
                  { label: 'Orders', value: rec.orders },
                  { label: 'Pieces', value: rec.pieces },
                  { label: 'Revenue', value: $(rec.revenue) },
                  { label: 'Net Profit', value: $(rec.netProfit) },
                ].map(s => (
                  <div key={s.label} className="bg-white/10 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-black">{s.value}</p>
                    <p className="text-slate-400 text-xs uppercase tracking-widest mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">

              {/* P&L Summary */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-black text-lg mb-4">💰 P&L Summary</h3>
                {[
                  { label: 'Gross Revenue', value: $(rec.revenue), color: 'text-green-700' },
                  { label: 'Cost of Goods Sold', value: `(${$(rec.cogs)})`, color: 'text-red-600' },
                  { label: 'Gross Profit', value: $(rec.grossProfit), color: 'text-blue-700', bold: true },
                  { label: `Staff Labor (${rec.staffHoursTotal} hrs)`, value: `(${$(rec.staffCost)})`, color: 'text-red-600' },
                  ...Object.entries(rec.expensesByCategory).map(([cat, amt]: [string, any]) => ({
                    label: cat, value: `(${$(amt)})`, color: 'text-red-600'
                  })),
                  { label: 'Net Profit', value: $(rec.netProfit), color: rec.netProfit >= 0 ? 'text-green-700' : 'text-red-600', bold: true },
                  { label: 'Net Margin', value: `${rec.margin.toFixed(1)}%`, color: 'text-gray-700' },
                ].map(row => (
                  <div key={row.label} className={`flex justify-between py-2 border-b border-gray-50 last:border-0 ${row.bold ? 'border-t-2 border-gray-200 mt-1 pt-3' : ''}`}>
                    <span className="text-gray-500 text-sm">{row.label}</span>
                    <span className={`font-black text-sm ${row.color}`}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Payment Methods */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-black text-lg mb-4">💳 Payment Breakdown</h3>
                {Object.entries(rec.paymentMap).map(([method, data]: [string, any]) => (
                  <div key={method} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700 capitalize font-bold">{method.replace(/_/g, ' ')}</span>
                    <div className="text-right">
                      <span className="font-black text-sm">{$(data.amount)}</span>
                      <span className="text-gray-400 text-xs ml-2">({data.count} orders)</span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between py-2 mt-2 border-t-2 border-gray-200">
                  <span className="text-sm font-black">Total</span>
                  <span className="font-black text-green-700">{$(rec.revenue)}</span>
                </div>
              </div>

              {/* By Site */}
              {rec.siteMap.length > 1 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <h3 className="font-black text-lg mb-4">📍 By Site</h3>
                  {rec.siteMap.map(([site, data]: [string, any]) => (
                    <div key={site} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm font-bold text-gray-700">{site}</span>
                      <div className="text-right">
                        <span className="font-black text-sm">{$(data.revenue)}</span>
                        <span className="text-gray-400 text-xs ml-2">{data.orders} orders · {data.pieces} pcs</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* By Day (multi-day only) */}
              {rec.dayMap.length > 1 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <h3 className="font-black text-lg mb-4">📅 By Day</h3>
                  {rec.dayMap.map(([day, data]: [string, any]) => (
                    <div key={day} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm font-bold text-gray-700">{day}</span>
                      <div className="text-right">
                        <span className="font-black text-sm">{$(data.revenue)}</span>
                        <span className="text-gray-400 text-xs ml-2">{data.orders} orders · {data.pieces} pcs</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Staff */}
              {rec.staffMap.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <h3 className="font-black text-lg mb-4">👥 Staff Hours</h3>
                  {rec.staffMap.map(([name, data]: [string, any]) => (
                    <div key={name} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm font-bold text-gray-700">{name}</span>
                      <div className="text-right">
                        <span className="font-black text-sm">{data.hours} hrs</span>
                        {data.cost > 0 && <span className="text-red-600 text-xs ml-2">({$(data.cost)})</span>}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 mt-2 border-t-2 border-gray-200">
                    <span className="text-sm font-black">Total</span>
                    <div className="text-right">
                      <span className="font-black text-sm">{rec.staffHoursTotal} hrs</span>
                      {rec.staffCost > 0 && <span className="text-red-600 text-xs ml-2">({$(rec.staffCost)})</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Other Expenses */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-lg">🧾 Event Expenses</h3>
                  <button onClick={() => setShowExpenseForm(!showExpenseForm)}
                    className="text-xs font-black bg-blue-700 text-white px-3 py-1.5 rounded-xl hover:bg-blue-600 transition-all no-print">
                    {showExpenseForm ? 'Cancel' : '+ Add'}
                  </button>
                </div>

                {showExpenseForm && (
                  <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3 no-print">
                    <div className="grid grid-cols-2 gap-3">
                      <select className="border-2 border-gray-200 rounded-xl px-3 py-2 font-bold bg-white focus:outline-none focus:border-blue-400"
                        value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})}>
                        <option>Truck Rental</option>
                        <option>Food</option>
                        <option>DTFs</option>
                        <option>Supplies</option>
                        <option>Misc</option>
                      </select>
                      <input type="date" className="border-2 border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-blue-400"
                        value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} />
                      <input className="border-2 border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400"
                        placeholder="Description (optional)" value={newExpense.description}
                        onChange={e => setNewExpense({...newExpense, description: e.target.value})} />
                      <input type="number" step="0.01" className="border-2 border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-blue-400"
                        placeholder="Amount $" value={newExpense.amount}
                        onChange={e => setNewExpense({...newExpense, amount: e.target.value})} />
                    </div>
                    <button onClick={async () => {
                      if (!newExpense.amount || !selectedSlug) return;
                      await supabase.from('event_expenses').insert({
                        event_slug: selectedSlug,
                        date: newExpense.date,
                        category: newExpense.category,
                        description: newExpense.description || null,
                        amount: parseFloat(newExpense.amount),
                      });
                      setNewExpense({ category: 'Truck Rental', description: '', amount: '', date: new Date().toISOString().split('T')[0] });
                      setShowExpenseForm(false);
                      generate();
                    }} disabled={!newExpense.amount}
                      className="w-full bg-blue-700 text-white font-black py-2 rounded-xl disabled:opacity-40 hover:bg-blue-600 transition-all">
                      Save Expense
                    </button>
                  </div>
                )}

                {rec.allExpenses.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">No expenses logged yet.</p>
                ) : (
                  <>
                    <div className="space-y-1 mb-4">
                      {rec.allExpenses.map((exp: any) => (
                        <div key={exp.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                          <div>
                            <span className="text-sm font-bold text-gray-700">{exp.category}</span>
                            {exp.description && <span className="text-xs text-gray-400 ml-2">{exp.description}</span>}
                            <span className="text-xs text-gray-300 ml-2">{new Date(exp.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-sm text-red-600">({$(Number(exp.amount))})</span>
                            <button onClick={async () => {
                              await supabase.from('event_expenses').delete().eq('id', exp.id);
                              generate();
                            }} className="text-gray-300 hover:text-red-500 transition-all no-print text-xs">🗑️</button>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between pt-2 border-t-2 border-gray-200 mt-2">
                        <span className="font-black text-sm">Total Event Expenses</span>
                        <span className="font-black text-sm text-red-600">({$(rec.allExpensesTotal)})</span>
                      </div>
                    </div>

                    {/* Full picture */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Full Picture (This Period + All Expenses)</p>
                      {[
                        { label: 'Period Revenue', value: $(rec.revenue), color: 'text-green-700' },
                        { label: 'Period COGS', value: `(${$(rec.cogs)})`, color: 'text-red-500' },
                        { label: 'Staff Labor', value: `(${$(rec.staffCost)})`, color: 'text-red-500' },
                        { label: 'All Event Expenses', value: `(${$(rec.allExpensesTotal)})`, color: 'text-red-500' },
                        { label: 'Net Profit', value: $(rec.netProfitWithAllExpenses), color: rec.netProfitWithAllExpenses >= 0 ? 'text-green-700' : 'text-red-600' },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between py-1.5 border-b border-slate-100 last:border-0 last:font-black last:pt-2 last:border-t last:border-slate-200">
                          <span className="text-xs text-slate-500">{row.label}</span>
                          <span className={`text-xs font-black ${row.color}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Top Products */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-black text-lg mb-4">👕 Top Products</h3>
                {rec.topProducts.map(([name, count]: [string, number]) => (
                  <div key={name} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-600 truncate pr-2">{name}</span>
                    <span className="font-black text-sm shrink-0">{count} sold</span>
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
