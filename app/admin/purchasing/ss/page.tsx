'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const SIZE_ORDER = ['YS','YM','YL','YXL','XS','S','M','L','XL','2XL','3XL','4XL'];

export default function SSPurchasingPage() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productDetail, setProductDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedColor, setSelectedColor] = useState<any>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [poItems, setPoItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('event_settings').select('slug, event_name').order('id', { ascending: false })
      .then(({ data }) => { if (data) setEvents(data); });
  }, []);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchResults([]);
    setSelectedProduct(null);
    setProductDetail(null);
    try {
      const res = await fetch(`/api/ss-search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.products || []);
    } catch (e) { alert('Search failed'); }
    setSearching(false);
  };

  const selectProduct = async (product: any) => {
    setSelectedProduct(product);
    setSelectedColor(null);
    setQuantities({});
    setProductDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/ss-product?style=${product.style}`);
      const data = await res.json();
      setProductDetail(data);
    } catch (e) {}
    setLoadingDetail(false);
  };

  const getInventoryForColorSize = (colorCode: string, size: string) =>
    productDetail?.inventory?.find((i: any) => i.colorCode === colorCode && i.sizeCode === size);

  const getPriceForColorSize = (colorCode: string, size: string) =>
    productDetail?.pricing?.find((p: any) => p.colorCode === colorCode && p.sizeCode === size);

  const getImageForColor = (colorCode: string) => {
    if (!productDetail?.media) return null;
    return productDetail.media.find((m: any) => m.colorCode === colorCode && m.mediaType === 'Front')?.url
      || productDetail.media.find((m: any) => m.colorCode === colorCode)?.url;
  };

  const addToOrder = () => {
    if (!selectedProduct || !selectedColor) return;
    const items: any[] = [];
    Object.entries(quantities).forEach(([size, qty]) => {
      if (qty > 0) {
        const price = getPriceForColorSize(selectedColor.colorCode, size);
        const img = getImageForColor(selectedColor.colorCode);
        items.push({
          ss_style: selectedProduct.style,
          product_name: selectedProduct.title,
          color_name: selectedColor.colorName,
          color_code: selectedColor.colorCode,
          size,
          sku: `${selectedProduct.style}-${selectedColor.colorCode}-${size}`,
          qty,
          unit_cost: price?.piecePrice || 0,
          total_cost: (price?.piecePrice || 0) * qty,
          image_url: img || null,
        });
      }
    });
    if (items.length === 0) return alert('Enter at least one quantity');
    setPoItems([...poItems, ...items]);
    setQuantities({});
  };

  const removeItem = (index: number) => setPoItems(poItems.filter((_, i) => i !== index));
  const totalCost = poItems.reduce((s, i) => s + i.total_cost, 0);
  const totalQty = poItems.reduce((s, i) => s + i.qty, 0);

  const savePO = async () => {
    if (poItems.length === 0) return alert('Add items first');
    setSaving(true);
    try {
      const poNumber = `SS-${Date.now()}`;
      const { data: po, error } = await supabase.from('purchase_orders').insert({
        po_number: poNumber,
        event_slug: selectedEvent || null,
        status: 'draft',
        supplier: 'SS Activewear',
        notes: poNotes || null,
        total_cost: totalCost,
      }).select().single();
      if (error) throw error;
      await supabase.from('purchase_order_items').insert(poItems.map(item => ({ ...item, po_id: po.id })));

      // Also create product rows in products table for the event
      if (selectedEvent) {
        for (const item of poItems) {
          const productId = `${item.product_name} | ${item.size} | ${item.color_name}`;
          await supabase.from('products').upsert({
            id: productId, name: item.product_name,
            base_price: 0, image_url: item.image_url || null,
          }, { onConflict: 'id', ignoreDuplicates: true });
          await supabase.from('inventory').upsert({
            product_id: productId, size: item.size,
            count: item.qty, active: true,
            event_slug: selectedEvent, cost_price: item.unit_cost,
          }, { onConflict: 'product_id,size,event_slug' });
        }
      }

      setSaved(true);
      setTimeout(() => {
        setPoItems([]); setSelectedProduct(null); setProductDetail(null);
        setSelectedColor(null); setQuantities({}); setSaved(false); setSaving(false);
      }, 2000);
    } catch (err: any) {
      alert('Error: ' + err.message);
      setSaving(false);
    }
  };

  const colors = selectedProduct?.colors || [];
  const sizes = selectedColor
    ? [...new Set((productDetail?.inventory || [])
        .filter((i: any) => i.colorCode === selectedColor.colorCode)
        .map((i: any) => i.sizeCode))]
        .sort((a: any, b: any) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b))
    : [];

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase tracking-widest hover:underline">← Command Center</Link>
        <h1 className="text-4xl font-black mt-2 mb-8">🛒 S&S Activewear Order</h1>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Search */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-black text-lg mb-4">Search S&S Catalog</h2>
              <div className="flex gap-3">
                <input className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold focus:outline-none focus:border-blue-400"
                  placeholder="Style # or keyword (e.g. 202, Tultex hoodie)"
                  value={query} onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && search()} />
                <button onClick={search} disabled={searching}
                  className="bg-slate-900 hover:bg-slate-700 text-white font-black px-6 rounded-xl disabled:opacity-40 transition-all">
                  {searching ? '⏳' : '🔍'}
                </button>
              </div>
            </div>

            {searchResults.length > 0 && !selectedProduct && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 max-h-72 overflow-y-auto">
                <p className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">{searchResults.length} results</p>
                {searchResults.map(p => (
                  <button key={p.style} onClick={() => selectProduct(p)}
                    className="w-full text-left p-3 rounded-xl mb-1 hover:bg-gray-50 border-2 border-transparent hover:border-gray-200 transition-all">
                    <p className="font-black text-sm">{p.title}</p>
                    <p className="text-xs text-gray-400">Style #{p.style}</p>
                  </button>
                ))}
              </div>
            )}

            {selectedProduct && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-black text-lg">{selectedProduct.title}</h3>
                    <p className="text-xs text-gray-400">Style #{selectedProduct.style}</p>
                  </div>
                  <button onClick={() => { setSelectedProduct(null); setProductDetail(null); setSelectedColor(null); }}
                    className="text-gray-400 hover:text-gray-600 text-sm font-bold">✕ Clear</button>
                </div>

                {loadingDetail ? (
                  <p className="text-gray-400 animate-pulse text-sm">Loading inventory...</p>
                ) : (
                  <>
                    <label className="text-xs font-black uppercase tracking-wider text-gray-400 block mb-2">Color</label>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {colors.map((c: any) => {
                        const img = getImageForColor(c.colorCode);
                        return (
                          <button key={c.colorCode} onClick={() => { setSelectedColor(c); setQuantities({}); }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-bold transition-all ${selectedColor?.colorCode === c.colorCode ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                            {img && <img src={img} alt={c.colorName} className="w-8 h-8 object-cover rounded" />}
                            <span>{c.colorName}</span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedColor && sizes.length > 0 && (
                      <>
                        <label className="text-xs font-black uppercase tracking-wider text-gray-400 block mb-2">Quantities</label>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          {(sizes as string[]).map((size) => {
                            const inv = getInventoryForColorSize(selectedColor.colorCode, size);
                            const price = getPriceForColorSize(selectedColor.colorCode, size);
                            return (
                              <div key={size} className="bg-gray-50 rounded-xl p-2 border border-gray-100">
                                <div className="flex justify-between mb-0.5">
                                  <span className="text-xs font-black">{size}</span>
                                  <span className={`text-xs font-bold ${(inv?.onHand || 0) < 12 ? 'text-red-400' : 'text-green-500'}`}>{inv?.onHand ?? '?'}</span>
                                </div>
                                {price && <p className="text-xs text-gray-400 mb-1">${price.piecePrice}</p>}
                                <input type="number" min="0"
                                  className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm font-bold text-center focus:outline-none focus:border-blue-400"
                                  placeholder="0" value={quantities[size] || ''}
                                  onChange={e => setQuantities({ ...quantities, [size]: parseInt(e.target.value) || 0 })} />
                              </div>
                            );
                          })}
                        </div>
                        <button onClick={addToOrder}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl transition-all">
                          + Add to Order
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right: PO Summary */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-black text-lg">Purchase Order</h2>
                <div className="text-right">
                  <p className="text-2xl font-black text-green-700">${totalCost.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{totalQty} pieces</p>
                </div>
              </div>

              <div className="mb-3">
                <label className="text-xs font-black uppercase tracking-wider text-gray-400 block mb-1">Link to Event</label>
                <select className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-bold bg-white focus:outline-none focus:border-blue-400 text-sm"
                  value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}>
                  <option value="">— No event (warehouse stock) —</option>
                  {events.map(e => <option key={e.slug} value={e.slug}>{e.event_name}</option>)}
                </select>
                {selectedEvent && <p className="text-xs text-blue-500 mt-1">✓ Will auto-create inventory for this event when saved</p>}
              </div>

              <textarea className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 mb-4"
                placeholder="Notes (truck date, delivery location, etc.)" rows={2}
                value={poNotes} onChange={e => setPoNotes(e.target.value)} />

              {poItems.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No items yet.</p>
              ) : (
                <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
                  {poItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      {item.image_url && <img src={item.image_url} alt={item.color_name} className="w-12 h-12 object-cover rounded-lg shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm truncate">{item.product_name}</p>
                        <p className="text-xs text-gray-500">{item.color_name} — {item.size} × {item.qty}</p>
                        <p className="text-xs text-green-600 font-bold">${item.unit_cost}/ea = ${item.total_cost.toFixed(2)}</p>
                      </div>
                      <button onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-500 transition-all shrink-0 text-lg">✕</button>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={savePO} disabled={saving || poItems.length === 0}
                className={`w-full py-4 rounded-2xl font-black text-white text-lg transition-all ${saved ? 'bg-green-500' : 'bg-slate-900 hover:bg-slate-700'} disabled:opacity-40`}>
                {saved ? '✅ Saved!' : saving ? 'Saving...' : `💾 Save PO · ${totalQty} pcs · $${totalCost.toFixed(2)}`}
              </button>
            </div>

            <Link href="/admin/purchasing/manage" className="block bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-center hover:border-blue-300 transition-all">
              <p className="font-black text-gray-700">📋 View All Purchase Orders →</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
