// @ts-nocheck
'use client'; 

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- ⚠️ PASTE YOUR SUPABASE KEYS HERE ⚠️ ---
const SUPABASE_URL = 'https://jtywzhexaqlhzgbgdupz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0eXd6aGV4YXFsaHpnYmdkdXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxOTQ0NTAsImV4cCI6MjA4NDc3MDQ1MH0.9xsTi8YlmTwm2ALynmyjbTGZYhQnPXfV-RnqB7e3dJc';

// Initialize the connection
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- DATA CONFIGURATION ---
const PRODUCTS = [
  { id: 'hoodie_aqua', name: 'Unisex Hoodie (Aqua)', basePrice: 60 },
  { id: 'hoodie_grey', name: 'Unisex Hoodie (Grey)', basePrice: 60 },
  { id: 'crew_red', name: 'Crew Sweat (Red)', basePrice: 55 },
  { id: 'tee_royal', name: 'Tie Dye T-Shirt (Royal)', basePrice: 35 },
  { id: 'tee_dusk', name: 'Short Sleeve T-Shirt (Dusk)', basePrice: 30 },
  { id: 'jogger_grey', name: 'Unisex Jogger Pant', basePrice: 40 },
];

const LOGO_OPTIONS = ['Butterfly', 'Backstroke', 'Breaststroke', 'Freestyle', 'IM', 'GO State', 'WI State', 'Flag'];

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
    const newItem = {
      id: Date.now(),
      productName: selectedProduct.name,
      size: size,
      customizations: { logos, names, backList: backNameList, metallic: metallicHighlight },
      finalPrice: calculateTotal()
    };
    setCart([...cart, newItem]);
    
    // Reset Form
    setLogos([]);
    setNames([]);
    setBackNameList(false);
    setMetallicHighlight(false);
  };

  const removeItem = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  // --- 🚀 NEW: SUBMIT ORDER TO DATABASE ---
  const handleSubmitOrder = async () => {
    if (!customerName || !customerPhone) {
      alert("Please enter your Name and Phone Number (Section 6)");
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase
      .from('orders') // This must match the table name you created
      .insert([
        { 
          customer_name: customerName,
          phone: customerPhone,
          cart_data: cart, // Supabase automatically handles the JSON
          total_price: calculateGrandTotal()
        },
      ]);

    setIsSubmitting(false);

    if (error) {
      console.error('Error submitting:', error);
      alert('Error submitting order! Check console for details.');
    } else {
      alert('Order Submitted Successfully!');
      setCart([]); // Clear cart
      setCustomerName('');
      setCustomerPhone('');
    }
  };

  const addLogo = () => setLogos([...logos, { type: 'Butterfly', position: '' }]);
  const addName = () => setNames([...names, { text: '', position: '' }]);

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
        
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
                <div className="grid gap-4">
                  <select 
                    className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                    onChange={(e) => setSelectedProduct(PRODUCTS.find(p => p.id === e.target.value))}
                    value={selectedProduct.id}
                  >
                    {PRODUCTS.map(p => (
                      <option key={p.id} value={p.id}>{p.name} - ${p.basePrice}</option>
                    ))}
                  </select>
                  <select 
                    className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                  >
                    <option>Youth S</option><option>Youth M</option><option>Youth L</option><option>Youth XL</option>
                    <option>Adult S</option><option>Adult M</option><option>Adult L</option><option>Adult XL</option>
                  </select>
                </div>
              </section>

              {/* SECTION 2 */}
              <section>
                <div className="flex justify-between items-center mb-3 border-b pb-2">
                  <h2 className="font-bold text-gray-700">2. Accent Logos</h2>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">+$5.00</span>
                </div>
                {logos.map((logo, index) => (
                  <div key={index} className="flex gap-2 mb-3 bg-gray-50 p-3 rounded border">
                    <select className="border p-2 rounded flex-1 bg-white">
                      {LOGO_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
                    </select>
                    <input type="text" placeholder="Pos #" className="border p-2 rounded w-20 text-center" />
                  </div>
                ))}
                <button onClick={addLogo} className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded hover:border-blue-500 hover:text-blue-500 font-semibold">+ Add Logo</button>
              </section>

              {/* SECTION 3 */}
              <section>
                <div className="flex justify-between items-center mb-3 border-b pb-2">
                  <h2 className="font-bold text-gray-700">3. Names</h2>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">+$5.00</span>
                </div>
                {names.map((nameItem, index) => (
                  <div key={index} className="flex gap-2 mb-3 bg-gray-50 p-3 rounded border">
                    <input type="text" maxLength={12} placeholder="NAME" className="border p-2 rounded flex-1 uppercase" />
                    <input type="text" placeholder="Pos #" className="border p-2 rounded w-20 text-center" />
                  </div>
                ))}
                <button onClick={addName} className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded hover:border-blue-500 hover:text-blue-500 font-semibold">+ Add Name</button>
              </section>

              {/* SECTION 4/5 */}
              <section className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <label className="flex items-center gap-3 mb-2 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5" checked={backNameList} onChange={(e) => setBackNameList(e.target.checked)} />
                  <span className="font-medium text-gray-700">Back Name List (+$5)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5" checked={metallicHighlight} onChange={(e) => setMetallicHighlight(e.target.checked)} />
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