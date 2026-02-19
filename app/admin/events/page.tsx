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

const SIZE_ORDER = ['Youth XS', 'Youth S', 'Youth M', 'Youth L', 'Youth XL', 'Adult S', 'Adult M', 'Adult L', 'Adult XL', 'Adult XXL', 'Adult 3XL', 'Adult 4XL'];

const POSITIONS = [
    { id: 'full_front', label: 'Full Front' }, { id: 'left_chest', label: 'Left Chest' },
    { id: 'center_chest', label: 'Center Chest' }, { id: 'left_sleeve', label: 'Left Sleeve' },
    { id: 'right_sleeve', label: 'Right Sleeve' }, { id: 'back_center', label: 'Back Center' },
    { id: 'back_bottom', label: 'Back Bottom' }, { id: 'left_thigh', label: 'Left Thigh' }, 
    { id: 'right_thigh', label: 'Right Thigh' }, { id: 'rear', label: 'Rear' }
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
   
  const [showFinancials, setShowFinancials] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '' });
  const [editingOrder, setEditingOrder] = useState(null);
  const [originalOrderTotal, setOriginalOrderTotal] = useState(0); 
  const [newOrderTotal, setNewOrderTotal] = useState(0); 

  const [newGuestName, setNewGuestName] = useState(''); 
  const [orders, setOrders] = useState([]);

  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  
  // --- INVENTORY STATE ---
  const [inventory, setInventory] = useState([]); // Local Event Inventory
  const [products, setProducts] = useState([]); // Global Master List
  const [logos, setLogos] = useState([]);
  
  // --- TRUCKING STATE ---
  const [truckTargetEvent, setTruckTargetEvent] = useState(''); 
  const [transferQty, setTransferQty] = useState({}); // <--- NEW BULK STATE

  const [guests, setGuests] = useState([]); 
  const [terminals, setTerminals] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ revenue: 0, count: 0, net: 0, topItem: '-' });
  const [uploadLog, setUploadLog] = useState([]); 

  const [availableEvents, setAvailableEvents] = useState([]);
  const [selectedEventSlug, setSelectedEventSlug] = useState(''); 

  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const [hideUnpaid, setHideUnpaid] = useState(true); 
  const audioRef = useRef(null);
  const lastOrderCount = useRef(0);
  const processedIds = useRef(new Set());

  // Forms
  const [newProdId, setNewProdId] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState(30);
  const [newProdCost, setNewProdCost] = useState(8.50); 
  const [newProdImage, setNewProdImage] = useState(''); 
  const [newProdType, setNewProdType] = useState('top'); 
  const [newLogoName, setNewLogoName] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [newLogoCategory, setNewLogoCategory] = useState('accent'); 
  const [newLogoPlacement, setNewLogoPlacement] = useState('large'); 
  const [newTermLabel, setNewTermLabel] = useState('');
  const [newTermId, setNewTermId] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventLogo, setEventLogo] = useState('');
  const [headerColor, setHeaderColor] = useState('#1e3a8a'); 
  const [paymentMode, setPaymentMode] = useState('retail');
  const [retailPaymentMethod, setRetailPaymentMethod] = useState('stripe'); 
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
      const sessionAuth = sessionStorage.getItem('admin_auth');
      if (sessionAuth === 'true') {
          setIsAuthorized(true);
      }
  }, []);

  useEffect(() => {
      if (isAuthorized && mounted) {
          const loadEvents = async () => {
              const { data } = await supabase.from('event_settings').select('*').eq('status', 'active').order('id');
              if (data && data.length > 0) {
                  setAvailableEvents(data);
                  if (!selectedEventSlug) setSelectedEventSlug(data[0].slug);
                  setTruckTargetEvent(data[0].slug);
              }
          };
          loadEvents();
      }
  }, [isAuthorized, mounted]);

  useEffect(() => {
    if (!isAuthorized || !mounted) return;
    
    fetchOrders();
    fetchSettings();
    fetchInventory(); 
    fetchLogos();
    fetchGuests();
    fetchTerminals();

    const channel = supabase.channel('global_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
            fetchOrders(); 
            fetchGuests(); 
            fetchInventory(); 
            if (payload.eventType === 'INSERT' && audioRef.current) {
                audioRef.current.play().catch(e => console.error("Audio error:", e));
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, (payload) => {
            fetchInventory();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, (payload) => {
            fetchGuests();
        })
        .subscribe();

    const timer = setInterval(() => {
        fetchOrders();
        fetchInventory();
        fetchGuests();
    }, 5000);

    return () => {
        supabase.removeChannel(channel);
        clearInterval(timer);
    };
  }, [isAuthorized, mounted, selectedEventSlug]);

  useEffect(() => {
    if (lastOrderCount.current === 0 && orders.length > 0) {
      lastOrderCount.current = orders.length;
      return;
    }
    if (!mounted || !autoPrintEnabled || orders.length === 0) return;

    if (orders.length > lastOrderCount.current) {
      const newestOrder = orders[0]; 
      const isRecent = (new Date().getTime() - new Date(newestOrder.created_at).getTime()) < 300000;
      const pStatus = (newestOrder.payment_status || '').toLowerCase();
      const isHostedEvent = paymentMode === 'hosted';
      const isStrictlyPaid = pStatus === 'paid' || pStatus === 'succeeded' || Number(newestOrder.total_price) === 0;
      const isValid = isHostedEvent ? (newestOrder.status !== 'incomplete') : isStrictlyPaid;

      if (isRecent && isValid && !newestOrder.printed && !processedIds.current.has(newestOrder.id)) {
        processedIds.current.add(newestOrder.id);
        if (audioRef.current) audioRef.current.play().catch(() => {});
        printLabel(newestOrder);
      }
    }
    lastOrderCount.current = orders.length;
  }, [orders, autoPrintEnabled, mounted, paymentMode]);

  useEffect(() => {
      if (editingOrder && mounted) {
          let total = 0;
          if (Array.isArray(editingOrder.cart_data)) {
              editingOrder.cart_data.forEach(item => {
                  if(!item) return;
                  const productRef = products.find(p => 
                      (item.productId && p.id === item.productId) || 
                      (p.name && item.productName && p.name.toLowerCase() === item.productName.toLowerCase())
                  );
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

  useEffect(() => {
    if (!mounted || !orders || !selectedEventSlug) {
      setStats({ revenue: 0, count: 0, net: 0, topItem: '-' });
      return;
    }

    const uniqueOrderMap = new Map();
    orders.forEach(o => {
      const validStatuses = ['paid', 'complete', 'shipped', 'delivered', 'completed'];
      const pStatus = (o.payment_status || '').toLowerCase();
      const isHosted = paymentMode === 'hosted';
      const isPaid = pStatus === 'paid' || pStatus === 'succeeded';
      
      const isValid = isHosted 
        ? (o.status !== 'incomplete' && o.status !== 'refunded')
        : (validStatuses.includes(o.status) || isPaid) && o.status !== 'refunded';

      if (o.event_slug === selectedEventSlug && isValid) {
        uniqueOrderMap.set(o.id, o);
      }
    });
    
    const cleanOrders = Array.from(uniqueOrderMap.values());

    let calculatedRevenue = 0;
    let calculatedCOGS = 0;
    const itemCounts = {};

    cleanOrders.forEach(order => {
      const cart = Array.isArray(order.cart_data) ? order.cart_data : [];
      let orderTotal = 0;
      
      if (paymentMode === 'hosted' || Number(order.total_price || 0) === 0) {
        cart.forEach(item => {
          const prod = products.find(p => p.id === item.productId);
          let itemPrice = Number(prod?.base_price ?? 30); 
          if (itemPrice > 500) itemPrice = itemPrice / 100; 
          if (item.customizations) {
            itemPrice += (Number(item.customizations.logos?.length || 0) * 5);
            itemPrice += (Number(item.customizations.names?.length || 0) * 5);
            if (item.customizations.metallic) itemPrice += 5;
          }
          orderTotal += itemPrice;
        });
      } else {
        let rawTotal = Number(order.total_price || 0);
        if (rawTotal > 5000) rawTotal = rawTotal / 100; 
        orderTotal += rawTotal;
      }
      
      calculatedRevenue += orderTotal;

      cart.forEach(item => {
        calculatedCOGS += 10; 
        const key = `${item.productName || 'Unknown'} (${item.size || '?'})`;
        itemCounts[key] = (itemCounts[key] || 0) + 1;
      });
    });

    const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);

    setStats({
      revenue: calculatedRevenue,
      count: cleanOrders.length,
      net: calculatedRevenue - (calculatedRevenue * 0.03) - calculatedCOGS, 
      topItem: sortedItems.length > 0 ? `${sortedItems[0][0]} (${sortedItems[0][1]})` : '-'
    });

  }, [orders, selectedEventSlug, paymentMode, mounted, products]);
    
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
              sessionStorage.setItem('admin_auth', 'true'); 
          } else { 
              alert("Wrong password"); 
          } 
      } catch (err) { alert("Login failed"); } 
      setLoading(false); 
  };

  const fetchOrders = async () => { 
      if (!supabase || !selectedEventSlug) return; 
      const { data, error } = await supabase.from('orders').select('*').eq('event_slug', selectedEventSlug).order('created_at', { ascending: false }); 
      if (error) return;
      const uniqueOrders = Array.from(new Map(data.map(item => [item.id, item])).values());
      setOrders(uniqueOrders); 
  };

  const fetchInventory = async () => { 
      if (!supabase || !selectedEventSlug) return; 
      const { data: p } = await supabase.from('products').select('*').order('sort_order'); 
      if (p) setProducts(p); 
      const { data: i } = await supabase.from('inventory').select('*').eq('event_slug', selectedEventSlug).order('product_id', { ascending: true }); 
      if (i) setInventory(i); 
  };

  const fetchLogos = async () => { 
      if (!supabase || !selectedEventSlug) return; 
      const { data } = await supabase.from('logos').select('*').eq('event_slug', selectedEventSlug).order('sort_order'); 
      if (data) setLogos(data); 
  };
  
  const fetchGuests = async () => { 
      if (!supabase || !selectedEventSlug) return; 
      const { data } = await supabase.from('guests').select('*').eq('event_slug', selectedEventSlug).order('name'); 
      if (data) setGuests(data); else setGuests([]);
  };

  const fetchTerminals = async () => { 
      if (!supabase) return; 
      const { data } = await supabase.from('terminals').select('*').order('id'); 
      if (data) setTerminals(data); 
  };

  const fetchSettings = async () => { 
      if (!supabase || !selectedEventSlug) return; 
      const { data } = await supabase.from('event_settings').select('*').eq('slug', selectedEventSlug).single(); 
      if (data) { 
          setEventName(data.event_name); 
          setEventLogo(data.event_logo_url || ''); 
          setHeaderColor(data.header_color || '#1e3a8a'); 
          setPaymentMode(data.payment_mode || 'retail'); 
          setRetailPaymentMethod(data.retail_payment_method || 'stripe'); 
          setPrinterType(data.printer_type || 'label'); 
          setOfferBackNames(data.offer_back_names ?? true); 
          setOfferMetallic(data.offer_metallic ?? true); 
          setOfferPersonalization(data.offer_personalization ?? true); 
          setPnEnabled(data.printnode_enabled || false); 
          setPnApiKey(data.printnode_api_key || ''); 
          setPnPrinterId(data.printnode_printer_id || ''); 
      } 
  };

  const addTerminal = async () => { 
      if(!newTermLabel || !newTermId) return; 
      await supabase.from('terminals').insert([{ label: newTermLabel, device_id: newTermId }]); 
      setNewTermLabel(''); setNewTermId(''); 
      fetchTerminals(); 
  };

  const deleteTerminal = async (id) => { 
      if(confirm("Remove?")) { await supabase.from('terminals').delete().eq('id', id); fetchTerminals(); } 
  };

  const saveSettings = async () => { 
      await supabase.from('event_settings').update({ 
          event_name: eventName, 
          event_logo_url: eventLogo, 
          header_color: headerColor, 
          payment_mode: paymentMode, 
          retail_payment_method: retailPaymentMethod, 
          printer_type: printerType, 
          offer_back_names: offerBackNames, 
          offer_metallic: offerMetallic, 
          offer_personalization: offerPersonalization, 
          printnode_enabled: pnEnabled, 
          printnode_api_key: pnApiKey, 
          printnode_printer_id: pnPrinterId,
          tax_enabled: taxEnabled,
          tax_rate: taxRate
      }).eq('slug', selectedEventSlug); 
      alert("Saved settings for " + selectedEventSlug); 
  };

  const closeEvent = async () => { 
      if (prompt(`Type 'CLOSE' to confirm archive:`) !== 'CLOSE') return; 
      setLoading(true); 
      const { data: updateData, error: updateError } = await supabase.from('event_settings').update({ status: 'archived' }).eq('slug', selectedEventSlug).select();
      if (updateError || !updateData.length) { alert("Error archiving"); setLoading(false); return; }
      await supabase.from('orders').update({ status: 'completed' }).eq('event_slug', selectedEventSlug).neq('status', 'completed').neq('status', 'refunded');
      alert("SUCCESS: Event Archived!"); 
      
      const { data: refreshedEvents } = await supabase.from('event_settings').select('*').eq('status', 'active').order('id');
      if (refreshedEvents) {
          setAvailableEvents(refreshedEvents);
          if (refreshedEvents.length > 0) setSelectedEventSlug(refreshedEvents[0].slug);
          else setSelectedEventSlug('');
      }
      fetchOrders(); 
      setLoading(false); 
  };

  const handleStatusChange = async (orderId, newStatus) => {
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      if (newStatus === 'ready') {
          try {
              const { data: orderData } = await supabase.from('orders').select('customer_name, phone').eq('id', orderId).single();
              if (orderData && orderData.phone) {
                  const message = `Hi ${orderData.customer_name}! Your order is ready for pickup. Please head to the Lev Custom Merch team and start wearing your new gear!`;
                  await fetch('/api/send-sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: orderData.phone, message: message }) });
              }
          } catch (err) { console.error("Error sending text:", err); }
      }
  };

  const markOrderPaid = async (orderId) => {
      if(!confirm("Mark this order as PAID?")) return;
      setOrders(orders.map(o => o.id === orderId ? { ...o, payment_status: 'paid' } : o));
      await supabase.from('orders').update({ payment_status: 'paid' }).eq('id', orderId);
  };

  const deleteOrder = async (orderId, cartData) => { if (!confirm("Delete Order?")) return; setLoading(true); if (Array.isArray(cartData)) { for (const item of cartData) { if (item?.productId && item?.size) { const { data: current } = await supabase.from('inventory').select('count').eq('product_id', item.productId).eq('size', item.size).single(); if (current) { await supabase.from('inventory').update({ count: current.count + 1 }).eq('product_id', item.productId).eq('size', item.size); } } } } await supabase.from('orders').delete().eq('id', orderId); fetchOrders(); fetchInventory(); setLoading(false); };
  const handleRefund = async (orderId, paymentIntentId) => { if (!confirm("Refund?")) return; setLoading(true); try { const result = await refundOrder(orderId, paymentIntentId); if (result.success) { alert("Refunded."); setOrders(orders.map(o => o.id === orderId ? { ...o, status: 'refunded' } : o)); } else { alert("Failed: " + result.message); } } catch(e) { alert("Error: " + e.message); } setLoading(false); };
  const discoverPrinters = async () => { if(!pnApiKey) return alert("Enter API Key"); setLoading(true); try { const res = await fetch('https://api.printnode.com/printers', { headers: { 'Authorization': 'Basic ' + btoa(pnApiKey + ':') } }); const data = await res.json(); if (Array.isArray(data)) { setAvailablePrinters(data); alert(`Found ${data.length} printers!`); } } catch (e) {} setLoading(false); };
  
  const printLabel = async (order) => {
      if (!order) return;
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, printed: true } : o));
      try { await supabase.from('orders').update({ printed: true }).eq('id', order.id); } catch (e) {}
      const isCloud = pnEnabled && pnApiKey && pnPrinterId;
      const mode = isCloud ? 'cloud' : 'download';
      try {
          const res = await fetch('/api/printnode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order, mode, apiKey: pnApiKey, printerId: pnPrinterId }) });
          const result = await res.json();
          if (!result.success) { console.error("Print API Error:", result.error); return; }
          if (!isCloud) {
              const pdfBytes = Uint8Array.from(atob(result.pdfBase64), c => c.charCodeAt(0));
              const blob = new Blob([pdfBytes], { type: 'application/pdf' });
              window.open(window.URL.createObjectURL(blob), '_blank');
          }
      } catch (e) { console.error(e); }
  };

  const saveCustomerInfo = async () => {
      if (!editingCustomer) return;
      try {
          const { error } = await supabase.from('orders').update({ customer_name: customerForm.name, phone: customerForm.phone, email: customerForm.email }).eq('id', editingCustomer.id);
          if (error) throw error;
          setOrders(orders.map(o => o.id === editingCustomer.id ? { ...o, customer_name: customerForm.name, phone: customerForm.phone, email: customerForm.email } : o));
          setEditingCustomer(null); 
          alert("Customer updated!");
      } catch (err) { alert("Update failed: " + err.message); }
  };

  const openEditModal = (order) => { 
      const rawCart = Array.isArray(order.cart_data) ? order.cart_data : [];
      const cleanCart = rawCart.filter(item => item !== null && item !== undefined).map(item => ({ ...item, productName: item.productName || 'Unknown', size: item.size || 'N/A', customizations: { mainDesign: item.customizations?.mainDesign || '', logos: Array.isArray(item.customizations?.logos) ? item.customizations.logos : [], names: Array.isArray(item.customizations?.names) ? item.customizations.names : [], backList: !!item.customizations?.backList, metallic: !!item.customizations?.metallic } }));
      setEditingOrder({ ...order, cart_data: cleanCart }); 
      setOriginalOrderTotal(order.total_price || 0);
  };
  const closeEditModal = () => { setEditingOrder(null); };
  const handleEditChange = (f, v) => setEditingOrder(p => ({ ...p, [f]: v }));
  const handleEditItem = (index, field, value) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; newCart[index] = { ...newCart[index], [field]: value }; return { ...prev, cart_data: newCart }; }); };
  const handleUpdateMainDesign = (index, value) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; newCart[index].customizations.mainDesign = value; return { ...prev, cart_data: newCart }; }); };
  const handleEditName = (idx, nIdx, val) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; if(newCart[idx].customizations.names[nIdx]) newCart[idx].customizations.names[nIdx].text = val; return { ...prev, cart_data: newCart }; }); };
  const handleAddAccent = (idx) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; newCart[idx].customizations.logos.push({ type: logos[0]?.label || 'Logo', position: 'Left Sleeve' }); return { ...prev, cart_data: newCart }; }); };
  const handleAddName = (idx) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; newCart[idx].customizations.names.push({ text: '', position: 'Hood' }); return { ...prev, cart_data: newCart }; }); };
  const handleUpdateAccent = (idx, lIdx, field, val) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; if(newCart[idx].customizations.logos[lIdx]) newCart[idx].customizations.logos[lIdx][field] = val; return { ...prev, cart_data: newCart }; }); };
  const handleUpdateNamePos = (idx, nIdx, val) => { setEditingOrder(prev => { const newCart = [...prev.cart_data]; if(newCart[idx].customizations.names[nIdx]) newCart[idx].customizations.names[nIdx].position = val; return { ...prev, cart_data: newCart }; }); };

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

  const addLogo = async (e) => { 
      e.preventDefault(); 
      if (!newLogoName) return; 
      await supabase.from('logos').insert([{ label: newLogoName, image_url: newLogoUrl, category: newLogoCategory, placement: newLogoPlacement, sort_order: logos.length + 1, event_slug: selectedEventSlug }]); 
      setNewLogoName(''); setNewLogoUrl(''); fetchLogos(); 
  };
  const deleteLogo = async (id) => { if (!confirm("Delete?")) return; await supabase.from('logos').delete().eq('id', id); fetchLogos(); };
  
  // --- UPDATED: BULK TRUCK FUNCTIONALITY ---
  const processBulkTransfer = async () => {
      if (!truckTargetEvent) return alert("Select an event first!");
      
      const itemsToMove = Object.entries(transferQty)
        .filter(([_, qty]) => parseInt(qty) > 0)
        .map(([sku, qty]) => ({
          sku,
          qty: parseInt(qty),
          product: products.find(p => p.id === sku)
        }));

      if (itemsToMove.length === 0) return alert("Enter quantities to load.");

      setLoading(true);
      try {
          for (const batchItem of itemsToMove) {
              const { sku, qty, product } = batchItem;

              // Check existing stock
              const { data: existing } = await supabase
                  .from('inventory')
                  .select('count')
                  .eq('event_slug', truckTargetEvent)
                  .eq('product_id', sku)
                  .eq('size', 'Adult L') // Default fallback size
                  .maybeSingle();

              // UPSERT to Event Truck
              await supabase.from('inventory').upsert({
                  event_slug: truckTargetEvent,
                  product_id: sku,
                  size: 'Adult L',
                  count: (existing?.count || 0) + qty,
                  active: true, 
                  override_price: product.base_price, // BRINGS THE PRICE OVER
                  cost_price: product.cost_price || 8.50
              }, { onConflict: 'event_slug,product_id,size' });
          }
          alert("🚛 Truck Loaded & Prices Synced!");
          setTransferQty({});
          fetchInventory();
      } catch (e) {
          alert("Transfer Error: " + e.message);
      }
      setLoading(false);
  };

  const returnToWarehouse = async (item) => {
    if (!confirm(`Move ${item.count} units back to Warehouse?`)) return;
    setLoading(true);
    try {
        await supabase.from('inventory').delete()
            .eq('event_slug', selectedEventSlug)
            .eq('product_id', item.product_id)
            .eq('size', item.size);
        fetchInventory();
        alert("↩️ Stock returned.");
    } catch (e) { alert("Error: " + e.message); }
    setLoading(false);
  };

  const deleteProduct = async (id) => { 
      if (!confirm(`Delete "${id}" PERMANENTLY?`)) return;
      await supabase.from('inventory').delete().eq('product_id', id); 
      await supabase.from('products').delete().eq('id', id); 
      fetchInventory(); 
  };  
  const updateStock = async (pid, s, f, v) => { setInventory(inventory.map(i => (i.product_id === pid && i.size === s) ? { ...i, [f]: v } : i)); await supabase.from('inventory').update({ [f]: v }).eq('product_id', pid).eq('size', s); };
  
  const updateProductInfo = async (pid, field, value) => {
    setProducts(products.map(p => p.id === pid ? { ...p, [field]: value } : p));
    await supabase.from('products').update({ [field]: value }).eq('id', pid);
  };

  const toggleLogo = async (id, s) => { setLogos(logos.map(l => l.id === id ? { ...l, active: !s } : l)); await supabase.from('logos').update({ active: !s }).eq('id', id); };
  const getProductName = (id) => products.find(p => p.id === id)?.name || id;
  
  const handleAddProduct = async (e) => { 
      e.preventDefault(); 
      if (!newProdId || !newProdName) return alert("Missing Info"); 
      const safeId = newProdId.toLowerCase().replace(/\s/g, '_');
      await supabase.from('products').insert([{ id: safeId, name: newProdName, base_price: parseFloat(newProdPrice), image_url: newProdImage, type: newProdType, sort_order: 99 }]); 
      setNewProdId(''); setNewProdName(''); fetchInventory(); 
  };

  const handleGuestUpload = (e) => { const f = e.target.files[0]; if (!f) return; setLoading(true); const r = new FileReader(); r.onload = async (evt) => { try { const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]); for (const row of d) { const n = row['Name'] || row['name'] || row['Guest']; const s = row['Size'] || row['size']; if (n) await supabase.from('guests').insert([{ name: String(n).trim(), size: s ? String(s).trim() : null, has_ordered: false, event_slug: selectedEventSlug }]); } alert(`Imported!`); fetchGuests(); } catch (e) {} setLoading(false); }; r.readAsBinaryString(f); };
  const addSingleGuest = async (e) => { e.preventDefault(); if (!newGuestName.trim()) return; setLoading(true); try { await supabase.from('guests').insert([{ name: newGuestName.trim(), event_slug: selectedEventSlug, has_ordered: false }]); setNewGuestName(''); fetchGuests(); alert("Guest Added!"); } catch (err) { alert("Error adding guest: " + err.message); } setLoading(false); };
  const resetGuest = async (id) => { if (confirm("Reset?")) { await supabase.from('guests').update({ has_ordered: false }).eq('id', id); fetchGuests(); } };
  const deleteGuest = async (id, name) => { if (!confirm(`Permanently remove "${name}"?`)) return; setLoading(true); try { await supabase.from('guests').delete().eq('id', id); fetchGuests(); } catch (err) { alert("Error deleting guest: " + err.message); } setLoading(false); }; 
  const clearGuestList = async () => { if (confirm("Clear All?")) { await supabase.from('guests').delete().neq('id', 0); fetchGuests(); } };
  
  if (!mounted) return <div className="p-10 text-center font-bold">Loading Admin...</div>;
  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center bg-gray-100"><form onSubmit={handleLogin} className="bg-white p-8 rounded shadow"><h1 className="text-xl font-bold mb-4">Admin Login</h1><input type="password" onChange={e => setPasscode(e.target.value)} className="border p-2 w-full rounded" placeholder="Password"/></form></div>;

  const visibleOrders = orders.filter(o => {
      if (o.status === 'refunded') return false;
      if (!hideUnpaid) return true; 
      const pStatus = (o.payment_status || '').toLowerCase();
      const isHostedEvent = paymentMode === 'hosted';
      const isPaid = isHostedEvent ? (o.status !== 'incomplete' && o.status !== 'awaiting_payment') : (pStatus === 'paid' || pStatus === 'succeeded' || Number(o.total_price) === 0);
      return isPaid;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black font-sans">
      <audio ref={audioRef} src="/ding.mp3" preload="auto" />
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex flex-col">
              <h1 className="text-3xl font-black text-gray-900">{eventName || 'Admin Dashboard'}</h1>
              <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-gray-500 uppercase">Viewing Event:</span>
                  <select value={selectedEventSlug} onChange={(e) => setSelectedEventSlug(e.target.value)} className="bg-white border rounded py-1 px-2 text-sm font-bold shadow-sm">
                      {availableEvents.map(evt => <option key={evt.id} value={evt.slug}>{evt.event_name} ({evt.slug})</option>)}
                  </select>
              </div>
          </div>
          <div className="flex bg-white rounded-lg p-1 shadow border border-gray-300">
            {['orders', 'global catalog', 'event stock', 'guests', 'logos', 'terminals', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded font-bold uppercase text-xs ${activeTab === tab ? 'bg-blue-900 text-white' : 'hover:bg-gray-100'}`}>{tab}</button>
            ))}
          </div>
        </div>

        {/* --- ORDERS TAB --- */}
        {activeTab === 'orders' && ( <div className="space-y-6"> 
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4"> 
            <div onClick={() => setShowFinancials(!showFinancials)} className="bg-white p-4 rounded shadow border-l-4 border-green-500 cursor-pointer hover:bg-gray-50">
                <p className="text-xs text-gray-500 font-bold uppercase">Gross Revenue</p>
                <p className={`text-3xl font-black ${showFinancials ? 'text-green-700' : 'text-gray-300 blur-sm'}`}>{showFinancials ? `$${stats.revenue.toFixed(2)}` : '$8,888.88'}</p>
            </div>
            <div className="bg-white p-4 rounded shadow border-l-4 border-blue-500"><p className="text-xs text-gray-500 font-bold uppercase">Paid Orders</p><p className="text-3xl font-black text-blue-900">{stats.count}</p></div> 
            <div onClick={() => setShowFinancials(!showFinancials)} className="bg-white p-4 rounded shadow border-l-4 border-pink-500 cursor-pointer hover:bg-gray-50">
                <p className="text-xs text-gray-500 font-bold uppercase">Est. Net Profit</p>
                <p className={`text-3xl font-black ${showFinancials ? 'text-pink-600' : 'text-gray-300 blur-sm'}`}>{showFinancials ? `$${stats.net.toFixed(2)}` : '$8,888.88'}</p>
            </div>
            <div className="bg-white p-4 rounded shadow border-l-4 border-purple-500 flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-2"><input type="checkbox" id="autoPrint" checked={autoPrintEnabled} onChange={(e) => setAutoPrintEnabled(e.target.checked)} className="w-4 h-4" /><label htmlFor="autoPrint" className="text-xs font-black uppercase">Auto-Print</label></div>
                <div className="flex items-center gap-2 border-t pt-2"><input type="checkbox" id="hideUnpaid" checked={hideUnpaid} onChange={(e) => setHideUnpaid(e.target.checked)} className="w-4 h-4" /><label htmlFor="hideUnpaid" className="text-xs font-bold uppercase">Hide Unpaid</label></div>
            </div> 
          </div> 
          <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300 overflow-x-auto"> 
            <table className="w-full text-left min-w-[800px]"><thead className="bg-gray-200"><tr><th className="p-4 w-40">Status</th><th className="p-4">Date</th><th className="p-4">Customer</th><th className="p-4">Items</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>{visibleOrders.map((order) => {
                const safeItems = Array.isArray(order.cart_data) ? order.cart_data : [];
                const pStatus = (order.payment_status || '').toLowerCase();
                const isPaid = paymentMode === 'hosted' ? order.status !== 'incomplete' : (pStatus === 'paid' || pStatus === 'succeeded' || Number(order.total_price) === 0);
                return (
                <tr key={order.id} className={`border-b hover:bg-gray-50 ${order.printed ? 'bg-gray-50' : 'bg-white'}`}>
                    <td className="p-4 align-top"><select value={order.status || 'pending'} onChange={(e) => handleStatusChange(order.id, e.target.value)} className={`p-2 rounded border-2 uppercase font-bold text-xs ${STATUSES[order.status || 'pending']?.color}`}>{Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></td>
                    <td className="p-4 align-top text-sm text-gray-500 font-medium">{new Date(order.created_at).toLocaleString()}</td>
                    <td className="p-4 align-top"><div className="font-bold">{order.customer_name}</div><div className="text-sm">{order.phone}</div><button onClick={() => { setEditingCustomer(order); setCustomerForm({ name: order.customer_name || '', phone: order.phone || '', email: order.email || '' }); }} className="text-blue-600 text-xs font-bold underline mt-1">Edit Info</button></td>
                    <td className="p-4 align-top text-sm">{safeItems.map((item, i) => <div key={i} className="mb-1"><strong>{item?.productName}</strong> ({item?.size})</div>)}<div className="mt-2 text-right font-black text-green-800">${order.total_price}</div></td>
                    <td className="p-4 align-top text-right flex justify-end gap-2">{!isPaid && (<button onClick={() => markOrderPaid(order.id)} className="p-2 rounded bg-green-50 text-green-600 font-bold text-xs uppercase">Pay</button>)}<button onClick={() => openEditModal(order)} className="p-2 rounded bg-blue-50 text-blue-600 font-bold">✏️</button><button onClick={() => printLabel(order)} className="p-2 rounded bg-gray-200">🖨️</button><button onClick={() => deleteOrder(order.id, order.cart_data)} className="text-red-500">🗑️</button></td>
                </tr>
            )})}</tbody></table> 
          </div> 
        </div> )}

        {/* --- UPDATED: GLOBAL CATALOG TAB --- */}
        {activeTab === 'global catalog' && (
            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                    <div className="bg-white p-6 rounded-lg shadow border border-gray-200 sticky top-4">
                        <h2 className="font-bold text-xl mb-4">Create Master Product</h2>
                        <form onSubmit={handleAddProduct} className="space-y-3">
                            <input className="w-full border p-2 rounded" placeholder="SKU ID" value={newProdId} onChange={e => setNewProdId(e.target.value)} />
                            <input className="w-full border p-2 rounded" placeholder="Product Name" value={newProdName} onChange={e => setNewProdName(e.target.value)} />
                            <div className="grid grid-cols-2 gap-2">
                                <input type="number" className="w-full border p-2 rounded" placeholder="Price" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} />
                                <input type="number" className="w-full border p-2 rounded" placeholder="Cost" value={newProdCost} onChange={e => setNewProdCost(e.target.value)} />
                            </div>
                            <button className="w-full bg-green-600 text-white font-bold py-2 rounded">Create Global Product</button>
                        </form>
                    </div>
                </div>
                
                <div className="md:col-span-2">
                    <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300 flex flex-col h-[700px]">
                        <div className="bg-gray-800 text-white p-4 font-bold uppercase text-sm shrink-0 flex justify-between items-center">
                            <span>Global Master List</span>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-400">Truck to:</span>
                                    <select className="text-black text-xs rounded p-1 font-bold" value={truckTargetEvent} onChange={(e) => setTruckTargetEvent(e.target.value)}>
                                        <option value="">-- Choose --</option>
                                        {availableEvents.map(evt => <option key={evt.id} value={evt.slug}>{evt.slug}</option>)}
                                    </select>
                                </div>
                                <button onClick={processBulkTransfer} disabled={loading || !truckTargetEvent} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-black shadow transition-all">
                                    {loading ? 'Moving...' : 'Finalize Bulk Load 🚛'}
                                </button>
                            </div>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            <table className="w-full text-left">
                                <thead className="bg-gray-100 border-b sticky top-0"><tr><th className="p-3 w-16">Img</th><th className="p-3">Product Name</th><th className="p-3 w-24">Base $</th><th className="p-3 text-right">Load Qty</th></tr></thead>
                                <tbody>
                                    {products.map((prod) => (
                                        <tr key={prod.id} className="border-b hover:bg-gray-50">
                                            <td className="p-3">{prod.image_url ? <img src={prod.image_url} className="w-10 h-10 object-contain" /> : <div className="w-10 h-10 bg-gray-100" />}</td>
                                            <td className="p-3">
                                                <input className="font-bold text-gray-700 bg-transparent w-full" value={prod.name} onChange={(e) => updateProductInfo(prod.id, 'name', e.target.value)} />
                                                <div className="text-[10px] text-gray-400">ID: {prod.id}</div>
                                            </td>
                                            <td className="p-3">
                                                <input type="number" className="w-16 border rounded text-center text-sm" value={prod.base_price} onChange={(e) => updateProductInfo(prod.id, 'base_price', e.target.value)} />
                                            </td>
                                            <td className="p-3 text-right">
                                                <input type="number" placeholder="0" className="w-20 border p-2 rounded text-center font-black focus:ring-2 focus:ring-blue-500" value={transferQty[prod.id] || ''} onChange={(e) => setTransferQty({...transferQty, [prod.id]: e.target.value})} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- EVENT STOCK TAB --- */}
        {activeTab === 'event stock' && (
            <div className="max-w-4xl mx-auto">
                <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300 flex flex-col h-[700px]">
                    <div className="bg-blue-900 text-white p-4 font-bold uppercase text-sm tracking-wide shrink-0">
                        Active Truck Inventory ({selectedEventSlug})
                    </div>
                    <div className="overflow-y-auto flex-1">
                        <table className="w-full text-left">
                            <thead className="bg-gray-100 border-b sticky top-0">
                                <tr><th className="p-4">Product</th><th className="p-4">Size</th><th className="p-4 text-center">Event Price</th><th className="p-4 text-center">Stock</th><th className="p-4 text-center">Action</th></tr>
                            </thead>
                            <tbody>
                                {inventory.filter(i => i.active).map((item) => {
                                    const globalProd = products.find(p => p.id === item.product_id);
                                    return (
                                        <tr key={`${item.product_id}_${item.size}`} className="border-b">
                                            <td className="p-4 font-bold text-sm">{getProductName(item.product_id)}</td>
                                            <td className="p-4 text-sm">{item.size}</td>
                                            <td className="p-4 text-center font-bold text-green-700">
                                                <input type="number" className="w-20 border rounded text-center" value={item.override_price || globalProd?.base_price} onChange={(e) => updateStock(item.product_id, item.size, 'override_price', parseFloat(e.target.value))} />
                                            </td>
                                            <td className="p-4 text-center">
                                                <input type="number" className="w-16 border text-center font-black" value={item.count} onChange={(e) => updateStock(item.product_id, item.size, 'count', parseInt(e.target.value))} />
                                            </td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => returnToWarehouse(item)} className="text-xs bg-gray-100 p-2 rounded border font-bold">↩️ Return</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* --- GUESTS TAB --- */}
        {activeTab === 'guests' && (
            <div className="max-w-4xl mx-auto">
                <div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200">
                    <h2 className="font-bold text-xl mb-4">Manage Guest List</h2>
                    <form onSubmit={addSingleGuest} className="flex gap-4 mb-6 pb-6 border-b">
                        <input className="flex-1 border p-2 rounded text-lg" placeholder="Guest Name" value={newGuestName} onChange={e => setNewGuestName(e.target.value)} />
                        <button className="bg-green-600 text-white font-bold px-6 py-2 rounded">➕ Add</button>
                    </form>
                    <div className="flex gap-4 items-center">
                        <input type="file" accept=".xlsx, .xls" onChange={handleGuestUpload} className="text-xs" />
                        <button onClick={clearGuestList} className="text-red-600 font-bold text-sm underline">Clear All</button>
                    </div>
                </div>
                <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300">
                    <table className="w-full text-left">
                        <thead className="bg-gray-100 border-b"><tr><th className="p-4">Name</th><th className="p-4 text-center">Ordered?</th><th className="p-4 text-right">Action</th></tr></thead>
                        <tbody>{guests.map((g) => (<tr key={g.id} className="border-b"><td className="p-4 font-bold">{g.name}</td><td className="p-4 text-center">{g.has_ordered ? '✅' : '⏳'}</td><td className="p-4 text-right flex justify-end gap-2"><button onClick={() => resetGuest(g.id)} className="text-xs underline">Reset</button><button onClick={() => deleteGuest(g.id, g.name)} className="text-red-500">🗑️</button></td></tr>))}</tbody>
                    </table>
                </div>
            </div>
        )}

        {/* --- LOGOS TAB --- */}
        {activeTab === 'logos' && (
            <div className="max-w-4xl mx-auto">
                <div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200">
                    <h2 className="font-bold text-xl mb-4">Add Logo Option</h2>
                    <form onSubmit={addLogo} className="grid grid-cols-2 gap-4">
                        <input className="border p-2 rounded" placeholder="Label" value={newLogoName} onChange={e => setNewLogoName(e.target.value)} />
                        <input className="border p-2 rounded" placeholder="Image URL" value={newLogoUrl} onChange={e => setNewLogoUrl(e.target.value)} />
                        <button className="bg-blue-900 text-white font-bold py-2 rounded col-span-2">Add Logo</button>
                    </form>
                </div>
                <div className="bg-white shadow rounded-lg border border-gray-300">
                    <table className="w-full text-left">
                        <thead className="bg-gray-800 text-white"><tr><th className="p-4">Preview</th><th className="p-4">Label</th><th className="p-4 text-center">Active</th><th className="p-4 text-right">Action</th></tr></thead>
                        <tbody>{logos.map((logo) => (<tr key={logo.id} className="border-b"><td className="p-4"><img src={logo.image_url} className="w-12 h-12 object-contain" /></td><td className="p-4 font-bold">{logo.label}</td><td className="p-4 text-center"><input type="checkbox" checked={logo.active} onChange={() => toggleLogo(logo.id, logo.active)} /></td><td className="p-4 text-right"><button onClick={() => deleteLogo(logo.id)} className="text-red-500">🗑️</button></td></tr>))}</tbody>
                    </table>
                </div>
            </div>
        )}

        {/* --- TERMINALS TAB --- */}
        {activeTab === 'terminals' && (
            <div className="max-w-4xl mx-auto"><div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200"><h2 className="font-bold text-xl mb-4">Manage Terminals</h2><div className="grid md:grid-cols-2 gap-4"><input className="border p-2 rounded" placeholder="Label" value={newTermLabel} onChange={e => setNewTermLabel(e.target.value)} /><input className="border p-2 rounded" placeholder="Device ID" value={newTermId} onChange={e => setNewTermId(e.target.value)} /><button onClick={addTerminal} className="bg-blue-900 text-white font-bold py-2 rounded col-span-2">Add Terminal</button></div></div><div className="bg-white shadow rounded-lg border border-gray-300"><table className="w-full text-left"><thead className="bg-gray-800 text-white"><tr><th className="p-4">Label</th><th className="p-4">Device ID</th><th className="p-4 text-right">Action</th></tr></thead><tbody>{terminals.map((t) => (<tr key={t.id} className="border-b"><td className="p-4 font-bold">{t.label}</td><td className="p-4 font-mono text-sm">{t.device_id}</td><td className="p-4 text-right"><button onClick={() => deleteTerminal(t.id)} className="text-red-500 font-bold">🗑️</button></td></tr>))}</tbody></table></div></div>
        )}

        {/* --- SETTINGS TAB --- */}
        {activeTab === 'settings' && (
            <div className="max-w-xl mx-auto">
                <div className="bg-white p-8 rounded-lg shadow border border-gray-200">
                    <h2 className="font-bold text-2xl mb-6">Event Settings</h2>
                    <div className="space-y-4">
                        <div><label className="block text-sm font-bold">Event Name</label><input className="w-full border p-2 rounded" value={eventName} onChange={e => setEventName(e.target.value)} /></div>
                        <div><label className="block text-sm font-bold">Logo URL</label><input className="w-full border p-2 rounded" value={eventLogo} onChange={e => setEventLogo(e.target.value)} /></div>
                        <div className="bg-yellow-50 p-4 border rounded">
                            <label className="block text-xs font-black uppercase text-yellow-800 mb-2">Tax Settings</label>
                            <div className="flex justify-between items-center"><span className="text-sm font-bold">Tax Enabled</span><input type="checkbox" checked={taxEnabled} onChange={e => setTaxEnabled(e.target.checked)} /></div>
                            {taxEnabled && <div className="mt-2"><label className="text-xs font-bold">Rate (%)</label><input type="number" className="w-full border p-2 rounded mt-1" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value))} /></div>}
                        </div>
                        <button onClick={saveSettings} className="w-full bg-blue-900 text-white font-bold py-3 rounded text-lg shadow">Save Global Settings</button>
                    </div>
                </div>
            </div>
        )}

        {/* --- EDIT ORDER MODAL --- */}
        {editingOrder && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div className="p-6 border-b flex justify-between bg-gray-50 rounded-t-xl"><h2 className="font-bold text-lg">Edit Order #{String(editingOrder.id).slice(0,8)}</h2><button onClick={closeEditModal} className="text-2xl text-gray-500 hover:text-black">×</button></div>
                    <div className="p-6 space-y-6">
                        <div className="bg-blue-50 p-4 rounded border border-blue-100"><label className="block text-xs font-bold uppercase text-blue-900 mb-1">Customer Name</label><input className="w-full p-2 border rounded font-bold" value={editingOrder.customer_name} onChange={(e) => handleEditChange('customer_name', e.target.value)} /></div>
                        {editingOrder.cart_data.map((item, idx) => {
                            const productRef = products.find(p => (item.productId && p.id === item.productId) || (p.name && item.productName && p.name.toLowerCase() === item.productName.toLowerCase()));
                            const isBottom = productRef?.type === 'bottom';
                            const allowedLogos = logos.filter(l => isBottom ? l.placement !== 'large' : true);
                            return (
                            <div key={idx} className="bg-white p-4 border rounded-lg shadow-sm">
                                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                                    <span className="font-bold text-lg">{item.productName}</span>
                                    <select className="border-2 p-1 rounded font-bold bg-gray-50" value={item.size} onChange={(e) => handleEditItem(idx, 'size', e.target.value)}>{SIZE_ORDER.map(s => <option key={s} value={s}>{s}</option>)}</select>
                                </div>
                                <div className="mb-4">
                                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">Main Design</div>
                                    <select className="w-full border p-2 rounded font-bold" value={item.customizations?.mainDesign || ''} onChange={(e) => handleUpdateMainDesign(idx, e.target.value)} >
                                        <option value="">(None)</option>
                                        {allowedLogos.filter(l => l.category === 'main').map(l => ( <option key={l.id} value={l.label}>{l.label}</option> ))}
                                    </select>
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="text-xs font-bold text-gray-500 uppercase">Accents ($5)</div>
                                    {item.customizations?.logos?.map((l, lIdx) => (
                                        <div key={lIdx} className="flex gap-2">
                                            <select className="border p-2 rounded flex-1 text-sm font-bold" value={l.type} onChange={(e) => handleUpdateAccent(idx, lIdx, 'type', e.target.value)}>
                                                {allowedLogos.map(opt => <option key={opt.id} value={opt.label}>{opt.label}</option>)}
                                            </select>
                                            <select className="border p-2 rounded w-40 text-sm" value={l.position} onChange={(e) => handleUpdateAccent(idx, lIdx, 'position', e.target.value)}>{POSITIONS.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}</select>
                                        </div>
                                    ))}
                                    <button onClick={() => handleAddAccent(idx)} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded font-bold text-blue-600">+ Add Accent</button>
                                </div>
                                <div className="space-y-2"><div className="text-xs font-bold text-gray-500 uppercase">Personalization ($5)</div>{item.customizations?.names?.map((n, nIdx) => (<div key={nIdx} className="flex gap-2"><input className="border p-2 rounded flex-1 text-sm uppercase font-bold" value={n.text} onChange={(e) => handleEditName(idx, nIdx, e.target.value)} placeholder="NAME" /><select className="border p-2 rounded w-40 text-sm" value={n.position} onChange={(e) => handleUpdateNamePos(idx, nIdx, e.target.value)}>{POSITIONS.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}</select></div>))}<button onClick={() => handleAddName(idx)} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded font-bold text-blue-600">+ Add Name</button></div>
                            </div>
                        )})}
                    </div>
                    <div className="p-6 border-t flex justify-end gap-3 bg-gray-50 rounded-b-xl"><button onClick={closeEditModal} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded">Cancel</button><button onClick={saveOrderEdits} className={`px-6 py-2 text-white font-bold rounded shadow transition-colors ${newOrderTotal > originalOrderTotal ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`} >{loading ? "Saving..." : (newOrderTotal > originalOrderTotal ? `Save & Pay Difference ($${(newOrderTotal - originalOrderTotal).toFixed(2)})` : "Save Changes")}</button></div>
                </div>
            </div>
        )}

        {/* --- EDIT CUSTOMER MODAL --- */}
        {editingCustomer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                  <h2 className="text-xl font-bold mb-4">Edit Customer Info</h2>
                  <div className="mb-4"><label className="block text-sm font-bold mb-1">Name</label><input value={customerForm.name} onChange={e => setCustomerForm({...customerForm, name: e.target.value})} className="w-full border p-2 rounded" /></div>
                  <div className="mb-4"><label className="block text-sm font-bold mb-1">Phone</label><input value={customerForm.phone} onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} className="w-full border p-2 rounded" /></div>
                  <div className="mb-6"><label className="block text-sm font-bold mb-1">Email</label><input value={customerForm.email} onChange={e => setCustomerForm({...customerForm, email: e.target.value})} className="w-full border p-2 rounded" /></div>
                  <div className="flex justify-end gap-2"><button onClick={() => setEditingCustomer(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button><button onClick={saveCustomerInfo} className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700">Save Changes</button></div>
              </div>
          </div>
        )}

      </div>
    </div>
  );
}
