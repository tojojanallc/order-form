// @ts-nocheck
'use client'; 

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Access keys safely
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const PRODUCTS = [
  { id: 'hoodie', name: 'Unisex Hoodie', basePrice: 60 },
  { id: 'tee', name: 'T-Shirt', basePrice: 35 },
];

export default function OrderForm() {
  const [cart, setCart] = useState([]); 
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddToCart = () => {
    setCart([...cart, { id: Date.now(), name: 'Test Item', price: 60 }]);
  };

  const handleCheckout = async () => {
    if (!supabase) return alert("Database connection missing! Check .env.local");
    setIsSubmitting(true);
    
    // 1. Save Order
    const { error } = await supabase.from('orders').insert([{ 
      customer_name: customerName, phone: customerPhone, cart_data: cart, total_price: 100 
    }]);

    if (error) {
       console.error(error); 
       alert('Database Error: ' + error.message); 
       setIsSubmitting(false); 
       return;
    }

    // 2. Stripe Checkout
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart, customerName }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert("Stripe Error: " + (data.error || "Unknown"));
    } catch (err) {
      alert("Checkout failed");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="p-10 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Test Order Form</h1>
      <button onClick={handleAddToCart} className="bg-blue-500 text-white w-full py-2 rounded mb-4">Add Test Item to Cart</button>
      
      {cart.length > 0 && (
        <div className="space-y-2">
            <input className="border p-2 w-full" placeholder="Name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
            <input className="border p-2 w-full" placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
            <button onClick={handleCheckout} disabled={isSubmitting} className="bg-green-500 text-white w-full py-2 rounded">
                {isSubmitting ? "Processing..." : "Pay Now"}
            </button>
        </div>
      )}
    </div>
  );
}