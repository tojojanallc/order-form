'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

type ProductStat = {
  product_name: string;
  total_units: number;
  total_revenue: number;
  total_profit: number;
  margin: number;
  sizes: Record<string, number>;
  events: string[];
  top_size: string;
};

type SizeStat = {
  size: string;
  units: number;
  pct: number;
};

export default function AnalyticsPage() {
  const [products, setProducts] = useState<ProductStat[]>([]);
  const [sizes, setSizes] = useState<SizeStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'units' | 'revenue' | 'profit'>('units');
  const [selectedProduct, setSelectedProduct] = useState<ProductStat | null>(null);
  const [eventFilter, setEventFilter] = useState('all');
  const [allEvents, setAllEvents] = useState<string[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('sales_ledger')
      .select('product_id, size, qty, sale_price, cost_basis, event_slug');

    if (!data) { setLoading(false); return; }

    const events = [...new Set(data.map(r => r.event_slug).filter(Boolean))];
    setAllEvents(events);

    buildStats(data, 'all');
    setLoading(false);
  };

  const buildStats = (data: any[], filter: string) => {
    const filtered = filter === 'all' ? data : data.filter(r => r.event_slug === filter);

    // Group by product name
    const productMap: Record<string, ProductStat> = {};
    const sizeMap: Record<string, number> = {};

    filtered.forEach(row => {
      // Derive product name from product_id (strip size/color)
      const parts = row.product_id?.split('|');
      const name = parts?.[0]?.trim() || row.product_id || 'Unknown';

      if (!productMap[name]) {
        productMap[name] = { product_name: name, total_units: 0, total_revenue: 0, total_profit: 0, margin: 0, sizes: {}, events: [], top_size: '' };
      }
      const p = productMap[name];
      const qty = row.qty || 1;
      p.total_units += qty;
      p.total_revenue += Number(row.sale_price || 0);
      p.total_profit += Number(row.sale_price || 0) - Number(row.cost_basis || 0);
      p.sizes[row.size] = (p.sizes[row.size] || 0) + qty;
      if (row.event_slug && !p.events.includes(row.event_slug)) p.events.push(row.event_slug);

      // Overall size totals
      sizeMap[row.size] = (sizeMap[row.size] || 0) + qty;
    });

    // Compute margin and top size
    Object.values(productMap).forEach(p => {
      p.margin = p.total_revenue > 0 ? Math.round((p.total_profit / p.total_revenue) * 100) : 0;
      p.top_size = Object.entries(p.sizes).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    });

    const productList = Object.values(productMap).sort((a, b) => b.total_units - a.total_units);
    setProducts(productList);

    // Size breakdown
    const totalUnits = Object.values(sizeMap).reduce((s, v) => s + v, 0);
    const SIZE_ORDER = ['YXS','YS','YM','YL','YXL','YXL2','XS','S','M','L','XL','2XL','3XL','Adult XS','Adult S','Adult M','Adult L','Adult XL','Youth S','Youth M','Youth L','Youth XL'];
    const sizeList = Object.entries(sizeMap)
      .map(([size, units]) => ({ size, units, pct: totalUnits > 0 ? Math.round((units / totalUnits) * 100) : 0 }))
      .sort((a, b) => {
        const ai = SIZE_ORDER.indexOf(a.size);
        const bi = SIZE_ORDER.indexOf(b.size);
        if (ai >= 0 && bi >= 0) return ai - bi;
        return b.units - a.units;
      });
    setSizes(sizeList);
  };

  const handleEventFilter = async (slug: string) => {
    setEventFilter(slug);
    setSelectedProduct(null);
    setLoading(true);
    const { data } = await supabase.from('sales_ledger').select('product_id, size, qty, sale_price, cost_basis, event_slug');
    if (data) buildStats(data, slug);
    setLoading(false);
  };

  const sorted = [...products].sort((a, b) => {
    if (sortBy === 'revenue') return b.total_revenue - a.total_revenue;
    if (sortBy === 'profit') return b.total_profit - a.total_profit;
    return b.total_units - a.total_units;
  });

  const totalUnits = products.reduce((s, p) => s + p.total_units, 0);
  const totalRevenue = products.reduce((s, p) => s + p.total_revenue, 0);
  const totalProfit = products.reduce((s, p) => s + p.total_profit, 0);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto p-6">

        {/* Header */}
        <div className="mb-8 flex justify-between items-start flex-wrap gap-4">
          <div>
            <Link href="/admin" className="text-[10px] font-black uppercase text-blue-600 tracking-widest hover:underline">← Command Center</Link>
            <h1 className="text-4xl font-black tracking-tight mt-1">📊 Product Performance</h1>
            <p className="text-sm text-gray-500 mt-1">What sells, what sizes move, and where the profit comes from.</p>
          </div>
          {/* Event filter */}
          <select className="border-2 border-gray-200 rounded-xl px-4 py-2 font-bold text-sm bg-white focus:outline-none focus:border-blue-400" value={eventFilter} onChange={e => handleEventFilter(e.target.value)}>
            <option value="all">All Events</option>
            {allEvents.map(e => <option key={e} value={e}>{e.replace(/-/g, ' ')}</option>)}
          </select>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Units Sold', value: totalUnits, prefix: '', suffix: '' },
            { label: 'Total Revenue', value: totalRevenue.toFixed(0), prefix: '$', suffix: '' },
            { label: 'Est. Profit', value: totalProfit.toFixed(0), prefix: '$', suffix: '' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-3xl font-black">{s.prefix}{s.value}{s.suffix}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Product table */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50 flex gap-2 items-center justify-between">
                <h2 className="font-black text-lg">By Product</h2>
                <div className="flex gap-2">
                  {(['units', 'revenue', 'profit'] as const).map(s => (
                    <button key={s} onClick={() => setSortBy(s)}
                      className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${sortBy === s ? 'bg-slate-900 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="p-10 text-center text-gray-400 animate-pulse font-bold">Loading...</div>
              ) : (
                <div className="divide-y max-h-[500px] overflow-y-auto">
                  {sorted.map((p, i) => (
                    <button key={p.product_name} onClick={() => setSelectedProduct(selectedProduct?.product_name === p.product_name ? null : p)}
                      className={`w-full text-left px-6 py-4 hover:bg-blue-50 transition-all ${selectedProduct?.product_name === p.product_name ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-gray-300 w-5">#{i+1}</span>
                            <p className="font-black text-sm truncate">{p.product_name}</p>
                          </div>
                          <div className="flex gap-3 mt-1 ml-7">
                            <span className="text-xs text-gray-500">{p.total_units} units</span>
                            {p.top_size && <span className="text-xs text-blue-600 font-bold">Top: {p.top_size}</span>}
                            <span className="text-xs text-gray-400">{p.events.length} event{p.events.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {p.total_revenue > 0 && <p className="font-black text-green-700 text-sm">${p.total_revenue.toFixed(0)}</p>}
                          {p.total_profit > 0 && <p className="text-xs text-pink-600 font-bold">${p.total_profit.toFixed(0)} profit</p>}
                          {p.margin > 0 && <p className="text-[10px] text-gray-400">{p.margin}% margin</p>}
                        </div>
                      </div>
                      {/* Mini size bar */}
                      {Object.keys(p.sizes).length > 0 && (
                        <div className="flex gap-1 mt-2 ml-7 flex-wrap">
                          {Object.entries(p.sizes).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([size, qty]) => (
                            <span key={size} className="text-[9px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">{size}: {qty}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                  {sorted.length === 0 && <p className="text-center text-gray-400 font-bold py-10">No sales data yet.</p>}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Size breakdown */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b bg-gray-50">
                <h2 className="font-black">Size Breakdown</h2>
                <p className="text-xs text-gray-400">Across all products</p>
              </div>
              <div className="p-5 space-y-2">
                {sizes.slice(0, 15).map(s => (
                  <div key={s.size} className="flex items-center gap-3">
                    <span className="text-xs font-black w-10 text-right text-gray-500">{s.size}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-2 bg-blue-500 rounded-full transition-all" style={{ width: `${s.pct}%` }} />
                    </div>
                    <span className="text-xs font-black text-gray-700 w-12">{s.units} <span className="text-gray-400 font-normal">({s.pct}%)</span></span>
                  </div>
                ))}
                {sizes.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No data yet.</p>}
              </div>
            </div>

            {/* Selected product detail */}
            {selectedProduct && (
              <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b bg-blue-50">
                  <h2 className="font-black text-sm text-blue-900 truncate">{selectedProduct.product_name}</h2>
                  <p className="text-xs text-blue-600">Size breakdown</p>
                </div>
                <div className="p-5 space-y-2">
                  {Object.entries(selectedProduct.sizes).sort((a,b)=>b[1]-a[1]).map(([size, qty]) => {
                    const total = Object.values(selectedProduct.sizes).reduce((s,v)=>s+v,0);
                    const pct = Math.round((qty/total)*100);
                    return (
                      <div key={size} className="flex items-center gap-3">
                        <span className="text-xs font-black w-10 text-right text-gray-500">{size}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-black text-gray-700 w-12">{qty} <span className="text-gray-400">({pct}%)</span></span>
                      </div>
                    );
                  })}
                  <div className="pt-3 border-t mt-3 text-xs space-y-1">
                    {selectedProduct.events.map(e => (
                      <span key={e} className="inline-block bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full mr-1 font-bold">{e.replace(/-/g,' ')}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
