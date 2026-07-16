'use client';
import { useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const SIZE_ORDER = ['YS','YM','YL','YXL','XS','S','M','L','XL','2XL','3XL'];

// Age group → typical size ranges
const AGE_SIZE_MAP: Record<string, { sizes: string[]; adultMix: number }> = {
  '6U':  { sizes: ['YS','YM'], adultMix: 0 },
  '7U':  { sizes: ['YS','YM'], adultMix: 0 },
  '8U':  { sizes: ['YS','YM','YL'], adultMix: 0 },
  '9U':  { sizes: ['YS','YM','YL'], adultMix: 0 },
  '10U': { sizes: ['YM','YL','YXL'], adultMix: 0.05 },
  '11U': { sizes: ['YM','YL','YXL'], adultMix: 0.1 },
  '12U': { sizes: ['YL','YXL','S'], adultMix: 0.2 },
  '13U': { sizes: ['YXL','S','M'], adultMix: 0.3 },
  '14U': { sizes: ['S','M','L'], adultMix: 0.5 },
  '15U': { sizes: ['S','M','L'], adultMix: 0.6 },
  '16U': { sizes: ['S','M','L','XL'], adultMix: 0.7 },
  '18U': { sizes: ['S','M','L','XL'], adultMix: 0.8 },
};

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
    if (pattern.test(productName)) return isYouth(productName) ? `${category} (Youth)` : category;
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
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [parsedSchedule, setParsedSchedule] = useState<any>(null);
  const [parseError, setParseError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const parsePdf = async () => {
    if (!pdfFile) return;
    setPdfParsing(true);
    setParseError('');
    setParsedSchedule(null);

    try {
      // Read PDF as base64
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res((reader.result as string).split(',')[1]);
        reader.onerror = () => rej(new Error('Failed to read file'));
        reader.readAsDataURL(pdfFile);
      });

      // Call Claude API to extract schedule info
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64 }
              },
              {
                type: 'text',
                text: `Analyze this tournament/meet schedule PDF and extract the following information. Return ONLY valid JSON, no other text:
{
  "eventName": "name of the event",
  "divisions": [
    {
      "ageGroup": "e.g. 10U, 12U, 14U",
      "numTeams": number of teams in this division,
      "athletesPerTeam": estimated athletes per team (default 12 if not specified),
      "notes": "any relevant notes"
    }
  ],
  "totalTeams": total number of teams,
  "estimatedAthletes": total estimated athletes,
  "eventDates": "date range of the event"
}`
              }
            ]
          }]
        })
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setParsedSchedule(parsed);
    } catch (err: any) {
      setParseError('Could not parse PDF. Try again or enter attendees manually.');
    }
    setPdfParsing(false);
  };

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

    // Build historical sales by category + size
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

    const bufferPct = parseFloat(buffer) / 100;

    // If we have parsed schedule, use it to build size-specific recommendations per division
    let scheduleRecs: any[] = [];
    if (parsedSchedule?.divisions?.length > 0) {
      scheduleRecs = parsedSchedule.divisions.map((div: any) => {
        const ageGroup = div.ageGroup;
        const totalAthletes = (div.numTeams || 1) * (div.athletesPerTeam || 12);
        const sizeInfo = AGE_SIZE_MAP[ageGroup] || AGE_SIZE_MAP['12U'];
        
        // Build size distribution for this age group
        const youthAthletes = Math.round(totalAthletes * (1 - (sizeInfo.adultMix || 0)));
        const adultAthletes = totalAthletes - youthAthletes;
        
        const sizeBreakdown: Record<string, number> = {};
        // Distribute evenly across likely sizes with buffer
        sizeInfo.sizes.forEach((size, i, arr) => {
          const weight = i === Math.floor(arr.length / 2) ? 0.4 : 0.3; // middle size gets more
          const base = SIZE_ORDER.indexOf(size) < 4 
            ? Math.ceil(youthAthletes * (weight / arr.length * arr.length))
            : Math.ceil(adultAthletes * (weight / arr.length * arr.length));
          sizeBreakdown[size] = Math.max(1, Math.ceil(base * (1 + bufferPct)));
        });

        return { ageGroup, totalAthletes, numTeams: div.numTeams, sizeBreakdown };
      });
    }

    // Build historical-based recommendations
    const attendees = parsedSchedule?.estimatedAthletes || parseInt(expectedAttendees) || 0;
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

    setResults({ recommendations, avgItemsPerEvent, scaleFactor, scheduleRecs, estimatedAthletes: attendees });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-6">
      <div className="max-w-5xl mx-auto">
        <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase tracking-widest hover:underline">← Command Center</Link>
        <h1 className="text-4xl font-black mt-2 mb-2">📦 Order Helper</h1>
        <p className="text-gray-400 mb-8">Recommends blank quantities using your sales history — optionally upload a tournament schedule PDF for smarter age-based sizing.</p>

        {/* PDF Upload */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
          <h2 className="font-black text-lg mb-1">📄 Tournament Schedule (Optional)</h2>
          <p className="text-xs text-gray-400 mb-4">Upload a PDF with age divisions and team counts to get age-specific size recommendations.</p>
          <div className="flex gap-3 items-center flex-wrap">
            <input ref={fileRef} type="file" accept=".pdf" className="hidden"
              onChange={e => { setPdfFile(e.target.files?.[0] || null); setParsedSchedule(null); }} />
            <button onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl px-6 py-3 text-sm font-bold text-gray-500 hover:text-blue-600 transition-all">
              {pdfFile ? `📄 ${pdfFile.name}` : '+ Upload PDF'}
            </button>
            {pdfFile && !parsedSchedule && (
              <button onClick={parsePdf} disabled={pdfParsing}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-xl text-sm disabled:opacity-40 transition-all">
                {pdfParsing ? '⏳ Reading PDF...' : '🔍 Parse Schedule'}
              </button>
            )}
            {pdfFile && <button onClick={() => { setPdfFile(null); setParsedSchedule(null); setParseError(''); if (fileRef.current) fileRef.current.value = ''; }} className="text-red-400 text-sm font-bold hover:text-red-600">✕ Remove</button>}
          </div>
          {parseError && <p className="text-red-500 text-xs mt-3 font-bold">{parseError}</p>}

          {parsedSchedule && (
            <div className="mt-4 bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="font-black text-blue-900 mb-2">✅ {parsedSchedule.eventName || 'Event'} — {parsedSchedule.eventDates || ''}</p>
              <div className="flex flex-wrap gap-3 mb-3">
                <span className="text-xs font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full">{parsedSchedule.totalTeams} teams</span>
                <span className="text-xs font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full">~{parsedSchedule.estimatedAthletes} athletes</span>
                <span className="text-xs font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full">{parsedSchedule.divisions?.length} divisions</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {parsedSchedule.divisions?.map((d: any) => (
                  <div key={d.ageGroup} className="bg-white rounded-lg p-2 text-center border border-blue-100">
                    <p className="font-black text-blue-700">{d.ageGroup}</p>
                    <p className="text-xs text-gray-500">{d.numTeams} teams · ~{(d.numTeams || 1) * (d.athletesPerTeam || 12)} athletes</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Manual inputs */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
          <h2 className="font-black text-lg mb-4">⚙️ Settings</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Expected Attendees</label>
              <input type="number" className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-bold focus:outline-none focus:border-blue-400"
                placeholder={parsedSchedule ? `${parsedSchedule.estimatedAthletes} (from PDF)` : 'e.g. 500 (optional)'}
                value={expectedAttendees} onChange={e => setExpectedAttendees(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">{parsedSchedule ? 'Override PDF estimate if needed' : 'Leave blank to use historical averages'}</p>
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
            {/* Summary */}
            <div className="bg-blue-900 text-white rounded-2xl p-5 mb-6 flex flex-wrap gap-6">
              <div><p className="text-2xl font-black">{eventCount}</p><p className="text-blue-300 text-xs uppercase tracking-wider">Events in History</p></div>
              <div><p className="text-2xl font-black">{totalHistoricalOrders}</p><p className="text-blue-300 text-xs uppercase tracking-wider">Historical Orders</p></div>
              <div><p className="text-2xl font-black">{Math.round(results.avgItemsPerEvent)}</p><p className="text-blue-300 text-xs uppercase tracking-wider">Avg Items / Event</p></div>
              {results.estimatedAthletes > 0 && <div><p className="text-2xl font-black">{results.estimatedAthletes}</p><p className="text-blue-300 text-xs uppercase tracking-wider">Est. Athletes</p></div>}
              <div><p className="text-2xl font-black">{buffer}%</p><p className="text-blue-300 text-xs uppercase tracking-wider">Safety Buffer</p></div>
            </div>

            {/* Age-based breakdown from PDF */}
            {results.scheduleRecs?.length > 0 && (
              <div className="mb-6">
                <h2 className="font-black text-xl mb-3">📋 By Age Division (from Schedule)</h2>
                <p className="text-xs text-gray-400 mb-4">Size ranges estimated from age group norms. Use this as a guide for how to distribute your blanks across youth vs adult sizes.</p>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.scheduleRecs.map((div: any) => (
                    <div key={div.ageGroup} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-black text-lg">{div.ageGroup}</h3>
                          <p className="text-xs text-gray-400">{div.numTeams} teams · ~{div.totalAthletes} athletes</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(div.sizeBreakdown).map(([size, qty]: [string, any]) => (
                          <div key={size} className="bg-gray-50 rounded-lg px-3 py-2 text-center border border-gray-100 min-w-[52px]">
                            <p className="text-xs font-black text-gray-400">{size}</p>
                            <p className="text-lg font-black text-slate-900">{qty}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historical category recommendations */}
            <h2 className="font-black text-xl mb-3">📊 By Garment Category (from History)</h2>
            <p className="text-xs text-gray-400 mb-4">Based on your actual sales data across all events. These totals scale to your expected attendance.</p>
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
                          <p className="text-xs text-gray-400 mt-1">{s.pct}%</p>
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
