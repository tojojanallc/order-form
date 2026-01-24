// @ts-nocheck
'use client'; 

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Status Options & Colors
const STATUSES = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  ready: { label: 'Ready for Pickup', color: 'bg-green-100 text-green-800 border-green-300' },
  completed: { label: 'Completed', color: 'bg-gray-200 text-gray-600 border-gray-400' },
};

export default function AdminPage() {
  const [passcode, setPasscode] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notifying, setNotifying] = useState(null);

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
    // Fetch orders, newest first
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) { console.error(error); alert("Error fetching data."); } 
    else { setOrders(data); }
    setLoading(false);
  };

  // --- NEW: UPDATE STATUS ---
  const handleStatusChange = async (orderId, newStatus) => {
    // 1. Optimistic Update (Update UI instantly)
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

    // 2. Update Database
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      alert("Failed to save status");
      fetchOrders(); // Revert on error
    }
  };

  const handleNotifyPickup = async (orderId, customerName, phone) => {
    if (!confirm(`Send "Ready for Pickup" text to ${customerName}?`)) return;
    setNotifying(orderId);

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
      handleStatusChange(orderId, 'ready'); // Auto-update status to "Ready"
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
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-black text-gray-900">Production Dashboard</h1>
          <button onClick={fetchOrders} className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 text-black font-bold border border-gray-300">Refresh Data</button>
        </div>

        {loading ? <p className="text-black font-bold">Loading orders...</p> : (
          <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-4 border-b border-gray-300 font-black text-gray-900 w-32">Status</th>
                  <th className="p-4 border-b border-gray-300 font-black text-gray-900">Customer</th>
                  <th className="p-4 border-b border-gray-300 font-black text-gray-900">Items</th>
                  <th className="p-4 border-b border-gray-300 font-black text-gray-900 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const currentStatus = order.status || 'pending';
                  return (
                    <tr key={order.id} className={`border-b border-gray-200 ${currentStatus === 'completed' ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50'}`}>
                      {/* STATUS DROPDOWN */}
                      <td className="p-4 align-top">
                        <select 
                          value={currentStatus}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          className={`text-xs font-bold uppercase p-2 rounded border-2 ${STATUSES[currentStatus]?.color || 'bg-white border-gray-300'}`}
                        >
                          {Object.entries(STATUSES).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                          ))}
                        </select>
                      </td>

                      <td className="p-4 align-top">
                        <div className="font-bold text-black">{order.customer_name}</div>
                        <div className="text-sm text-gray-800 font-medium">{order.phone}</div>
                        <div className="text-xs text-gray-500 mt-1">{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                      </td>
                      
                      <td className="p-4 align-top bg-gray-50 border-l border-r border-gray-200">
                        {formatCart(order.cart_data)}
                        <div className="mt-2 text-right font-black text-green-800">${order.total_price}</div>
                      </td>
                      
                      <td className="p-4 text-right align-top">
                        <button 
                            onClick={() => handleNotifyPickup(order.id, order.customer_name, order.phone)}
                            disabled={notifying === order.id || currentStatus === 'completed'}
                            className={`${notifying === order.id ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white text-xs font-bold px-3 py-2 rounded shadow whitespace-nowrap`}
                        >
                            {notifying === order.id ? "Sending..." : "📲 Text: Ready"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}