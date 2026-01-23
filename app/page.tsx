// @ts-nocheck
'use client'; 

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- ⚠️ PASTE YOUR REAL KEYS HERE OR IT WILL CRASH ⚠️ ---
const SUPABASE_URL = 'https://jtywzhexaqlhzgbgdupz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0eXd6aGV4YXFsaHpnYmdkdXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxOTQ0NTAsImV4cCI6MjA4NDc3MDQ1MH0.9xsTi8YlmTwm2ALynmyjbTGZYhQnPXfV-RnqB7e3dJc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 1. CONFIGURATION ---
const PRODUCTS = [
  { id: 'hoodie_aqua', name: 'Unisex Hoodie (Aqua)', basePrice: 60, type: 'top' },
  { id: 'hoodie_grey', name: 'Unisex Hoodie (Grey)', basePrice: 60, type: 'top' },
  { id: 'crew_red', name: 'Crew Sweat (Red)', basePrice: 55, type: 'top' },
  { id: 'tee_royal', name: 'Tie Dye T-Shirt (Royal)', basePrice: 35, type: 'top' },
  { id: 'tee_dusk', name: 'Short Sleeve T-Shirt (Dusk)', basePrice: 30, type: 'top' },
  { id: 'jogger_grey', name: 'Unisex Jogger Pant', basePrice: 40, type: 'bottom' },
];

const LOGO_OPTIONS = ['Butterfly', 'Backstroke', 'Breaststroke', 'Freestyle', 'IM', 'GO State', 'WI State', 'Flag'];

