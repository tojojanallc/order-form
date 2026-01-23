// @ts-nocheck
'use client'; 

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- IMPORT CENTRALIZED DATA ---
import { PRODUCTS, LOGO_OPTIONS, POSITIONS } from './config';

// --- DATABASE CONNECTION ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export default function OrderForm() {
  const [cart, setCart] = useState([]); 
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [selectedProduct, setSelectedProduct] = useState(PRODUCTS[0]);
  const [size, setSize] = useState('Adult M');
  const [logos, setLogos] = useState([]); 
  const [names, setNames] = useState([]);
  const [backNameList, setBackNameList] = useState(false);
  const [metallicHighlight, setMetallicHighlight] = useState(false);

  const calculateTotal = () => {
    let total = selectedProduct.basePrice;
    total += logos.length * 5;      
    total += names.length * 5;      
    if (backNameList) total += 5;   
    if (metallicHighlight) total += 5; 
    return total;
  };

  const calculateGrandTotal = () => {
    return cart.reduce((sum, item) => sum + item.finalPrice, 0);
  };

  const handleAddToCart = () => {
    const missingLogoPos = logos.some(l => !l.position);
    const missingNamePos = names.some(n => !n.position);
    if (missingLogoPos || missingNamePos) { alert("Please select a Position for every Logo and Name."); return; }

    const newItem = {
      id: Date.now(),
      productName: selectedProduct.name,
      size: size,
      customizations: { logos, names, backList: backNameList, metallic: metallicHighlight },
      finalPrice: calculateTotal()
    };
    setCart([...cart, newItem]);
    setLogos([]); setNames([]); setBackNameList(false); setMetallicHighlight(false);
  };

  const removeItem = (itemId) => setCart(cart.filter(item => item.id !== itemId));

  const getValidPositions = () => POSITIONS[selectedProduct.type] || POSITIONS.top;
  const updateLogo = (i, f, v) => { const n = [...logos]; n[i][f] = v; setLogos(n); };
  const updateName = (i, f, v) => { const n = [...names]; n[i][f] = v; setNames(n); };

  const handleCheckout = async () => {
    if (!customerName || !customerPhone) { alert("Please enter your Name and Phone Number"); return; }
    if (!supabase) { alert("System Error: Database not connected."); return; }
    
    setIsSubmitting(true);

    const { error } = await supabase.from('orders').insert([{ 
      customer_name: customerName, phone: customerPhone, cart_data: cart, total_price: calculateGrandTotal() 
    }]);

    if (error) {
       console.error(error); 
       alert('Error saving to database. Check console.'); 
       setIsSubmitting(false); 
       return;
    }

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart, customerName }),
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url; 
      } else {
        alert("Error creating payment session: " + (data.error || "Unknown Error"));
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      alert("Checkout failed unexpectedly.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 font-sans text-gray-900">
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
        {/* LEFT COLUMN */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-gray-300">
            <div className="bg-blue-900 text-white p-6 text-center">
              <h1 className="text-2xl font-bold uppercase tracking-wide">2025 Championships</h1>
              <p className="text-blue-100 text-sm mt-1">Order Form</p>
            </div>
            
            <div className="p-6 space-y-8">
              {/* SECTION 1 */}
              <section className="bg-gray-50 p-4 rounded-lg border border-gray-300">
                <h2 className="font-bold text-black mb-3 border-b border-gray-300 pb-2">1. Select Garment</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-gray-900 uppercase">Item</label>
                    <select className="w-full p-3 border border-gray-400 rounded-lg bg-white text-black font-medium" onChange={(e) => setSelectedProduct(PRODUCTS.find(p => p.id === e.target.value))} value={selectedProduct.id}>
                      {PRODUCTS.map(p => <option key={p.id} value={p.id}>{p.name} - ${p.basePrice}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-black text-gray-900 uppercase">Size</label>
                    <select className="w-full p-3 border border-gray-400 rounded-lg bg-white text-black font-medium" value={size} onChange={(e) => setSize(e.target.value)}>
                      <optgroup label="Youth"><option>Youth S</option><option>Youth M</option><option>Youth L</option><option>Youth XL</option></optgroup>
                      <optgroup label="Adult"><option>Adult S</option><option>Adult M</option><option>Adult L</option><option>Adult XL</option></optgroup>
                    </select>
                  </div>
                </div>
              </section>

              {/* SECTION 2 */}
              <section>
                <div className="flex justify-between items-center mb-3 border-b border-gray-300 pb-2"><h2 className="font-bold text-black">2. Accent Logos</h2><span className="text-xs bg-blue-100 text-blue-900 px-2 py-1 rounded-full font-bold">+$5.00</span></div>
                {logos.map((logo, index) => (
                  <div key={index} className="flex flex-col md:flex-row gap-2 mb-3 bg-gray-50 p-3 rounded border border-gray-300">
                    <select className="border border-gray-400 p-2 rounded flex-1 bg-white text-black" value={logo.type} onChange={(e) => updateLogo(index, 'type', e.target.value)}>{LOGO_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}</select>
                    <select className="border border-gray-400 p-2 rounded md:w-48 bg-white text-black" value={logo.position} onChange={(e) => updateLogo(index, 'position', e.target.value)}><option value="">Select Position...</option>{getValidPositions().map(pos => <option key={pos.id} value={pos.label}>{pos.label}</option>)}</select>
                    <button onClick={() => setLogos(logos.filter((_, i) => i !== index))} className="text-red-600 font-bold px-2">×</button>
                  </div>
                ))}
                <button onClick={() => setLogos([...logos, { type: 'Butterfly', position: '' }])} className="w-full py-2 border-2 border-dashed border-gray-400 text-gray-700 rounded hover:border-blue-600 hover:text-blue-600 font-bold">+ Add Logo</button>
              </section>

              {/* SECTION 3 */}
              <section>
                <div className="flex justify-between items-center mb-3 border-b border-gray-300 pb-2"><h2 className="font-bold text-black">3. Names</h2><span className="text-xs bg-blue-100 text-blue-900 px-2 py-1 rounded-full font-bold">+$5.00</span></div>
                {names.map((nameItem, index) => (
                  <div key={index} className="flex flex-col md:flex-row gap-2 mb-3 bg-gray-50 p-3 rounded border border-gray-300">
                    <input type="text" maxLength={12} placeholder="NAME" className="border border-gray-400 p-2 rounded flex-1 uppercase text-black" value={nameItem.text} onChange={(e) => updateName(index, 'text', e.target.value)} />
                    <select className="border border-gray-400 p-2 rounded md:w-48 bg-white text-black" value={nameItem.position} onChange={(e) => updateName(index, 'position', e.target.value)}><option value="">Select Position...</option>{getValidPositions().map(pos => <option key={pos.id} value={pos.label}>{pos.label}</option>)}</select>
                    <button onClick={() => setNames(names.filter((_, i) => i !== index))} className="text-red-600 font-bold px-2">×</button>
                  </div>
                ))}
                <button onClick={() => setNames([...names, { text: '', position: '' }])} className="w-full py-2 border-2 border-dashed border-gray-400 text-gray-700 rounded hover:border-blue-600 hover:text-blue-600 font-bold">+ Add Name</button>
              </section>

              {/* SECTION 4/5 */}
              <section className="bg-yellow-50 p-4 rounded-lg border border-yellow-300">
                <label className="flex items-center gap-3 mb-2 cursor-pointer"><input type="checkbox" className="w-5 h-5 text-blue-800" checked={backNameList} onChange={(e) => setBackNameList(e.target.checked)} /><span className="font-bold text-black">Back Name List (+$5)</span></label>
                <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="w-5 h-5 text-blue-800" checked={metallicHighlight} onChange={(e) => setMetallicHighlight(e.target.checked)} /><span className="font-bold text-black">Metallic Highlight (+$5)</span></label>
              </section>
            </div>
            <div className="bg-gray-900 text-white p-6 sticky bottom-0 flex justify-between items-center"><div><p className="text-gray-300 text-xs uppercase">Current Item</p><p className="text-2xl font-bold">${calculateTotal()}</p></div><button onClick={handleAddToCart} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg active:scale-95 transition-transform">Add to Cart</button></div>
          </div>
        </div>

        {/* RIGHT COLUMN: CART */}
        <div className="md:col-span-1">
          <div className="bg-white shadow-xl rounded-xl border border-gray-300 sticky top-4">
            <div className="bg-gray-800 text-white p-4 rounded-t-xl"><h2 className="font-bold text-lg">Your Cart</h2><p className="text-gray-300 text-sm">{cart.length} items</p></div>
            <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
              {cart.length === 0 ? <p className="text-gray-500 text-center italic py-10">Cart is empty.</p> : cart.map((item) => (
                <div key={item.id} className="border-b border-gray-200 pb-4 last:border-0 relative group">
                  <button onClick={() => removeItem(item.id)} className="absolute top-0 right-0 text-red-500 hover:text-red-700 font-bold text-xs p-1">REMOVE</button>
                  <p className="font-black text-black text-lg">{item.productName}</p><p className="text-sm text-gray-800 font-medium">Size: {item.size}</p>
                  <div className="text-xs text-gray-800 mt-1 space-y-1 font-medium">{item.customizations.logos.map((l, i) => <div key={i}>• {l.type} ({l.position})</div>)}{item.customizations.names.map((n, i) => <div key={i}>• "{n.text}" ({n.position})</div>)}</div>
                  <p className="font-bold text-right mt-2 text-blue-900 text-lg">${item.finalPrice}.00</p>
                </div>
              ))}
            </div>

            {/* CHECKOUT FORM */}
            {cart.length > 0 && (
              <div className="p-4 bg-gray-100 border-t border-gray-300 rounded-b-xl">
                <h3 className="font-bold text-black mb-2">6. Customer Info</h3>
                <input className="w-full p-2 border border-gray-400 rounded mb-2 text-sm text-black" placeholder="Full Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                <input className="w-full p-2 border border-gray-400 rounded mb-4 text-sm text-black" placeholder="Phone Number" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                <div className="flex justify-between items-center mb-4 border-t border-gray-300 pt-4"><span className="font-bold text-black">Total Due</span><span className="font-bold text-2xl text-blue-900">${calculateGrandTotal()}</span></div>
                <button onClick={handleCheckout} disabled={isSubmitting} className={`w-full py-3 rounded-lg font-bold shadow transition-colors text-white ${isSubmitting ? 'bg-gray-500' : 'bg-blue-800 hover:bg-blue-900'}`}>{isSubmitting ? "Processing..." : "Pay Now with Stripe"}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}