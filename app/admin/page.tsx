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

  // --- AUTO PRINT STATE ---
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

  // --- RE-SYNCED REAL-TIME LISTENER ---
  useEffect(() => {
    if (isAuthorized && mounted) {
        fetchOrders(); fetchSettings(); fetchInventory(); fetchLogos(); fetchGuests();
        if (supabase) {
            const channel = supabase
              .channel('admin_sync')
              .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                  console.log("DB Change detected! Refreshing data...");
                  fetchOrders(); // This forces the screen to refresh
              })
              .subscribe();
            return () => { supabase.removeChannel(channel); };
        }
    }
  }, [isAuthorized, mounted]);

  // --- AUTO-PRINT TRIGGER ---
  useEffect(() => {
    // Bookmark the initial count so we don't print on load
    if (lastOrderCount.current === 0 && orders.length > 0) {
      lastOrderCount.current = orders.length;
      return;
    }

    if (!mounted || !autoPrintEnabled || orders.length === 0) return;

    // Check if a new order was actually added to the top
    if (orders.length > lastOrderCount.current) {
        const newestOrder = orders[0];
        // Safety: Only trigger if the order is less than 60 seconds old
        const isRecent = (new Date() - new Date(newestOrder.created_at)) < 60000;
        
        if (isRecent && !newestOrder.printed) {
            console.log("Auto-Print Triggered for Order:", newestOrder.id);
            if (audioRef.current) audioRef.current.play().catch(() => {});
            printLabel(newestOrder);
        }
    }
    lastOrderCount.current = orders.length;
  }, [orders, autoPrintEnabled, mounted]);

  // (All helper functions: fetchOrders, fetchInventory, etc. remain unchanged)
  const fetchOrders = async () => { if (!supabase) return; const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }); if (data) setOrders(data); };
  const fetchInventory = async () => { if (!supabase) return; const { data: p } = await supabase.from('products').select('*').order('sort_order'); const { data: i } = await supabase.from('inventory').select('*').order('product_id', { ascending: true }); if (p) setProducts(p); if (i) setInventory(i); };
  const fetchLogos = async () => { if (!supabase) return; const { data } = await supabase.from('logos').select('*').order('sort_order'); if (data) setLogos(data); };
  const fetchGuests = async () => { if (!supabase) return; const { data } = await supabase.from('guests').select('*').order('name'); if (data) setGuests(data); };
  const fetchSettings = async () => { if (!supabase) return; const { data } = await supabase.from('event_settings').select('*').single(); if (data) { setEventName(data.event_name); setEventLogo(data.event_logo_url || ''); setHeaderColor(data.header_color || '#1e3a8a'); setPaymentMode(data.payment_mode || 'retail'); setPrinterType(data.printer_type || 'label'); setOfferBackNames(data.offer_back_names ?? true); setOfferMetallic(data.offer_metallic ?? true); setOfferPersonalization(data.offer_personalization ?? true); setPnEnabled(data.printnode_enabled || false); setPnApiKey(data.printnode_api_key || ''); setPnPrinterId(data.printnode_printer_id || ''); } };
  const saveSettings = async () => { await supabase.from('event_settings').update({ event_name: eventName, event_logo_url: eventLogo, header_color: headerColor, payment_mode: paymentMode, printer_type: printerType, offer_back_names: offerBackNames, offer_metallic: offerMetallic, offer_personalization: offerPersonalization, printnode_enabled: pnEnabled, printnode_api_key: pnApiKey, printnode_printer_id: pnPrinterId }).eq('id', 1); alert("Saved!"); };
  const closeEvent = async () => { if (prompt(`Type 'CLOSE' to confirm archive:`) !== 'CLOSE') return; setLoading(true); await supabase.from('orders').update({ event_name: eventName }).neq('status', 'completed'); await supabase.from('orders').update({ status: 'completed' }).neq('status', 'completed'); alert("Event Closed!"); fetchOrders(); setLoading(false); };
  const handleStatusChange = async (orderId, newStatus) => { setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o)); await supabase.from('orders').update({ status: newStatus }).eq('id', orderId); };
  const deleteOrder = async (orderId, cartData) => { if (!confirm("Delete Order?")) return; setLoading(true); if (Array.isArray(cartData)) { for (const item of cartData) { if (item?.productId && item?.size) { const { data: current } = await supabase.from('inventory').select('count').eq('product_id', item.productId).eq('size', item.size).single(); if (current) { await supabase.from('inventory').update({ count: current.count + 1 }).eq('product_id', item.productId).eq('size', item.size); } } } } await supabase.from('orders').delete().eq('id', orderId); fetchOrders(); fetchInventory(); setLoading(false); };
  const handleRefund = async (orderId, paymentIntentId) => { if (!confirm("Refund?")) return; setLoading(true); try { const result = await refundOrder(orderId, paymentIntentId); if (result.success) { alert("Refunded."); setOrders(orders.map(o => o.id === orderId ? { ...o, status: 'refunded' } : o)); } else { alert("Failed: " + result.message); } } catch(e) { alert("Error: " + e.message); } setLoading(false); };
  const discoverPrinters = async () => { if(!pnApiKey) return alert("Enter API Key"); setLoading(true); try { const res = await fetch('https://api.printnode.com/printers', { headers: { 'Authorization': 'Basic ' + btoa(pnApiKey + ':') } }); const data = await res.json(); if (Array.isArray(data)) { setAvailablePrinters(data); alert(`Found ${data.length} printers!`); } } catch (e) {} setLoading(false); };
  
  const printLabel = async (order) => {
      if (!order) return;
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, printed: true } : o));
      await supabase.from('orders').update({ printed: true }).eq('id', order.id);
      const isCloud = pnEnabled && pnApiKey && pnPrinterId;
      const mode = isCloud ? 'cloud' : 'download';
      try {
          const res = await fetch('/api/printnode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order, mode, apiKey: pnApiKey, printerId: pnPrinterId })
          });
          const result = await res.json();
          if (!result.success) { console.error("Print Node Error:", result.error); return; }
          if (!isCloud) {
              const pdfBytes = Uint8Array.from(atob(result.pdfBase64), c => c.charCodeAt(0));
              const blob = new Blob([pdfBytes], { type: 'application/pdf' });
              const url = window.URL.createObjectURL(blob);
              window.open(url, '_blank');
          }
      } catch (e) { console.error("Network Error:", e.message); }
  };

  const openEditModal = (order) => { 
      const rawCart = Array.isArray(order.cart_data) ? order.cart_data : [];
      const cleanCart = rawCart.filter(item => item !== null).map(item => ({
            ...item,
            productName: item.productName || 'Unknown',
            size: item.size || 'N/A',
            customizations: {
                mainDesign: item.customizations?.mainDesign || '',
                logos: Array.isArray(item.customizations?.logos) ? item.customizations.logos : [],
                names: Array.isArray(item.customizations?.names) ? item.customizations.names : [],
                backList: !!item.customizations?.backList,
                metallic: !!item.customizations?.metallic
            }
      }));
      setEditingOrder({ ...order, cart_data: cleanCart }); 
      setOriginalOrderTotal(order.total_price || 0);
  };
  const closeEditModal = () => { setEditingOrder(null); };
  const handleEditChange = (f, v) => setEditingOrder(p => ({ ...p, [f]: v }));
  const handleEditItem = (index, field, value) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; newCart[index] = { ...newCart[index], [field]: value }; return { ...prev, cart_data: newCart }; }); };
  const handleUpdateMainDesign = (index, value) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; newCart[index].customizations.mainDesign = value; return { ...prev, cart_data: newCart }; }); };
  const handleEditName = (idx, nIdx, val) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; newCart[idx].customizations.names[nIdx].text = val; return { ...prev, cart_data: newCart }; }); };
  const handleAddAccent = (idx) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; newCart[idx].customizations.logos.push({ type: logos[0]?.label || 'Logo', position: 'Left Sleeve' }); return { ...prev, cart_data: newCart }; }); };
  const handleAddName = (idx) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; newCart[idx].customizations.names.push({ text: '', position: 'Hood' }); return { ...prev, cart_data: newCart }; }); };
  const handleUpdateAccent = (idx, lIdx, field, val) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; newCart[idx].customizations.logos[lIdx][field] = val; return { ...prev, cart_data: newCart }; }); };
  const handleUpdateNamePos = (idx, nIdx, val) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; newCart[idx].customizations.names[nIdx].position = val; return { ...prev, cart_data: newCart }; }); };

  const saveOrderEdits = async () => { 
      if(!editingOrder) return; 
      setLoading(true); 
      const priceDifference = newOrderTotal - originalOrderTotal;
      const { error } = await supabase.from('orders').update({ customer_name: editingOrder.customer_name, cart_data: editingOrder.cart_data, shipping_address: editingOrder.shipping_address, total_price: newOrderTotal }).eq('id', editingOrder.id); 
      if(error) { alert("Error: " + error.message); setLoading(false); return; }
      if (priceDifference > 0) {
          const upgradeCart = [{ productName: `Add-on #${String(editingOrder.id).slice(0,4)}`, finalPrice: priceDifference, size: 'N/A', customizations: { mainDesign: 'Upgrade' } }];
          try {
              const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart: upgradeCart, customerName: editingOrder.customer_name }) });
              const data = await res.json();
              if(data.url) { window.location.href = data.url; return; }
          } catch(e) {}
      } else { setOrders(orders.map(o => o.id === editingOrder.id ? editingOrder : o)); closeEditModal(); }
      setLoading(false); 
  };

  // Stats Logic
  useEffect(() => {
    if(!mounted || !orders) return;
    try {
        const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'refunded');
        if (activeOrders.length > 0) {
            const revenue = activeOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
            const count = activeOrders.length;
            let totalCOGS = 0;
            const itemCounts = {};
            activeOrders.forEach(order => {
                const items = Array.isArray(order.cart_data) ? order.cart_data : [];
                items.forEach(item => {
                    if (!item) return;
                    const invItem = inventory.find(i => i.product_id === item.productId && i.size === item.size);
                    const unitCost = Number(invItem?.cost_price || 8.00);
                    totalCOGS += (unitCost + 1.50);
                    const key = `${item.productName || 'Unknown'} (${item.size || '?'})`;
                    itemCounts[key] = (itemCounts[key] || 0) + 1;
                });
            });
            const stripeFees = (revenue * 0.029) + (count * 0.30);
            const net = revenue - stripeFees - totalCOGS;
            const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);
            const topItem = sortedItems.length > 0 ? sortedItems[0] : null;
            setStats({ revenue, count, net, topItem: topItem ? `${topItem[0]} (${topItem[1]})` : '-' });
        } else { setStats({ revenue: 0, count: 0, net: 0, topItem: '-' }); }
    } catch (e) {}
  }, [orders, inventory, mounted]);

  // Inventory logic
  const handleBulkUpload = (e) => { const f = e.target.files[0]; if (!f) return; setUploadLog(["Reading..."]); setLoading(true); const r = new FileReader(); r.onload = async (evt) => { try { const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]); if (!d.length) { setLoading(false); return; } for (const row of d) { await supabase.from('inventory').update({ count: row.count, cost_price: row.cost_price }).eq('product_id', row.product_id).eq('size', row.size); } fetchInventory(); } catch (e) { setUploadLog([e.message]); } setLoading(false); }; r.readAsBinaryString(f); };
  const addLogo = async (e) => { e.preventDefault(); if (!newLogoName) return; await supabase.from('logos').insert([{ label: newLogoName, image_url: newLogoUrl, category: newLogoCategory, sort_order: logos.length + 1, active: true }]); setNewLogoName(''); setNewLogoUrl(''); fetchLogos(); };

  if (!mounted) return <div className="p-10 text-center text-gray-500 font-bold">Loading Admin...</div>;
  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center bg-gray-100"><form onSubmit={handleLogin} className="bg-white p-8 rounded shadow"><h1 className="text-xl font-bold mb-4">Admin Login</h1><input type="password" onChange={e => setPasscode(e.target.value)} className="border p-2 w-full rounded" placeholder="Password"/></form></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black font-sans">
      <audio ref={audioRef} src="/ding.mp3" preload="auto" />
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-black text-gray-900">{eventName || 'Admin Dashboard'}</h1>
          <div className="flex bg-white rounded-lg p-1 shadow border border-gray-300">
            {['orders', 'history', 'inventory', 'guests', 'logos', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded font-bold ${activeTab === tab ? 'bg-blue-900 text-white' : 'hover:bg-gray-100'}`}>{tab}</button>
            ))}
          </div>
        </div>

        {activeTab === 'orders' && ( <div className="space-y-6"> 
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4"> 
            <div className="bg-white p-4 rounded shadow border-l-4 border-green-500"><p className="text-xs text-gray-500 font-bold uppercase">Revenue</p><p className="text-3xl font-black text-green-700">${stats.revenue.toFixed(2)}</p></div> 
            <div className="bg-white p-4 rounded shadow border-l-4 border-blue-500"><p className="text-xs text-gray-500 font-bold uppercase">Paid Orders</p><p className="text-3xl font-black text-blue-900">{stats.count}</p></div> 
            <div className="bg-white p-4 rounded shadow border-l-4 border-pink-500"><p className="text-xs text-gray-500 font-bold uppercase">Est. Net Profit</p><p className="text-3xl font-black text-pink-600">${stats.net.toFixed(2)}</p></div>
            
            {/* AUTO-PRINT UI BLOCK */}
            <div className="bg-white p-4 rounded shadow border-l-4 border-purple-500 flex flex-col justify-between">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-tight">Printer Automation</p>
                <div className="flex items-center gap-2 mt-1">
                    <input type="checkbox" id="autoPrint" checked={autoPrintEnabled} onChange={(e) => setAutoPrintEnabled(e.target.checked)} className="w-5 h-5 accent-blue-900 cursor-pointer" />
                    <label htmlFor="autoPrint" className="text-sm font-black text-gray-800 cursor-pointer uppercase">Auto-Print Labels</label>
                </div>
            </div> 
          </div> 
          <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300 overflow-x-auto"> 
            <table className="w-full text-left min-w-[800px]"><thead className="bg-gray-200"><tr><th className="p-4 w-40">Status</th><th className="p-4">Customer</th><th className="p-4">Items</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>{orders.filter(o => o.status !== 'completed').map((order) => {
                const safeItems = Array.isArray(order.cart_data) ? order.cart_data : [];
                return (
                <tr key={order.id} className={`border-b hover:bg-gray-50 ${order.printed ? 'bg-gray-50' : 'bg-white'}`}>
                    <td className="p-4 align-top"><select value={order.status || 'pending'} onChange={(e) => handleStatusChange(order.id, e.target.value)} className={`p-2 rounded border-2 uppercase font-bold text-xs ${STATUSES[order.status || 'pending']?.color}`}>{Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></td>
                    <td className="p-4 align-top"><div className="font-bold">{order.customer_name}</div><div className="text-xs text-gray-500">{new Date(order.created_at).toLocaleString()}</div></td>
                    <td className="p-4 align-top text-sm">{safeItems.map((item, i) => ( <div key={i} className="mb-2"><strong>{item?.productName}</strong> ({item?.size})</div> ))}<div className="mt-2 text-right font-black text-green-800">${order.total_price}</div></td>
                    <td className="p-4 align-top text-right">
                        <button onClick={() => openEditModal(order)} className="p-2 rounded mr-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold">✏️</button>
                        <button onClick={() => printLabel(order)} className={`p-2 rounded mr-2 font-bold ${order.printed ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 text-black hover:bg-blue-100'}`}>🖨️</button>
                        <button onClick={() => deleteOrder(order.id, order.cart_data)} className="text-red-500 hover:text-red-700 font-bold text-lg">🗑️</button>
                    </td>
                </tr>
            )})}</tbody></table> 
          </div> 
        </div> )}

        {activeTab === 'inventory' && ( <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200"><h2 className="font-bold text-xl mb-4 text-black uppercase">Add Item</h2><form onSubmit={handleAddProductWithSizeUpdates} className="space-y-3"><div><label className="text-xs font-bold uppercase text-gray-500">ID</label><input className="w-full border p-2 rounded text-black" placeholder="jogger_navy" value={newProdId} onChange={e => setNewProdId(e.target.value)} /></div><div><label className="text-xs font-bold uppercase text-gray-500">Name</label><input className="w-full border p-2 rounded text-black" value={newProdName} onChange={e => setNewProdName(e.target.value)} /></div><div><label className="text-xs font-bold uppercase text-gray-500">Type</label><select className="w-full border p-2 rounded bg-white text-black" value={newProdType} onChange={e => setNewProdType(e.target.value)}><option value="top">Top</option><option value="bottom">Bottom</option></select></div><button className="w-full bg-green-600 text-white font-bold py-2 rounded">Create</button></form></div>
                <div className="bg-blue-50 p-6 rounded-lg shadow border border-blue-200"><h2 className="font-bold text-lg mb-2 text-blue-900">📦 Bulk Update</h2><button onClick={downloadTemplate} className="text-xs bg-white border border-blue-300 px-3 py-1 rounded text-blue-700 font-bold mb-4 uppercase">⬇️ Export Stock</button><input type="file" onChange={handleBulkUpload} className="block w-full text-sm text-gray-500" />{uploadLog.length > 0 && (<div className="mt-4 p-2 bg-black text-green-400 text-xs font-mono h-48 overflow-y-auto rounded border border-gray-700">{uploadLog.map((log, i) => <div key={i} className="mb-1 border-b border-gray-800 pb-1">{log}</div>)}</div>)}</div>
            </div>
            <div className="md:col-span-2 space-y-6"><div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300"><div className="bg-blue-900 text-white p-4 font-bold uppercase text-sm">Manage Prices</div><table className="w-full text-left text-sm text-black"><thead className="bg-gray-100"><tr><th className="p-3 font-bold uppercase text-xs">Product</th><th className="p-3 font-bold uppercase text-xs">Price ($)</th><th className="p-3 text-right">Action</th></tr></thead><tbody>{products.map((prod) => (<tr key={prod.id} className="border-b"><td className="p-3 font-bold">{prod.name}</td><td className="p-3 font-bold">$<input type="number" className="w-20 border rounded p-1 ml-1 text-black font-bold" value={prod.base_price} onChange={(e) => updatePrice(prod.id, e.target.value)} /></td><td className="p-3 text-right"><button onClick={() => deleteProduct(prod.id)} className="text-red-500 font-bold text-lg">🗑️</button></td></tr>))}</tbody></table></div><div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300"><div className="bg-gray-800 text-white p-4 font-bold uppercase text-sm tracking-wide">Manage Stock</div><table className="w-full text-left text-sm text-black"><thead className="bg-gray-100"><tr><th className="p-4 uppercase text-xs">Product</th><th className="p-4 uppercase text-xs">Size</th><th className="p-4 uppercase text-xs text-center">Cost</th><th className="p-4 uppercase text-xs text-center">Stock</th></tr></thead><tbody>{inventory.map((item) => (<tr key={`${item.product_id}_${item.size}`} className="border-b"><td className="p-4 font-bold">{getProductName(item.product_id)}</td><td className="p-4">{item.size}</td><td className="p-4"><input type="number" className="w-16 border rounded text-center mx-auto block text-black" value={item.cost_price || ''} onChange={(e) => updateStock(item.product_id, item.size, 'cost_price', parseFloat(e.target.value))} /></td><td className="p-4"><input type="number" className="w-16 border text-center font-bold text-black mx-auto block" value={item.count} onChange={(e) => updateStock(item.product_id, item.size, 'count', parseInt(e.target.value))} /></td></tr>))}</tbody></table></div></div>
        </div> )}

        {activeTab === 'guests' && (<div className="max-w-4xl mx-auto"><div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200"><h2 className="font-bold text-xl mb-4 text-black uppercase">Guests</h2><input type="file" onChange={handleGuestUpload} className="block w-full text-sm text-gray-500" /><button onClick={clearGuestList} className="mt-4 text-red-600 font-bold text-xs uppercase underline">🗑️ Clear Guest List</button></div><div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300"><table className="w-full text-left text-sm text-black"><thead className="bg-gray-100"><tr><th className="p-4 uppercase text-xs">Name</th><th className="p-4 uppercase text-xs">Size</th><th className="p-4 text-center uppercase text-xs">Status</th><th className="p-4 text-right uppercase text-xs">Action</th></tr></thead><tbody>{guests.map((g) => (<tr key={g.id} className="border-b"><td className="p-4 font-bold">{g.name}</td><td className="p-4 font-mono">{g.size || '-'}</td><td className="p-4 text-center">{g.has_ordered ? <span className="text-green-600 font-bold uppercase">Redeemed</span> : 'Wait'}</td><td className="p-4 text-right"><button onClick={() => resetGuest(g.id)} className="text-blue-600 font-bold text-xs underline uppercase tracking-tight">Reset</button></td></tr>))}</tbody></table></div></div>)}
        
        {activeTab === 'logos' && (<div className="max-w-4xl mx-auto"><div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200"><h2 className="font-bold text-xl mb-4 text-black uppercase">Logos</h2><form onSubmit={addLogo} className="grid grid-cols-2 gap-4"><input className="border p-2 rounded text-black col-span-2" placeholder="Label Name" value={newLogoName} onChange={e => setNewLogoName(e.target.value)}/><div className="col-span-2 flex items-center gap-6 bg-gray-50 p-2 rounded border border-gray-200"><span className="font-bold text-gray-700 text-sm">Type:</span><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="cat" checked={newLogoCategory === 'main'} onChange={() => setNewLogoCategory('main')} className="w-4 h-4" /><span className="text-sm font-bold text-black uppercase">Main Design</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="cat" checked={newLogoCategory === 'accent'} onChange={() => setNewLogoCategory('accent')} className="w-4 h-4" /><span className="text-sm font-bold text-black uppercase">Accent</span></label></div><button className="bg-blue-900 text-white font-bold p-2 col-span-2 rounded uppercase tracking-widest">Add</button></form><div className="mt-6 space-y-2 text-black">{logos.map(l => (<div key={l.id} className="flex justify-between p-2 border-b"><span>{l.label} <span className="text-xs text-gray-400 font-bold uppercase ml-2">[{l.category}]</span></span><button onClick={() => deleteLogo(l.id)} className="text-red-500 font-bold">🗑️</button></div>))}</div></div>)}

        {activeTab === 'settings' && (<div className="max-w-xl mx-auto bg-white p-8 rounded shadow border border-gray-300 space-y-6"><h2 className="font-black text-2xl text-black uppercase">Settings</h2><div><label className="font-bold text-xs uppercase text-gray-500">Event Title</label><input className="w-full border p-3 rounded text-black font-bold" value={eventName} onChange={e => setEventName(e.target.value)} /></div><div className="bg-purple-50 p-6 rounded border border-purple-200 text-black"><p className="font-bold text-purple-900 mb-2 uppercase text-xs tracking-widest border-b pb-2">Cloud PrintNode</p><div className="flex justify-between items-center mb-4"><span>Status:</span><input type="checkbox" checked={pnEnabled} onChange={e => setPnEnabled(e.target.checked)} className="w-6 h-6" /></div><input className="w-full border p-2 mb-2 text-sm text-black" placeholder="API Key" value={pnApiKey} onChange={e => setPnApiKey(e.target.value)}/><div className="flex gap-2"><input className="flex-1 border p-2 text-sm text-black" placeholder="Printer ID" value={pnPrinterId} onChange={e => setPnPrinterId(e.target.value)} /><button onClick={discoverPrinters} className="bg-purple-600 text-white px-3 py-1 text-xs rounded font-bold uppercase">Find</button></div></div><button onClick={saveSettings} className="w-full bg-blue-900 text-white py-4 font-black rounded shadow uppercase tracking-widest">Save Settings</button><button onClick={closeEvent} className="w-full bg-red-100 text-red-800 font-bold py-3 mt-10 rounded border border-red-200 uppercase tracking-tight">🏁 Close Event</button></div>)}

        {/* --- EDIT MODAL --- */}
        {editingOrder && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div className="p-6 border-b flex justify-between bg-gray-50 rounded-t-xl"><h2 className="font-bold text-lg text-black uppercase tracking-tight">Edit Order #{String(editingOrder.id).slice(0,8)}</h2><button onClick={closeEditModal} className="text-2xl text-gray-500 hover:text-black">×</button></div>
                    <div className="p-6 space-y-6">
                        <div className="bg-blue-50 p-4 rounded border border-blue-100 text-black"><label className="block text-xs font-bold uppercase text-blue-900 mb-1">Customer Name</label><input className="w-full p-2 border rounded font-bold text-black" value={editingOrder.customer_name} onChange={(e) => handleEditChange('customer_name', e.target.value)} /></div>
                        {editingOrder.cart_data.map((item, idx) => (
                            <div key={idx} className="bg-white p-4 border rounded-lg shadow-sm space-y-4 text-black">
                                <div className="flex justify-between items-center pb-2 border-b"><span className="font-bold text-lg text-black">{item.productName}</span><select className="border-2 p-1 rounded font-bold bg-gray-50 text-black" value={item.size} onChange={(e) => handleEditItem(idx, 'size', e.target.value)}>{SIZE_ORDER.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                <div><label className="text-xs font-bold uppercase text-gray-400">Main Design</label><select className="w-full border p-2 rounded text-black font-black" value={item.customizations?.mainDesign || ''} onChange={(e) => handleUpdateMainDesign(idx, e.target.value)} ><option value="">None</option>{logos.filter(l => l.category === 'main').map(l => ( <option key={l.id} value={l.label}>{l.label}</option> ))}</select></div>
                                <div className="space-y-2"><label className="text-xs font-bold uppercase text-gray-400">Accents</label>{item.customizations?.logos?.map((l, lIdx) => (<div key={lIdx} className="flex gap-2"><select className="border p-2 rounded flex-1 text-sm font-bold text-black" value={l.type} onChange={(e) => handleUpdateAccent(idx, lIdx, 'type', e.target.value)}>{logos.map(opt => <option key={opt.id} value={opt.label}>{opt.label}</option>)}</select><select className="border p-2 rounded w-40 text-sm text-black" value={l.position} onChange={(e) => handleUpdateAccent(idx, lIdx, 'position', e.target.value)}>{POSITIONS.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}</select></div>))}<button onClick={() => handleAddAccent(idx)} className="text-xs text-blue-600 font-black">+ Accent</button></div>
                                <div className="space-y-2"><label className="text-xs font-bold uppercase text-gray-400">Names</label>{item.customizations?.names?.map((n, nIdx) => (<div key={nIdx} className="flex gap-2"><input className="border p-2 rounded flex-1 text-sm uppercase font-black text-black" value={n.text} onChange={(e) => handleEditName(idx, nIdx, e.target.value)} /><select className="border p-2 rounded w-40 text-sm text-black" value={n.position} onChange={(e) => handleUpdateNamePos(idx, nIdx, e.target.value)}>{POSITIONS.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}</select></div>))}<button onClick={() => handleAddName(idx)} className="text-xs text-blue-600 font-black">+ Name</button></div>
                            </div>
                        ))}
                    </div>
                    <div className="p-6 border-t flex justify-end gap-3 bg-gray-50 rounded-b-xl"><button onClick={closeEditModal} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded transition-all uppercase">Cancel</button><button onClick={saveOrderEdits} className={`px-6 py-2 text-white font-bold rounded shadow transition-all transform hover:scale-105 ${newOrderTotal > originalOrderTotal ? 'bg-green-600' : 'bg-blue-600'}`} >{loading ? "Saving..." : (newOrderTotal > originalOrderTotal ? `Upcharge & Save ($${(newOrderTotal - originalOrderTotal).toFixed(2)})` : "Save Changes")}</button></div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}