// @ts-nocheck
'use client'; 

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export default function AdminPage() {
  const [passcode, setPasscode] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notifying, setNotifying] = useState(null); // Tracks which button is loading

  const handleLogin = (e) => {
    e.preventDefault();
    if (passcode === 'swim2025') { 
      setIsAuthorized(true);
      fetchOrders();
    } else {
      alert("Wrong password");
    }
  };

  const fetchOrders = async () => {
    if (!supabase) return alert("Database connection missing");
    setLoading(true);
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); alert("Error fetching data."); } 
    else { setOrders(data); }
    setLoading(false);
  };

  // --- NEW: NOTIFY FUNCTION ---
  const handleNotifyPickup = async (orderId, customerName, phone) => {
    if (!confirm(`Send "Ready for Pickup" text to ${customerName}?`)) return;
    
    setNotifying(orderId);

    // 1. Send the Text
    const response = await fetch('/api/send-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        phone: phone, 
        message: `Hi ${customerName}! Your Swag Order is READY for pickup at the main booth. See you soon!` 
      }),
    });

    if (response.ok) {
      alert("Text Sent!");
      // Optional: You could update a "status" field in Supabase here if you wanted
    } else {
      alert("Failed to send text.");
    }
    setNotifying(null);
  };

  const formatCart = (cartItems) => {
    if (!Array.isArray(cartItems)) return "No items";
    return cartItems.map((item, i) => (
      <div key={i} className="mb-2 border-b border-gray-300 pb-2 last:border-0 text-sm text-black">
        <span className="font-bold text-black">{item.productName}</span> ({item.size})
        <br />
        <span className="text-xs text-gray-800 font-medium">
          {item.customizations.logos.map(l => `Logo: ${l.type} (${l.position})`).join(', ')}
          {item.customizations.names.map(n => `Name: ${n.text} (${n.position})`).join(', ')}
          {item.customizations.backList && <div>• Back Name List</div>}
          {item.customizations.metallic && <div>• Metallic Highlight</div>}
        </span>
        <div className="font-bold text-xs mt-1 text-green-800">${item.finalPrice}</div>
      </div>
    ));
  };

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded shadow-md border border-gray-300">
          <h1 className="text-xl font-bold mb-4 text-black">Admin Login</h1>
          <input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} className="border border-gray-400 p-2 w-full mb-4 rounded text-black" placeholder="Enter Password" />
          <button className="bg-blue-800 text-white w-full py-2 rounded hover:bg-blue-900 font-bold">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-black text-gray-900">Order Dashboard</h1>
          <button onClick={fetchOrders} className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 text-black font-bold border border-gray-300">Refresh Data</button>
        </div>

        {loading ? <p className="text-black font-bold">Loading orders...</p> : (
          <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-4 border-b border-gray-300 font-black text-gray-900">Date</th>
                  <th className="p-4 border-b border-gray-300 font-black text-gray-900">Customer</th>
                  <th className="p-4 border-b border-gray-300 font-black text-gray-900">Items</th>
                  <th className="p-4 border-b border-gray-300 font-black text-gray-900 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-100 border-b border-gray-200">
                    <td className="p-4 text-sm text-gray-900 font-medium">{new Date(order.created_at).toLocaleDateString()} <br/> {new Date(order.created_at).toLocaleTimeString()}</td>
                    <td className="p-4 align-top"><div className="font-bold text-black">{order.customer_name}</div><div className="text-sm text-gray-800 font-medium">{order.phone}</div></td>
                    <td className="p-4 align-top bg-gray-50">{formatCart(order.cart_data)}</td>
                    <td className="p-4 text-right align-top">
                        <button 
                            onClick={() => handleNotifyPickup(order.id, order.customer_name, order.phone)}
                            disabled={notifying === order.id}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded shadow whitespace-nowrap"
                        >
                            {notifying === order.id ? "Sending..." : "📲 Text: Ready"}
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}