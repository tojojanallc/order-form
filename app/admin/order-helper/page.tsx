'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const SIZE_ORDER = ['YS','YM','YL','YXL','XS','S','M','L','XL','2XL','3XL'];

const CATEGORY_MAP: { pattern: RegExp; category: string }[] = [
  { pattern: /hoodie|hooded sweatshirt|pullover/i, category: 'Hoodie' },
  { pattern: /crewneck|crew neck|fleece crew/i, category: 'Crewneck' },
  { pattern: /sweatpant|jogger|fleece pant/i, category: 'Sweatpants' },
  { pattern: /t-shirt|tee|fine jersey|tie.?dye/i, category: 'T-Shirt' },
  { pattern: /long.?sleeve/i, category: 'Long Sleeve' },
  { pattern: /tank/i, category: 'Tank' },
  { pattern: /zip/i, category: 'Zip Hoodie' },
];

const isYouth = (name: string) => /youth|kids|child/i.test(name);

const getCategory = (productName: string) => {
  for (const { pattern, category } of CATEGORY_MAP) {
    if (pattern.test(productName)) {
      return isYouth(productName) ? `${category} (Youth)` : category;
    }
  }
  return isYouth(productName) ? 'Other (Youth)' : 'Other';
};

export default function OrderHelperPage() {
  const [expectedAttendees, setExpectedAttendees] = useState('');
  const [buffer, setBuffer] = useState('15');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [eventCount, setEventCount] = useState(0);
  const [totalHistoricalOrders, setTotalHistoricalOrders] = useState(0);

  const generate = async () => {
    setLoading(true);
    setResults(null);

    const { data: orders } = await supabase
      .from('orders')
      .select('id, cart_data, total_price, payment_status, status, event_slug')
      .neq('status', 'refunded');

    if (!orders) { setLoading(false); return; }

    const paidOrders = orders.filter(o => {
      const p = (o.payment_status || '').toLowerCase();
      return p === 'paid' || p === 'succeeded' || Number(o.total_price) === 0;
    });

    const uniqueEvents = new Set(paidOrders.map(o => o.event_slug)).size;
    setEventCount(uniqueEvents);
    setTotalHistoricalOrders(paidOrders.length);

    const salesMap: Record<string, Record<string, number>> = {};
    const itemsPerEvent: Record<string, number> = {};

    paidOrders.forEach(o => {
      const slug = o.event_slug || 'unknown';
      (o.cart_data || []).forEach((item: any) => {
        const rawName = (item.productName || '').trim();
        const size = (item.size || '').trim();
        if (!rawName || !size || size === 'N/A') return;
        const category = getCategory(rawName);
        if (!salesMap[category]) salesMap[category] = {};
        salesMap[category][size] = (salesMap[category][size] || 0) + 1;
        itemsPerEvent[slug] = (itemsPerEvent[slug] || 0) + 1;
      });
    });

    const avgItemsPerEvent = Object.values(itemsPerEvent).length > 0
      ? Object.values(itemsPerEvent).reduce((s, n) => s + n, 0) / Object.values(itemsPerEvent).length : 1;

    const attendees = parseInt(expectedAttendees) || 0;
    const bufferPct = parseFloat(buffer) / 100;
    const scaleFactor = attendees > 0 ? (attendees / (avgItemsPerEvent * 3)) : 1;

    const recommendations = Object.entries(salesMap)
      .sort((a, b) => Object.values(b[1]).reduce((s,n)=>s+n,0) - Object.values(a[1]).reduce((s,n)=>s+n,0))
      .map(([productName, sizeCounts]) => {
        const totalSold = Object.values(sizeCounts).reduce((s, n) => s + n, 0);
        const sizes = SIZE_ORDER.filter(s => sizeCounts[s]).map(s => {
          const historicalQty = sizeCounts[s];
          const pct = Math.round((historicalQty / totalSold) * 100);
          const scaled = attendees > 0
            ? Math.ceil((historicalQty / uniqueEvents) * scaleFactor * (1 + bufferPct))
            : Math.ceil((historicalQty / uniqueEvents) * (1 + bufferPct));
          return { size: s, historicalQty, pct, recommended: Math.max(1, scaled) };
        });
        const totalRecommended = sizes.reduce((s, r) => s + r.recommended, 0);
        return { productName, totalSold, avgPerEvent: totalSold / uniqueEvents, sizes, totalRecommended };
      });

    setResults({ recommendations, avgItemsPerEvent, scaleFactor });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-6">
      <div className="max-w-5xl mx-auto">
        <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase tracking-widest hover:underline">← Command Center</Link>
        <h1 className="text-4xl font-black mt-2 mb-2">📦 Order Helper</h1>
        <p className="text-gray-400 mb-8">Recommends blank quantities based on your full sales history across all events.</p>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Expected Attendees</label>
              <input type="number" className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-bold focus:outline-none focus:border-blue-400"
                placeholder="e.g. 500 (optional)" value={expectedAttendees} onChange={e => setExpectedAttendees(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Leave blank to use historical averages</p>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Safety Buffer %</label>
              <input type="number" className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-bold focus:outline-none focus:border-blue-400"
                placeholder="15" value={buffer} onChange={e => setBuffer(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Extra % added to all quantities</p>
            </div>
            <div className="flex items-end">
              <button onClick={generate} disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-700 text-white font-black py-3 rounded-xl disabled:opacity-40 transition-all">
                {loading ? 'Analyzing...' : '🔍 Generate Recommendations'}
              </button>
            </div>
          </div>
        </div>

        {results && (
          <>
            <div className="bg-blue-900 text-white rounded-2xl p-5 mb-6 flex flex-wrap gap-6">
              <div><p className="text-2xl font-black">{eventCount}</p><p className="text-blue-300 text-xs uppercase tracking-wider">Events Analyzed</p></div>
              <div><p className="text-2xl font-black">{totalHistoricalOrders}</p><p className="text-blue-300 text-xs uppercase tracking-wider">Historical Orders</p></div>
              <div><p className="text-2xl font-black">{Math.round(results.avgItemsPerEvent)}</p><p className="text-blue-300 text-xs uppercase tracking-wider">Avg Items / Event</p></div>
              {expectedAttendees && <div><p className="text-2xl font-black">{expectedAttendees}</p><p className="text-blue-300 text-xs uppercase tracking-wider">Expected Attendees</p></div>}
              <div><p className="text-2xl font-black">{buffer}%</p><p className="text-blue-300 text-xs uppercase tracking-wider">Safety Buffer</p></div>
            </div>

            <div className="space-y-4">
              {results.recommendations.map((rec: any) => (
                  <div key={rec.productName} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-b border-gray-100">
                      <div>
                        <h3 className="font-black text-lg text-slate-900">{rec.productName}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{rec.totalSold} sold across {eventCount} events · avg {rec.avgPerEvent.toFixed(1)}/event</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-blue-700">{rec.totalRecommended}</p>
                        <p className="text-xs text-gray-400">total recommended</p>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {rec.sizes.map((s: any) => (
                          <div key={s.size} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                            <p className="text-xs font-black uppercase text-gray-400 mb-1">{s.size}</p>
                            <p className="text-2xl font-black text-slate-900">{s.recommended}</p>
                            <div className="mt-1.5 bg-gray-200 rounded-full h-1.5">
                              <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${s.pct}%` }} />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{s.pct}% of sales</p>
                            <p className="text-xs text-gray-300">{s.historicalQty} sold</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