// --- 2. POSITION DEFINITIONS (The "Smart" List) ---
const POSITIONS = {
  top: [
    { id: '1', label: 'Pos 1: Full Front' },
    { id: '2', label: 'Pos 2: Left Crest' },
    { id: '3', label: 'Pos 3: Full Back' },
    { id: '4', label: 'Pos 4: Upper Back' },
    { id: '5', label: 'Pos 5: Lower Back' },
    { id: '6', label: 'Pos 6: Vertical Back' },
    { id: '7', label: 'Pos 7: Sleeve' },
  ],
  bottom: [
    { id: '8', label: 'Pos 8: Left Hip' },
    { id: '9', label: 'Pos 9: Right Hip' },
    { id: '10', label: 'Pos 10: Leg Vertical' },
  ]
};

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

  // --- CALCULATOR ---
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

  // --- HANDLERS ---
  const handleAddToCart = () => {
    const missingLogoPos = logos.some(l => !l.position);
    const missingNamePos = names.some(n => !n.position);
    
    if (missingLogoPos || missingNamePos) {
      alert("Please select a Position for every Logo and Name.");
      return;
    }

    const newItem = {
      id: Date.now(),
      productName: selectedProduct.name,
      size: size,
      customizations: { logos, names, backList: backNameList, metallic: metallicHighlight },
      finalPrice: calculateTotal()
    };
    setCart([...cart, newItem]);
    setLogos([]);
    setNames([]);
    setBackNameList(false);
    setMetallicHighlight(false);
  };

  const removeItem = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const handleSubmitOrder = async () => {
    if (!customerName || !customerPhone) {
      alert("Please enter your Name and Phone Number (Section 6)");
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.from('orders').insert([{ 
      customer_name: customerName, phone: customerPhone, cart_data: cart, total_price: calculateGrandTotal() 
    }]);
    setIsSubmitting(false);
    if (error) { console.error(error); alert('Error submitting order!'); } 
    else { alert('Order Submitted Successfully!'); setCart([]); setCustomerName(''); setCustomerPhone(''); }
  };

  // --- HELPERS FOR THE UI ---
  const getValidPositions = () => {
    return POSITIONS[selectedProduct.type] || POSITIONS.top;
  };

  const updateLogo = (index, field, value) => {
    const newLogos = [...logos];
    newLogos[index][field] = value;
    setLogos(newLogos);
  };

  const updateName = (index, field, value) => {
    const newNames = [...names];
    newNames[index][field] = value;
    setNames(newNames);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 font-sans">
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: BUILDER */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200">
            <div className="bg-blue-900 text-white p-6 text-center">
              <h1 className="text-2xl font-bold uppercase tracking-wide">2025 Championships</h1>
              <p className="text-blue-200 text-sm mt-1">Order Form</p>
            </div>
            
            <div className="p-6 space-y-8">
              {/* SECTION 1 */}
              <section className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h2 className="font-bold text-gray-700 mb-3 border-b pb-2">1. Select Garment</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Item</label>
                    <select 
                      className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                      onChange={(e) => setSelectedProduct(PRODUCTS.find(p => p.id === e.target.value))}
                      value={selectedProduct.id}
                    >
                      {PRODUCTS.map(p => (
                        <option key={p.id} value={p.id}>{p.name} - ${p.basePrice}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Size</label>
                    <select 
                      className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                    >
                      <optgroup label="Youth">
                        <option>Youth S</option><option>Youth M</option><option>Youth L</option><option>Youth XL</option>
                      </optgroup>
                      <optgroup label="Adult">
                        <option>Adult S</option><option>Adult M</option><option>Adult L</option><option>Adult XL</option>
                      </optgroup>
                    </select>
                  </div>
                </div>
              </section>

              {/* SECTION 2: LOGOS */}
              <section>
                <div className="flex justify-between items-center mb-3 border-b pb-2">
                  <h2 className="font-bold text-gray-700">2. Accent Logos</h2>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">+$5.00</span>
                </div>
                {logos.map((logo, index) => (
                  <div key={index} className="flex flex-col md:flex-row gap-2 mb-3 bg-gray-50 p-3 rounded border">
                    <select 
                      className="border p-2 rounded flex-1 bg-white"
                      value={logo.type}
                      onChange={(e) => updateLogo(index, 'type', e.target.value)}
                    >
                      {LOGO_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
                    </select>
                    
                    {/* VISUAL POSITION SELECTOR */}
                    <select 
                      className="border p-2 rounded md:w-48 bg-white"
                      value={logo.position}
                      onChange={(e) => updateLogo(index, 'position', e.target.value)}
                    >
                      <option value="">Select Position...</option>
                      {getValidPositions().map(pos => (
                        <option key={pos.id} value={pos.label}>{pos.label}</option>
                      ))}
                    </select>

                    <button 
                      onClick={() => {
                        const newLogos = logos.filter((_, i) => i !== index);
                        setLogos(newLogos);
                      }}
                      className="text-red-500 font-bold px-2"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button onClick={() => setLogos([...logos, { type: 'Butterfly', position: '' }])} className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded hover:border-blue-500 hover:text-blue-500 font-semibold">+ Add Logo</button>
              </section>

              {/* SECTION 3: NAMES */}
              <section>
                <div className="flex justify-between items-center mb-3 border-b pb-2">
                  <h2 className="font-bold text-gray-700">3. Names</h2>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">+$5.00</span>
                </div>
                {names.map((nameItem, index) => (
                  <div key={index} className="flex flex-col md:flex-row gap-2 mb-3 bg-gray-50 p-3 rounded border">
                    <input 
                      type="text" 
                      maxLength={12} 
                      placeholder="NAME (Max 12)" 
                      className="border p-2 rounded flex-1 uppercase" 
                      value={nameItem.text}
                      onChange={(e) => updateName(index, 'text', e.target.value)}
                    />
                    
                    {/* VISUAL POSITION SELECTOR */}
                    <select 
                      className="border p-2 rounded md:w-48 bg-white"
                      value={nameItem.position}
                      onChange={(e) => updateName(index, 'position', e.target.value)}
                    >
                      <option value="">Select Position...</option>
                      {getValidPositions().map(pos => (
                        <option key={pos.id} value={pos.label}>{pos.label}</option>
                      ))}
                    </select>

                    <button 
                      onClick={() => {
                        const newNames = names.filter((_, i) => i !== index);
                        setNames(newNames);
                      }}
                      className="text-red-500 font-bold px-2"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button onClick={() => setNames([...names, { text: '', position: '' }])} className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded hover:border-blue-500 hover:text-blue-500 font-semibold">+ Add Name</button>
              </section>

              {/* SECTION 4/5 */}
              <section className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <label className="flex items-center gap-3 mb-2 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 text-blue-600" checked={backNameList} onChange={(e) => setBackNameList(e.target.checked)} />
                  <span className="font-medium text-gray-700">Back Name List (+$5)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 text-blue-600" checked={metallicHighlight} onChange={(e) => setMetallicHighlight(e.target.checked)} />
                  <span className="font-medium text-gray-700">Metallic Highlight (+$5)</span>
                </label>
              </section>
            </div>

            <div className="bg-gray-900 text-white p-6 sticky bottom-0 flex justify-between items-center">
              <div>
                <p className="text-gray-400 text-xs uppercase">Current Item</p>
                <p className="text-2xl font-bold">${calculateTotal()}</p>
              </div>
              <button 
                onClick={handleAddToCart}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-bold shadow-lg active:scale-95 transition-transform"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CART */}
        <div className="md:col-span-1">
          <div className="bg-white shadow-xl rounded-xl border border-gray-200 sticky top-4">
            <div className="bg-gray-800 text-white p-4 rounded-t-xl">
              <h2 className="font-bold text-lg">Your Cart</h2>
              <p className="text-gray-400 text-sm">{cart.length} items</p>
            </div>

            <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-gray-400 text-center italic py-10">Cart is empty.</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="border-b pb-4 last:border-0 relative group">
                    <button onClick={() => removeItem(item.id)} className="absolute top-0 right-0 text-red-400 hover:text-red-600 font-bold text-xs p-1">REMOVE</button>
                    <p className="font-bold text-gray-800">{item.productName}</p>
                    <p className="text-sm text-gray-600">Size: {item.size}</p>
                    
                    <div className="text-xs text-gray-500 mt-1 space-y-1">
                      {item.customizations.logos.map((l, i) => <div key={i}>• {l.type} ({l.position})</div>)}
                      {item.customizations.names.map((n, i) => <div key={i}>• "{n.text}" ({n.position})</div>)}
                    </div>
                    
                    <p className="font-bold text-right mt-2 text-blue-900">${item.finalPrice}.00</p>
                  </div>
                ))
              )}
            </div>

            {/* SECTION 6: CUSTOMER INFO */}
            {cart.length > 0 && (
              <div className="p-4 bg-gray-50 border-t rounded-b-xl">
                <h3 className="font-bold text-gray-700 mb-2">6. Customer Info</h3>
                <input 
                  className="w-full p-2 border rounded mb-2 text-sm" 
                  placeholder="Full Name" 
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                <input 
                  className="w-full p-2 border rounded mb-4 text-sm" 
                  placeholder="Phone Number" 
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />

                <div className="flex justify-between items-center mb-4 border-t pt-4">
                  <span className="font-bold text-gray-700">Total Due</span>
                  <span className="font-bold text-2xl text-blue-900">${calculateGrandTotal()}</span>
                </div>
                
                <button 
                  onClick={handleSubmitOrder}
                  disabled={isSubmitting}
                  className={`w-full py-3 rounded-lg font-bold shadow transition-colors text-white ${isSubmitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {isSubmitting ? "Submitting..." : "Submit Order"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}