'use client'
import React, { useState } from 'react'
import Link from 'next/link'

const SPORTS = ['Basketball','Baseball/Softball','Soccer','Wrestling','Swimming/Diving','Volleyball','Football','Track & Field','Lacrosse','Multi-Sport Tournament','Dance/Cheer','Other']
const AGE_GROUPS = ['All Youth (6-12)','All Teen (13-18)','All Adult (18+)','Youth + Teen Mix','Teen + Adult Mix','All Ages Mix']
const PRODUCT_TYPES = ['T-Shirt','Hoodie','Zip-Up','Long Sleeve','Tank Top','Hat','Beanie','Shorts','Jacket']
const ALL_SIZES = ['YS','YM','YL','YXL','S','M','L','XL','2XL','3XL']

type Product = { id: number; name: string; type: string; price: string; colors: string }

export default function BuyingGuide() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ sport: '', age_group: '', expected_attendance: '', num_days: '1', notes: '' })
  const [products, setProducts] = useState<Product[]>([
    { id: 1, name: '', type: 'T-Shirt', price: '', colors: '' },
  ])
  const [recommendation, setRecommendation] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const setProduct = (id: number, k: string, v: string) => setProducts(p => p.map(x => x.id === id ? { ...x, [k]: v } : x))
  const addProduct = () => setProducts(p => [...p, { id: Date.now(), name: '', type: 'T-Shirt', price: '', colors: '' }])
  const removeProduct = (id: number) => setProducts(p => p.filter(x => x.id !== id))

  async function generate() {
    setLoading(true)
    const res = await fetch('/api/buying-guide', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form: { ...form, products: products.filter(p => p.name) } })
    })
    const data = await res.json()
    try {
      const text = data.content[0].text.replace(/```json|```/g, '').trim()
      setRecommendation(JSON.parse(text))
      setStep(3)
    } catch(e) { alert('Error generating recommendation. Check console.'); console.error(data) }
    setLoading(false)
  }

  const iB = 'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:border-slate-400 bg-white'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-900 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="text-[10px] font-black uppercase tracking-widest text-white opacity-40 hover:opacity-80">← Back</Link>
          <div>
            <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Lev Custom Merch</p>
            <h1 className="text-xl font-black text-white">Event Buying Guide</h1>
          </div>
        </div>
        <a href="https://portal.levcustom.com/admin" target="_blank" className="text-[10px] font-black uppercase text-white opacity-40 hover:opacity-80 tracking-widest">Lev Portal ↗</a>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Steps */}
        <div className="flex rounded-2xl overflow-hidden border border-gray-200 bg-white mb-8">
          {[['1','Event Info'],['2','Products'],['3','Buying Guide']].map(([n, label], i) => (
            <div key={n} onClick={() => step > i+1 && setStep(i+1)} className={`flex-1 py-3 text-center border-r border-gray-100 last:border-0 ${step===i+1?'bg-slate-900':step>i+1?'bg-green-50 cursor-pointer':''}`}>
              <div className={`text-[10px] font-black uppercase ${step===i+1?'text-blue-400':step>i+1?'text-green-600':'text-gray-400'}`}>{step>i+1?'✓':n}</div>
              <div className={`text-xs font-bold ${step===i+1?'text-white':step>i+1?'text-green-600':'text-gray-400'}`}>{label}</div>
            </div>
          ))}
        </div>

        {/* Step 1 — Event Info */}
        {step === 1 && (
          <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm space-y-6">
            <h2 className="text-2xl font-black text-slate-900">Tell us about the event</h2>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Sport / Event Type</label>
              <div className="flex flex-wrap gap-2">
                {SPORTS.map(s => (
                  <button key={s} onClick={() => set('sport', s)}
                    className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${form.sport===s?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-gray-200 hover:border-slate-400'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Age Groups</label>
              <div className="flex flex-wrap gap-2">
                {AGE_GROUPS.map(a => (
                  <button key={a} onClick={() => set('age_group', a)}
                    className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${form.age_group===a?'bg-blue-600 text-white border-blue-600':'bg-white text-slate-600 border-gray-200 hover:border-slate-400'}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Attendance per Day</label>
                <input type="number" value={form.expected_attendance} onChange={e => set('expected_attendance', e.target.value)} placeholder="e.g. 300" className={iB} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Number of Days</label>
                <div className="flex gap-2">
                  {['1','2','3','4','5'].map(d => (
                    <button key={d} onClick={() => set('num_days', d)}
                      className={`flex-1 py-3 rounded-xl text-sm font-black border transition-all ${form.num_days===d?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-gray-200 hover:border-slate-400'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                placeholder="e.g. Indoor venue, families stay all day, sold 120 shirts last year..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-slate-400 resize-none" />
            </div>
            <div className="flex justify-end">
              <button onClick={() => setStep(2)} disabled={!form.sport || !form.age_group || !form.expected_attendance}
                className="bg-slate-900 text-white px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest disabled:opacity-40 hover:bg-blue-600 transition-colors">
                Next: Products →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Products */}
        {step === 2 && (
          <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-slate-900">What are you selling?</h2>
              <button onClick={addProduct} className="bg-slate-900 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-colors">
                + Add Product
              </button>
            </div>

            <div className="space-y-4">
              {products.map((p, i) => (
                <div key={p.id} className="border border-gray-200 rounded-2xl p-5 space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Product {i + 1}</span>
                    {products.length > 1 && (
                      <button onClick={() => removeProduct(p.id)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-gray-400 mb-1">Product Name</label>
                      <input value={p.name} onChange={e => setProduct(p.id, 'name', e.target.value)}
                        placeholder="e.g. Champion Reverse Weave Hoodie - Black" className={iB} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 mb-1">Type</label>
                      <select value={p.type} onChange={e => setProduct(p.id, 'type', e.target.value)} className={iB}>
                        {PRODUCT_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 mb-1">Selling Price</label>
                      <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                        <span className="pl-4 text-gray-400 text-sm">$</span>
                        <input type="number" value={p.price} onChange={e => setProduct(p.id, 'price', e.target.value)}
                          placeholder="45" className="flex-1 py-3 px-3 text-sm font-semibold outline-none" />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-gray-400 mb-1">Colors available <span className="text-gray-300">(optional)</span></label>
                      <input value={p.colors} onChange={e => setProduct(p.id, 'colors', e.target.value)}
                        placeholder="e.g. Black, Navy, Gray" className={iB} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest border border-gray-200 hover:bg-gray-50">← Back</button>
              <button onClick={generate} disabled={products.filter(p => p.name).length === 0 || loading}
                className="bg-green-600 text-white px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest disabled:opacity-40 hover:bg-green-700 transition-colors">
                {loading ? '✨ Generating...' : '✨ Generate Buying Guide'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Results */}
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
                <div><div className="text-[10px] text-white opacity-40 uppercase font-black">Est. Revenue</div>
                  <div className="text-3xl font-black text-blue-400">
                    ${(recommendation.products||[]).reduce((s:number,p:any)=>s+(p.total*(p.price||0)),0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {(recommendation.products || []).map((prod: any, i: number) => {
              const activeSizes = ALL_SIZES.filter(sz => (prod.sizes||{})[sz] > 0)
              const total = activeSizes.reduce((s:number,sz:string)=>s+(prod.sizes[sz]||0),0)
              return (
                <div key={i} className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-start">
                    <div>
                      <div className="font-black text-slate-900">{prod.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{prod.type} · ${prod.price} each</div>
                      <div className="text-xs text-gray-500 mt-1">{prod.notes}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-slate-900">{total} units</div>
                      <div className="text-xs text-gray-400">${((prod.price||0)*total).toLocaleString()} est. revenue</div>
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    <div className="flex gap-3 flex-wrap">
                      {ALL_SIZES.map(sz => {
                        const qty = (prod.sizes||{})[sz] || 0
                        if (qty === 0) return null
                        return (
                          <div key={sz} className="text-center">
                            <div className="text-[10px] font-black text-gray-400 mb-1">{sz}</div>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-base ${qty>15?'bg-slate-900 text-white':qty>8?'bg-blue-500 text-white':qty>3?'bg-blue-100 text-blue-800':'bg-gray-100 text-gray-600'}`}>
                              {qty}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
                <div className="font-black text-slate-900 mb-4">🎯 Safe Bets</div>
                {(recommendation.safe_bets||[]).map((item:string,i:number)=>(
                  <div key={i} className="text-sm text-slate-600 py-2 border-b border-gray-50 last:border-0"><span className="text-green-600 font-black mr-2">✓</span>{item}</div>
                ))}
              </div>
              <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
                <div className="font-black text-slate-900 mb-4">⚠️ Watch Out</div>
                {(recommendation.risk_items||[]).map((item:string,i:number)=>(
                  <div key={i} className="text-sm text-slate-600 py-2 border-b border-gray-50 last:border-0"><span className="text-orange-500 font-black mr-2">!</span>{item}</div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
              <div className="font-black text-slate-900 mb-4">💡 Buying Tips</div>
              {(recommendation.tips||[]).map((tip:string,i:number)=>(
                <div key={i} className="text-sm text-slate-600 py-3 border-b border-gray-50 last:border-0">{i+1}. {tip}</div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setStep(1); setRecommendation(null) }} className="flex-1 bg-gray-100 text-slate-600 py-3 rounded-full text-xs font-black uppercase tracking-widest hover:bg-gray-200">
                Start Over
              </button>
              <button onClick={() => window.print()} className="flex-1 bg-slate-900 text-white py-3 rounded-full text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-colors">
                🖨️ Print Guide
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@media print { @page { margin: 0.5in; } header,nav { display:none; } }`}</style>
    </div>
  )
}
