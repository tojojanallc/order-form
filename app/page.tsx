// @ts-nocheck
'use client'; 

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { POSITIONS } from './config'; 

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const SIZE_ORDER = ['Youth XS', 'Youth S', 'Youth M', 'Youth L', 'Adult S', 'Adult M', 'Adult L', 'Adult XL', 'Adult XXL', 'Adult 3XL', 'Adult 4XL'];

export default function OrderForm() {
  const [cart, setCart] = useState([]); 
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingZip, setShippingZip] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  
  const [guests, setGuests] = useState([]);
  const [selectedGuest, setSelectedGuest] = useState(null); 
  const [guestSearch, setGuestSearch] = useState('');
  const [guestError, setGuestError] = useState(''); 

  const [products, setProducts] = useState([]); 
  const [inventory, setInventory] = useState({});
  const [activeItems, setActiveItems] = useState({});
  
  // LOGO STATES
  const [logoOptions, setLogoOptions] = useState([]); 
  const [mainOptions, setMainOptions] = useState([]); // Main Designs (Pick 1)
  const [accentOptions, setAccentOptions] = useState([]); // Accents (Pick Any)

  const [eventName, setEventName] = useState('Lev Custom Merch');
  const [eventLogo, setEventLogo] = useState('');
  const [paymentMode, setPaymentMode] = useState('retail'); 
  const [showBackNames, setShowBackNames] = useState(true);
  const [showMetallic, setShowMetallic] = useState(true);

  // SELECTIONS
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [size, setSize] = useState('');
  const [selectedMainDesign, setSelectedMainDesign] = useState(''); 
  const [logos, setLogos] = useState([]); // Accents list
  const [names, setNames] = useState([]);
  const [backNameList, setBackNameList] = useState(false);
  const [metallicHighlight, setMetallicHighlight] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!supabase) return;
      const { data: productData } = await supabase.from('products').select('*').order('sort_order');
      if (productData) setProducts(productData);

      const { data: logoData } = await supabase.from('logos').select('label, image_url, category').eq('active', true).order('sort_order');
      if (logoData) {
          setLogoOptions(logoData);
          setMainOptions(logoData.filter(l => l.category === 'main'));
          setAccentOptions(logoData.filter(l => !l.category || l.category === 'accent'));
      }

      const { data: invData } = await supabase.from('inventory').select('*');
      if (invData) {
        const stockMap = {};
        const activeMap = {};
        invData.forEach(item => {
            const key = `${item.product_id}_${item.size}`;
            stockMap[key] = item.count;
            activeMap[key] = item.active;
        });
        setInventory(stockMap);
        setActiveItems(activeMap);
      }
      const { data: settings } = await supabase.from('event_settings').select('*').single();
      if (settings) {
        setEventName(settings.event_name);
        setEventLogo(settings.event_logo_url);
        setPaymentMode(settings.payment_mode || 'retail');
        setShowBackNames(settings.offer_back_names ?? true);
        setShowMetallic(settings.offer_metallic ?? true);
      }

      const { data: guestData } = await supabase.from('guests').select('*');
      if (guestData) setGuests(guestData);
    };
    fetchData();
  }, []);

  const verifyGuest = () => {
      if (!guestSearch.trim()) return;
      setGuestError('');
      const search = guestSearch.trim().toLowerCase();
      const match = guests.find(g => g.name.toLowerCase() === search);
      if (match) {
          if (match.has_ordered) { setGuestError("❌ This name has already redeemed their item."); setSelectedGuest(null); } 
          else { setSelectedGuest(match); setCustomerName(match.name); setGuestError(''); }
      } else { setGuestError("❌ Name not found. Please type your full name exactly."); setSelectedGuest(null); }
  };

  const visibleProducts = products.filter(p => Object.keys(activeItems).some(k => k.startsWith(p.id) && activeItems[k] === true));

  useEffect(() => {
    if (!selectedProduct && visibleProducts.length > 0) setSelectedProduct(visibleProducts[0]);
  }, [visibleProducts, selectedProduct]);

  useEffect(() => {
      if (mainOptions.length === 1) {
          setSelectedMainDesign(mainOptions[0].label);
      }
  }, [mainOptions]);

  const getVisibleSizes = () => {
    if (!selectedProduct) return [];
    const unsorted = Object.keys(activeItems).filter(key => key.startsWith(selectedProduct.id + '_') && activeItems[key] === true).map(key => key.replace(`${selectedProduct.id}_`, ''));
    return unsorted.sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
  };
  const visibleSizes = getVisibleSizes();

  useEffect(() => {
    if (visibleSizes.length > 0 && !visibleSizes.includes(size)) setSize(visibleSizes[0]);
  }, [selectedProduct, visibleSizes, size]);

  const stockKey = selectedProduct ? `${selectedProduct.id}_${size}` : '';
  const currentStock = inventory[stockKey] ?? 0;
  const isOutOfStock = currentStock <= 0;

  const calculateTotal = () => {
    if (!selectedProduct) return 0;
    let total = selectedProduct.base_price; 
    total += logos.length * 5;      
    total += names.length * 5;      
    if (backNameList) total += 5;   
    if (metallicHighlight) total += 5; 
    return total;
  };

  const calculateGrandTotal = () => cart.reduce((sum, item) => sum + item.finalPrice, 0);

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    if (mainOptions.length > 0 && !selectedMainDesign) { alert("Please select a Design (Step 2)."); return; }
    
    const missingLogoPos = logos.some(l => !l.position);
    const missingNamePos = names.some(n => !n.position);
    if (missingLogoPos || missingNamePos) { alert("Please select a Position for every Accent Logo and Name."); return; }

    const newItem = {
      id: Date.now(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      size: size,
      needsShipping: isOutOfStock, 
      customizations: { 
          mainDesign: selectedMainDesign, 
          logos, 
          names, 
          backList: backNameList, 
          metallic: metallicHighlight 
      },
      finalPrice: calculateTotal()
    };
    setCart([...cart, newItem]);
    
    setLogos([]); setNames([]); setBackNameList(false); setMetallicHighlight(false);
    if (mainOptions.length > 1) setSelectedMainDesign(''); 
  };

  const removeItem = (itemId) => setCart(cart.filter(item => item.id !== itemId));
  const getValidPositions = () => selectedProduct ? (POSITIONS[selectedProduct.type] || POSITIONS.top) : [];
  
  const addLogo = (logoLabel) => { setLogos([...logos, { type: logoLabel, position: '' }]); };
  const updateLogo = (i, f, v) => { const n = [...logos]; n[i][f] = v; setLogos(n); };
  const updateName = (i, f, v) => { const n = [...names]; n[i][f] = v; setNames(n); };
  const cartRequiresShipping = cart.some(item => item.needsShipping);
  const getLogoImage = (type) => { const found = logoOptions.find(l => l.label === type); return found ? found.image_url : null; };

  const handleCheckout = async () => {
    if (paymentMode === 'hosted') {
        if (!selectedGuest) { alert("Please verify your name first."); return; }
        if (selectedGuest.has_ordered) { alert("Already redeemed."); return; }
    } else {
        if (!customerName) { alert("Please enter Name"); return; }
    }
    
    if (cartRequiresShipping) { if (!shippingAddress || !shippingCity || !shippingState || !shippingZip) { alert("Shipping Address Required!"); return; } }
    
    setIsSubmitting(true);
    
    const { error } = await supabase.from('orders').insert([{ 
      customer_name: paymentMode === 'hosted' ? selectedGuest.name : customerName, 
      phone: customerPhone || 'N/A', 
      cart_data: cart, total_price: calculateGrandTotal(),
      shipping_address: cartRequiresShipping ? shippingAddress : null,
      shipping_city: cartRequiresShipping ? shippingCity : null,
      shipping_state: cartRequiresShipping ? shippingState : null,
      shipping_zip: cartRequiresShipping ? shippingZip : null,
      status: cartRequiresShipping ? 'pending_shipping' : 'pending' 
    }]);

    if (error) { console.error(error); alert('Error saving order.'); setIsSubmitting(false); return; }

    if (paymentMode === 'hosted' && selectedGuest) {
        await supabase.from('guests').update({ has_ordered: true }).eq('id', selectedGuest.id);
        setOrderComplete(true);
        setCart([]);
        setSelectedGuest(null);
        setGuestSearch('');
    } else {
        try {
            const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart, customerName }) });
            const data = await response.json();
            if (data.url) window.location.href = data.url; else alert("Payment Error");
        } catch (err) { alert("Checkout failed."); setIsSubmitting(false); }
    }
  };

  if (products.length === 0) return <div className="p-10 text-center font-bold">Loading Menu...</div>;
  if (!selectedProduct) return <div className="p-10 text-center">No active products available.</div>;

  if (orderComplete) {
      return (
          <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-8 text-center">
              <div className="bg-white p-8 rounded-xl shadow-lg border border-green-200 max-w-md">
                  <div className="text-6xl mb-4">🎉</div>
                  <h1 className="text-3xl font-black text-green-800 mb-2">Order Received!</h1>
                  <p className="text-gray-600 mb-6">Your gear is being prepared.</p>
                  <button onClick={() => { setOrderComplete(false); setCustomerName(''); setCustomerEmail(''); setCustomerPhone(''); window.location.reload(); }} className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700">Done</button>
              </div>
          </div>
      );
  }

  const showPrice = paymentMode === 'retail';

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 font-sans text-gray-900">
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-gray-300">
            <div className="bg-blue-900 text-white p-6 text-center">
              {eventLogo ? <img src={eventLogo} alt="Event Logo" className="h-16 mx-auto mb-2" /> : <h1 className="text-2xl font-bold uppercase tracking-wide">{eventName}</h1>}
              <p className="text-blue-100 text-sm mt-1">{eventLogo ? eventName : 'Order Form'}</p>
            </div>
            <div className="p-6 space-y-8">
              
              <section className="bg-gray-50 p-4 rounded-lg border border-gray-300">
                <h2 className="font-bold text-black mb-3 border-b border-gray-300 pb-2">1. Select Garment</h2>
                {selectedProduct && selectedProduct.image_url && (<div className="mb-4 bg-white p-2 rounded border border-gray-200 flex justify-center"><img src={selectedProduct.image_url} alt={selectedProduct.name} className="h-48 object-contain" /></div>)}
                {isOutOfStock ? (<div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-4" role="alert"><p className="font-bold">⚠️ Out of Stock at Event</p><p className="text-sm">We can ship this to your home!</p></div>) : <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-2 mb-4 text-xs font-bold uppercase">✓ In Stock ({currentStock} available)</div>}
                <div className="grid md:grid-cols-2 gap-4">
                  <div><label className="text-xs font-black text-gray-900 uppercase">Item</label><select className="w-full p-3 border border-gray-400 rounded-lg bg-white text-black font-medium" onChange={(e) => setSelectedProduct(visibleProducts.find(p => p.id === e.target.value))} value={selectedProduct.id}>{visibleProducts.map(p => <option key={p.id} value={p.id}>{p.name} {showPrice ? `- $${p.base_price}` : ''}</option>)}</select></div>
                  <div><label className="text-xs font-black text-gray-900 uppercase">Size</label><select className="w-full p-3 border border-gray-400 rounded-lg bg-white text-black font-medium" value={size} onChange={(e) => setSize(e.target.value)}>{visibleSizes.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                </div>
              </section>

              {/* --- 2. MAIN DESIGN (MANDATORY, RADIO) --- */}
              {mainOptions.length > 0 && (
                  <section>
                    <div className="flex justify-between items-center mb-3 border-b border-gray-300 pb-2"><h2 className="font-bold text-black">2. Choose Design</h2><span className="text-xs bg-green-100 text-green-900 px-2 py-1 rounded-full font-bold">Included</span></div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                        {mainOptions.map((opt) => (
                            <button 
                                key={opt.label} 
                                onClick={() => setSelectedMainDesign(opt.label)} 
                                className={`border-2 rounded-lg p-2 flex flex-col items-center gap-2 transition-all active:scale-95 ${selectedMainDesign === opt.label ? 'border-green-600 bg-green-50 ring-2 ring-green-200' : 'border-gray-200 bg-white hover:border-gray-400'}`}
                            >
                                {opt.image_url ? (
                                    <img src={opt.image_url} alt={opt.label} className="h-20 w-full object-contain" />
                                ) : (
                                    <div className="h-20 w-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">No Image</div>
                                )}
                                <span className={`text-xs font-bold text-center leading-tight ${selectedMainDesign === opt.label ? 'text-green-800' : 'text-gray-800'}`}>{opt.label}</span>
                                {selectedMainDesign === opt.label && <span className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded-full font-bold">SELECTED ✓</span>}
                            </button>
                        ))}
                    </div>
                  </section>
              )}

              {/* --- 3. ACCENT LOGOS (CONDITIONAL) --- */}
              {accentOptions.length > 0 && (
                  <section>
                    <div className="flex justify-between items-center mb-3 border-b border-gray-300 pb-2"><h2 className="font-bold text-black">3. Add Accents (Optional)</h2>{showPrice && <span className="text-xs bg-blue-100 text-blue-900 px-2 py-1 rounded-full font-bold">+$5.00</span>}</div>
                    
                    {/* Visual Menu for Accents */}
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mb-4">
                        {accentOptions.map((opt) => (
                            <button 
                                key={opt.label} 
                                onClick={() => addLogo(opt.label)} 
                                className="bg-white border border-gray-300 hover:border-blue-500 rounded p-2 flex flex-col items-center gap-1 transition-all active:scale-95"
                            >
                                {opt.image_url ? <img src={opt.image_url} className="h-12 w-full object-contain" /> : <div className="h-12 w-full bg-gray-100 text-[10px] flex items-center justify-center">No Img</div>}
                                <span className="text-[10px] font-bold text-center leading-tight truncate w-full">{opt.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Selected List */}
                    {logos.length > 0 && (
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-300 space-y-3">
                            <h3 className="text-xs font-bold uppercase text-gray-500">Selected Accents (Set Position)</h3>
                            {logos.map((logo, index) => {
                                const currentImage = getLogoImage(logo.type);
                                return (
                                    <div key={index} className="flex items-center gap-3 bg-white p-2 rounded border border-gray-200 shadow-sm">
                                        <div className="w-10 h-10 flex-shrink-0 border rounded bg-gray-50 flex items-center justify-center">{currentImage ? <img src={currentImage} className="max-h-8 max-w-8" /> : <span className="text-xs">IMG</span>}</div>
                                        <div className="flex-1"><div className="text-sm font-bold">{logo.type}</div></div>
                                        <select className={`border-2 p-1 rounded text-sm ${!logo.position ? 'border-red-400 bg-red-50 text-red-900' : 'border-gray-300 text-black'}`} value={logo.position} onChange={(e) => updateLogo(index, 'position', e.target.value)}><option value="">Position...</option>{getValidPositions().map(pos => <option key={pos.id} value={pos.label}>{pos.label}</option>)}</select>
                                        <button onClick={() => setLogos(logos.filter((_, i) => i !== index))} className="text-gray-400 hover:text-red-600 font-bold text-xl px-2">×</button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                  </section>
              )}

              <section>
                <div className="flex justify-between items-center mb-3 border-b border-gray-300 pb-2"><h2 className="font-bold text-black">4. Personalization</h2>{showPrice && <span className="text-xs bg-blue-100 text-blue-900 px-2 py-1 rounded-full font-bold">+$5.00</span>}</div>
                {names.map((nameItem, index) => (
                  <div key={index} className="flex flex-col md:flex-row gap-2 mb-3 bg-gray-50 p-3 rounded border border-gray-300">
                    <input type="text" maxLength={12} placeholder="NAME" className="border border-gray-400 p-2 rounded flex-1 uppercase text-black" value={nameItem.text} onChange={(e) => updateName(index, 'text', e.target.value)} />
                    <select className="border border-gray-400 p-2 rounded md:w-48 bg-white text-black" value={nameItem.position} onChange={(e) => updateName(index, 'position', e.target.value)}><option value="">Select Position...</option>{getValidPositions().map(pos => <option key={pos.id} value={pos.label}>{pos.label}</option>)}</select>
                    <button onClick={() => setNames(names.filter((_, i) => i !== index))} className="text-red-600 font-bold px-2">×</button>
                  </div>
                ))}
                
                {/* --- FIX: UPDATED BUTTON TEXT --- */}
                <button onClick={() => setNames([...names, { text: '', position: '' }])} className="w-full py-2 border-2 border-dashed border-gray-400 text-gray-700 rounded hover:border-blue-600 hover:text-blue-600 font-bold">+ Add Your Name to Your Apparel</button>
              
              </section>
              
              {showBackNames && (<section className="bg-yellow-50 p-4 rounded-lg border border-yellow-300"><label className="flex items-center gap-3 mb-2 cursor-pointer"><input type="checkbox" className="w-5 h-5 text-blue-800" checked={backNameList} onChange={(e) => setBackNameList(e.target.checked)} /><span className="font-bold text-black">Back Name List {showPrice && '(+$5)'}</span></label>{showMetallic && (<label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="w-5 h-5 text-blue-800" checked={metallicHighlight} onChange={(e) => setMetallicHighlight(e.target.checked)} /><span className="font-bold text-black">Metallic Highlight {showPrice && '(+$5)'}</span></label>)}</section>)}

            </div>
            <div className="bg-gray-900 text-white p-6 sticky bottom-0 flex justify-between items-center"><div><p className="text-gray-300 text-xs uppercase">{showPrice ? 'Current Item' : 'Your Selection'}</p><p className="text-2xl font-bold">{showPrice ? `$${calculateTotal()}` : 'Free'}</p></div><button onClick={handleAddToCart} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg active:scale-95 transition-transform">Add to Cart</button></div>
          </div>
        </div>
        <div className="md:col-span-1">
          <div className="bg-white shadow-xl rounded-xl border border-gray-300 sticky top-4">
            <div className="bg-gray-800 text-white p-4 rounded-t-xl"><h2 className="font-bold text-lg">Your Cart</h2><p className="text-gray-300 text-sm">{cart.length} items</p></div>
            <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
              {cart.length === 0 ? <p className="text-gray-500 text-center italic py-10">Cart is empty.</p> : cart.map((item) => (
                <div key={item.id} className="border-b border-gray-200 pb-4 last:border-0 relative group">
                  <button onClick={() => removeItem(item.id)} className="absolute top-0 right-0 text-red-500 hover:text-red-700 font-bold text-xs p-1">REMOVE</button>
                  <p className="font-black text-black text-lg">{item.productName}</p>
                  {item.needsShipping && <span className="bg-orange-200 text-orange-800 text-xs font-bold px-2 py-1 rounded">Ship to Home</span>}
                  <p className="text-sm text-gray-800 font-medium">Size: {item.size}</p>
                  <div className="text-xs text-blue-900 font-bold mt-1">Main Design: {item.customizations.mainDesign}</div>
                  <div className="text-xs text-gray-800 mt-1 space-y-1 font-medium">{item.customizations.logos.map((l, i) => <div key={i}>• {l.type} ({l.position})</div>)}{item.customizations.names.map((n, i) => <div key={i}>• "{n.text}" ({n.position})</div>)}</div>
                  {showPrice && <p className="font-bold text-right mt-2 text-blue-900 text-lg">${item.finalPrice}.00</p>}
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="p-4 bg-gray-100 border-t border-gray-300 rounded-b-xl">
                <h3 className="font-bold text-black mb-2">6. Customer Info</h3>
                
                {paymentMode === 'hosted' ? (
                    <div className="relative mb-4">
                        <label className="text-xs font-bold uppercase text-gray-700 mb-1 block">Full Name</label>
                        <div className="flex gap-2">
                            <input className={`flex-1 p-3 border-2 rounded-lg text-lg ${selectedGuest ? 'border-green-500 bg-green-50 text-green-900 font-bold' : 'border-gray-400'}`} placeholder="Enter full name" value={guestSearch} disabled={!!selectedGuest} onChange={(e) => { setGuestSearch(e.target.value); setSelectedGuest(null); setGuestError(''); }} />
                            {selectedGuest ? (<button onClick={() => { setSelectedGuest(null); setGuestSearch(''); }} className="bg-gray-200 text-gray-700 font-bold px-4 rounded hover:bg-gray-300">Reset</button>) : (<button onClick={verifyGuest} className="bg-blue-800 text-white font-bold px-4 rounded hover:bg-blue-900">Check</button>)}
                        </div>
                        {guestError && <p className="text-red-600 text-sm font-bold mt-2">{guestError}</p>}
                        {selectedGuest && <p className="text-green-700 text-sm font-bold mt-2">✅ Verified! Welcome, {selectedGuest.name}.</p>}
                    </div>
                ) : (
                    <>
                        <input className="w-full p-2 border border-gray-400 rounded mb-2 text-sm text-black" placeholder="Full Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                        <input className="w-full p-2 border border-gray-400 rounded mb-2 text-sm text-black" placeholder="Email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                        <input className="w-full p-2 border border-gray-400 rounded mb-4 text-sm text-black" placeholder="Phone Number" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                    </>
                )}

                {cartRequiresShipping && (<div className="bg-orange-50 border border-orange-200 p-3 rounded mb-4 animate-pulse-once"><h4 className="font-bold text-orange-800 text-sm mb-2">🚚 Shipping Address Required</h4><input className="w-full p-2 border border-gray-300 rounded mb-2 text-sm" placeholder="Street Address" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} /><div className="grid grid-cols-2 gap-2"><input className="w-full p-2 border border-gray-300 rounded mb-2 text-sm" placeholder="City" value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} /><input className="w-full p-2 border border-gray-300 rounded mb-2 text-sm" placeholder="State" value={shippingState} onChange={(e) => setShippingState(e.target.value)} /></div><input className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="Zip Code" value={shippingZip} onChange={(e) => setShippingZip(e.target.value)} /></div>)}
                {showPrice && <div className="flex justify-between items-center mb-4 border-t border-gray-300 pt-4"><span className="font-bold text-black">Total Due</span><span className="font-bold text-2xl text-blue-900">${calculateGrandTotal()}</span></div>}
                
                <button onClick={handleCheckout} disabled={isSubmitting || (paymentMode === 'hosted' && !selectedGuest)} className={`w-full py-3 rounded-lg font-bold shadow transition-colors text-white ${isSubmitting || (paymentMode === 'hosted' && !selectedGuest) ? 'bg-gray-400' : 'bg-blue-800 hover:bg-blue-900'}`}>
                    {isSubmitting ? "Processing..." : (paymentMode === 'hosted' ? "🎉 Submit Order (Free)" : "Pay Now with Stripe")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}