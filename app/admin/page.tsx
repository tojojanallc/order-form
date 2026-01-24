// @ts-nocheck
'use client'; 
import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const STATUSES = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  pending_shipping: { label: 'To Be Shipped', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  ready: { label: 'Ready for Pickup', color: 'bg-green-100 text-green-800 border-green-300' },
  shipped: { label: 'Shipped', color: 'bg-green-200 text-green-900 border-green-400' },
  completed: { label: 'Completed', color: 'bg-gray-200 text-gray-600 border-gray-400' },
};

export default function AdminPage() {
  const [passcode, setPasscode] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const handleLogin = (e) => { e.preventDefault(); if (passcode === 'swim2025') { setIsAuthorized(true); fetchOrders(); } else { alert("Wrong password"); } };

  const fetchOrders = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  const handleStatusChange = async (orderId, newStatus, customerName, phone) => {
    setProcessingId(orderId);
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);

    if (newStatus === 'ready') {
       try {
        await fetch('/api/send-text', { method: 'POST', body: JSON.stringify({ phone, message: `Hi ${customerName}! Your Swag Order is READY for pickup!` }) });
       } catch (e) { console.error(e); }
    }
    setProcessingId(null);
  };

  const downloadCSV = () => {
    if (!orders.length) return;
    const headers = ['ID', 'Date', 'Customer', 'Phone', 'Address', 'Status', 'Total', 'Items'];
    const rows = orders.map(o => {
      const address = o.shipping_address ? `"${o.shipping_address}, ${o.shipping_city}, ${o.shipping_state}"` : "Pickup";
      const items = o.cart_data.map(i => `${i.productName} (${i.size})`).join(' | ');
      return [o.id, new Date(o.created_at).toLocaleDateString(), `"${o.customer_name}"`, o.phone, address, o.status, o.total_price, `"${items}"`].join(',');
    });
    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURI([headers.join(','), ...rows].join('\n'));
    link.download = "orders.csv";
    link.click();
  };

  const formatCart = (cartItems) => {
    if (!Array.isArray(cartItems)) return "No items";
    return cartItems.map((item, i) => (
      <div key={i} className="mb-2 border-b border-gray-300 pb-2 last:border-0 text-sm text-black">
        <span className="font-bold text-black">{item.productName}</span> ({item.size}) 
        {item.needsShipping && <span className="ml-2 bg-purple-100 text-purple-800 text-xs px-1 rounded">SHIP</span>}
        <br />
        <span className="text-xs text-gray-800 font-medium">
          {item.customizations.logos.map(l => `${l.type}`).join(', ')}
        </span>
      </div>
    ));
  };

  if (!isAuthorized) return <div className="p-10"><form onSubmit={handleLogin}><input type="password" onChange={e => setPasscode(e.target.value)} className="border p-2" placeholder="Password"/></form></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between mb-6"><h1 className="text-3xl font-black">Admin</h1><div><button onClick={downloadCSV} className="bg-green-600 text-white px-4 py-2 rounded mr-2">Export CSV</button><button onClick={fetchOrders} className="bg-gray-200 px-4 py-2 rounded">Refresh</button></div></div>
        
        {loading ? <p>Loading...</p> : (
          <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300">
            <table className="w-full text-left">
              <thead className="bg-gray-200"><tr><th className="p-4">Status</th><th className="p-4">Customer</th><th className="p-4">Items</th></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 align-top">
                        <select value={order.status || 'pending'} onChange={(e) => handleStatusChange(order.id, e.target.value, order.customer_name, order.phone)} className={`p-2 rounded border-2 uppercase font-bold text-xs ${STATUSES[order.status || 'pending']?.color}`}>
                            {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                    </td>
                    <td className="p-4 align-top">
                        <div className="font-bold">{order.customer_name}</div>
                        <div className="text-sm">{order.phone}</div>
                        {order.shipping_address && (
                            <div className="mt-2 text-sm bg-purple-50 p-2 rounded border border-purple-200 text-purple-900">
                                🚚 <strong>Ship to:</strong><br/>
                                {order.shipping_address}<br/>
                                {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
                            </div>
                        )}
                    </td>
                    <td className="p-4 align-top">{formatCart(order.cart_data)}</td>
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