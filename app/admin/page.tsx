'use client'; 

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- ⚠️ PASTE YOUR SUPABASE KEYS HERE ⚠️ ---
const SUPABASE_URL = 'https://jtywzhexaqlhzgbgdupz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0eXd6aGV4YXFsaHpnYmdkdXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxOTQ0NTAsImV4cCI6MjA4NDc3MDQ1MH0.9xsTi8YlmTwm2ALynmyjbTGZYhQnPXfV-RnqB7e3dJc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function AdminPage() {
  const [passcode, setPasscode] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Simple "Client-side" security. 
  // For a real app, you'd want something stronger, but this keeps prying eyes out.
  const handleLogin = (e) => {
    e.preventDefault();
    if (passcode === 'swim2025') { // <--- CHANGE THIS PASSWORD IF YOU WANT
      setIsAuthorized(true);
      fetchOrders();
    } else {
      alert("Wrong password");
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    // Fetch orders, newest first
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching orders:', error);
    else setOrders(data);
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
          {item.customizations.logos.length > 0 && `Logos: ${item.customizations.logos.length}, `}
          {item.customizations.names.length > 0 && `Names: ${item.customizations.names.length}, `}
          {item.customizations.backList && `Back List, `}
          {item.customizations.metallic && `Metallic`}
        </span>
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
                      {/* This parses the complex JSON into readable text */}
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