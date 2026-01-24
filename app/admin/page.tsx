// @ts-nocheck
'use client'; 

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { PRODUCTS } from '../config'; // Import your product names

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
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'inventory'
  
  // Data State
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const handleLogin = (e) => { 
    e.preventDefault(); 
    if (passcode === 'swim2025') { 
      setIsAuthorized(true); 
      fetchOrders(); 
    } else { 
      alert("Wrong password"); 
    } 
  };

  // --- ORDER FUNCTIONS ---
  const fetchOrders = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  const handleStatusChange = async (orderId, newStatus, customerName, phone) => {
    setProcessingId(orderId);
    // Optimistic Update
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

  // --- INVENTORY FUNCTIONS ---
  const fetchInventory = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from('inventory').select('*').order('product_id', { ascending: true });
    if (data) setInventory(data);
    setLoading(false);
  };

  const updateStock = async (productId, size, newCount) => {
    // Optimistic Update UI
    setInventory(inventory.map(i => (i.product_id === productId && i.size === size) ? { ...i, count: newCount } : i));
    
    // Save to DB (Silent save)
    await supabase
      .from('inventory')
      .update({ count: newCount })
      .eq('product_id', productId)
      .eq('size', size);
  };

  // Helper to get real name from ID
  const getProductName = (id) => {
    const product = PRODUCTS.find(p => p.id === id);
    return product ? product.name : id;
  };

  // --- RENDER ---
  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center bg-gray-100"><form onSubmit={handleLogin} className="bg-white p-8 rounded shadow"><h1 className="text-xl font-bold mb-4">Admin Login</h1><input type="password" onChange={e => setPasscode(e.target.value)} className="border p-2 w-full rounded" placeholder="Password"/></form></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER & TABS */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-black text-gray-900">Admin Dashboard</h1>
          <div className="flex bg-white rounded-lg p-1 shadow border border-gray-300">
            <button 
                onClick={() => { setActiveTab('orders'); fetchOrders(); }} 
                className={`px-6 py-2 rounded font-bold transition-colors ${activeTab === 'orders' ? 'bg-blue-900 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                Orders
            </button>
            <button 
                onClick={() => { setActiveTab('inventory'); fetchInventory(); }} 
                className={`px-6 py-2 rounded font-bold transition-colors ${activeTab === 'inventory' ? 'bg-blue-900 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                Inventory
            </button>
          </div>
        </div>

        {/* --- ORDERS VIEW --- */}
        {activeTab === 'orders' && (
            <div>
                <div className="flex justify-end mb-4 gap-2">
                    <button onClick={downloadCSV} className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700">📥 Export CSV</button>
                    <button onClick={fetchOrders} className="bg-gray-200 text-gray-800 px-4 py-2 rounded font-bold hover:bg-gray-300">Refresh</button>
                </div>
                {loading ? <p>Loading Orders...</p> : (
                <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300 overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-gray-200"><tr><th className="p-4 w-40">Status</th><th className="p-4">Customer</th><th className="p-4">Items</th></tr></thead>
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
                                        🚚 <strong>Ship to:</strong><br/>{order.shipping_address}<br/>{order.shipping_city}, {order.shipping_state} {order.shipping_zip}
                                    </div>
                                )}
                            </td>
                            <td className="p-4 align-top text-sm">
                                {order.cart_data.map((item, i) => (
                                    <div key={i} className="mb-2 border-b border-gray-100 pb-1 last:border-0">
                                        <span className="font-bold">{item.productName}</span> ({item.size})
                                        {item.needsShipping && <span className="ml-2 bg-purple-100 text-purple-800 text-xs px-1 rounded">SHIP</span>}
                                        <div className="text-xs text-gray-500">{item.customizations.logos.map(l => l.type).join(', ')}</div>
                                    </div>
                                ))}
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
                )}
            </div>
        )}

        {/* --- INVENTORY VIEW --- */}
        {activeTab === 'inventory' && (
            <div>
                <div className="flex justify-end mb-4">
                    <button onClick={fetchInventory} className="bg-gray-200 text-gray-800 px-4 py-2 rounded font-bold hover:bg-gray-300">Refresh Stock</button>
                </div>
                {loading ? <p>Loading Stock...</p> : (
                <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300">
                    <table className="w-full text-left">
                    <thead className="bg-gray-800 text-white">
                        <tr>
                            <th className="p-4">Product Name</th>
                            <th className="p-4">Size</th>
                            <th className="p-4 w-48">Stock Count</th>
                            <th className="p-4 text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inventory.map((item) => (
                        <tr key={`${item.product_id}_${item.size}`} className="border-b hover:bg-gray-50">
                            <td className="p-4 font-bold text-gray-700">{getProductName(item.product_id)}</td>
                            <td className="p-4 font-mono text-gray-600 font-bold">{item.size}</td>
                            <td className="p-4">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => updateStock(item.product_id, item.size, Math.max(0, item.count - 1))} className="w-8 h-8 bg-gray-200 rounded font-bold hover:bg-gray-300">-</button>
                                    <input 
                                        type="number" 
                                        className="w-20 border-2 border-gray-300 text-center p-1 rounded font-bold text-lg" 
                                        value={item.count}
                                        onChange={(e) => updateStock(item.product_id, item.size, parseInt(e.target.value) || 0)}
                                    />
                                    <button onClick={() => updateStock(item.product_id, item.size, item.count + 1)} className="w-8 h-8 bg-gray-200 rounded font-bold hover:bg-gray-300">+</button>
                                </div>
                            </td>
                            <td className="p-4 text-right">
                                {item.count === 0 ? (
                                    <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">Sold Out</span>
                                ) : item.count < 5 ? (
                                    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">Low Stock</span>
                                ) : (
                                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">In Stock</span>
                                )}
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
                )}
            </div>
        )}

      </div>
    </div>
  );
}