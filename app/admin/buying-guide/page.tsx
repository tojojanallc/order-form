'use client'
import React, { useState } from 'react'
import Link from 'next/link'

const SPORTS = ['Basketball', 'Baseball/Softball', 'Soccer', 'Wrestling', 'Swimming/Diving', 'Volleyball', 'Football', 'Track & Field', 'Lacrosse', 'Multi-Sport Tournament', 'Dance/Cheer', 'Other']
const AGE_GROUPS = ['All Youth (6-12)', 'All Teen (13-18)', 'All Adult (18+)', 'Youth + Teen Mix', 'Teen + Adult Mix', 'All Ages Mix']
const PRODUCTS = ['T-Shirts', 'Hoodies/Sweatshirts', 'Zip-Ups', 'Tank Tops', 'Hats/Beanies', 'Shorts', 'Long Sleeves', 'Jackets']

const HISTORICAL_DATA: Record<string, Record<string, number>> = {
  basketball: { YS: 5, YM: 12, YL: 20, YXL: 8, S: 15, M: 12, L: 10, XL: 8, '2XL': 7, '3XL': 3 },
  soccer: { YS: 8, YM: 15, YL: 18, YXL: 7, S: 14, M: 12, L: 10, XL: 8, '2XL': 5, '3XL': 3 },
  wrestling: { YS: 3, YM: 8, YL: 10, YXL: 5, S: 18, M: 16, L: 14, XL: 12, '2XL': 8, '3XL': 6 },
  default: { YS: 5, YM: 10, YL: 15, YXL: 6, S: 16, M: 15, L: 13, XL: 10, '2XL': 6, '3XL': 4 },
}

