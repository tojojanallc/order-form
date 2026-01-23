// @ts-nocheck
'use client'; 

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- SECURE CONNECTION ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export default function AdminPage() {
  const [passcode, setPasscode] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Simple Password Protection
  const handleLogin = (e) => {
    e.preventDefault();
    if (passcode === 'swim2025') { // <--- YOU CAN CHANGE THIS PASSWORD
      setIsAuthorized(true);
      fetchOrders();
    } else {
      alert("Wrong password");
    }
  };

  const fetchOrders = async () => {
    if (!supabase) return alert("Database connection missing");
    setLoading(true);
    
    // Fetch orders, newest first
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching orders:', error);
        alert("Error fetching data. Check console.");
    } else {
        setOrders(data);
    }
    setLoading(false);
  };

  // Helper to make the JSON cart readable
  const formatCart = (cartItems) => {
    if (!Array.isArray(cartItems)) return "No items";
    return cartItems.map((item, i) => (
      <div key={i} className="mb-2 border-b pb-1 last:border-0 text-sm">
        <span className="font-bold">{item.productName}</span> ({item.size})
        <br />
        <span className="text-xs text-gray-500">
          {item.customizations.logos.map(l => `Logo: ${l.type} (${l.position})`).join(', ')}
          {item.customizations.names.map(n => `Name: ${n.text} (${n.position})`).join(', ')}
          {item.customizations.backList && <div>• Back Name List</div>}
          {item.customizations.metallic && <div>• Metallic Highlight</div>}
        </span>
        <div className="font-bold text-xs mt-1">${item.finalPrice}</div>
      </div>
    ));
  };

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded shadow-md">
          <h1 className="text-xl font-bold mb-4">Admin Login</h1>
          <input 
            type="password" 
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className="border p-2 w-full mb-4 rounded"
            placeholder="Enter Password"
          />
          <button className="bg-blue-600 text-white w-full py-2 rounded hover:bg-blue-700">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Order Dashboard</h1>
          <button onClick={fetchOrders} className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">Refresh Data</button>
        </div>

        {loading ? (
          <p>Loading orders...</p>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-4 border-b font-bold text-gray-600">Date</th>
                  <th className="p-4 border-b font-bold text-gray-600">Customer</th>
                  <th className="p-4 border-b font-bold text-gray-600">Items (Details)</th>
                  <th className="p-4 border-b font-bold text-gray-600 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="p-4 border-b text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleDateString()} <br/>
                      {new Date(order.created_at).toLocaleTimeString()}
                    </td>
                    <td className="p-4 border-b align-top">
                      <div className="font-bold text-gray-800">{order.customer_name}</div>
                      <div className="text-sm text-gray-500">{order.phone}</div>
                    </td>
                    <td className="p-4 border-b align-top bg-gray-50">
                      {formatCart(order.cart_data)}
                    </td>
                    <td className="p-4 border-b text-right font-bold text-green-700 align-top">
                      ${order.total_price}
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