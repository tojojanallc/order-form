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

  // --- 1. THE REFRESH FIX ---
  useEffect(() => {
    if (isAuthorized && mounted) {
        fetchOrders(); fetchSettings(); fetchInventory(); fetchLogos(); fetchGuests();
        if (supabase) {
            const channel = supabase.channel('admin_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                // This forces the refresh when Supabase changes
                fetchOrders();
            }).subscribe();
            return () => { supabase.removeChannel(channel); };
        }
    }
  }, [isAuthorized, mounted]);

  // --- 2. THE AUTO-PRINT FIX ---
  useEffect(() => {
    // Baselining the count so it doesn't print all history on login
    if (lastOrderCount.current === 0 && orders.length > 0) {
      lastOrderCount.current = orders.length;
      return;
    }
    if (!mounted || !autoPrintEnabled || orders.length === 0) return;

    if (orders.length > lastOrderCount.current) {
      const newestOrder = orders[0]; 
      const isNew = (new Date() - new Date(newestOrder.created_at)) < 60000;
      if (isNew && !newestOrder.printed) {
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
      const mode = isCloud ? 'cloud' : 'download';
      try {
          const res = await fetch('/api/printnode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order, mode, apiKey: pnApiKey, printerId: pnPrinterId })
          });
          const result = await res.json();
          if (!result.success) { console.error(result.error); return; }
          if (!isCloud) {
              const pdfBytes = Uint8Array.from(atob(result.pdfBase64), c => c.charCodeAt(0));
              const blob = new Blob([pdfBytes], { type: 'application/pdf' });
              window.open(window.URL.createObjectURL(blob), '_blank');
          }
      } catch (e) { console.error(e); }
  };

  const openEditModal = (order) => { 
      const rawCart = Array.isArray(order.cart_data) ? order.cart_data : [];
      const cleanCart = rawCart
        .filter(item => item !== null && item !== undefined)
        .map(item => ({
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
  const handleEditItem = (index, field, value) => {
      setEditingOrder(prev => {
          const newCart = [...prev.cart_data];
          newCart[index] = { ...newCart[index], [field]: value };
          return { ...prev, cart_data: newCart };
      });
  };
  const handleUpdateMainDesign = (index, value) => {
      setEditingOrder(prev => {
          const newCart = [...prev.cart_data];
          const newItem = { ...newCart[index] };
          const newCust = { ...newItem.customizations, mainDesign: value };
          newItem.customizations = newCust;
          newCart[index] = newItem;
          return { ...prev, cart_data: newCart };
      });
  };
  const handleEditName = (idx, nIdx, val) => {
      setEditingOrder(prev => {
          const newCart = [...prev.cart_data];
          const newItem = { ...newCart[idx] };
          const newCust = { ...newItem.customizations };
          const newNames = [...newCust.names];
          if(newNames[nIdx]) {
              newNames[nIdx] = { ...newNames[nIdx], text: val };
              newCust.names = newNames;
              newItem.customizations = newCust;
              newCart[idx] = newItem;
          }
          return { ...prev, cart_data: newCart };
      });
  };
  const handleAddAccent = (idx) => {
      setEditingOrder(prev => {
          const newCart = [...prev.cart_data];
          const newItem = { ...newCart[idx] };
          const newCust = { ...newItem.customizations };
          const newLogos = [...(newCust.logos || [])];
          newLogos.push({ type: logos[0]?.label || 'Logo', position: 'Left Sleeve' });
          newCust.logos = newLogos;
          newItem.customizations = newCust;
          newCart[idx] = newItem;
          return { ...prev, cart_data: newCart };
      });
  };
  const handleAddName = (idx) => {
      setEditingOrder(prev => {
          const newCart = [...prev.cart_data];
          const newItem = { ...newCart[idx] };
          const newCust = { ...newItem.customizations };
          const newNames = [...(newCust.names || [])];
          newNames.push({ text: '', position: 'Hood' });
          newCust.names = newNames;
          newItem.customizations = newCust;
          newCart[idx] = newItem;
          return { ...prev, cart_data: newCart };
      });
  };
  const handleUpdateAccent = (idx, lIdx, field, val) => {
      setEditingOrder(prev => {
          const newCart = [...prev.cart_data];
          const newItem = { ...newCart[idx] };
          const newCust = { ...newItem.customizations };
          const newLogos = [...newCust.logos];
          if(newLogos[lIdx]) {
              newLogos[lIdx] = { ...newLogos[lIdx], [field]: val };
              newCust.logos = newLogos;
              newItem.customizations = newCust;
              newCart[idx] = newItem;
          }
          return { ...prev, cart_data: newCart };
      });
  };
  const handleUpdateNamePos = (idx, nIdx, val) => {
      setEditingOrder(prev => {
          const newCart = [...prev.cart_data];
          const newItem = { ...newCart[idx] };
          const newCust = { ...newItem.customizations };
          const newNames = [...newCust.names];
          if(newNames[nIdx]) {
              newNames[nIdx] = { ...newNames[nIdx], position: val };
              newCust.names = newNames;
              newItem.customizations = newCust;
              newCart[idx] = newItem;
          }
          return { ...prev, cart_data: newCart };
      });
  };

  const saveOrderEdits = async () => { 
      if(!editingOrder) return; 
      setLoading(true); 
      const priceDifference = newOrderTotal - originalOrderTotal;
      const isUpcharge = priceDifference > 0;
      const { error } = await supabase.from('orders').update({ customer_name: editingOrder.customer_name, cart_data: editingOrder.cart_data, shipping_address: editingOrder.shipping_address, total_price: newOrderTotal }).eq('id', editingOrder.id); 
      if(error) { alert("Error: " + error.message); setLoading(false); return; }
      if (isUpcharge) {
          const upgradeCart = [{ productName: `Add-on Order #${String(editingOrder.id).slice(0,4)}`, finalPrice: priceDifference, size: 'N/A', customizations: { mainDesign: 'Upgrade' } }];
          try {
              const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart: upgradeCart, customerName: editingOrder.customer_name }) });
              const data = await res.json();
              if(data.url) { window.location.href = data.url; return; } else { alert("Payment Link Error"); }
          } catch(e) { alert("Payment Error: " + e.message); }
      } else { setOrders(orders.map(o => o.id === editingOrder.id ? editingOrder : o)); closeEditModal(); }
      setLoading(false); 
  };

  const addLogo = async (e) => { e.preventDefault(); if (!newLogoName) return; await supabase.from('logos').insert([{ label: newLogoName, image_url: newLogoUrl, category: newLogoCategory, sort_order: logos.length + 1 }]); setNewLogoName(''); setNewLogoUrl(''); fetchLogos(); };
  const deleteLogo = async (id) => { if (!confirm("Delete?")) return; await supabase.from('logos').delete().eq('id', id); fetchLogos(); };
  const deleteProduct = async (id) => { if (!confirm("Delete product?")) return; await supabase.from('inventory').delete().eq('product_id', id); await supabase.from('products').delete().eq('id', id); fetchInventory(); };
  const updateStock = async (pid, s, f, v) => { setInventory(inventory.map(i => (i.product_id === pid && i.size === s) ? { ...i, [f]: v } : i)); await supabase.from('inventory').update({ [f]: v }).eq('product_id', pid).eq('size', s); };
  const updatePrice = async (pid, v) => { setProducts(products.map(p => p.id === pid ? { ...p, base_price: v } : p)); await supabase.from('products').update({ base_price: v }).eq('id', pid); };
  const toggleLogo = async (id, s) => { setLogos(logos.map(l => l.id === id ? { ...l, active: !s } : l)); await supabase.from('logos').update({ active: !s }).eq('id', id); };
  const getProductName = (id) => products.find(p => p.id === id)?.name || id;
  const downloadTemplate = () => { try { const data = inventory.map(item => ({ product_id: item.product_id, size: item.size, count: item.count, cost_price: item.cost_price || 8.50, _Reference_Name: getProductName(item.product_id) || item.product_id })); const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Inventory"); XLSX.writeFile(wb, "Inventory.xlsx"); } catch (e) {} };
  const downloadCSV = () => { if (!orders.length) return; const headers = ['ID', 'Event', 'Date', 'Customer', 'Phone', 'Address', 'Status', 'Total', 'Items']; const rows = orders.map(o => { const addr = o.shipping_address ? `"${o.shipping_address}, ${o.shipping_city}, ${o.shipping_state}"` : "Pickup"; const items = (Array.isArray(o.cart_data) ? o.cart_data : []).map(i => `${i?.productName} (${i?.size})`).join(' | '); return [o.id, `"${o.event_name || ''}"`, new Date(o.created_at).toLocaleDateString(), `"${o.customer_name}"`, o.phone, addr, o.status, o.total_price, `"${items}"`].join(','); }); const link = document.createElement("a"); link.href = "data:text/csv;charset=utf-8," + encodeURI([headers.join(','), ...rows].join('\n')); link.download = "orders.csv"; link.click(); };
  const handleAddProductWithSizeUpdates = async (e) => { e.preventDefault(); if (!newProdId || !newProdName) return alert("Missing"); await supabase.from('products').insert([{ id: newProdId.toLowerCase().replace(/\s/g, '_'), name: newProdName, base_price: newProdPrice, image_url: newProdImage, type: newProdType, sort_order: 99 }]); const sizes = SIZE_ORDER; await supabase.from('inventory').insert(sizes.map(s => ({ product_id: newProdId.toLowerCase().replace(/\s/g, '_'), size: s, count: 0, active: true }))); alert("Created!"); setNewProdId(''); fetchInventory(); };
  const handleGuestUpload = (e) => { const f = e.target.files[0]; if (!f) return; setLoading(true); const r = new FileReader(); r.onload = async (evt) => { try { const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]); for (const row of d) { const n = row['Name'] || row['name'] || row['Guest']; const s = row['Size'] || row['size']; if (n) await supabase.from('guests').insert([{ name: String(n).trim(), size: s ? String(s).trim() : null, has_ordered: false }]); } alert(`Imported!`); fetchGuests(); } catch (e) {} setLoading(false); }; r.readAsBinaryString(f); };
  const resetGuest = async (id) => { if (confirm("Reset?")) { await supabase.from('guests').update({ has_ordered: false }).eq('id', id); fetchGuests(); } };
  const clearGuestList = async () => { if (confirm("Clear All?")) { await supabase.from('guests').delete().neq('id', 0); fetchGuests(); } };
  const handleBulkUpload = (e) => { const f = e.target.files[0]; if (!f) return; setUploadLog(["Reading..."]); setLoading(true); const r = new FileReader(); r.onload = async (evt) => { try { const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]); if (!d.length) { setLoading(false); return; } const logs = []; for (const row of d) { const clean = {}; Object.keys(row).forEach(k => clean[k.toLowerCase().trim()] = row[k]); const pid = String(clean['product_id']).trim(); const sz = String(clean['size']).trim(); const cnt = parseInt(clean['count']); const cst = clean['cost_price'] ? parseFloat(clean['cost_price']) : 8.50; const { data: ex } = await supabase.from('inventory').select('product_id').eq('product_id', pid).eq('size', sz).maybeSingle(); if (ex) { await supabase.from('inventory').update({ count: cnt, cost_price: cst }).eq('product_id', pid).eq('size', sz); logs.push(`Updated ${pid}`); } else { await supabase.from('inventory').insert([{ product_id: pid, size: sz, count: cnt, cost_price: cst, active: true }]); logs.push(`Created ${pid}`); } } setUploadLog(logs); fetchInventory(); } catch (e) { setUploadLog([e.message]); } setLoading(false); }; r.readAsBinaryString(f); };

  if (!mounted) return <div className="p-10 text-center text-gray-500 font-bold uppercase tracking-widest">Loading Dashboard...</div>;
  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center bg-gray-100"><form onSubmit={handleLogin} className="bg-white p-8 rounded shadow"><h1 className="text-xl font-bold mb-4">Admin Login</h1><input type="password" onChange={e => setPasscode(e.target.value)} className="border p-2 w-full rounded" placeholder="Password"/></form></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black font-sans">
      <audio ref={audioRef} src="/ding.mp3" preload="auto" />
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">{eventName || 'Admin'}</h1>
          <div className="flex bg-white rounded-lg p-1 shadow border border-gray-300">
            {['orders', 'history', 'inventory', 'guests', 'logos', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded font-bold uppercase text-xs tracking-widest ${activeTab === tab ? 'bg-blue-900 text-white' : 'hover:bg-gray-100'}`}>{tab}</button>
            ))}
          </div>
        </div>

        {activeTab === 'orders' && ( <div className="space-y-6"> 
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4"> 
            <div className="bg-white p-4 rounded shadow border-l-4 border-green-500"><p className="text-xs text-gray-500 font-bold uppercase">Revenue</p><p className="text-2xl font-black text-green-700">${stats.revenue.toFixed(2)}</p></div> 
            <div className="bg-white p-4 rounded shadow border-l-4 border-blue-500"><p className="text-xs text-gray-500 font-bold uppercase">Paid Orders</p><p className="text-2xl font-black text-blue-900">{stats.count}</p></div> 
            <div className="bg-white p-4 rounded shadow border-l-4 border-pink-500"><p className="text-xs text-gray-500 font-bold uppercase tracking-tight">Est. Net Profit</p><p className="text-2xl font-black text-pink-600">${stats.net.toFixed(2)}</p></div>
            
            <div className="bg-white p-4 rounded shadow border-l-4 border-purple-500 flex flex-col justify-between">
                <p className="text-xs text-gray-500 font-bold uppercase">Printing Control</p>
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="autoPrint" checked={autoPrintEnabled} onChange={(e) => setAutoPrintEnabled(e.target.checked)} className="w-5 h-5 accent-blue-900 cursor-pointer" />
                    <label htmlFor="autoPrint" className="text-xs font-black text-gray-800 cursor-pointer uppercase">Auto-Print</label>
                </div>
            </div> 
          </div> 
          <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300 overflow-x-auto"> 
            <table className="w-full text-left min-w-[800px]"><thead className="bg-gray-200"><tr><th className="p-4 uppercase text-xs">Status</th><th className="p-4 uppercase text-xs">Customer</th><th className="p-4 uppercase text-xs">Items</th><th className="p-4 text-right uppercase text-xs">Actions</th></tr></thead><tbody>{orders.filter(o => o.status !== 'completed').map((order) => {
                const safeItems = Array.isArray(order.cart_data) ? order.cart_data : [];
                return (
                <tr key={order.id} className={`border-b hover:bg-gray-50 ${order.printed ? 'bg-gray-50' : 'bg-white'}`}>
                    <td className="p-4 align-top"><select value={order.status || 'pending'} onChange={(e) => handleStatusChange(order.id, e.target.value)} className={`p-2 rounded border-2 uppercase font-bold text-xs ${STATUSES[order.status || 'pending']?.color}`}>{Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></td>
                    <td className="p-4 align-top"><div className="font-bold text-gray-900">{order.customer_name}</div><div className="text-xs text-gray-400 font-bold">{new Date(order.created_at).toLocaleString()}</div></td>
                    <td className="p-4 align-top text-sm">{safeItems.map((item, i) => ( <div key={i} className="mb-2"><strong>{item?.productName}</strong> ({item?.size})</div> ))}<div className="mt-2 text-right font-black text-green-800">${order.total_price}</div></td>
                    <td className="p-4 align-top text-right">
                        <button onClick={() => openEditModal(order)} className="p-2 rounded mr-2 bg-blue-50 text-blue-600 font-bold">✏️</button>
                        <button onClick={() => printLabel(order)} className={`p-2 rounded mr-2 font-bold ${order.printed ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 text-black hover:bg-blue-100'}`}>🖨️</button>
                        <button onClick={() => deleteOrder(order.id, order.cart_data)} className="text-red-500 hover:text-red-700 font-bold text-lg">🗑️</button>
                    </td>
                </tr>
            )})}</tbody></table> 
          </div> 
        </div> )}

        {activeTab === 'inventory' && ( <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200"><h2 className="font-bold text-xl mb-4 text-black uppercase tracking-tighter">Add Item</h2><form onSubmit={handleAddProductWithSizeUpdates} className="space-y-3"><div><label className="text-xs font-bold uppercase text-gray-400">ID</label><input className="w-full border p-2 rounded text-black" placeholder="jogger_navy" value={newProdId} onChange={e => setNewProdId(e.target.value)} /></div><div><label className="text-xs font-bold uppercase text-gray-400">Name</label><input className="w-full border p-2 rounded text-black" value={newProdName} onChange={e => setNewProdName(e.target.value)} /></div><div><label className="text-xs font-bold uppercase text-gray-400">Type</label><select className="w-full border p-2 rounded bg-white text-black font-bold" value={newProdType} onChange={e => setNewProdType(e.target.value)}><option value="top">Top</option><option value="bottom">Bottom</option></select></div><button className="w-full bg-green-600 text-white font-bold py-2 rounded shadow">Create</button></form></div>
                <div className="bg-blue-50 p-6 rounded-lg shadow border border-blue-200"><h2 className="font-bold text-lg mb-2 text-blue-900 uppercase tracking-tighter">Bulk Stock</h2><button onClick={downloadTemplate} className="text-xs bg-white border border-blue-300 px-3 py-1 rounded text-blue-700 font-bold mb-4 hover:bg-blue-100">⬇️ Export Current</button><input type="file" onChange={handleBulkUpload} className="block w-full text-sm text-gray-500 mb-4" />{uploadLog.length > 0 && (<div className="mt-4 p-2 bg-black text-green-400 text-xs font-mono h-48 overflow-y-auto rounded border border-gray-700 shadow-inner">{uploadLog.map((log, i) => <div key={i} className="mb-1 border-b border-gray-800 pb-1">{log}</div>)}</div>)}</div>
            </div>
            <div className="md:col-span-2 space-y-6"><div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300"><div className="bg-blue-900 text-white p-4 font-bold uppercase text-xs tracking-widest">Pricing Console</div><table className="w-full text-left text-sm text-black"><thead className="bg-gray-100"><tr><th className="p-3 font-bold uppercase text-xs">Product</th><th className="p-3 font-bold uppercase text-xs text-center">Price ($)</th><th className="p-3 text-right">Action</th></tr></thead><tbody>{products.map((prod) => (<tr key={prod.id} className="border-b"><td className="p-3 font-bold">{prod.name}</td><td className="p-3 font-bold text-center">$<input type="number" className="w-20 border rounded p-1 ml-1 text-black font-bold shadow-sm text-center" value={prod.base_price} onChange={(e) => updatePrice(prod.id, e.target.value)} /></td><td className="p-3 text-right"><button onClick={() => deleteProduct(prod.id)} className="text-red-500 font-bold text-lg">🗑️</button></td></tr>))}</tbody></table></div><div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300"><div className="bg-gray-800 text-white p-4 font-bold uppercase text-xs tracking-widest">Stock & Costs</div><table className="w-full text-left text-sm text-black"><thead className="bg-gray-100"><tr><th className="p-4 uppercase text-xs font-bold text-gray-500">Product</th><th className="p-4 uppercase text-xs font-bold text-gray-500">Size</th><th className="p-4 uppercase text-xs font-bold text-center text-gray-500">Cost ($)</th><th className="p-4 uppercase text-xs font-bold text-center text-gray-500">Stock</th><th className="p-4 text-center text-xs font-bold uppercase text-gray-500">Active</th></tr></thead><tbody>{inventory.map((item) => (<tr key={`${item.product_id}_${item.size}`} className="border-b"><td className="p-4 font-bold">{getProductName(item.product_id)}</td><td className="p-4 font-medium">{item.size}</td><td className="p-4"><input type="number" className="w-16 border rounded text-center mx-auto block text-black shadow-sm" value={item.cost_price || ''} onChange={(e) => updateStock(item.product_id, item.size, 'cost_price', parseFloat(e.target.value))} /></td><td className="p-4"><input type="number" className="w-16 border text-center font-bold text-black mx-auto block shadow-sm" value={item.count} onChange={(e) => updateStock(item.product_id, item.size, 'count', parseInt(e.target.value))} /></td><td className="p-4"><input type="checkbox" checked={item.active ?? true} onChange={(e) => updateStock(item.product_id, item.size, 'active', e.target.checked)} className="mx-auto block w-5 h-5" /></td></tr>))}</tbody></table></div></div>
        </div> )}

        {activeTab === 'guests' && (<div className="max-w-4xl mx-auto"><div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200"><h2 className="font-bold text-xl mb-4 text-black uppercase tracking-widest">Redemption Manager</h2><input type="file" onChange={handleGuestUpload} className="block w-full text-sm text-gray-500 mb-4" /><button onClick={clearGuestList} className="text-red-600 font-bold text-xs uppercase underline tracking-tighter">🗑️ Wipe List</button></div><div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300"><table className="w-full text-left text-sm text-black"><thead className="bg-gray-100"><tr><th className="p-4 font-bold uppercase text-xs">Name</th><th className="p-4 font-bold uppercase text-xs text-center">Pre-Size</th><th className="p-4 text-center font-bold uppercase text-xs">Status</th><th className="p-4 text-right font-bold uppercase text-xs">Action</th></tr></thead><tbody>{guests.length === 0 ? <tr><td colSpan="4" className="p-8 text-center text-gray-500">No guests found.</td></tr> : guests.map((guest) => (<tr key={guest.id} className="border-b hover:bg-gray-50"><td className="p-4 font-bold">{guest.name}</td><td className="p-4 font-mono font-bold text-blue-600 text-center">{guest.size || '-'}</td><td className="p-4 text-center">{guest.has_ordered ? <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-black text-[10px]">REDEEMED</span> : <span className="text-gray-400 font-bold uppercase text-[10px]">Pending</span>}</td><td className="p-4 text-right"><button onClick={() => resetGuest(guest.id)} className="text-blue-600 hover:text-blue-800 font-bold text-xs underline uppercase">Reset</button></td></tr>))}</tbody></table></div></div>)}
        
        {activeTab === 'logos' && (<div className="max-w-4xl mx-auto"><div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200"><h2 className="font-bold text-xl mb-4 text-black uppercase tracking-widest">Logo Repository</h2><form onSubmit={addLogo} className="grid grid-cols-2 gap-4"><input className="border p-2 rounded text-black col-span-2 shadow-sm" placeholder="Label Name" value={newLogoName} onChange={e => setNewLogoName(e.target.value)} /><input className="border p-2 rounded text-black col-span-2 shadow-sm" placeholder="Image URL (http://...)" value={newLogoUrl} onChange={e => setNewLogoUrl(e.target.value)} /><div className="col-span-2 flex items-center gap-6 bg-gray-50 p-2 rounded border border-gray-200"><span className="font-bold text-gray-500 text-xs uppercase">Category:</span><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="cat" checked={newLogoCategory === 'main'} onChange={() => setNewLogoCategory('main')} className="w-4 h-4" /><span className="text-xs font-bold text-black uppercase">Main Design (Free)</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="cat" checked={newLogoCategory === 'accent'} onChange={() => setNewLogoCategory('accent')} className="w-4 h-4" /><span className="text-sm font-bold text-black uppercase">Accent (+$5.00)</span></label></div><button className="bg-blue-900 text-white font-bold p-3 col-span-2 rounded uppercase tracking-widest shadow-lg">Add Logo</button></form></div><div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300"><table className="w-full text-left text-sm text-black"><thead className="bg-gray-800 text-white"><tr><th className="p-4">Preview</th><th className="p-4">Label</th><th className="p-4">Type</th><th className="p-4 text-center">Visible?</th><th className="p-4 text-right">Action</th></tr></thead><tbody>{logos.map((logo) => (<tr key={logo.id} className="border-b hover:bg-gray-50"><td className="p-4">{logo.image_url ? <img src={logo.image_url} alt={logo.label} className="w-12 h-12 object-contain border rounded bg-gray-50" /> : <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-xs">No Img</div>}</td><td className="p-4 font-bold text-lg">{logo.label}</td><td className="p-4"><span className={`text-xs font-bold px-2 py-1 rounded uppercase ${logo.category === 'main' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{logo.category || 'accent'}</span></td><td className="p-4 text-center"><input type="checkbox" checked={logo.active} onChange={() => toggleLogo(logo.id, logo.active)} className="w-6 h-6 cursor-pointer mx-auto block" /></td><td className="p-4 text-right"><button onClick={() => deleteLogo(logo.id)} className="text-red-500 hover:text-red-700 font-bold">🗑️</button></td></tr>))}</tbody></table></div></div>)}
        
        {activeTab === 'settings' && (<div className="max-w-xl mx-auto"><div className="bg-white p-8 rounded-lg shadow border border-gray-200"><h2 className="font-bold text-2xl mb-6 text-black">Event Settings</h2><div className="mb-4"><label className="block text-gray-700 font-bold mb-2 uppercase text-xs">Event Name</label><input className="w-full border p-3 rounded text-lg text-black" value={eventName} onChange={e => setEventName(e.target.value)} /></div><div className="mb-6"><label className="block text-gray-700 font-bold mb-2 uppercase text-xs">Event Logo URL</label><input className="w-full border p-3 rounded text-lg text-black" value={eventLogo} onChange={e => setEventLogo(e.target.value)} />{eventLogo && <img src={eventLogo} className="mt-4 h-24 mx-auto border rounded p-2" />}</div><div className="mb-6"><label className="block text-gray-700 font-bold mb-2 uppercase text-xs">Header Color</label><div className="flex gap-4 items-center"><input type="color" className="w-16 h-10 cursor-pointer border rounded" value={headerColor} onChange={e => setHeaderColor(e.target.value)} /><span className="text-sm text-gray-500 font-mono">{headerColor}</span></div></div><div className="mb-6 bg-purple-50 p-4 rounded border border-purple-200 text-black shadow-inner"><label className="block text-purple-900 font-bold mb-3 border-b border-purple-200 pb-2 uppercase text-xs tracking-wide">Cloud Printing (PrintNode)</label><div className="flex items-center justify-between mb-3"><span className="text-gray-800">Enable Cloud Print?</span><input type="checkbox" checked={pnEnabled} onChange={e => setPnEnabled(e.target.checked)} className="w-5 h-5" /></div>{pnEnabled && (<div className="space-y-3"><input className="w-full p-2 border rounded text-sm text-black" placeholder="API Key" value={pnApiKey} onChange={e => setPnApiKey(e.target.value)} /><div className="flex gap-2"><input className="flex-1 p-2 border rounded text-sm text-black" placeholder="Printer ID" value={pnPrinterId} onChange={e => setPnPrinterId(e.target.value)} /><button onClick={discoverPrinters} className="bg-purple-600 text-white px-3 py-1 text-xs rounded font-bold uppercase shadow">Scan</button></div>{availablePrinters.length > 0 && (<div className="bg-white border p-2 rounded max-h-32 overflow-y-auto shadow-inner">{availablePrinters.map(p => (<div key={p.id} className="text-xs p-1 hover:bg-gray-100 cursor-pointer flex justify-between" onClick={() => setPnPrinterId(p.id)}><span>{p.name}</span><span className="font-mono text-gray-500">{p.id}</span></div>))}</div>)}</div>)}</div><button onClick={saveSettings} className="w-full bg-blue-900 text-white font-bold py-3 rounded text-lg hover:bg-blue-800 shadow mb-8 uppercase tracking-widest transition-all">Save Changes</button><div className="border-t pt-6 mt-6"><h3 className="font-bold text-red-700 mb-2 uppercase text-sm tracking-tight">Danger Zone</h3><button onClick={closeEvent} className="w-full bg-red-100 text-red-800 font-bold py-3 rounded border border-red-300 hover:bg-red-200 transition-colors">🏁 Close Event (Archive All)</button></div></div></div>)}

        {activeTab === 'history' && ( <div> <div className="bg-gray-800 text-white p-4 rounded-t-lg flex justify-between items-center shadow-lg"><h2 className="font-bold text-xl uppercase tracking-widest">Archive</h2><button onClick={downloadCSV} className="bg-white text-black px-4 py-2 rounded font-bold hover:bg-gray-200 text-xs uppercase tracking-tighter">📥 Export</button></div> <div className="bg-white shadow rounded-b-lg overflow-hidden border border-gray-300 overflow-x-auto"> {orders.filter(o => o.status === 'completed').length === 0 ? <div className="p-8 text-center text-gray-400 font-bold uppercase italic">History empty.</div> : ( <table className="w-full text-left min-w-[800px]"> <thead className="bg-gray-100 text-gray-500"> <tr> <th className="p-4 font-bold text-xs uppercase">Event</th> <th className="p-4 font-bold text-xs uppercase text-right">Total</th> </tr> </thead> <tbody> {orders.filter(o => o.status === 'completed').map((order) => ( <tr key={order.id} className="border-b hover:bg-gray-50 opacity-75"> <td className="p-4 font-bold text-blue-900">{order.event_name || '-'}</td> <td className="p-4 text-right font-black text-green-900">${order.total_price}</td> </tr> ))} </tbody> </table>)} </div> </div> )}

        {/* EDIT MODAL */}
        {editingOrder && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div className="p-6 border-b flex justify-between bg-gray-50 rounded-t-xl shadow-sm"><h2 className="font-black text-lg text-black uppercase tracking-tighter italic">Edit Order #{String(editingOrder.id).slice(0,8)}</h2><button onClick={closeEditModal} className="text-2xl text-gray-500 hover:text-black">×</button></div>
                    <div className="p-6 space-y-6">
                        <div className="bg-blue-50 p-4 rounded border border-blue-100 text-black shadow-inner"><label className="block text-[10px] font-black uppercase text-blue-900 mb-1 tracking-widest">Customer</label><input className="w-full p-2 border rounded font-black text-black shadow-sm" value={editingOrder.customer_name} onChange={(e) => handleEditChange('customer_name', e.target.value)} /></div>
                        {editingOrder.cart_data.map((item, idx) => (
                            <div key={idx} className="bg-white p-4 border rounded-lg shadow-sm space-y-4 text-black">
                                <div className="flex justify-between items-center pb-2 border-b"><span className="font-black text-lg text-black uppercase italic">{item.productName}</span><select className="border-2 p-1 rounded font-black bg-gray-50 text-black shadow-sm" value={item.size} onChange={(e) => handleEditItem(idx, 'size', e.target.value)}>{SIZE_ORDER.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                <div><label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Design</label><select className="w-full border p-2 rounded text-black font-black shadow-sm" value={item.customizations?.mainDesign || ''} onChange={(e) => handleUpdateMainDesign(idx, e.target.value)} ><option value="">None</option>{logos.filter(l => l.category === 'main').map(l => ( <option key={l.id} value={l.label}>{l.label}</option> ))}</select></div>
                                <div className="space-y-2"><label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Accents ($5.00)</label>{item.customizations?.logos?.map((l, lIdx) => (<div key={lIdx} className="flex gap-2"><select className="border p-2 rounded flex-1 text-xs font-black text-black shadow-sm" value={l.type} onChange={(e) => handleUpdateAccent(idx, lIdx, 'type', e.target.value)}>{logos.map(opt => <option key={opt.id} value={opt.label}>{opt.label}</option>)}</select><select className="border p-2 rounded w-40 text-xs text-black shadow-sm" value={l.position} onChange={(e) => handleUpdateAccent(idx, lIdx, 'position', e.target.value)}>{POSITIONS.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}</select></div>))}<button onClick={() => handleAddAccent(idx)} className="text-[10px] font-black text-blue-600 uppercase tracking-widest">+ Accent</button></div>
                                <div className="space-y-2"><label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Personalization ($5.00)</label>{item.customizations?.names?.map((n, nIdx) => (<div key={nIdx} className="flex gap-2"><input className="border p-2 rounded flex-1 text-xs uppercase font-black text-black shadow-sm" value={n.text} onChange={(e) => handleEditName(idx, nIdx, e.target.value)} placeholder="NAME" /><select className="border p-2 rounded w-40 text-xs text-black shadow-sm" value={n.position} onChange={(e) => handleUpdateNamePos(idx, nIdx, e.target.value)}>{POSITIONS.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}</select></div>))}<button onClick={() => handleAddName(idx)} className="text-xs text-blue-600 font-black">+ Name</button></div>
                            </div>
                        ))}
                    </div>
                    <div className="p-6 border-t flex justify-end gap-3 bg-gray-50 rounded-b-xl shadow-inner"><button onClick={closeEditModal} className="px-4 py-2 text-xs font-black text-gray-600 hover:bg-gray-200 rounded transition-all uppercase tracking-widest">Cancel</button><button onClick={saveOrderEdits} className={`px-6 py-2 text-xs font-black text-white rounded shadow-xl transition-all transform hover:scale-105 uppercase tracking-widest ${newOrderTotal > originalOrderTotal ? 'bg-green-600' : 'bg-blue-600'}`} >{loading ? "Processing..." : (newOrderTotal > originalOrderTotal ? `Upcharge & Save ($${(newOrderTotal - originalOrderTotal).toFixed(2)})` : "Save Changes")}</button></div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}