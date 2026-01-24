// @ts-nocheck
'use client'; 

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Standard statuses
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
  const [activeTab, setActiveTab] = useState('orders');
  
  // Data
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // New Product Form
  const [newProdId, setNewProdId] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState(30);
  const [newProdType, setNewProdType] = useState('top');

  const handleLogin = (e) => { e.preventDefault(); if (passcode === 'swim2025') { setIsAuthorized(true); fetchOrders(); } else { alert("Wrong password"); } };

  const fetchOrders = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  const fetchInventory = async () => {
    if (!supabase) return;
    setLoading(true);
    // Join logic handled manually for simplicity
    const { data: prodData } = await supabase.from('products').select('*').order('sort_order');
    const { data: invData } = await supabase.from('inventory').select('*');
    if (prodData) setProducts(prodData);
    if (invData) setInventory(invData);
    setLoading(false);
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
  };

  const updateStock = async (productId, size, field, value) => {
    setInventory(inventory.map(i => (i.product_id === productId && i.size === size) ? { ...i, [field]: value } : i));
    await supabase.from('inventory').update({ [field]: value }).eq('product_id', productId).eq('size', size);
  };

  // --- NEW: ADD PRODUCT ---
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProdId || !newProdName) return alert("Missing fields");

    // 1. Add to Products Table
    const { error } = await supabase.from('products').insert([{
        id: newProdId.toLowerCase().replace(/\s/g, '_'),
        name: newProdName,
        base_price: newProdPrice,
        type: newProdType,
        sort_order: 99
    }]);

    if (error) return alert("Error creating product: " + error.message);

    // 2. Auto-create Inventory Rows (Standard Sizes)
    const sizes = ['Youth S', 'Youth M', 'Youth L', 'Adult S', 'Adult M', 'Adult L', 'Adult XL', 'Adult XXL'];
    const invRows = sizes.map(s => ({
        product_id: newProdId.toLowerCase().replace(/\s/g, '_'),
        size: s,
        count: 0,
        active: true
    }));

    await supabase.from('inventory').insert(invRows);

    alert("Product Created!");
    setNewProdId(''); setNewProdName('');
    fetchInventory(); // Refresh
  };

  const getProductName = (id) => products.find(p => p.id === id)?.name || id;

  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center bg-gray-100"><form onSubmit={handleLogin} className="bg-white p-8 rounded shadow"><h1 className="text-xl font-bold mb-4">Admin Login</h1><input type="password" onChange={e => setPasscode(e.target.value)} className="border p-2 w-full rounded" placeholder="Password"/></form></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-black text-gray-900">Admin Dashboard</h1>
          <div className="flex bg-white rounded-lg p-1 shadow border border-gray-300">
            <button onClick={() => { setActiveTab('orders'); fetchOrders(); }} className={`px-6 py-2 rounded font-bold ${activeTab === 'orders' ? 'bg-blue-900 text-white' : 'hover:bg-gray-100'}`}>Orders</button>
            <button onClick={() => { setActiveTab('inventory'); fetchInventory(); }} className={`px-6 py-2 rounded font-bold ${activeTab === 'inventory' ? 'bg-blue-900 text-white' : 'hover:bg-gray-100'}`}>Products & Stock</button>
          </div>
        </div>

        {activeTab === 'orders' && (
            <div>
                 <div className="flex justify-end mb-4"><button onClick={fetchOrders} className="bg-gray-200 px-4 py-2 rounded">Refresh</button></div>
                 {/* (Simple Table - reused from before) */}
                 <div className="bg-white shadow rounded-lg p-4">
                    {orders.map(o => (
                        <div key={o.id} className="border-b py-2 flex justify-between">
                            <div><strong>{o.customer_name}</strong> - {o.status}</div>
                            <div>${o.total_price}</div>
                        </div>
                    ))}
                 </div>
            </div>
        )}

        {activeTab === 'inventory' && (
            <div className="grid md:grid-cols-3 gap-6">
                {/* LEFT: ADD PRODUCT FORM */}
                <div className="md:col-span-1">
                    <div className="bg-white p-6 rounded-lg shadow border border-gray-200 sticky top-4">
                        <h2 className="font-bold text-xl mb-4">Add New Item</h2>
                        <form onSubmit={handleAddProduct} className="space-y-3">
                            <div>
                                <label className="text-xs font-bold uppercase">ID (Unique)</label>
                                <input className="w-full border p-2 rounded" placeholder="e.g. hat_blue" value={newProdId} onChange={e => setNewProdId(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase">Display Name</label>
                                <input className="w-full border p-2 rounded" placeholder="e.g. Blue Hat" value={newProdName} onChange={e => setNewProdName(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase">Price ($)</label>
                                <input type="number" className="w-full border p-2 rounded" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} />
                            </div>
                            <button className="w-full bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700">Create Product</button>
                        </form>
                    </div>
                </div>

                {/* RIGHT: INVENTORY LIST */}
                <div className="md:col-span-2">
                    <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300">
                        <table className="w-full text-left">
                        <thead className="bg-gray-800 text-white"><tr><th className="p-4">Product</th><th className="p-4">Size</th><th className="p-4">Stock</th><th className="p-4">Active</th></tr></thead>
                        <tbody>
                            {inventory.map((item) => (
                            <tr key={`${item.product_id}_${item.size}`} className={`border-b ${!item.active ? 'bg-gray-100 opacity-50' : ''}`}>
                                <td className="p-4 font-bold">{getProductName(item.product_id)}</td>
                                <td className="p-4">{item.size}</td>
                                <td className="p-4">
                                    <input type="number" className="w-16 border text-center font-bold" value={item.count} onChange={(e) => updateStock(item.product_id, item.size, 'count', parseInt(e.target.value))} />
                                </td>
                                <td className="p-4">
                                    <input type="checkbox" checked={item.active ?? true} onChange={(e) => updateStock(item.product_id, item.size, 'active', e.target.checked)} className="w-5 h-5" />
                                </td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}