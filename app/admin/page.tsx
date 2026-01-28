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

  useEffect(() => {
    if (isAuthorized && mounted) {
        fetchOrders(); fetchSettings(); fetchInventory(); fetchLogos(); fetchGuests();
        if (supabase) {
            const channel = supabase.channel('admin_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders()).subscribe();
            return () => { supabase.removeChannel(channel); };
        }
    }
  }, [isAuthorized, mounted]);

  // --- AUTO PRINT LOGIC ---
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
                    const overhead = 1.50; 
                    totalCOGS += (unitCost + overhead);
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

  // Actions
  const handleLogin = async (e) => { e.preventDefault(); setLoading(true); try { const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: passcode }) }); const data = await res.json(); if (data.success) { setIsAuthorized(true); } else { alert("Wrong password"); } } catch (err) { alert("Login failed"); } setLoading(false); };
  const fetchOrders = async () => { if (!supabase) return; const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }); if (data) setOrders(data); };
  const fetchInventory = async () => { if (!supabase) return; const { data: p } = await supabase.from('products').select('*').order('sort_order'); const { data: i } = await supabase.from('inventory').select('*').order('product_id', { ascending: true }); if (p) setProducts(p); if (i) setInventory(i); };
  const fetchLogos = async () => { if (!supabase) return; const { data } = await supabase.from('logos').select('*').order('sort_order'); if (data) setLogos(data); };
  const fetchGuests = async () => { if (!supabase) return; const { data } = await supabase.from('guests').select('*').order('name'); if (data) setGuests(data); };
  const fetchSettings = async () => { if (!supabase) return; const { data } = await supabase.from('event_settings').select('*').single(); if (data) { setEventName(data.event_name); setEventLogo(data.event_logo_url || ''); setHeaderColor(data.header_color || '#1e3a8a'); setPaymentMode(data.payment_mode || 'retail'); setPrinterType(data.printer_type || 'label'); setOfferBackNames(data.offer_back_names ?? true); setOfferMetallic(data.offer_metallic ?? true); setOfferPersonalization(data.offer_personalization ?? true); setPnEnabled(data.printnode_enabled || false); setPnApiKey(data.printnode_api_key || ''); setPnPrinterId(data.printnode_printer_id || ''); } };
  const saveSettings = async () => { await supabase.from('event_settings').update({ event_name: eventName, event_logo_url: eventLogo, header_color: headerColor, payment_mode: paymentMode, printer_type: printerType, offer_back_names: offerBackNames, offer_metallic: offerMetallic, offer_personalization: offerPersonalization, printnode_enabled: pnEnabled, printnode_api_key: pnApiKey, printnode_printer_id: pnPrinterId }).eq('id', 1); alert("Saved!"); };
  const closeEvent = async () => { if (prompt(`Type 'CLOSE' to confirm archive:`) !== 'CLOSE') return; setLoading(true); await supabase.from('orders').update({ event_name: eventName }).neq('status', 'completed'); await supabase.from('orders').update({ status: 'completed' }).neq('status', 'completed'); alert("Event Closed!"); fetchOrders(); setLoading(false); };
  const handleStatusChange = async (orderId, newStatus) => { setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o)); await supabase.from('orders').update({ status: newStatus }).eq('id', orderId); };
  const deleteOrder = async (orderId, cartData) => { if (!confirm("Delete Order?")) return; setLoading(true); if (Array.isArray(cartData)) { for (const item of cartData) { if (item?.productId && item?.size) { const { data: current } = await supabase.from('inventory').select('count').eq('product_id', item.productId).eq('size', item.size).single(); if (current) { await supabase.from('inventory').update({ count: current.count + 1 }).eq('product_id', item.productId).eq('size', item.size); } } } } await supabase.from('orders').delete().eq('id', orderId); fetchOrders(); fetchInventory(); setLoading(false); };
  
  const handleRefund = async (orderId, paymentIntentId) => {
    if (!confirm("Refund?")) return;
    setLoading(true);
    try {
        const result = await refundOrder(orderId, paymentIntentId);
        if (result.success) { alert("Refunded."); setOrders(orders.map(o => o.id === orderId ? { ...o, status: 'refunded' } : o)); } else { alert("Failed: " + result.message); }
    } catch(e) { alert("Error: " + e.message); }
    setLoading(false);
  };

  const discoverPrinters = async () => { if(!pnApiKey) return alert("Enter API Key"); setLoading(true); try { const res = await fetch('https://api.printnode.com/printers', { headers: { 'Authorization': 'Basic ' + btoa(pnApiKey + ':') } }); const data = await res.json(); if (Array.isArray(data)) { setAvailablePrinters(data); alert(`Found ${data.length} printers!`); } } catch (e) {} setLoading(false); };
  
  const printLabel = async (order) => {
      if (!order) return;
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, printed: true } : o));
      await supabase.from('orders').update({ printed: true }).eq('id', order.id);
      const isCloud = pnEnabled && pnApiKey && pnPrinterId;
      try {
          const res = await fetch('/api/printnode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order, mode: isCloud ? 'cloud' : 'download', apiKey: pnApiKey, printerId: pnPrinterId })
          });
          const result = await res.json();
          if (result.success && !isCloud) {
              const pdfBytes = Uint8Array.from(atob(result.pdfBase64), c => c.charCodeAt(0));
              const blob = new Blob([pdfBytes], { type: 'application/pdf' });
              window.open(window.URL.createObjectURL(blob), '_blank');
          }
      } catch (e) {}
  };

  // --- EDIT FUNCTIONS ---
  const openEditModal = (order) => { 
      const rawCart = Array.isArray(order.cart_data) ? order.cart_data : [];
      const cleanCart = rawCart.filter(i => i).map(item => ({
            ...item,
            productName: item.productName || 'Unknown',
            size: item.size || 'N/A',
            customizations: { mainDesign: item.customizations?.mainDesign || '', logos: Array.isArray(item.customizations?.logos) ? item.customizations.logos : [], names: Array.isArray(item.customizations?.names) ? item.customizations.names : [], backList: !!item.customizations?.backList, metallic: !!item.customizations?.metallic }
      }));
      setEditingOrder({ ...order, cart_data: cleanCart }); 
      setOriginalOrderTotal(order.total_price || 0);
  };
  const closeEditModal = () => { setEditingOrder(null); };
  const handleEditChange = (f, v) => setEditingOrder(p => ({ ...p, [f]: v }));
  const handleEditItem = (idx, f, v) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; newCart[idx] = { ...newCart[idx], [f]: v }; return { ...prev, cart_data: newCart }; }); };
  const handleUpdateMainDesign = (idx, v) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; newCart[idx].customizations.mainDesign = v; return { ...prev, cart_data: newCart }; }); };
  const handleEditName = (idx, nIdx, val) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; newCart[idx].customizations.names[nIdx].text = val; return { ...prev, cart_data: newCart }; }); };
  const handleAddAccent = (idx) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; newCart[idx].customizations.logos.push({ type: logos[0]?.label || 'Logo', position: 'Left Sleeve' }); return { ...prev, cart_data: newCart }; }); };
  const handleAddName = (idx) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; newCart[idx].customizations.names.push({ text: '', position: 'Hood' }); return { ...prev, cart_data: newCart }; }); };
  const handleUpdateAccent = (idx, lIdx, f, v) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; newCart[idx].customizations.logos[lIdx][f] = v; return { ...prev, cart_data: newCart }; }); };
  const handleUpdateNamePos = (idx, nIdx, v) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; newCart[idx].customizations.names[nIdx].position = v; return { ...prev, cart_data: newCart }; }); };

  const saveOrderEdits = async () => { 
      if(!editingOrder) return; 
      setLoading(true); 
      const priceDifference = newOrderTotal - originalOrderTotal;
      const { error } = await supabase.from('orders').update({ customer_name: editingOrder.customer_name, cart_data: editingOrder.cart_data, total_price: newOrderTotal }).eq('id', editingOrder.id); 
      if(!error && priceDifference > 0) {
          const upgradeCart = [{ productName: `Upcharge Order #${String(editingOrder.id).slice(0,4)}`, finalPrice: priceDifference, size: 'N/A', customizations: { mainDesign: 'Upgrade' } }];
          const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart: upgradeCart, customerName: editingOrder.customer_name }) });
          const data = await res.json();
          if(data.url) window.location.href = data.url;
      } else { setOrders(orders.map(o => o.id === editingOrder.id ? editingOrder : o)); closeEditModal(); }
      setLoading(false); 
  };

  // --- AUX ---
  const addLogo = async (e) => { e.preventDefault(); if (!newLogoName) return; await supabase.from('logos').insert([{ label: newLogoName, image_url: newLogoUrl, category: newLogoCategory, sort_order: logos.length + 1 }]); setNewLogoName(''); setNewLogoUrl(''); fetchLogos(); };
  const deleteLogo = async (id) => { if (!confirm("Delete?")) return; await supabase.from('logos').delete().eq('id', id); fetchLogos(); };
  const deleteProduct = async (id) => { if (!confirm("Delete product?")) return; await supabase.from('inventory').delete().eq('product_id', id); await supabase.from('products').delete().eq('id', id); fetchInventory(); };
  const updateStock = async (pid, s, f, v) => { setInventory(inventory.map(i => (i.product_id === pid && i.size === s) ? { ...i, [f]: v } : i)); await supabase.from('inventory').update({ [f]: v }).eq('product_id', pid).eq('size', s); };
  const updatePrice = async (pid, v) => { setProducts(products.map(p => p.id === pid ? { ...p, base_price: v } : p)); await supabase.from('products').update({ base_price: v }).eq('id', pid); };
  const toggleLogo = async (id, s) => { setLogos(logos.map(l => l.id === id ? { ...l, active: !s } : l)); await supabase.from('logos').update({ active: !s }).eq('id', id); };
  const getProductName = (id) => products.find(p => p.id === id)?.name || id;
  const downloadTemplate = () => { const data = inventory.map(item => ({ product_id: item.product_id, size: item.size, count: item.count, cost_price: item.cost_price || 8.50 })); const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Inventory"); XLSX.writeFile(wb, "Inventory.xlsx"); };
  const downloadCSV = () => { const rows = orders.map(o => [o.id, o.customer_name, o.status, o.total_price].join(',')); const link = document.createElement("a"); link.href = "data:text/csv;charset=utf-8," + encodeURI("ID,Name,Status,Total\n" + rows.join('\n')); link.download = "orders.csv"; link.click(); };
  const handleAddProductWithSizeUpdates = async (e) => { e.preventDefault(); if (!newProdId || !newProdName) return; await supabase.from('products').insert([{ id: newProdId.toLowerCase().replace(/\s/g, '_'), name: newProdName, base_price: newProdPrice, type: newProdType, sort_order: 99 }]); const sizes = ['Youth XS', 'Youth S', 'Youth M', 'Youth L', 'Adult S', 'Adult M', 'Adult L', 'Adult XL', 'Adult XXL', 'Adult 3XL', 'Adult 4XL']; await supabase.from('inventory').insert(sizes.map(s => ({ product_id: newProdId.toLowerCase().replace(/\s/g, '_'), size: s, count: 0, active: true }))); fetchInventory(); };
  const handleGuestUpload = (e) => { const f = e.target.files[0]; if (!f) return; setLoading(true); const r = new FileReader(); r.onload = async (evt) => { const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]); for (const row of d) { if (row.Name) await supabase.from('guests').insert([{ name: String(row.Name).trim(), size: row.Size, has_ordered: false }]); } fetchGuests(); setLoading(false); }; r.readAsBinaryString(f); };
  const resetGuest = async (id) => { await supabase.from('guests').update({ has_ordered: false }).eq('id', id); fetchGuests(); };
  const clearGuestList = async () => { if (confirm("Clear All?")) { await supabase.from('guests').delete().neq('id', 0); fetchGuests(); } };
  const handleBulkUpload = (e) => { const f = e.target.files[0]; if (!f) return; setLoading(true); const r = new FileReader(); r.onload = async (evt) => { const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]); for (const row of d) { await supabase.from('inventory').update({ count: row.count, cost_price: row.cost_price }).eq('product_id', row.product_id).eq('size', row.size); } fetchInventory(); setLoading(false); }; r.readAsBinaryString(f); };

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
            <div className="bg-white p-4 rounded shadow border-l-4 border-pink-500"><p className="text-xs text-gray-500 font-bold uppercase">Est. Net</p><p className="text-3xl font-black text-pink-600">${stats.net.toFixed(2)}</p></div>
            <div className="bg-blue-900 p-4 rounded shadow flex flex-col justify-center items-center text-white"><p className="text-xs font-bold uppercase mb-2 opacity-80">Auto-Print</p><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={autoPrintEnabled} onChange={(e) => setAutoPrintEnabled(e.target.checked)} className="sr-only peer" /><div className="w-14 h-7 bg-blue-700 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-full"></div></label></div> 
          </div> 
          <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300 overflow-x-auto"> 
            <table className="w-full text-left min-w-[800px]"><thead className="bg-gray-200"><tr><th className="p-4 w-40">Status</th><th className="p-4">Date</th><th className="p-4">Customer</th><th className="p-4">Items</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>{orders.filter(o => o.status !== 'completed').map((order) => {
                const safeItems = Array.isArray(order.cart_data) ? order.cart_data : [];
                return (
                <tr key={order.id} className={`border-b hover:bg-gray-50 ${order.printed ? 'bg-gray-50' : 'bg-white'}`}>
                    <td className="p-4 align-top"><select value={order.status || 'pending'} onChange={(e) => handleStatusChange(order.id, e.target.value)} className={`p-2 rounded border-2 uppercase font-bold text-xs ${STATUSES[order.status || 'pending']?.color}`}>{Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></td>
                    <td className="p-4 align-top text-sm text-gray-500" suppressHydrationWarning>{new Date(order.created_at).toLocaleString()}</td>
                    <td className="p-4 align-top font-bold">{order.customer_name}</td>
                    <td className="p-4 align-top text-sm">{safeItems.map((item, i) => ( <div key={i} className="mb-2"><span className="font-bold">{item?.productName}</span> ({item?.size})</div> ))}<div className="mt-2 text-right font-black text-green-800">${order.total_price}</div></td>
                    <td className="p-4 align-top text-right"><button onClick={() => openEditModal(order)} className="p-2 mr-2 text-blue-600 font-bold">✏️</button><button onClick={() => printLabel(order)} className={`p-2 mr-2 font-bold ${order.printed ? 'text-gray-400' : 'text-green-600'}`}>🖨️</button><button onClick={() => deleteOrder(order.id, order.cart_data)} className="text-red-500 font-bold">🗑️</button></td>
                </tr>
            )})}</tbody></table> 
          </div> 
        </div> )}

        {activeTab === 'history' && ( <div><div className="bg-gray-800 text-white p-4 rounded-t-lg flex justify-between items-center font-bold"><h2>Archive</h2><button onClick={downloadCSV}>CSV</button></div><div className="bg-white shadow rounded-b-lg border border-gray-300 p-10 text-center">{orders.filter(o => o.status === 'completed').length === 0 ? "Empty" : "Items found"}</div></div> )}

        {activeTab === 'inventory' && ( <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded shadow border"><h2 className="font-bold mb-4">Add Item</h2><form onSubmit={handleAddProductWithSizeUpdates} className="space-y-3"><input className="w-full border p-2" placeholder="ID" value={newProdId} onChange={e => setNewProdId(e.target.value)}/><input className="w-full border p-2" placeholder="Name" value={newProdName} onChange={e => setNewProdName(e.target.value)}/><button className="w-full bg-green-600 text-white font-bold py-2">Create</button></form></div>
            <div className="md:col-span-2 space-y-6"><div className="bg-white shadow rounded border overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-100"><tr><th className="p-3">Product</th><th className="p-3">Price</th><th className="p-3">Action</th></tr></thead><tbody>{products.map(p => (<tr key={p.id} className="border-b"><td className="p-3 font-bold">{p.name}</td><td className="p-3"><input type="number" className="w-20 border p-1" value={p.base_price} onChange={e => updatePrice(p.id, e.target.value)}/></td><td className="p-3"><button onClick={() => deleteProduct(p.id)} className="text-red-500">🗑️</button></td></tr>))}</tbody></table></div></div>
        </div> )}

        {activeTab === 'guests' && (<div className="bg-white p-6 rounded shadow border"><h2 className="font-bold mb-4">Guests</h2><input type="file" onChange={handleGuestUpload}/><table className="w-full text-left mt-6"><thead className="bg-gray-100"><tr><th className="p-3">Name</th><th className="p-3">Status</th></tr></thead><tbody>{guests.map(g => (<tr key={g.id} className="border-b"><td className="p-3">{g.name}</td><td className="p-3">{g.has_ordered ? "Redeemed" : "Wait"}</td></tr>))}</tbody></table></div>)}
        
        {activeTab === 'logos' && (<div className="bg-white p-6 rounded shadow border"><h2 className="font-bold mb-4">Add Logo</h2><form onSubmit={addLogo} className="grid grid-cols-2 gap-4"><input className="border p-2" placeholder="Name" value={newLogoName} onChange={e => setNewLogoName(e.target.value)}/><button className="bg-blue-900 text-white font-bold p-2">Add</button></form><div className="mt-6 space-y-2">{logos.map(l => (<div key={l.id} className="flex justify-between p-2 border-b"><span>{l.label}</span><button onClick={() => deleteLogo(l.id)} className="text-red-500">🗑️</button></div>))}</div></div>)}
        
        {activeTab === 'settings' && (<div className="bg-white p-8 rounded shadow border max-w-xl mx-auto"><h2 className="font-bold text-2xl mb-6">Settings</h2><input className="w-full border p-3 mb-4" placeholder="Event Name" value={eventName} onChange={e => setEventName(e.target.value)}/><div className="bg-purple-50 p-4 rounded mb-6 border border-purple-200 font-bold">Cloud Printing<div className="flex justify-between mt-2">Enable?<input type="checkbox" checked={pnEnabled} onChange={e => setPnEnabled(e.target.checked)}/></div><input className="w-full p-2 border mt-2 text-sm" placeholder="API Key" value={pnApiKey} onChange={e => setPnApiKey(e.target.value)}/><div className="flex mt-2 gap-2"><input className="flex-1 p-2 border" placeholder="Printer ID" value={pnPrinterId} onChange={e => setPnPrinterId(e.target.value)}/><button onClick={discoverPrinters} className="bg-purple-600 text-white px-4 text-xs">Find</button></div></div><button onClick={saveSettings} className="w-full bg-blue-900 text-white font-bold py-3 shadow">Save</button></div>)}

        {editingOrder && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div className="p-6 border-b flex justify-between bg-gray-50 rounded-t-xl"><h2 className="font-bold text-lg">Edit Order #{String(editingOrder.id).slice(0,8)}</h2><button onClick={closeEditModal} className="text-2xl text-gray-500">×</button></div>
                    <div className="p-6 space-y-6">
                        <div className="bg-blue-50 p-4 rounded border border-blue-100"><label className="block text-xs font-bold uppercase text-blue-900 mb-1">Customer Name</label><input className="w-full p-2 border rounded font-bold" value={editingOrder.customer_name} onChange={(e) => handleEditChange('customer_name', e.target.value)} /></div>
                        {editingOrder.cart_data.map((item, idx) => (
                            <div key={idx} className="bg-white p-4 border rounded-lg shadow-sm">
                                <div className="flex justify-between items-center mb-4 pb-2 border-b"><span className="font-bold text-lg">{item.productName}</span><select className="border-2 p-1 rounded font-bold" value={item.size} onChange={(e) => handleEditItem(idx, 'size', e.target.value)}>{SIZE_ORDER.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                <div className="mb-4"><div className="text-xs font-bold text-gray-500 uppercase mb-1">Main Design</div><select className="w-full border p-2 rounded" value={item.customizations?.mainDesign || ''} onChange={(e) => handleUpdateMainDesign(idx, e.target.value)}><option value="">None</option>{logos.filter(l => l.category === 'main').map(l => (<option key={l.id} value={l.label}>{l.label}</option>))}</select></div>
                                <div className="space-y-2 mb-4"><div className="text-xs font-bold text-gray-500 uppercase">Accents ($5)</div>{item.customizations?.logos?.map((l, lIdx) => (<div key={lIdx} className="flex gap-2"><select className="border p-2 rounded flex-1 text-sm font-bold" value={l.type} onChange={(e) => handleUpdateAccent(idx, lIdx, 'type', e.target.value)}>{logos.map(opt => <option key={opt.id} value={opt.label}>{opt.label}</option>)}</select><select className="border p-2 rounded w-40 text-sm" value={l.position} onChange={(e) => handleUpdateAccent(idx, lIdx, 'position', e.target.value)}>{POSITIONS.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}</select></div>))}<button onClick={() => handleAddAccent(idx)} className="text-xs text-blue-600 font-bold">+ Accent</button></div>
                                <div className="space-y-2"><div className="text-xs font-bold text-gray-500 uppercase">Personalization ($5)</div>{item.customizations?.names?.map((n, nIdx) => (<div key={nIdx} className="flex gap-2"><input className="border p-2 rounded flex-1 text-sm uppercase font-bold" value={n.text} onChange={(e) => handleEditName(idx, nIdx, e.target.value)} /><select className="border p-2 rounded w-40 text-sm" value={n.position} onChange={(e) => handleUpdateNamePos(idx, nIdx, e.target.value)}>{POSITIONS.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}</select></div>))}<button onClick={() => handleAddName(idx)} className="text-xs text-blue-600 font-bold">+ Name</button></div>
                            </div>
                        ))}
                    </div>
                    <div className="p-6 border-t flex justify-end gap-3 bg-gray-50 rounded-b-xl"><button onClick={closeEditModal} className="px-4 py-2 text-gray-600 font-bold">Cancel</button><button onClick={saveOrderEdits} className="px-6 py-2 bg-blue-600 text-white font-bold rounded shadow">{newOrderTotal > originalOrderTotal ? `Save & Pay $${(newOrderTotal - originalOrderTotal).toFixed(2)}` : "Save"}</button></div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}