// @ts-nocheck
'use client'; 

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// --- UPDATED STATUSES WITH PARTIALLY FULFILLED ---
const STATUSES = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  pending_shipping: { label: 'To Be Shipped', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  partially_fulfilled: { label: 'Partially Fulfilled', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' }, // <--- NEW
  ready: { label: 'Ready for Pickup', color: 'bg-green-100 text-green-800 border-green-300' },
  shipped: { label: 'Shipped', color: 'bg-green-200 text-green-900 border-green-400' },
  completed: { label: 'Completed', color: 'bg-gray-200 text-gray-600 border-gray-400' },
};

export default function AdminPage() {
  const [passcode, setPasscode] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState('orders');
  
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [logos, setLogos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Forms
  const [newProdId, setNewProdId] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState(30);
  const [newLogoName, setNewLogoName] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');

  // Settings
  const [eventName, setEventName] = useState('');
  const [eventLogo, setEventLogo] = useState('');
  const [offerBackNames, setOfferBackNames] = useState(true);
  const [offerMetallic, setOfferMetallic] = useState(true);

  // --- SECURE LOGIN ---
  const handleLogin = async (e) => { 
    e.preventDefault(); 
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passcode })
      });
      const data = await res.json();
      if (data.success) { 
        setIsAuthorized(true); 
        fetchOrders(); 
      } else { 
        alert("Wrong password"); 
      }
    } catch (err) { alert("Login failed"); }
    setLoading(false);
  };

  // --- FETCHERS ---
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
    const { data: prodData } = await supabase.from('products').select('*').order('sort_order');
    const { data: invData } = await supabase.from('inventory').select('*');
    if (prodData) setProducts(prodData);
    if (invData) setInventory(invData);
    setLoading(false);
  };

  const fetchLogos = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from('logos').select('*').order('sort_order');
    if (data) setLogos(data);
    setLoading(false);
  };

  const fetchSettings = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from('event_settings').select('*').single();
    if (data) {
        setEventName(data.event_name);
        setEventLogo(data.event_logo_url || '');
        setOfferBackNames(data.offer_back_names ?? true);
        setOfferMetallic(data.offer_metallic ?? true);
    }
    setLoading(false);
  };

  // --- ACTIONS ---
  const saveSettings = async () => {
    await supabase.from('event_settings').update({ event_name: eventName, event_logo_url: eventLogo, offer_back_names: offerBackNames, offer_metallic: offerMetallic }).eq('id', 1);
    alert("Event Settings Saved!");
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    
    // --- TEXT MESSAGE LOGIC ---
    const order = orders.find(o => o.id === orderId);
    if (order) {
        let message = '';
        
        if (newStatus === 'ready') {
            message = `Hi ${order.customer_name}! Your Swag Order is READY for pickup!`;
        } 
        else if (newStatus === 'partially_fulfilled') {
            message = `Hi ${order.customer_name}! Your Swag Order is PARTIALLY READY. Please pick up your available items at the booth!`;
        }

        if (message) {
            try { await fetch('/api/send-text', { method: 'POST', body: JSON.stringify({ phone: order.phone, message }) }); } catch (e) {} 
        }
    }
  };

  const deleteOrder = async (orderId, cartData) => {
    const confirmed = confirm("⚠️ Cancel Order & Restore Inventory?\n\nOK = Delete & Add Stock Back\nCancel = Do Nothing");
    if (!confirmed) return;
    
    setLoading(true);
    if (cartData && Array.isArray(cartData)) {
        for (const item of cartData) {
            if (item.productId && item.size) {
                const { data: currentItem } = await supabase.from('inventory').select('count').eq('product_id', item.productId).eq('size', item.size).single();
                if (currentItem) { await supabase.from('inventory').update({ count: currentItem.count + 1 }).eq('product_id', item.productId).eq('size', item.size); }
            }
        }
    }
    await supabase.from('orders').delete().eq('id', orderId);
    fetchOrders(); fetchInventory();
    setLoading(false);
    alert("Order deleted and inventory restored.");
  };

  const addLogo = async (e) => {
    e.preventDefault();
    if (!newLogoName) return;
    await supabase.from('logos').insert([{ label: newLogoName, image_url: newLogoUrl, sort_order: logos.length + 1 }]);
    setNewLogoName(''); setNewLogoUrl(''); fetchLogos();
  };

  const deleteLogo = async (id) => { if (!confirm("Delete this logo?")) return; await supabase.from('logos').delete().eq('id', id); fetchLogos(); };
  
  const deleteProduct = async (id) => {
    if (!confirm("Are you sure? This deletes the product AND inventory.")) return;
    await supabase.from('inventory').delete().eq('product_id', id);
    await supabase.from('products').delete().eq('id', id);
    fetchInventory();
  };

  const updateStock = async (productId, size, field, value) => {
    setInventory(inventory.map(i => (i.product_id === productId && i.size === size) ? { ...i, [field]: value } : i));
    await supabase.from('inventory').update({ [field]: value }).eq('product_id', productId).eq('size', size);
  };

  const updatePrice = async (productId, newPrice) => {
    setProducts(products.map(p => p.id === productId ? { ...p, base_price: newPrice } : p));
    await supabase.from('products').update({ base_price: newPrice }).eq('id', productId);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProdId || !newProdName) return alert("Missing fields");
    const { error } = await supabase.from('products').insert([{ id: newProdId.toLowerCase().replace(/\s/g, '_'), name: newProdName, base_price: newProdPrice, type: 'top', sort_order: 99 }]);
    if (error) return alert("Error: " + error.message);
    const sizes = ['Youth S', 'Youth M', 'Youth L', 'Adult S', 'Adult M', 'Adult L', 'Adult XL', 'Adult XXL'];
    const invRows = sizes.map(s => ({ product_id: newProdId.toLowerCase().replace(/\s/g, '_'), size: s, count: 0, active: true }));
    await supabase.from('inventory').insert(invRows);
    alert("Product Created!"); setNewProdId(''); setNewProdName(''); fetchInventory();
  };

  const getProductName = (id) => products.find(p => p.id === id)?.name || id;
  const toggleLogo = async (id, currentStatus) => { setLogos(logos.map(l => l.id === id ? { ...l, active: !currentStatus } : l)); await supabase.from('logos').update({ active: !currentStatus }).eq('id', id); };

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

  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center bg-gray-100"><form onSubmit={handleLogin} className="bg-white p-8 rounded shadow"><h1 className="text-xl font-bold mb-4">Admin Login</h1><input type="password" onChange={e => setPasscode(e.target.value)} className="border p-2 w-full rounded" placeholder="Password"/></form></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-black text-gray-900">Admin Dashboard</h1>
          <div className="flex bg-white rounded-lg p-1 shadow border border-gray-300">
            <button onClick={() => { setActiveTab('orders'); fetchOrders(); }} className={`px-4 py-2 rounded font-bold ${activeTab === 'orders' ? 'bg-blue-900 text-white' : 'hover:bg-gray-100'}`}>Orders</button>
            <button onClick={() => { setActiveTab('inventory'); fetchInventory(); }} className={`px-4 py-2 rounded font-bold ${activeTab === 'inventory' ? 'bg-blue-900 text-white' : 'hover:bg-gray-100'}`}>Products</button>
            <button onClick={() => { setActiveTab('logos'); fetchLogos(); }} className={`px-4 py-2 rounded font-bold ${activeTab === 'logos' ? 'bg-blue-900 text-white' : 'hover:bg-gray-100'}`}>Logos</button>
            <button onClick={() => { setActiveTab('settings'); fetchSettings(); }} className={`px-4 py-2 rounded font-bold ${activeTab === 'settings' ? 'bg-blue-900 text-white' : 'hover:bg-gray-100'}`}>Settings</button>
          </div>
        </div>

        {activeTab === 'orders' && (
            <div>
                 <div className="flex justify-end mb-4 gap-2">
                    <button onClick={downloadCSV} className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700">📥 Export CSV</button>
                    <button onClick={fetchOrders} className="bg-gray-200 px-4 py-2 rounded font-bold hover:bg-gray-300 text-black">Refresh</button>
                 </div>
                 <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300 overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="p-4 w-40">Status</th>
                        <th className="p-4">Date</th>
                        <th className="p-4">Customer</th>
                        <th className="p-4">Items</th>
                        <th className="p-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                        {orders.map((order) => (
                        <tr key={order.id} className="border-b hover:bg-gray-50">
                            <td className="p-4 align-top"><select value={order.status || 'pending'} onChange={(e) => handleStatusChange(order.id, e.target.value)} className={`p-2 rounded border-2 uppercase font-bold text-xs ${STATUSES[order.status || 'pending']?.color}`}>{Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></td>
                            <td className="p-4 align-top text-sm text-gray-500 font-medium">{new Date(order.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                            <td className="p-4 align-top"><div className="font-bold">{order.customer_name}</div><div className="text-sm">{order.phone}</div>{order.shipping_address && <div className="mt-2 text-sm bg-purple-50 p-2 rounded border border-purple-200 text-purple-900">🚚 <strong>Ship to:</strong><br/>{order.shipping_address}<br/>{order.shipping_city}, {order.shipping_state} {order.shipping_zip}</div>}</td>
                            <td className="p-4 align-top text-sm">{order.cart_data.map((item, i) => <div key={i} className="mb-2 border-b border-gray-100 pb-1 last:border-0"><span className="font-bold">{item.productName}</span> ({item.size}){item.needsShipping && <span className="ml-2 bg-purple-100 text-purple-800 text-xs px-1 rounded">SHIP</span>}<div className="text-xs text-gray-500">{item.customizations.logos.map(l => l.type).join(', ')}</div></div>)}<div className="mt-2 text-right font-black text-green-800">${order.total_price}</div></td>
                            <td className="p-4 align-top text-right"><button onClick={() => deleteOrder(order.id, order.cart_data)} className="text-red-500 hover:text-red-700 font-bold text-lg" title="Cancel & Restore">🗑️</button></td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                 </div>
            </div>
        )}

        {/* ... INVENTORY / LOGOS / SETTINGS TABS (Unchanged from previous turn, just pasting for completeness to prevent errors) ... */}
        {activeTab === 'inventory' && (
            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                    <div className="bg-white p-6 rounded-lg shadow border border-gray-200 sticky top-4">
                        <h2 className="font-bold text-xl mb-4">Add New Item</h2>
                        <form onSubmit={handleAddProduct} className="space-y-3">
                            <div><label className="text-xs font-bold uppercase">ID (Unique)</label><input className="w-full border p-2 rounded" placeholder="e.g. hat_blue" value={newProdId} onChange={e => setNewProdId(e.target.value)} /></div>
                            <div><label className="text-xs font-bold uppercase">Display Name</label><input className="w-full border p-2 rounded" placeholder="e.g. Blue Hat" value={newProdName} onChange={e => setNewProdName(e.target.value)} /></div>
                            <div><label className="text-xs font-bold uppercase">Price ($)</label><input type="number" className="w-full border p-2 rounded" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} /></div>
                            <button className="w-full bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700">Create Product</button>
                        </form>
                    </div>
                </div>
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300">
                        <div className="bg-blue-900 text-white p-4 font-bold uppercase text-sm tracking-wide">Manage Prices</div>
                        <table className="w-full text-left"><thead className="bg-gray-100 border-b"><tr><th className="p-3">Product Name</th><th className="p-3">Base Price ($)</th><th className="p-3 text-right">Action</th></tr></thead><tbody>{products.map((prod) => (<tr key={prod.id} className="border-b hover:bg-gray-50"><td className="p-3 font-bold text-gray-700">{prod.name}</td><td className="p-3"><div className="flex items-center gap-1"><span className="text-gray-500 font-bold">$</span><input type="number" className="w-20 border border-gray-300 rounded p-1 font-bold text-black" value={prod.base_price} onChange={(e) => updatePrice(prod.id, e.target.value)} /></div></td><td className="p-3 text-right"><button onClick={() => deleteProduct(prod.id)} className="text-red-500 hover:text-red-700 font-bold" title="Delete Product">🗑️</button></td></tr>))}</tbody></table>
                    </div>
                    <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300">
                        <div className="bg-gray-800 text-white p-4 font-bold uppercase text-sm tracking-wide">Manage Stock</div>
                        <table className="w-full text-left"><thead className="bg-gray-100 border-b"><tr><th className="p-4">Product</th><th className="p-4">Size</th><th className="p-4">Stock</th><th className="p-4">Active</th></tr></thead><tbody>{inventory.map((item) => (<tr key={`${item.product_id}_${item.size}`} className={`border-b ${!item.active ? 'bg-gray-100 opacity-50' : ''}`}><td className="p-4 font-bold">{getProductName(item.product_id)}</td><td className="p-4">{item.size}</td><td className="p-4"><input type="number" className="w-16 border text-center font-bold" value={item.count} onChange={(e) => updateStock(item.product_id, item.size, 'count', parseInt(e.target.value))} /></td><td className="p-4"><input type="checkbox" checked={item.active ?? true} onChange={(e) => updateStock(item.product_id, item.size, 'active', e.target.checked)} className="w-5 h-5" /></td></tr>))}</tbody></table>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'logos' && (
            <div className="max-w-4xl mx-auto">
                 <div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200">
                    <h2 className="font-bold text-xl mb-4">Add New Logo Option</h2>
                    <form onSubmit={addLogo} className="grid md:grid-cols-2 gap-4">
                        <input className="border p-2 rounded" placeholder="Name (e.g. State Champs)" value={newLogoName} onChange={e => setNewLogoName(e.target.value)} />
                        <input className="border p-2 rounded" placeholder="Image URL (http://...)" value={newLogoUrl} onChange={e => setNewLogoUrl(e.target.value)} />
                        <button className="bg-blue-900 text-white font-bold px-6 py-2 rounded hover:bg-blue-800 col-span-2">Add Logo</button>
                    </form>
                 </div>
                 <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300">
                    <table className="w-full text-left"><thead className="bg-gray-800 text-white"><tr><th className="p-4">Preview</th><th className="p-4">Logo Label</th><th className="p-4 text-center">Visible?</th><th className="p-4 text-right">Action</th></tr></thead><tbody>{logos.map((logo) => (<tr key={logo.id} className="border-b hover:bg-gray-50"><td className="p-4">{logo.image_url ? <img src={logo.image_url} alt={logo.label} className="w-12 h-12 object-contain border rounded bg-gray-50" /> : <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-xs">No Img</div>}</td><td className="p-4 font-bold text-lg">{logo.label}</td><td className="p-4 text-center"><input type="checkbox" checked={logo.active} onChange={() => toggleLogo(logo.id, logo.active)} className="w-6 h-6 cursor-pointer" /></td><td className="p-4 text-right"><button onClick={() => deleteLogo(logo.id)} className="text-red-500 hover:text-red-700 font-bold" title="Delete Logo">🗑️</button></td></tr>))}</tbody></table>
                 </div>
            </div>
        )}

        {activeTab === 'settings' && (
            <div className="max-w-xl mx-auto">
                <div className="bg-white p-8 rounded-lg shadow border border-gray-200">
                    <h2 className="font-bold text-2xl mb-6">Event Settings</h2>
                    <div className="mb-4"><label className="block text-gray-700 font-bold mb-2">Event Name</label><input className="w-full border p-3 rounded text-lg" placeholder="e.g. 2026 Winter Regionals" value={eventName} onChange={e => setEventName(e.target.value)} /></div>
                    <div className="mb-6"><label className="block text-gray-700 font-bold mb-2">Event Logo URL</label><input className="w-full border p-3 rounded text-lg" placeholder="https://..." value={eventLogo} onChange={e => setEventLogo(e.target.value)} />{eventLogo && <img src={eventLogo} className="mt-4 h-24 mx-auto border rounded p-2" />}</div>
                    <div className="mb-6 bg-gray-50 p-4 rounded border"><label className="block text-gray-700 font-bold mb-3 border-b pb-2">Customization Options</label><div className="flex items-center justify-between mb-3"><span className="font-bold text-gray-800">Offer Back Name List?</span><input type="checkbox" checked={offerBackNames} onChange={(e) => setOfferBackNames(e.target.checked)} className="w-6 h-6" /></div><div className="flex items-center justify-between"><span className="font-bold text-gray-800">Offer Metallic Upgrade?</span><input type="checkbox" checked={offerMetallic} onChange={(e) => setOfferMetallic(e.target.checked)} className="w-6 h-6" /></div></div>
                    <button onClick={saveSettings} className="w-full bg-blue-900 text-white font-bold py-3 rounded text-lg hover:bg-blue-800 shadow">Save Changes</button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}