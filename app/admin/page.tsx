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
  // --- CLIENT-ONLY GUARD ---
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

  // --- EDIT MODAL STATE ---
  const [editingOrder, setEditingOrder] = useState(null);

  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const audioRef = useRef(null);

  // Forms & Settings
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

  // PrintNode Settings
  const [pnEnabled, setPnEnabled] = useState(false);
  const [pnApiKey, setPnApiKey] = useState('');
  const [pnPrinterId, setPnPrinterId] = useState('');
  const [availablePrinters, setAvailablePrinters] = useState([]);

  // --- SAFE MOUNT & AUTH ---
  useEffect(() => {
    setMounted(true); // Allow rendering only after mount
    if (isAuthorized) {
        fetchOrders();
        fetchSettings(); 
        fetchInventory();
        fetchLogos();
        fetchGuests();
        if (supabase) {
            const channel = supabase.channel('admin_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders()).subscribe();
            return () => { supabase.removeChannel(channel); };
        }
    }
  }, [isAuthorized]);

  // --- STATS CALCULATION ---
  useEffect(() => {
    if (!mounted) return;
    try {
        const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'refunded');
        if (activeOrders.length > 0) {
            const revenue = activeOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
            const count = activeOrders.length;
            
            let totalCOGS = 0;
            const itemCounts = {};

            activeOrders.forEach(order => {
                if(Array.isArray(order.cart_data)) {
                    order.cart_data.forEach(item => {
                        if (!item) return;
                        const invItem = inventory.find(i => i.product_id === item.productId && i.size === item.size);
                        const unitCost = Number(invItem?.cost_price || 8.00);
                        const overhead = 1.50; 
                        totalCOGS += (unitCost + overhead);
                        const key = `${item.productName || 'Unknown'} (${item.size || '?'})`;
                        itemCounts[key] = (itemCounts[key] || 0) + 1;
                    });
                }
            });

            const stripeFees = (revenue * 0.029) + (count * 0.30);
            const net = revenue - stripeFees - totalCOGS;
            
            const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);
            const topItem = sortedItems.length > 0 ? sortedItems[0] : null;
            
            setStats({ revenue, count, net, topItem: topItem ? `${topItem[0]} (${topItem[1]})` : '-' });
        } else {
            setStats({ revenue: 0, count: 0, net: 0, topItem: '-' });
        }
    } catch (e) { console.log("Stats Error", e); }
  }, [orders, inventory, mounted]);

  useEffect(() => {
    if (!mounted) return;
    let interval;
    if (isAuthorized && autoPrintEnabled) { interval = setInterval(() => { checkForNewLabels(); }, 5000); }
    return () => clearInterval(interval);
  }, [isAuthorized, autoPrintEnabled, orders, mounted]);

  const checkForNewLabels = () => {
    const unprinted = orders.filter(o => !o.printed && o.status !== 'completed' && o.status !== 'shipped' && o.status !== 'refunded').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (unprinted.length > 0) { if (audioRef.current) audioRef.current.play().catch(e => console.log("Audio fail", e)); printLabel(unprinted[0]); }
  };

  const discoverPrinters = async () => {
      if(!pnApiKey) return alert("Enter API Key first");
      setLoading(true);
      try {
          const res = await fetch('https://api.printnode.com/printers', { headers: { 'Authorization': 'Basic ' + btoa(pnApiKey + ':') } });
          const data = await res.json();
          if (Array.isArray(data)) {
              setAvailablePrinters(data);
              alert(`Found ${data.length} printers! Select one.`);
          } else { alert("Could not fetch printers. Check Key."); }
      } catch (e) { alert("Connection Error"); }
      setLoading(false);
  };

  const printLabel = async (order) => {
    if (!order) return;
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, printed: true } : o));
    await supabase.from('orders').update({ printed: true }).eq('id', order.id);

    const safeCart = Array.isArray(order.cart_data) ? order.cart_data : [];

    if (pnEnabled) {
        const topMargin = "\n";        
        const leftMargin = "   ";      
        const lines = [ `ORDER #${order.id}`, `${order.customer_name}`, `Time: ${new Date(order.created_at).toLocaleTimeString()}`, `------------------------` ];
        safeCart.forEach(item => {
            if(!item) return;
            const customs = item.customizations || {};
            lines.push(`[ ] ${item.productName} (${item.size})`);
            if(customs.mainDesign) lines.push(`    Main: ${customs.mainDesign}`);
            if(customs.logos && customs.logos.length > 0) {
                const accents = customs.logos.map(l => `${l.type} (${l.position || 'Any'})`).join(', ');
                lines.push(`    Accents: ${accents}`);
            }
            if(customs.names && customs.names.length > 0) {
                const names = customs.names.map(n => `"${n.text}" (${n.position || 'Any'})`).join(', ');
                lines.push(`    Names: ${names}`);
            }
            if(item.needsShipping) lines.push(`    ** SHIP TO HOME **`);
            lines.push(` `); 
        });
        const content = topMargin + lines.map(line => leftMargin + line).join('\n');
        try {
            const res = await fetch('/api/printnode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: btoa(content), title: `Order ${order.id}` }) });
            const data = await res.json();
            if(!data.success) alert("PrintNode Failed: " + (data.error || "Unknown Error"));
        } catch(e) { alert("Cloud Print Network Failed: " + e.message); }
    } else {
        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) { alert("⚠️ POPUP BLOCKED"); return; }
        let htmlContent = '';
        const itemHtml = safeCart.map(i => {
            if(!i) return '';
            const customs = i.customizations || {};
            let details = `<strong>${i.productName}</strong> <span class="size">${i.size}</span>`;
            if (customs.mainDesign) details += `<br/>Main: ${customs.mainDesign}`;
            if (customs.logos?.length > 0) details += `<br/>Accents: ${customs.logos.map(l => l.type).join(', ')}`;
            if (customs.names?.length > 0) details += `<br/>Names: ${customs.names.map(n => `"${n.text}"`).join(', ')}`;
            return `<div class="item">${details}</div>`;
        }).join('');
        if (printerType === 'standard') {
            htmlContent = `<html><head><title>Order #${order.id}</title><style>@page { size: letter; margin: 0.5in; } body { font-family: sans-serif; padding: 20px; } .item { border-bottom: 2px solid #eee; padding: 20px 0; font-size: 18px; } .size { background: black; color: white; padding: 2px 8px; border-radius: 4px; } </style></head><body><h1>${order.customer_name}</h1><h2>Order #${order.id}</h2>${itemHtml}</body></html>`;
        } else {
            htmlContent = `<html><head><title>Order #${order.id}</title><style>@page { size: 4in 6in; margin: 0; } body { font-family: monospace; margin-top: 0.25in; margin-left: 0.25in; margin-right: 0.1in; } .header { border-bottom: 3px solid black; text-align: center; } .item { border-bottom: 1px dashed #999; padding: 5px 0; font-weight: bold; font-size: 14px; } </style></head><body><div class="header"><h1>${order.customer_name}</h1><h2>#${order.id}</h2></div>${itemHtml}</body></html>`;
        }
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 500);
    }
  };

  // --- ACTIONS ---
  const handleLogin = async (e) => { e.preventDefault(); setLoading(true); try { const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: passcode }) }); const data = await res.json(); if (data.success) { setIsAuthorized(true); } else { alert("Wrong password"); } } catch (err) { alert("Login failed"); } setLoading(false); };
  const fetchOrders = async () => { if (!supabase) return; setLoading(true); const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }); if (data) setOrders(data); setLoading(false); };
  const fetchInventory = async () => { if (!supabase) return; setLoading(true); const { data: prodData } = await supabase.from('products').select('*').order('sort_order'); const { data: invData } = await supabase.from('inventory').select('*').order('product_id', { ascending: true }); if (prodData) setProducts(prodData); if (invData) setInventory(invData); setLoading(false); };
  const fetchLogos = async () => { if (!supabase) return; setLoading(true); const { data } = await supabase.from('logos').select('*').order('sort_order'); if (data) setLogos(data); setLoading(false); };
  const fetchGuests = async () => { if (!supabase) return; setLoading(true); const { data } = await supabase.from('guests').select('*').order('name'); if (data) setGuests(data); setLoading(false); };
  
  const fetchSettings = async () => { 
      if (!supabase) return; 
      setLoading(true); 
      const { data } = await supabase.from('event_settings').select('*').single(); 
      if (data) { 
          setEventName(data.event_name); 
          setEventLogo(data.event_logo_url || ''); 
          setHeaderColor(data.header_color || '#1e3a8a'); 
          setPaymentMode(data.payment_mode || 'retail'); 
          setPrinterType(data.printer_type || 'label'); 
          setOfferBackNames(data.offer_back_names ?? true); 
          setOfferMetallic(data.offer_metallic ?? true); 
          setOfferPersonalization(data.offer_personalization ?? true);
          setPnEnabled(data.printnode_enabled || false);
          setPnApiKey(data.printnode_api_key || '');
          setPnPrinterId(data.printnode_printer_id || '');
      } 
      setLoading(false); 
  };
  
  const saveSettings = async () => { 
      await supabase.from('event_settings').update({ event_name: eventName, event_logo_url: eventLogo, header_color: headerColor, payment_mode: paymentMode, printer_type: printerType, offer_back_names: offerBackNames, offer_metallic: offerMetallic, offer_personalization: offerPersonalization, printnode_enabled: pnEnabled, printnode_api_key: pnApiKey, printnode_printer_id: pnPrinterId }).eq('id', 1); 
      alert("Event Settings Saved!"); 
  };

  const closeEvent = async () => { 
      const input = prompt(`⚠️ ARCHIVE EVENT?\n\nThis will tag all active orders with: "${eventName}"\nand move them to History.\n\nType 'CLOSE' to confirm:`); 
      if (input !== 'CLOSE') return; 
      setLoading(true); 
      await supabase.from('orders').update({ event_name: eventName }).neq('status', 'completed');
      await supabase.from('orders').update({ status: 'completed' }).neq('status', 'completed'); 
      alert("Event Closed!"); 
      fetchOrders(); 
      setLoading(false); 
  };

  const handleStatusChange = async (orderId, newStatus) => { setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o)); await supabase.from('orders').update({ status: newStatus }).eq('id', orderId); if (newStatus === 'ready' || newStatus === 'partially_fulfilled') { const order = orders.find(o => o.id === orderId); let msg = newStatus === 'ready' ? "READY for pickup!" : "PARTIALLY READY. Pick up available items!"; if (order) try { await fetch('/api/send-text', { method: 'POST', body: JSON.stringify({ phone: order.phone, message: `Hi ${order.customer_name}! Your Swag Order is ${msg}` }) }); } catch (e) {} } };
  
  const deleteOrder = async (orderId, cartData) => { if (!confirm("⚠️ Cancel Order & Restore Inventory?")) return; setLoading(true); if (cartData && Array.isArray(cartData)) { for (const item of cartData) { if (item.productId && item.size) { const { data: currentItem } = await supabase.from('inventory').select('count').eq('product_id', item.productId).eq('size', item.size).single(); if (currentItem) { await supabase.from('inventory').update({ count: currentItem.count + 1 }).eq('product_id', item.productId).eq('size', item.size); } } } } await supabase.from('orders').delete().eq('id', orderId); fetchOrders(); fetchInventory(); setLoading(false); alert("Order deleted and inventory restored."); };
  
  // --- RE-ENABLED REFUND LOGIC ---
  const handleRefund = async (orderId, paymentIntentId) => {
    if (!confirm("Refund this order? Cannot be undone.")) return;
    setLoading(true);
    try {
        const result = await refundOrder(orderId, paymentIntentId);
        if (result.success) { 
            alert("Success: Refunded."); 
            setOrders(orders.map(o => o.id === orderId ? { ...o, status: 'refunded' } : o)); 
        } else { 
            alert("Refund Failed: " + result.message); 
        }
    } catch(e) { 
        alert("Server Error: " + e.message);
    }
    setLoading(false);
  };

  // --- UPDATED: EDIT FUNCTIONS (SANITIZER ADDED) ---
  const openEditModal = (order) => { 
      // THE "CAR WASH": Deep clean the order data before setting state
      const rawCart = Array.isArray(order.cart_data) ? order.cart_data : [];
      
      const cleanCart = rawCart
        .filter(item => item !== null && item !== undefined) // Step 1: Remove ghost items
        .map(item => ({
            ...item,
            productName: item.productName || 'Unknown Item',
            size: item.size || 'N/A',
            // Step 2: Ensure customizations structure exists
            customizations: {
                mainDesign: item.customizations?.mainDesign || '',
                logos: Array.isArray(item.customizations?.logos) ? item.customizations.logos : [],
                names: Array.isArray(item.customizations?.names) ? item.customizations.names : [],
            }
      }));
      
      setEditingOrder({ ...order, cart_data: cleanCart }); 
  };

  const closeEditModal = () => { setEditingOrder(null); };
  const handleEditChange = (f, v) => setEditingOrder(p => ({ ...p, [f]: v }));
  const handleEditItem = (i, f, v) => { const c = [...editingOrder.cart_data]; c[i] = { ...c[i], [f]: v }; setEditingOrder(p => ({ ...p, cart_data: c })); };
  
  const handleEditName = (idx, nIdx, v) => { 
      const c = [...editingOrder.cart_data]; 
      const itm = { ...c[idx] }; 
      const cust = { ...itm.customizations }; 
      const nms = [...(cust.names || [])]; 
      
      if (nms[nIdx]) { 
          nms[nIdx] = { ...nms[nIdx], text: v }; 
          cust.names = nms; 
          itm.customizations = cust; 
          c[idx] = itm; 
          setEditingOrder(p => ({ ...p, cart_data: c })); 
      } 
  };

  const saveOrderEdits = async () => { if(!editingOrder) return; setLoading(true); const { error } = await supabase.from('orders').update({ customer_name: editingOrder.customer_name, cart_data: editingOrder.cart_data, shipping_address: editingOrder.shipping_address }).eq('id', editingOrder.id); if(error) alert("Error: " + error.message); else { setOrders(orders.map(o => o.id === editingOrder.id ? editingOrder : o)); closeEditModal(); } setLoading(false); };

  // ... (Other standard functions - Kept exactly as you had them) ...
  const addLogo = async (e) => { e.preventDefault(); if (!newLogoName) return; await supabase.from('logos').insert([{ label: newLogoName, image_url: newLogoUrl, category: newLogoCategory, sort_order: logos.length + 1 }]); setNewLogoName(''); setNewLogoUrl(''); fetchLogos(); };
  const deleteLogo = async (id) => { if (!confirm("Delete this logo?")) return; await supabase.from('logos').delete().eq('id', id); fetchLogos(); };
  const deleteProduct = async (id) => { if (!confirm("Are you sure? This deletes the product AND inventory.")) return; await supabase.from('inventory').delete().eq('product_id', id); await supabase.from('products').delete().eq('id', id); fetchInventory(); };
  const updateStock = async (productId, size, field, value) => { setInventory(inventory.map(i => (i.product_id === productId && i.size === size) ? { ...i, [field]: value } : i)); await supabase.from('inventory').update({ [field]: value }).eq('product_id', productId).eq('size', size); };
  const updatePrice = async (productId, newPrice) => { setProducts(products.map(p => p.id === productId ? { ...p, base_price: newPrice } : p)); await supabase.from('products').update({ base_price: newPrice }).eq('id', productId); };
  const toggleLogo = async (id, currentStatus) => { setLogos(logos.map(l => l.id === id ? { ...l, active: !currentStatus } : l)); await supabase.from('logos').update({ active: !currentStatus }).eq('id', id); };
  const getProductName = (id) => products.find(p => p.id === id)?.name || id;
  const downloadTemplate = () => { try { const data = inventory.map(item => ({ product_id: item.product_id, size: item.size, count: item.count, cost_price: item.cost_price || 8.50, _Reference_Name: getProductName(item.product_id) || item.product_id })); const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Inventory"); XLSX.writeFile(wb, "Inventory.xlsx"); } catch (e) { alert("Download Failed"); } };
  const downloadCSV = () => { if (!orders.length) return; const headers = ['ID', 'Event', 'Date', 'Customer', 'Phone', 'Address', 'Status', 'Total', 'Items']; const rows = orders.map(o => { const addr = o.shipping_address ? `"${o.shipping_address}, ${o.shipping_city}, ${o.shipping_state}"` : "Pickup"; const items = (Array.isArray(o.cart_data) ? o.cart_data : []).map(i => `${i?.productName} (${i?.size})`).join(' | '); return [o.id, `"${o.event_name || ''}"`, new Date(o.created_at).toLocaleDateString(), `"${o.customer_name}"`, o.phone, addr, o.status, o.total_price, `"${items}"`].join(','); }); const link = document.createElement("a"); link.href = "data:text/csv;charset=utf-8," + encodeURI([headers.join(','), ...rows].join('\n')); link.download = "orders.csv"; link.click(); };
  const handleAddProductWithSizeUpdates = async (e) => { e.preventDefault(); if (!newProdId || !newProdName) return alert("Missing fields"); await supabase.from('products').insert([{ id: newProdId.toLowerCase().replace(/\s/g, '_'), name: newProdName, base_price: newProdPrice, image_url: newProdImage, type: newProdType, sort_order: 99 }]); const sizes = ['Youth XS', 'Youth S', 'Youth M', 'Youth L', 'Adult S', 'Adult M', 'Adult L', 'Adult XL', 'Adult XXL', 'Adult 3XL', 'Adult 4XL']; await supabase.from('inventory').insert(sizes.map(s => ({ product_id: newProdId.toLowerCase().replace(/\s/g, '_'), size: s, count: 0, active: true }))); alert("Created!"); setNewProdId(''); setNewProdName(''); fetchInventory(); };
  const handleGuestUpload = (e) => { const f = e.target.files[0]; if (!f) return; setLoading(true); const r = new FileReader(); r.onload = async (evt) => { try { const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]); for (const row of d) { const n = row['Name'] || row['name'] || row['Guest']; const s = row['Size'] || row['size']; if (n) await supabase.from('guests').insert([{ name: String(n).trim(), size: s ? String(s).trim() : null, has_ordered: false }]); } alert(`Imported!`); fetchGuests(); } catch (e) {} setLoading(false); }; r.readAsBinaryString(f); };
  const resetGuest = async (id) => { if (confirm("Reset?")) { await supabase.from('guests').update({ has_ordered: false }).eq('id', id); fetchGuests(); } };
  const clearGuestList = async () => { if (confirm("Clear All Guests?")) { await supabase.from('guests').delete().neq('id', 0); fetchGuests(); } };
  const handleBulkUpload = (e) => { const f = e.target.files[0]; if (!f) return; setUploadLog(["Reading..."]); setLoading(true); const r = new FileReader(); r.onload = async (evt) => { try { const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]); if (!d.length) { setLoading(false); return; } const logs = []; for (const row of d) { const clean = {}; Object.keys(row).forEach(k => clean[k.toLowerCase().trim()] = row[k]); const pid = String(clean['product_id']).trim(); const sz = String(clean['size']).trim(); const cnt = parseInt(clean['count']); const cst = clean['cost_price'] ? parseFloat(clean['cost_price']) : 8.50; const { data: ex } = await supabase.from('inventory').select('product_id').eq('product_id', pid).eq('size', sz).maybeSingle(); if (ex) { await supabase.from('inventory').update({ count: cnt, cost_price: cst }).eq('product_id', pid).eq('size', sz); logs.push(`Updated ${pid}`); } else { await supabase.from('inventory').insert([{ product_id: pid, size: sz, count: cnt, cost_price: cst, active: true }]); logs.push(`Created ${pid}`); } } setUploadLog(logs); fetchInventory(); } catch (e) { setUploadLog([e.message]); } setLoading(false); }; r.readAsBinaryString(f); };

  if (!mounted) return <div className="p-10 text-center text-gray-500 font-bold">Loading Admin Dashboard...</div>;
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
            <div className="bg-white p-4 rounded shadow border-l-4 border-green-500"><p className="text-xs text-gray-500 font-bold uppercase">Gross Revenue</p><p className="text-3xl font-black text-green-700">${stats.revenue.toFixed(2)}</p></div> 
            <div className="bg-white p-4 rounded shadow border-l-4 border-blue-500"><p className="text-xs text-gray-500 font-bold uppercase">Paid Orders</p><p className="text-3xl font-black text-blue-900">{stats.count}</p></div> 
            <div className="bg-white p-4 rounded shadow border-l-4 border-pink-500"><p className="text-xs text-gray-500 font-bold uppercase">Est. Net Profit</p><p className="text-3xl font-black text-pink-600">${stats.net.toFixed(2)}</p></div>
            <div className="bg-white p-4 rounded shadow border border-gray-200"><p className="text-xs text-gray-500 font-bold uppercase">Top Seller</p><p className="text-lg font-bold text-gray-800 truncate" title={stats.topItem}>{stats.topItem}</p></div> 
          </div> 
          <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300 overflow-x-auto"> 
            <table className="w-full text-left min-w-[800px]"><thead className="bg-gray-200"><tr><th className="p-4 w-40">Status</th><th className="p-4">Date</th><th className="p-4">Customer</th><th className="p-4">Items</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>{orders.filter(o => o.status !== 'completed').map((order) => {
                const safeItems = Array.isArray(order.cart_data) ? order.cart_data : [];
                return (
                <tr key={order.id} className={`border-b hover:bg-gray-50 ${order.printed ? 'bg-gray-50' : 'bg-white'}`}>
                    <td className="p-4 align-top"><select value={order.status || 'pending'} onChange={(e) => handleStatusChange(order.id, e.target.value)} className={`p-2 rounded border-2 uppercase font-bold text-xs ${STATUSES[order.status || 'pending']?.color}`}>{Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></td>
                    <td className="p-4 align-top text-sm text-gray-500 font-medium" suppressHydrationWarning>{new Date(order.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                    <td className="p-4 align-top"><div className="font-bold">{order.customer_name}</div><div className="text-sm">{order.phone}</div></td>
                    <td className="p-4 align-top text-sm">{safeItems.map((item, i) => {
                        const customs = item?.customizations || {};
                        return ( <div key={i} className="mb-2 border-b border-gray-100 pb-1 last:border-0"><span className="font-bold">{item?.productName}</span> ({item?.size})<div className="text-xs text-gray-500 mt-1">{customs.logos?.map(l => l.type).join(', ')} {customs.names?.map(n => n.text).join(', ')}</div></div> );
                    })}<div className="mt-2 text-right font-black text-green-800">${order.total_price}</div></td>
                    <td className="p-4 align-top text-right">
                        <button onClick={() => openEditModal(order)} className="p-2 rounded mr-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold">✏️</button>
                        {order.status !== 'refunded' && order.payment_intent_id && ( <button onClick={() => handleRefund(order.id, order.payment_intent_id)} className="p-2 rounded mr-2 bg-red-50 text-red-500 hover:bg-red-100 font-bold">💸</button> )}
                        <button onClick={() => printLabel(order)} className="p-2 rounded mr-2 bg-gray-200 text-black hover:bg-blue-100">🖨️</button>
                        <button onClick={() => deleteOrder(order.id, order.cart_data)} className="text-red-500 hover:text-red-700 font-bold text-lg">🗑️</button>
                    </td>
                </tr>
            )})}</tbody></table> 
          </div> 
        </div> )}

        {/* ... OTHER TABS ... */}
        {activeTab === 'history' && ( <div><button onClick={downloadCSV}>Download CSV</button></div> )}
        {activeTab === 'inventory' && ( <div className="p-4"><button onClick={fetchInventory} className="bg-blue-500 text-white px-4 py-2 rounded">Reload</button></div> )}
        {activeTab === 'guests' && (<div className="p-4"><input type="file" onChange={handleGuestUpload} /></div>)}
        {activeTab === 'logos' && (<div className="p-4"><form onSubmit={addLogo}><input placeholder="Name" value={newLogoName} onChange={e=>setNewLogoName(e.target.value)} /><button>Add</button></form></div>)}
        {activeTab === 'settings' && (<div className="p-4"><button onClick={saveSettings} className="bg-blue-900 text-white p-3 rounded">Save Settings</button></div>)}

        {/* EDIT MODAL - SANITIZED */}
        {editingOrder && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div className="p-6 border-b flex justify-between"><h2 className="font-bold">Edit Order</h2><button onClick={closeEditModal}>×</button></div>
                    <div className="p-6 space-y-6">
                        <div><label className="block text-xs font-bold uppercase">Name</label><input className="w-full border p-2 rounded" value={editingOrder.customer_name} onChange={(e) => handleEditChange('customer_name', e.target.value)} /></div>
                        {editingOrder.cart_data.map((item, idx) => (
                            <div key={idx} className="bg-gray-50 p-4 border rounded mb-2">
                                <div className="flex justify-between"><span className="font-bold">{item.productName}</span><select className="border p-1" value={item.size} onChange={(e) => handleEditItem(idx, 'size', e.target.value)}>{SIZE_ORDER.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                {item.customizations?.names?.map((n, nIdx) => ( <input key={nIdx} className="border p-1 w-full mt-1" value={n.text} onChange={(e) => handleEditName(idx, nIdx, e.target.value)} /> ))}
                            </div>
                        ))}
                    </div>
                    <div className="p-6 border-t flex justify-end gap-2"><button onClick={closeEditModal} className="px-4 py-2 bg-gray-200 rounded">Cancel</button><button onClick={saveOrderEdits} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button></div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}