export default function BuyingGuide() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ sport: '', age_group: '', expected_attendance: '', num_days: '1', products: [] as string[], price_low: '', price_mid: '', price_high: '', notes: '' })
  const [recommendation, setRecommendation] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const toggleProduct = (p: string) => set('products', form.products.includes(p) ? form.products.filter((x: string) => x !== p) : [...form.products, p])

  async function generate() {
    setLoading(true)
    const sport = form.sport.toLowerCase()
    const histKey = sport.includes('basket') ? 'basketball' : sport.includes('soccer') ? 'soccer' : sport.includes('wrestl') ? 'wrestling' : 'default'
    const hist = HISTORICAL_DATA[histKey]

    const prompt = `You are a merchandise buying expert for onsite events. Generate a specific buying recommendation.

EVENT: ${form.sport} | Ages: ${form.age_group} | Attendance: ${form.expected_attendance}/day | Days: ${form.num_days} | Products: ${form.products.join(', ')} | Prices: $${form.price_low}/$${form.price_mid}/$${form.price_high} | Notes: ${form.notes || 'None'}

HISTORICAL SIZE DISTRIBUTION from similar events: YS:${hist.YS}% YM:${hist.YM}% YL:${hist.YL}% YXL:${hist.YXL}% S:${hist.S}% M:${hist.M}% L:${hist.L}% XL:${hist.XL}% 2XL:${hist['2XL']}% 3XL:${hist['3XL']}%

Buy for ${parseInt(form.expected_attendance) * parseInt(form.num_days)} total person-days. Target 65% sell-through. Respond ONLY with valid JSON:
{"summary":"2-3 sentence strategy","total_units":number,"products":[{"name":"string","total":number,"sizes":{"YS":0,"YM":0,"YL":0,"YXL":0,"S":0,"M":0,"L":0,"XL":0,"2XL":0,"3XL":0},"price_point":"low/mid/high","notes":"string"}],"tips":["tip1","tip2","tip3"],"risk_items":["item"],"safe_bets":["item"]}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
    })
    const data = await res.json()
    try {
      const text = data.content[0].text.replace(/```json|```/g, '').trim()
      setRecommendation(JSON.parse(text))
      setStep(3)
    } catch(e) { alert('Error generating recommendation') }
    setLoading(false)
  }

  const ALL_SIZES = ['YS','YM','YL','YXL','S','M','L','XL','2XL','3XL']
  const btn = (active: boolean, onClick: () => void, label: string, color = '#0a2342') => (
    <button onClick={onClick} className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border transition-all ${active ? 'text-white' : 'bg-white text-slate-600 border-gray-200 hover:border-slate-400'}`}
      style={active ? { background: color, borderColor: color } : {}}>
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-slate-900 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="text-[10px] font-black uppercase tracking-widest text-white opacity-50 hover:opacity-100">← Back</Link>
          <div>
            <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Lev Custom Merch</p>
            <h1 className="text-xl font-black text-white">Event Buying Guide</h1>
          </div>
        </div>
        <a href="https://portal.levcustom.com/admin" target="_blank" className="text-[10px] font-black uppercase text-white opacity-40 hover:opacity-80 tracking-widest">Lev Portal ↗</a>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Step indicator */}
        <div className="flex rounded-2xl overflow-hidden border border-gray-200 bg-white mb-8">
          {[['1','Event Info'],['2','Products'],['3','Buying Guide']].map(([n, label], i) => (
            <div key={n} onClick={() => step > i+1 && setStep(i+1)}
              className={`flex-1 py-3 text-center border-r border-gray-100 last:border-0 ${step === i+1 ? 'bg-slate-900' : step > i+1 ? 'bg-green-50 cursor-pointer' : ''}`}>
              <div className={`text-[10px] font-black uppercase ${step === i+1 ? 'text-blue-400' : step > i+1 ? 'text-green-600' : 'text-gray-400'}`}>{step > i+1 ? '✓' : n}</div>
              <div className={`text-xs font-bold ${step === i+1 ? 'text-white' : step > i+1 ? 'text-green-600' : 'text-gray-400'}`}>{label}</div>
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Tell us about the event</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Sport / Event Type</label>
                <div className="flex flex-wrap gap-2">{SPORTS.map(s => btn(form.sport === s, () => set('sport', s), s))}</div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Age Groups</label>
                <div className="flex flex-wrap gap-2">{AGE_GROUPS.map(a => btn(form.age_group === a, () => set('age_group', a), a, '#2563eb'))}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Attendance per Day</label>
                  <input type="number" value={form.expected_attendance} onChange={e => set('expected_attendance', e.target.value)}
                    placeholder="e.g. 300" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Number of Days</label>
                  <div className="flex gap-2">
                    {['1','2','3','4','5'].map(d => (
                      <button key={d} onClick={() => set('num_days', d)}
                        className={`flex-1 py-3 rounded-xl text-sm font-black border transition-all ${form.num_days === d ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-gray-200 hover:border-slate-400'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="e.g. Indoor venue, families stay all day, sold 120 shirts last year..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-slate-400 resize-none" />
              </div>
              <div className="flex justify-end">
                <button onClick={() => setStep(2)} disabled={!form.sport || !form.age_group || !form.expected_attendance}
                  className="bg-slate-900 text-white px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest disabled:opacity-40 hover:bg-blue-600 transition-colors">
                  Next: Products →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm">
            <h2 className="text-2xl font-black text-slate-900 mb-6">What are you selling?</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Products</label>
                <div className="flex flex-wrap gap-2">{PRODUCTS.map(p => btn(form.products.includes(p), () => toggleProduct(p), (form.products.includes(p) ? '✓ ' : '') + p, '#16a34a'))}</div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Price Points</label>
                <div className="grid grid-cols-3 gap-3">
                  {[['price_low','Low Entry','30'],['price_mid','Mid Standard','45'],['price_high','Premium','65']].map(([k,label,ph]) => (
                    <div key={k}>
                      <div className="text-[10px] text-gray-400 font-bold mb-1">{label}</div>
                      <div className="flex items-center gap-1 border border-gray-200 rounded-xl overflow-hidden">
                        <span className="pl-3 text-gray-400 text-sm">$</span>
                        <input type="number" value={(form as any)[k]} onChange={e => set(k, e.target.value)} placeholder={ph}
                          className="flex-1 py-3 pr-3 text-sm font-bold outline-none" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep(1)} className="px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest border border-gray-200 hover:bg-gray-50">← Back</button>
                <button onClick={generate} disabled={form.products.length === 0 || loading}
                  className="bg-green-600 text-white px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest disabled:opacity-40 hover:bg-green-700 transition-colors">
                  {loading ? '✨ Generating...' : '✨ Generate Buying Guide'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && recommendation && (
          <div className="space-y-4">
            <div className="bg-slate-900 rounded-3xl p-6 text-white">
              <div className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-2">
                {form.sport} · {form.age_group} · {form.expected_attendance}/day × {form.num_days} day{Number(form.num_days)>1?'s':''}
              </div>
              <p className="text-sm leading-relaxed opacity-80">{recommendation.summary}</p>
              <div className="flex gap-8 mt-4">
                <div><div className="text-[10px] text-white opacity-40 uppercase font-black">Total Units</div><div className="text-3xl font-black text-blue-400">{recommendation.total_units}</div></div>
                <div><div className="text-[10px] text-white opacity-40 uppercase font-black">Products</div><div className="text-3xl font-black text-blue-400">{recommendation.products?.length}</div></div>
              </div>
            </div>

            {(recommendation.products || []).map((prod: any, i: number) => {
              const activeSizes = ALL_SIZES.filter(sz => prod.sizes[sz] > 0)
              const total = activeSizes.reduce((s: number, sz: string) => s + (prod.sizes[sz]||0), 0)
              return (
                <div key={i} className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <div>
                      <div className="font-black text-slate-900">{prod.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{prod.notes}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-slate-900">{total}</div>
                      <div className={`text-[10px] font-black uppercase px-3 py-1 rounded-full inline-block mt-1 ${prod.price_point==='high'?'bg-yellow-100 text-yellow-800':prod.price_point==='mid'?'bg-blue-100 text-blue-800':'bg-green-100 text-green-800'}`}>
                        {prod.price_point} price
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4 flex gap-3 flex-wrap">
                    {activeSizes.map(sz => (
                      <div key={sz} className="text-center">
                        <div className="text-[10px] font-black text-gray-400 mb-1">{sz}</div>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-base ${prod.sizes[sz]>10?'bg-slate-900 text-white':prod.sizes[sz]>5?'bg-blue-500 text-white':'bg-blue-100 text-blue-800'}`}>
                          {prod.sizes[sz]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
                <div className="font-black text-slate-900 mb-4">🎯 Safe Bets</div>
                {(recommendation.safe_bets||[]).map((item: string, i: number) => <div key={i} className="text-sm text-slate-600 py-2 border-b border-gray-50 last:border-0"><span className="text-green-600 font-black mr-2">✓</span>{item}</div>)}
              </div>
              <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
                <div className="font-black text-slate-900 mb-4">⚠️ Watch Out</div>
                {(recommendation.risk_items||[]).map((item: string, i: number) => <div key={i} className="text-sm text-slate-600 py-2 border-b border-gray-50 last:border-0"><span className="text-orange-500 font-black mr-2">!</span>{item}</div>)}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
              <div className="font-black text-slate-900 mb-4">💡 Buying Tips</div>
              {(recommendation.tips||[]).map((tip: string, i: number) => <div key={i} className="text-sm text-slate-600 py-3 border-b border-gray-50 last:border-0">{i+1}. {tip}</div>)}
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setStep(1); setRecommendation(null) }} className="flex-1 bg-gray-100 text-slate-600 py-3 rounded-full text-xs font-black uppercase tracking-widest hover:bg-gray-200">Start Over</button>
              <button onClick={() => window.print()} className="flex-1 bg-slate-900 text-white py-3 rounded-full text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-colors">🖨️ Print Guide</button>
            </div>
          </div>
        )}
      </div>
      <style>{`@media print { @page { margin: 0.5in; } header { display: none; } }`}</style>
    </div>
  )
}
