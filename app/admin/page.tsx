// @ts-nocheck
'use client'; 

import React, { useState, useEffect, useRef } from 'react'; 
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx'; 
import { refundOrder } from '@/app/actions/refund-order';

// --- CONFIG ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const SIZE_ORDER = ['Youth XS', 'Youth S', 'Youth M', 'Youth L', 'Adult S', 'Adult M', 'Adult L', 'Adult XL', 'Adult XXL', 'Adult 3XL', 'Adult 4XL'];

const POSITIONS = [
    { id: 'full_front', label: 'Full Front' }, { id: 'left_chest', label: 'Left Chest' },
    { id: 'center_chest', label: 'Center Chest' }, { id: 'left_sleeve', label: 'Left Sleeve' },
    { id: 'right_sleeve', label: 'Right Sleeve' }, { id: 'back_center', label: 'Back Center' },
    { id: 'back_bottom', label: 'Back Bottom' }, { id: 'hood', label: 'Hood' },
    { id: 'left_thigh', label: 'Left Thigh' }, { id: 'right_thigh', label: 'Right Thigh' },
    { id: 'rear', label: 'Rear' }
];

const STATUSES = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  pending_shipping: { label: 'To Be Shipped', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  partially_fulfilled: { label: 'Partially Fulfilled', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  ready: { label: 'Ready for Pickup', color: 'bg-green-100 text-green-800 border-green-300' },
  shipped: { label: 'Shipped', color: 'bg-green-200 text-green-900 border-green-400' },
  completed: { label: 'Completed', color: 'bg-gray-200 text-gray-600 border-gray-400' },
  refunded: { label: 'Refunded', color: 'bg-red-100 text-red-800 border-red-300' },
};

export default function AdminPage() {
  const [mounted, setMounted] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState('orders');
  
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [logos, setLogos] = useState([]);
  const [guests, setGuests] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ revenue: 0, count: 0, net: 0, topItem: '-' });
  const [uploadLog, setUploadLog] = useState([]); 

  const [editingOrder, setEditingOrder] = useState(null);
  const [originalOrderTotal, setOriginalOrderTotal] = useState(0); 
  const [newOrderTotal, setNewOrderTotal] = useState(0); 

  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const audioRef = useRef(null);
  const lastOrderCount = useRef(0);

  // Forms
  const [newProdId, setNewProdId] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState(30);
  const [newProdImage, setNewProdImage] = useState(''); 
  const [newProdType, setNewProdType] = useState('top'); 
  const [newLogoName, setNewLogoName] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [newLogoCategory, setNewLogoCategory] = useState('accent'); 
  
  const [eventName, setEventName] = useState('');
  const [eventLogo, setEventLogo] = useState('');
  const [headerColor, setHeaderColor] = useState('#1e3a8a'); 
  const [paymentMode, setPaymentMode] = useState('retail'); 
  const [printerType, setPrinterType] = useState('label'); 
  const [offerBackNames, setOfferBackNames] = useState(true);
  const [offerMetallic, setOfferMetallic] = useState(true);
  const [offerPersonalization, setOfferPersonalization] = useState(true);

  const [pnEnabled, setPnEnabled] = useState(false);
  const [pnApiKey, setPnApiKey] = useState('');
  const [pnPrinterId, setPnPrinterId] = useState('');
  const [availablePrinters, setAvailablePrinters] = useState([]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isAuthorized && mounted) {
        fetchOrders(); fetchSettings(); fetchInventory(); fetchLogos(); fetchGuests();
        if (supabase) {
            const channel = supabase.channel('admin_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders()).subscribe();
            return () => { supabase.removeChannel(channel); };
        }
    }
  }, [isAuthorized, mounted]);

  useEffect(() => {
    if (!mounted || !autoPrintEnabled || orders.length === 0) return;
    if (orders.length > lastOrderCount.current) {
      const newestOrder = orders[0];
      if (!newestOrder.printed && (new Date() - new Date(newestOrder.created_at) < 30000)) {
        if (audioRef.current) audioRef.current.play().catch(() => {});
        printLabel(newestOrder);
      }
    }
    lastOrderCount.current = orders.length;
  }, [orders, autoPrintEnabled, mounted]);

  // Recalculate New Total Safe
  useEffect(() => {
      if (editingOrder && mounted) {
          let total = 0;
          if (Array.isArray(editingOrder.cart_data)) {
              editingOrder.cart_data.forEach(item => {
                  if(!item) return;
                  const productRef = products.find(p => p.name === item.productName);
                  const basePrice = productRef ? (productRef.base_price || 30) : 30;
                  let itemTotal = basePrice;
                  if (item.customizations) {
                      itemTotal += (item.customizations.logos?.length || 0) * 5;
                      itemTotal += (item.customizations.names?.length || 0) * 5;
                      if (item.customizations.backList) itemTotal += 5;
                      if (item.customizations.metallic) itemTotal += 5;
                  }
                  total += itemTotal;
              });
          }
          setNewOrderTotal(total);
      }
  }, [editingOrder, products, mounted]);

  // Stats
  useEffect(() => {
    if(!mounted || !orders) return;
    try {
        const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'refunded');
        const revenue = activeOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
        const count = activeOrders.length;
        setStats({ revenue, count, net: revenue * 0.7, topItem: '-' });
    } catch (e) {}
  }, [orders, inventory, mounted]);

  // Actions
  const handleLogin = async (e) => { e.preventDefault(); setLoading(true); try { const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: passcode }) }); const data = await res.json(); if (data.success) { setIsAuthorized(true); } else { alert("Wrong password"); } } catch (err) { alert("Login failed"); } setLoading(false); };
  const fetchOrders = async () => { if (!supabase) return; const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }); if (data) setOrders(data); };
  const fetchInventory = async () => { if (!supabase) return; const { data: p } = await supabase.from('products').select('*').order('sort_order'); const { data: i } = await supabase.from('inventory').select('*').order('product_id', { ascending: true }); if (p) setProducts(p); if (i) setInventory(i); };
  const fetchLogos = async () => { if (!supabase) return; const { data } = await supabase.from('logos').select('*').order('sort_order'); if (data) setLogos(data); };
  const fetchGuests = async () => { if (!supabase) return; const { data } = await supabase.from('guests').select('*').order('name'); if (data) setGuests(data); };
  const fetchSettings = async () => { if (!supabase) return; const { data } = await supabase.from('event_settings').select('*').single(); if (data) { setEventName(data.event_name); setEventLogo(data.event_logo_url || ''); setHeaderColor(data.header_color || '#1e3a8a'); setPaymentMode(data.payment_mode || 'retail'); setPrinterType(data.printer_type || 'label'); setOfferBackNames(data.offer_back_names ?? true); setOfferMetallic(data.offer_metallic ?? true); setOfferPersonalization(data.offer_personalization ?? true); setPnEnabled(data.printnode_enabled || false); setPnApiKey(data.printnode_api_key || ''); setPnPrinterId(data.printnode_printer_id || ''); } };
  const saveSettings = async () => { await supabase.from('event_settings').update({ event_name: eventName, event_logo_url: eventLogo, header_color: headerColor, payment_mode: paymentMode, printer_type: printerType, offer_back_names: offerBackNames, offer_metallic: offerMetallic, offer_personalization: offerPersonalization, printnode_enabled: pnEnabled, printnode_api_key: pnApiKey, printnode_printer_id: pnPrinterId }).eq('id', 1); alert("Saved!"); };
  const closeEvent = async () => { if (prompt(`Type 'CLOSE' to confirm archive:`) !== 'CLOSE') return; setLoading(true); await supabase.from('orders').update({ status: 'completed' }).neq('status', 'completed'); fetchOrders(); setLoading(false); };
  const handleStatusChange = async (orderId, newStatus) => { setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o)); await supabase.from('orders').update({ status: newStatus }).eq('id', orderId); };
  const deleteOrder = async (orderId) => { if (confirm("Delete Order?")) { await supabase.from('orders').delete().eq('id', orderId); fetchOrders(); } };
  const updateStock = async (pid, s, f, v) => { setInventory(inventory.map(i => (i.product_id === pid && i.size === s) ? { ...i, [f]: v } : i)); await supabase.from('inventory').update({ [f]: v }).eq('product_id', pid).eq('size', s); };
  const updatePrice = async (pid, v) => { setProducts(products.map(p => p.id === pid ? { ...p, base_price: v } : p)); await supabase.from('products').update({ base_price: v }).eq('id', pid); };
  const toggleLogo = async (id, s) => { setLogos(logos.map(l => l.id === id ? { ...l, active: !s } : l)); await supabase.from('logos').update({ active: !s }).eq('id', id); };
  const getProductName = (id) => products.find(p => p.id === id)?.name || id;

  const printLabel = async (order) => {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, printed: true } : o));
      await supabase.from('orders').update({ printed: true }).eq('id', order.id);
      try {
          const res = await fetch('/api/printnode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order, mode: pnEnabled ? 'cloud' : 'download', apiKey: pnApiKey, printerId: pnPrinterId })
          });
          const result = await res.json();
          if (result.success && !pnEnabled) {
              const pdfBytes = Uint8Array.from(atob(result.pdfBase64), c => c.charCodeAt(0));
              window.open(window.URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' })), '_blank');
          }
      } catch (e) {}
  };

  const openEditModal = (order) => { 
      const rawCart = Array.isArray(order.cart_data) ? order.cart_data : [];
      const cleanCart = rawCart.filter(i => i).map(item => ({
            ...item,
            productName: item.productName || 'Unknown',
            size: item.size || 'N/A',
            customizations: { mainDesign: item.customizations?.mainDesign || '', logos: Array.isArray(item.customizations?.logos) ? item.customizations.logos : [], names: Array.isArray(item.customizations?.names) ? item.customizations.names : [] }
      }));
      setEditingOrder({ ...order, cart_data: cleanCart }); 
      setOriginalOrderTotal(order.total_price || 0);
  };

  const saveOrderEdits = async () => { 
      if(!editingOrder) return; 
      setLoading(true); 
      const priceDifference = newOrderTotal - originalOrderTotal;
      const { error } = await supabase.from('orders').update({ customer_name: editingOrder.customer_name, cart_data: editingOrder.cart_data, total_price: newOrderTotal }).eq('id', editingOrder.id); 
      if(!error && priceDifference > 0) {
          const upgradeCart = [{ productName: `Upcharge #${String(editingOrder.id).slice(0,4)}`, finalPrice: priceDifference, size: 'N/A', customizations: { mainDesign: 'Upgrade' } }];
          const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart: upgradeCart, customerName: editingOrder.customer_name }) });
          const data = await res.json();
          if(data.url) window.location.href = data.url;
      } else { fetchOrders(); setEditingOrder(null); }
      setLoading(false); 
  };

  if (!mounted) return <div className="p-10 text-center text-gray-500 font-bold">Loading Admin...</div>;
  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center bg-gray-100"><form onSubmit={handleLogin} className="bg-white p-8 rounded shadow"><h1 className="text-xl font-bold mb-4">Admin Login</h1><input type="password" onChange={e => setPasscode(e.target.value)} className="border p-2 w-full rounded" placeholder="Password"/></form></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black">
      <audio ref={audioRef} src="/ding.mp3" preload="auto" />
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-black">{eventName || 'Admin Dashboard'}</h1>
          <div className="flex bg-white rounded-lg p-1 shadow border border-gray-300">
            {['orders', 'history', 'inventory', 'guests', 'logos', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded font-bold capitalize ${activeTab === tab ? 'bg-blue-900 text-white' : 'hover:bg-gray-100'}`}>{tab}</button>
            ))}
          </div>
        </div>

        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded shadow border-l-4 border-green-500"><p className="text-xs font-bold uppercase text-gray-400">Revenue</p><p className="text-3xl font-black text-green-700">${stats.revenue.toFixed(2)}</p></div>
              <div className="bg-white p-4 rounded shadow border-l-4 border-blue-500"><p className="text-xs font-bold uppercase text-gray-400">Paid Orders</p><p className="text-3xl font-black text-blue-900">{stats.count}</p></div>
              <div className="bg-blue-900 p-4 rounded shadow text-white flex flex-col justify-center items-center">
                <span className="text-xs font-bold uppercase opacity-80 mb-2">Auto-Print</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={autoPrintEnabled} onChange={e => setAutoPrintEnabled(e.target.checked)} className="sr-only peer" />
                  <div className="w-14 h-7 bg-blue-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all"></div>
                </label>
              </div>
            </div>
            <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300">
              <table className="w-full text-left">
                <thead className="bg-gray-200"><tr><th className="p-4 w-40">Status</th><th className="p-4">Customer</th><th className="p-4">Items</th><th className="p-4 text-right">Actions</th></tr></thead>
                <tbody>{orders.filter(o => o.status !== 'completed').map(o => (
                  <tr key={o.id} className={`border-b hover:bg-gray-50 ${o.printed ? 'bg-gray-50' : 'bg-white'}`}>
                    <td className="p-4">
                      <select value={o.status || 'pending'} onChange={e => handleStatusChange(o.id, e.target.value)} className={`p-2 rounded border-2 uppercase font-bold text-xs ${STATUSES[o.status || 'pending']?.color}`}>
                        {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td className="p-4 align-top"><div className="font-bold">{o.customer_name}</div><div className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString()}</div></td>
                    <td className="p-4 text-sm">{(o.cart_data || []).map((i, idx) => <div key={idx} className="mb-1"><strong>{i.productName}</strong> ({i.size})</div>)}<div className="mt-2 font-black text-green-800">${o.total_price}</div></td>
                    <td className="p-4 text-right">
                      <button onClick={() => openEditModal(o)} className="p-2 rounded mr-2 bg-blue-50 text-blue-600 font-bold">✏️ Edit</button>
                      <button onClick={() => printLabel(o)} className={`p-2 rounded font-bold ${o.printed ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-600'}`}>🖨️ Print</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded shadow border border-gray-200 h-fit space-y-4">
              <h2 className="font-bold text-xl">Manage Products</h2>
              <input className="w-full border p-2 rounded" placeholder="Product Name" value={newProdName} onChange={e => setNewProdName(e.target.value)} />
              <button className="w-full bg-green-600 text-white font-bold py-2 rounded">Add New Item</button>
              <hr />
              <div className="bg-blue-50 p-4 rounded text-sm space-y-2">
                <p className="font-bold text-blue-900">Bulk Stock Update</p>
                <input type="file" className="text-xs w-full" />
              </div>
            </div>
            <div className="md:col-span-2 bg-white shadow rounded border border-gray-300 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-800 text-white uppercase text-xs"><tr><th className="p-4">Product</th><th className="p-4">Size</th><th className="p-4 text-center">Stock</th><th className="p-4 text-center">Cost</th><th className="p-4 text-right">Price</th></tr></thead>
                <tbody>{inventory.map(i => (
                  <tr key={`${i.product_id}-${i.size}`} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-bold text-blue-900">{getProductName(i.product_id)}</td>
                    <td className="p-4">{i.size}</td>
                    <td className="p-4"><input type="number" className="mx-auto block w-16 border rounded text-center font-bold" value={i.count} onChange={e => updateStock(i.product_id, i.size, 'count', e.target.value)} /></td>
                    <td className="p-4"><input type="number" className="mx-auto block w-16 border rounded text-center" value={i.cost_price} onChange={e => updateStock(i.product_id, i.size, 'cost_price', e.target.value)} /></td>
                    <td className="p-4 text-right"><input type="number" className="w-16 border rounded text-right p-1" value={products.find(p => p.id === i.product_id)?.base_price || 0} onChange={e => updatePrice(i.product_id, e.target.value)} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'guests' && (
          <div className="bg-white p-6 rounded shadow border border-gray-300 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Guest Redemption List</h2>
              <button onClick={clearGuestList} className="text-red-600 font-bold text-sm underline">Clear All</button>
            </div>
            <table className="w-full text-left">
              <thead className="bg-gray-100 border-b"><tr><th className="p-4">Guest Name</th><th className="p-4">Pre-Size</th><th className="p-4 text-center">Status</th><th className="p-4 text-right">Action</th></tr></thead>
              <tbody>{guests.map(g => (
                <tr key={g.id} className="border-b">
                  <td className="p-4 font-bold">{g.name}</td>
                  <td className="p-4 font-mono">{g.size || '-'}</td>
                  <td className="p-4 text-center">{g.has_ordered ? <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold uppercase">Redeemed</span> : <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded text-xs uppercase">Waiting</span>}</td>
                  <td className="p-4 text-right"><button onClick={() => resetGuest(g.id)} className="text-blue-600 text-xs font-bold underline">Reset</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="bg-white p-8 rounded shadow border border-gray-300">
              <h2 className="text-2xl font-black mb-6">Event Settings</h2>
              <div className="space-y-4">
                <div><label className="block text-xs font-bold uppercase text-gray-500">Event Title</label><input className="w-full border p-3 rounded text-lg" value={eventName} onChange={e => setEventName(e.target.value)} /></div>
                <div className="bg-purple-50 p-6 rounded border border-purple-200">
                  <p className="font-bold text-purple-900 mb-2">Cloud Printing (PrintNode)</p>
                  <div className="flex items-center justify-between mb-4"><span className="text-sm">Enable Printer?</span><input type="checkbox" checked={pnEnabled} onChange={e => setPnEnabled(e.target.checked)} className="w-6 h-6" /></div>
                  <input className="w-full p-2 border rounded text-sm mb-2" placeholder="API Key" value={pnApiKey} onChange={e => setPnApiKey(e.target.value)} />
                  <div className="flex gap-2">
                    <input className="flex-1 p-2 border rounded text-sm" placeholder="Printer ID" value={pnPrinterId} onChange={e => setPnPrinterId(e.target.value)} />
                    <button onClick={discoverPrinters} className="bg-purple-600 text-white px-3 py-1 rounded text-xs font-bold">Discover</button>
                  </div>
                </div>
                <button onClick={saveSettings} className="w-full bg-blue-900 text-white py-3 font-bold rounded shadow hover:bg-blue-800">Save Event Settings</button>
              </div>
            </div>
            <div className="bg-red-50 p-6 rounded border border-red-200"><h3 className="font-bold text-red-700 uppercase text-xs mb-2">Danger Zone</h3><button onClick={closeEvent} className="w-full bg-red-100 text-red-800 font-bold py-3 rounded border border-red-300">🏁 Close Event & Archive Orders</button></div>
          </div>
        )}
      </div>

      {editingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between bg-gray-50 rounded-t-xl"><h2 className="font-bold text-lg">Edit Order #{String(editingOrder.id).slice(0,8)}</h2><button onClick={() => setEditingOrder(null)} className="text-2xl text-gray-500">×</button></div>
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 p-4 rounded border border-blue-100"><label className="block text-xs font-bold uppercase text-blue-900 mb-1">Customer Name</label><input className="w-full p-2 border rounded font-bold" value={editingOrder.customer_name} onChange={(e) => handleEditChange('customer_name', e.target.value)} /></div>
              {editingOrder.cart_data.map((item, idx) => (
                <div key={idx} className="bg-white p-4 border rounded-lg shadow-sm space-y-4">
                  <div className="flex justify-between items-center"><span className="font-bold">{item.productName}</span><select className="border-2 p-1 rounded font-bold" value={item.size} onChange={(e) => handleEditItem(idx, 'size', e.target.value)}>{SIZE_ORDER.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  <div><label className="text-xs font-bold text-gray-400 uppercase">Main Design</label><select className="w-full border p-2 rounded" value={item.customizations?.mainDesign || ''} onChange={(e) => handleUpdateMainDesign(idx, e.target.value)}><option value="">None</option>{logos.filter(l => l.category === 'main').map(l => (<option key={l.id} value={l.label}>{l.label}</option>))}</select></div>
                  <div className="space-y-2"><label className="text-xs font-bold text-gray-400 uppercase">Accents ($5)</label>{item.customizations?.logos?.map((l, lIdx) => (<div key={lIdx} className="flex gap-2"><select className="border p-1 rounded flex-1 text-sm" value={l.type} onChange={(e) => handleUpdateAccent(idx, lIdx, 'type', e.target.value)}>{logos.map(opt => <option key={opt.id} value={opt.label}>{opt.label}</option>)}</select><select className="border p-1 rounded w-32 text-sm" value={l.position} onChange={(e) => handleUpdateAccent(idx, lIdx, 'position', e.target.value)}>{POSITIONS.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}</select></div>))}<button onClick={() => handleAddAccent(idx)} className="text-xs text-blue-600 font-bold">+ Accent</button></div>
                  <div className="space-y-2"><label className="text-xs font-bold text-gray-400 uppercase">Names ($5)</label>{item.customizations?.names?.map((n, nIdx) => (<div key={nIdx} className="flex gap-2"><input className="border p-1 rounded flex-1 text-sm uppercase font-bold" value={n.text} onChange={(e) => handleEditName(idx, nIdx, e.target.value)} /><select className="border p-1 rounded w-32 text-sm" value={n.position} onChange={(e) => handleUpdateNamePos(idx, nIdx, e.target.value)}>{POSITIONS.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}</select></div>))}<button onClick={() => handleAddName(idx)} className="text-xs text-blue-600 font-bold">+ Name</button></div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t flex justify-end gap-3 bg-gray-50 rounded-b-xl"><button onClick={() => setEditingOrder(null)} className="px-4 py-2 text-gray-600 font-bold">Cancel</button><button onClick={saveOrderEdits} className={`px-6 py-2 text-white font-bold rounded shadow ${newOrderTotal > originalOrderTotal ? 'bg-green-600' : 'bg-blue-600'}`}>{newOrderTotal > originalOrderTotal ? `Save & Pay $${(newOrderTotal - originalOrderTotal).toFixed(2)}` : "Save Changes"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}