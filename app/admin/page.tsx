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

    // Check if a new order was added to the top of the list
    if (orders.length > lastOrderCount.current) {
      const newestOrder = orders[0];
      // Only auto-print if it hasn't been printed yet and is recent
      if (!newestOrder.printed && (new Date() - new Date(newestOrder.created_at) < 30000)) {
        console.log("Auto-printing new order:", newestOrder.id);
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
  
  // --- PRINT FUNCTION ---
  const printLabel = async (order) => {
      if (!order) return;
      
      // Mark Printed in UI and DB
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, printed: true } : o));
      await supabase.from('orders').update({ printed: true }).eq('id', order.id);

      const isCloud = pnEnabled && pnApiKey && pnPrinterId;
      const mode = isCloud ? 'cloud' : 'download';
      
      try {
          const res = await fetch('/api/printnode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  order, 
                  mode, 
                  apiKey: pnApiKey, 
                  printerId: pnPrinterId 
              })
          });
          
          const result = await res.json();
          if (!result.success) {
              console.error("Print Error:", result.error);
              return;
          }

          if (!isCloud) {
              const pdfBytes = Uint8Array.from(atob(result.pdfBase64), c => c.charCodeAt(0));
              const blob = new Blob([pdfBytes], { type: 'application/pdf' });
              const url = window.URL.createObjectURL(blob);
              window.open(url, '_blank');
          }

      } catch (e) {
          console.error("Network Error:", e.message);
      }
  };

  // --- SAFE EDIT FUNCTIONS ---
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
      const { error } = await supabase.from('orders').update({ 
          customer_name: editingOrder.customer_name, 
          cart_data: editingOrder.cart_data, 
          shipping_address: editingOrder.shipping_address,
          total_price: newOrderTotal 
      }).eq('id', editingOrder.id); 
      if(error) { alert("Error: " + error.message); setLoading(false); return; }
      if (isUpcharge) {
          const upgradeCart = [{
              productName: `Add-on Order #${String(editingOrder.id).slice(0,4)}`,
              finalPrice: priceDifference,
              size: 'N/A',
              customizations: { mainDesign: 'Upgrade' }
          }];
          try {
              const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart: upgradeCart, customerName: editingOrder.customer_name }) });
              const data = await res.json();
              if(data.url) { window.location.href = data.url; return; } else { alert("Payment Link Error"); }
          } catch(e) { alert("Payment Error: " + e.message); }
      } else {
          setOrders(orders.map(o => o.id === editingOrder.id ? editingOrder : o)); 
          closeEditModal(); 
      }
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
  const downloadTemplate = () => { try { const data = inventory.map(item => ({ product_id: item.product_id, size: item.size, count: item.count, cost_price: item.cost_price || 8.50, _Reference_Name: getProductName(item.product_id) || item.product_id })); const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Inventory"); XLSX.writeFile(wb, "Inventory.xlsx"); } catch (e) {} };
  const downloadCSV = () => { if (!orders.length) return; const headers = ['ID', 'Event', 'Date', 'Customer', 'Phone', 'Address', 'Status', 'Total', 'Items']; const rows = orders.map(o => { const addr = o.shipping_address ? `"${o.shipping_address}, ${o.shipping_city}, ${o.shipping_state}"` : "Pickup"; const items = (Array.isArray(o.cart_data) ? o.cart_data : []).map(i => `${i?.productName} (${i?.size})`).join(' | '); return [o.id, `"${o.event_name || ''}"`, new Date(o.created_at).toLocaleDateString(), `"${o.customer_name}"`, o.phone, addr, o.status, o.total_price, `"${items}"`].join(','); }); const link = document.createElement("a"); link.href = "data:text/csv;charset=utf-8," + encodeURI([headers.join(','), ...rows].join('\n')); link.download = "orders.csv"; link.click(); };
  const handleAddProductWithSizeUpdates = async (e) => { e.preventDefault(); if (!newProdId || !newProdName) return alert("Missing"); await supabase.from('products').insert([{ id: newProdId.toLowerCase().replace(/\s/g, '_'), name: newProdName, base_price: newProdPrice, image_url: newProdImage, type: newProdType, sort_order: 99 }]); const sizes = ['Youth XS', 'Youth S', 'Youth M', 'Youth L', 'Adult S', 'Adult M', 'Adult L', 'Adult XL', 'Adult XXL', 'Adult 3XL', 'Adult 4XL']; await supabase.from('inventory').insert(sizes.map(s => ({ product_id: newProdId.toLowerCase().replace(/\s/g, '_'), size: s, count: 0, active: true }))); alert("Created!"); setNewProdId(''); fetchInventory(); };
  const handleGuestUpload = (e) => { const f = e.target.files[0]; if (!f) return; setLoading(true); const r = new FileReader(); r.onload = async (evt) => { try { const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]); for (const row of d) { const n = row['Name'] || row['name'] || row['Guest']; const s = row['Size'] || row['size']; if (n) await supabase.from('guests').insert([{ name: String(n).trim(), size: s ? String(s).trim() : null, has_ordered: false }]); } alert(`Imported!`); fetchGuests(); } catch (e) {} setLoading(false); }; r.readAsBinaryString(f); };
  const resetGuest = async (id) => { if (confirm("Reset?")) { await supabase.from('guests').update({ has_ordered: false }).eq('id', id); fetchGuests(); } };
  const clearGuestList = async () => { if (confirm("Clear All?")) { await supabase.from('guests').delete().neq('id', 0); fetchGuests(); } };
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
            
            {/* AUTO-PRINT UI */}
            <div className="bg-blue-900 p-4 rounded shadow flex flex-col justify-center items-center text-white">
                <p className="text-xs font-bold uppercase mb-2 opacity-80">Auto-Print Labels</p>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={autoPrintEnabled} onChange={(e) => setAutoPrintEnabled(e.target.checked)} className="sr-only peer" />
                    <div className="w-14 h-7 bg-blue-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                    <span className="ml-3 text-sm font-bold">{autoPrintEnabled ? 'ON' : 'OFF'}</span>
                </label>
            </div> 
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
                        <button onClick={() => printLabel(order)} className={`p-2 rounded mr-2 font-bold ${order.printed ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>🖨️</button>
                        <button onClick={() => deleteOrder(order.id, order.cart_data)} className="text-red-500 hover:text-red-700 font-bold text-lg">🗑️</button>
                    </td>
                </tr>
            )})}</tbody></table> 
          </div> 
        </div> )}
        {/* ... (rest of tabs same as before) */}
      </div>
      {/* (MODAL CODE HERE - REMAINS THE SAME AS PREVIOUS) */}
    </div>
  );
}