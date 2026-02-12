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
  const [newGuestName, setNewGuestName] = useState(''); // <--- NEW STATE
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [logos, setLogos] = useState([]);
  const [guests, setGuests] = useState([]); 
  const [terminals, setTerminals] = useState([]); // NEW: Terminals List
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ revenue: 0, count: 0, net: 0, topItem: '-' });
  const [uploadLog, setUploadLog] = useState([]); 

// --- MULTI-EVENT STATE ---
  const [availableEvents, setAvailableEvents] = useState([]);
  const [selectedEventSlug, setSelectedEventSlug] = useState(''); // The master filter

  const [editingOrder, setEditingOrder] = useState(null);
  const [originalOrderTotal, setOriginalOrderTotal] = useState(0); 
  const [newOrderTotal, setNewOrderTotal] = useState(0); 

  // --- AUTO PRINT STATE ---
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const [hideUnpaid, setHideUnpaid] = useState(true); 
  const audioRef = useRef(null);
  const lastOrderCount = useRef(0);
  const processedIds = useRef(new Set());

  // Forms
  const [newProdId, setNewProdId] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState(30);
  const [newProdCost, setNewProdCost] = useState(8.50); // <--- ADDED: Cost State
  const [newProdImage, setNewProdImage] = useState(''); 
  const [newProdType, setNewProdType] = useState('top'); 
  const [newLogoName, setNewLogoName] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [newLogoCategory, setNewLogoCategory] = useState('accent'); 
  const [newLogoPlacement, setNewLogoPlacement] = useState('large'); // 'large' or 'small'
  // Terminal Form
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
// --- AUTH PERSISTENCE ---
  useEffect(() => {
      // Check if we are already logged in from before
      const sessionAuth = sessionStorage.getItem('admin_auth');
      if (sessionAuth === 'true') {
          setIsAuthorized(true);
      }
  }, []);

// --- ENGINE: LOAD EVENTS FIRST ---
  useEffect(() => {
      if (isAuthorized && mounted) {
          const loadEvents = async () => {
              const { data } = await supabase.from('event_settings').select('*').order('id');
              if (data && data.length > 0) {
                  setAvailableEvents(data);
                  // Default to the first event if none selected
                  if (!selectedEventSlug) setSelectedEventSlug(data[0].slug);
              }
          };
          loadEvents();
      }
  }, [isAuthorized, mounted]);

// --- ENGINE: SYNC DATA (Live Guests + Orders + Inventory) ---
  useEffect(() => {
    if (!isAuthorized || !mounted) return;

    console.log("🔌 Connecting to Realtime...");

    // 1. Initial Data Load
    fetchOrders();
    fetchSettings();
    fetchInventory();
    fetchLogos();
    fetchGuests();
    fetchTerminals();

    // 2. THE TRIPLE LISTENER
    const channel = supabase.channel('global_updates')
        // A. Listen for ORDERS
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
            console.log("🔔 ORDER UPDATE:", payload.eventType);
            fetchOrders(); 
            fetchGuests(); // Refresh guests too (in case an order redeemed a guest)
            fetchInventory(); 
            
            if (payload.eventType === 'INSERT' && audioRef.current) {
                audioRef.current.play().catch(e => console.error("Audio error:", e));
            }
        })
        // B. Listen for INVENTORY
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, (payload) => {
            console.log("📦 INVENTORY UPDATE:", payload.eventType);
            fetchInventory();
        })
        // C. Listen for GUESTS (New!)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, (payload) => {
            console.log("👥 GUEST UPDATE:", payload.eventType);
            fetchGuests();
        })
        .subscribe((status) => {
            console.log("📡 Connection Status:", status);
        });

    // 3. Backup Timer (Poll every 5 seconds)
    const timer = setInterval(() => {
        fetchOrders();
        fetchInventory();
        fetchGuests(); // <--- Added polling for safety
    }, 5000);

    return () => {
        supabase.removeChannel(channel);
        clearInterval(timer);
    };
  }, [isAuthorized, mounted, selectedEventSlug]);
  // --- AUTO-PRINT LOGIC (Kept Intact) ---
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

  // --- RECALCULATE TOTALS (Kept Intact) ---
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

  // --- STATS LOGIC (Fixed: Uses Override Price) ---
  useEffect(() => {
    if(!mounted || !orders) return;
    try {
        const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'refunded');
        
        if (activeOrders.length > 0) {
            let totalRevenue = 0;
            let totalCOGS = 0;
            const itemCounts = {};

            activeOrders.forEach(order => {
                const items = Array.isArray(order.cart_data) ? order.cart_data : [];
                
                // 1. Calculate Real Value (Revenue)
                let orderValue = 0;
                
                // If it's a hosted order (Guest pays $0), we calculate the "Implied Value"
                if (paymentMode === 'hosted' || order.total_price === 0) {
                    items.forEach(item => {
                        // Find the specific inventory item to get the REAL price
                        const invItem = inventory.find(i => i.product_id === item.productId && i.size === item.size);
                        
                        // PRIORITY: Override Price -> Global Price -> Default $30
                        let itemPrice = 30;
                        if (invItem && invItem.override_price) {
                            itemPrice = Number(invItem.override_price);
                        } else {
                            const prod = products.find(p => p.id === item.productId);
                            if (prod) itemPrice = Number(prod.base_price);
                        }
                        
                        // Add Customizations ($5 each)
                        if (item.customizations) {
                            itemPrice += (item.customizations.logos?.length || 0) * 5;
                            itemPrice += (item.customizations.names?.length || 0) * 5;
                            if (item.customizations.metallic) itemPrice += 5;
                        }
                        orderValue += itemPrice;
                    });
                } else {
                    orderValue = order.total_price || 0;
                }
                
                totalRevenue += orderValue;

                // 2. Calculate Costs (COGS)
                items.forEach(item => {
                    if (!item) return;
                    const invItem = inventory.find(i => i.product_id === item.productId && i.size === item.size);
                    const unitCost = Number(invItem?.cost_price || 8.00); 
                    totalCOGS += (unitCost + 1.50); // Cost + Overhead

                    const key = `${item.productName || 'Unknown'} (${item.size || '?'})`;
                    itemCounts[key] = (itemCounts[key] || 0) + 1;
                });
            });

            // 3. Net Profit
            const stripeFees = paymentMode === 'hosted' ? 0 : (totalRevenue * 0.029) + (activeOrders.length * 0.30);
            const net = totalRevenue - stripeFees - totalCOGS;

            const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);
            const topItem = sortedItems.length > 0 ? sortedItems[0] : null;

            setStats({ 
                revenue: totalRevenue, 
                count: activeOrders.length, 
                net, 
                topItem: topItem ? `${topItem[0]} (${topItem[1]})` : '-' 
            });
        } else { 
            setStats({ revenue: 0, count: 0, net: 0, topItem: '-' }); 
        }
    } catch (e) { console.error("Stats Error:", e); }
  }, [orders, inventory, mounted, paymentMode, products]);
 // Update the login function to SAVE the session
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
              sessionStorage.setItem('admin_auth', 'true'); // <--- SAVES LOGIN
          } else { 
              alert("Wrong password"); 
          } 
      } catch (err) { 
          alert("Login failed"); 
      } 
      setLoading(false); 
  };
  // --- FETCHERS (FILTERED BY EVENT) ---
  const fetchOrders = async () => { 
      if (!supabase || !selectedEventSlug) return; 
      const { data } = await supabase.from('orders')
        .select('*')
        .eq('event_slug', selectedEventSlug)
        .order('created_at', { ascending: false }); 
      if (data) setOrders(data); 
  };
const fetchInventory = async () => { 
      if (!supabase || !selectedEventSlug) return; 
      
      // 1. Get Global Products (Shared info like Name/Image)
      const { data: p } = await supabase.from('products').select('*').order('sort_order'); 
      
      // 2. Get Inventory (Specific to THIS Event)
      const { data: i } = await supabase.from('inventory')
        .select('*')
        .eq('event_slug', selectedEventSlug) // <--- THIS SEPARATES THE STOCK
        .order('product_id', { ascending: true }); 
      
      if (p) setProducts(p); 
      if (i) setInventory(i); 
  };

  const fetchLogos = async () => { 
      if (!supabase || !selectedEventSlug) return; 
      const { data } = await supabase.from('logos')
        .select('*')
        .eq('event_slug', selectedEventSlug) // <--- EVENT FILTER
        .order('sort_order'); 
      if (data) setLogos(data); 
  };
  
  const fetchGuests = async () => { 
      if (!supabase || !selectedEventSlug) return; 
      const { data } = await supabase.from('guests')
        .select('*')
        .eq('event_slug', selectedEventSlug) // <--- FILTER BY EVENT
        .order('name'); 
      if (data) setGuests(data); 
      else setGuests([]);
  };

  const fetchTerminals = async () => { 
      if (!supabase) return; 
      const { data } = await supabase.from('terminals').select('*').order('id'); 
      if (data) setTerminals(data); 
  };

  const fetchSettings = async () => { 
      if (!supabase || !selectedEventSlug) return; 
      const { data } = await supabase.from('event_settings')
        .select('*')
        .eq('slug', selectedEventSlug) // <--- EVENT FILTER
        .single(); 
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
      if(confirm("Remove?")) { 
          await supabase.from('terminals').delete().eq('id', id); 
          fetchTerminals(); 
      } 
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
          printnode_printer_id: pnPrinterId 
      }).eq('slug', selectedEventSlug); 
      alert("Saved settings for " + selectedEventSlug); 
  };
  const closeEvent = async () => { if (prompt(`Type 'CLOSE' to confirm archive:`) !== 'CLOSE') return; setLoading(true); await supabase.from('orders').update({ event_name: eventName }).neq('status', 'completed'); await supabase.from('orders').update({ status: 'completed' }).neq('status', 'completed'); alert("Event Closed!"); fetchOrders(); setLoading(false); };
  // --- UPDATED STATUS CHANGE WITH SMS ---
  // --- UPDATED STATUS CHANGE WITH SMS ---
  const handleStatusChange = async (orderId, newStatus) => {
      // 1. Update UI and Database immediately
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);

      // 2. CHECK IF READY FOR PICKUP
      if (newStatus === 'ready') {
          try {
              // 3. Get Customer Details
              const { data: orderData } = await supabase
                  .from('orders')
                  .select('customer_name, phone')
                  .eq('id', orderId)
                  .single();

              if (orderData && orderData.phone) {
                  const message = `Hi ${orderData.customer_name}! Your order is ready for pickup. Please head to the Lev Custom Merch team and start wearing your new gear!`;

                  // 4. Send the SMS
                  const res = await fetch('/api/send-sms', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                          phone: orderData.phone, // <--- FIXED HERE (Was "to")
                          message: message 
                      })
                  });
                  
                  if (res.ok) {
                      alert(`✅ Text sent to ${orderData.customer_name}`);
                  } else {
                      console.error("SMS Failed");
                  }
              }
          } catch (err) {
              console.error("Error sending text:", err);
          }
      }
  };
  const deleteOrder = async (orderId, cartData) => { if (!confirm("Delete Order?")) return; setLoading(true); if (Array.isArray(cartData)) { for (const item of cartData) { if (item?.productId && item?.size) { const { data: current } = await supabase.from('inventory').select('count').eq('product_id', item.productId).eq('size', item.size).single(); if (current) { await supabase.from('inventory').update({ count: current.count + 1 }).eq('product_id', item.productId).eq('size', item.size); } } } } await supabase.from('orders').delete().eq('id', orderId); fetchOrders(); fetchInventory(); setLoading(false); };
  const handleRefund = async (orderId, paymentIntentId) => { if (!confirm("Refund?")) return; setLoading(true); try { const result = await refundOrder(orderId, paymentIntentId); if (result.success) { alert("Refunded."); setOrders(orders.map(o => o.id === orderId ? { ...o, status: 'refunded' } : o)); } else { alert("Failed: " + result.message); } } catch(e) { alert("Error: " + e.message); } setLoading(false); };
  const discoverPrinters = async () => { if(!pnApiKey) return alert("Enter API Key"); setLoading(true); try { const res = await fetch('https://api.printnode.com/printers', { headers: { 'Authorization': 'Basic ' + btoa(pnApiKey + ':') } }); const data = await res.json(); if (Array.isArray(data)) { setAvailablePrinters(data); alert(`Found ${data.length} printers!`); } } catch (e) {} setLoading(false); };
  
  // *** SAFE PRINT LABEL ***
  const printLabel = async (order) => {
      if (!order) return;
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, printed: true } : o));
      try { await supabase.from('orders').update({ printed: true }).eq('id', order.id); } catch (e) {}

      const isCloud = pnEnabled && pnApiKey && pnPrinterId;
      const mode = isCloud ? 'cloud' : 'download';
      try {
          const res = await fetch('/api/printnode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order, mode, apiKey: pnApiKey, printerId: pnPrinterId })
          });
          const result = await res.json();
          if (!result.success) { console.error("Print API Error:", result.error); return; }
          if (!isCloud) {
              const pdfBytes = Uint8Array.from(atob(result.pdfBase64), c => c.charCodeAt(0));
              const blob = new Blob([pdfBytes], { type: 'application/pdf' });
              window.open(window.URL.createObjectURL(blob), '_blank');
          }
      } catch (e) { console.error(e); }
  };

  const openEditModal = (order) => { 
      const rawCart = Array.isArray(order.cart_data) ? order.cart_data : [];
      const cleanCart = rawCart.filter(item => item !== null && item !== undefined).map(item => ({
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

  const addLogo = async (e) => { 
      e.preventDefault(); 
      if (!newLogoName) return; 
      await supabase.from('logos').insert([{ 
          label: newLogoName, 
          image_url: newLogoUrl, 
          category: newLogoCategory, 
          placement: newLogoPlacement, 
          sort_order: logos.length + 1,
          event_slug: selectedEventSlug 
      }]); 
      setNewLogoName(''); setNewLogoUrl(''); 
      fetchLogos(); 
  };
  
  const deleteLogo = async (id) => { if (!confirm("Delete?")) return; await supabase.from('logos').delete().eq('id', id); fetchLogos(); };
// --- SMART DELETE (Protects other events) ---
  const deleteProduct = async (id) => { 
      // 1. Check if other events are using this product
      const { data: usage } = await supabase.from('inventory')
        .select('event_slug')
        .eq('product_id', id)
        .neq('event_slug', selectedEventSlug); // Look for OTHER events

      const isUsedElsewhere = usage && usage.length > 0;

      if (isUsedElsewhere) {
          // SAFE MODE: Only remove from THIS event
          if (!confirm(`Remove "${id}" from ${selectedEventSlug}?\n\n(It will remain in the Global Catalog because other events use it.)`)) return;
          
          await supabase.from('inventory')
            .delete()
            .eq('product_id', id)
            .eq('event_slug', selectedEventSlug);
            
      } else {
          // DESTRUCTIVE MODE: Delete completely
          if (!confirm(`Delete "${id}" PERMANENTLY?\n\n(No other events are using this, so it will be gone forever.)`)) return;
          
          await supabase.from('inventory').delete().eq('product_id', id); // Delete all stock
          await supabase.from('products').delete().eq('id', id); // Delete master record
      }
      
      fetchInventory(); 
  };  
  const updateStock = async (pid, s, f, v) => { setInventory(inventory.map(i => (i.product_id === pid && i.size === s) ? { ...i, [f]: v } : i)); await supabase.from('inventory').update({ [f]: v }).eq('product_id', pid).eq('size', s); };
  
  // FIX: Update Product Info (Name, Image, Price)
  const updateProductInfo = async (pid, field, value) => {
      setProducts(products.map(p => p.id === pid ? { ...p, [field]: value } : p));
      await supabase.from('products').update({ [field]: value }).eq('id', pid);
  };

  const updatePrice = async (pid, v) => { setProducts(products.map(p => p.id === pid ? { ...p, base_price: v } : p)); await supabase.from('products').update({ base_price: v }).eq('id', pid); };
  const toggleLogo = async (id, s) => { setLogos(logos.map(l => l.id === id ? { ...l, active: !s } : l)); await supabase.from('logos').update({ active: !s }).eq('id', id); };
  const getProductName = (id) => products.find(p => p.id === id)?.name || id;
  const downloadTemplate = () => { 
      try { 
          const data = inventory.map(item => ({ 
              product_id: item.product_id, 
              size: item.size, 
              count: item.count, 
              cost_price: item.cost_price || 8.50, 
              override_price: item.override_price || '', // <--- ADDED COLUMN
              _Reference_Name: getProductName(item.product_id) || item.product_id 
          })); 
          const ws = XLSX.utils.json_to_sheet(data); 
          const wb = XLSX.utils.book_new(); 
          XLSX.utils.book_append_sheet(wb, ws, "Inventory"); 
          XLSX.writeFile(wb, `${selectedEventSlug}_Inventory.xlsx`); 
      } catch (e) { console.error(e); } 
  };
  const downloadCSV = () => { if (!orders.length) return; const headers = ['ID', 'Event', 'Date', 'Customer', 'Phone', 'Address', 'Status', 'Total', 'Items']; const rows = orders.map(o => { const addr = o.shipping_address ? `"${o.shipping_address}, ${o.shipping_city}, ${o.shipping_state}"` : "Pickup"; const items = (Array.isArray(o.cart_data) ? o.cart_data : []).map(i => `${i?.productName} (${i?.size})`).join(' | '); return [o.id, `"${o.event_name || ''}"`, new Date(o.created_at).toLocaleDateString(), `"${o.customer_name}"`, o.phone, addr, o.status, o.total_price, `"${items}"`].join(','); }); const link = document.createElement("a"); link.href = "data:text/csv;charset=utf-8," + encodeURI([headers.join(','), ...rows].join('\n')); link.download = "orders.csv"; link.click(); };
  
  // FIX: Added Cost to Insert & Removed Auto-Caps
const handleAddProductWithSizeUpdates = async (e) => { 
      e.preventDefault(); 
      if (!newProdId || !newProdName) return alert("Missing Info"); 
      const safeId = newProdId.toLowerCase().replace(/\s/g, '_');
      
      // Save Product (Global)
      await supabase.from('products').insert([{ 
          id: safeId, 
          name: newProdName, 
          base_price: parseFloat(newProdPrice), 
          image_url: newProdImage, 
          type: newProdType, 
          sort_order: 99 
      }]); 
      
      // Save Inventory (Event Specific)
      const sizes = SIZE_ORDER; 
      await supabase.from('inventory').insert(sizes.map(s => ({ 
          product_id: safeId, 
          size: s, 
          count: 0, 
          cost_price: parseFloat(newProdCost), 
          active: true,
          event_slug: selectedEventSlug 
      }))); 
      
      alert("Created!"); 
      setNewProdId(''); setNewProdName(''); fetchInventory(); 
  };
  // --- UPDATED GUEST UPLOAD (SAVES TO CURRENT EVENT) ---
  const handleGuestUpload = (e) => { 
      const f = e.target.files[0]; 
      if (!f) return; 
      setLoading(true); 
      const r = new FileReader(); 
      r.onload = async (evt) => { 
          try { 
              const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]); 
              for (const row of d) { 
                  const n = row['Name'] || row['name'] || row['Guest']; 
                  const s = row['Size'] || row['size']; 
                  if (n) await supabase.from('guests').insert([{ 
                      name: String(n).trim(), 
                      size: s ? String(s).trim() : null, 
                      has_ordered: false,
                      event_slug: selectedEventSlug // <--- CRITICAL FIX
                  }]); 
              } 
              alert(`Imported!`); 
              fetchGuests(); 
          } catch (e) {} 
          setLoading(false); 
      }; 
      r.readAsBinaryString(f); 
  };
  // --- NEW: QUICK ADD SINGLE GUEST ---
  const addSingleGuest = async (e) => {
      e.preventDefault();
      if (!newGuestName.trim()) return;

      setLoading(true);
      try {
          const { error } = await supabase.from('guests').insert([{
              name: newGuestName.trim(),
              event_slug: selectedEventSlug,
              has_ordered: false
          }]);

          if (error) throw error;

          setNewGuestName(''); // Clear input
          fetchGuests(); // Refresh list immediately
          alert("Guest Added!");
      } catch (err) {
          alert("Error adding guest: " + err.message);
      }
      setLoading(false);
  };
  const resetGuest = async (id) => { if (confirm("Reset?")) { await supabase.from('guests').update({ has_ordered: false }).eq('id', id); fetchGuests(); } };
 // --- NEW: DELETE SINGLE GUEST ---
  const deleteGuest = async (id, name) => {
      if (!confirm(`Permanently remove "${name}" from the list?`)) return;
      
      setLoading(true);
      try {
          const { error } = await supabase.from('guests').delete().eq('id', id);
          if (error) throw error;
          
          fetchGuests(); // Refresh list immediately
      } catch (err) {
          alert("Error deleting guest: " + err.message);
      }
      setLoading(false);
  }; 
 const clearGuestList = async () => { if (confirm("Clear All?")) { await supabase.from('guests').delete().neq('id', 0); fetchGuests(); } };
  
  // *** FIXED: BULK UPLOAD WITH PARENT CREATION ***
  // *** FIXED: BULK UPLOAD WITH OVERRIDE PRICES ***
  const handleBulkUpload = (e) => { 
      const f = e.target.files[0]; 
      if (!f) return; 
      setUploadLog(["Reading..."]); 
      setLoading(true); 
      const r = new FileReader(); 
      r.onload = async (evt) => { 
          try { 
              const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]); 
              if (!d.length) { setLoading(false); return; } 
              const logs = []; 
              const productIdsSeen = new Set();

              for (const row of d) { 
                  const clean = {}; 
                  Object.keys(row).forEach(k => clean[k.toLowerCase().trim()] = row[k]); 
                  
                  const pid = String(clean['product_id']).trim(); 
                  const sz = String(clean['size']).trim(); 
                  const cnt = parseInt(clean['count']); 
                  const cst = clean['cost_price'] ? parseFloat(clean['cost_price']) : 8.50; 
                  
                  // NEW: Capture Override Price (looks for 'override_price' or 'price')
                  // If cell is empty, we send null (which clears the override)
                  let ovr = null;
                  if (clean['override_price']) ovr = parseFloat(clean['override_price']);
                  else if (clean['price']) ovr = parseFloat(clean['price']);
                  
                  // 1. ENSURE PARENT PRODUCT EXISTS
                  if (!productIdsSeen.has(pid)) {
                      productIdsSeen.add(pid);
                      const { data: existingProd } = await supabase.from('products').select('id').eq('id', pid).single();
                      if (!existingProd) {
                          await supabase.from('products').insert([{
                              id: pid,
                              name: clean['_reference_name'] || pid.replace(/_/g, ' ').toUpperCase(),
                              base_price: 30, 
                              type: 'top', 
                              sort_order: 99
                          }]);
                          logs.push(`✅ Created Parent: ${pid}`);
                      }
                  }

                  // 2. UPDATE INVENTORY
                  const { data: ex } = await supabase.from('inventory').select('product_id').eq('product_id', pid).eq('size', sz).eq('event_slug', selectedEventSlug).maybeSingle(); 
                  
                  if (ex) { 
                      // Update existing stock + price
                      await supabase.from('inventory').update({ 
                          count: cnt, 
                          cost_price: cst,
                          override_price: ovr // <--- SAVING PRICE
                      }).eq('product_id', pid).eq('size', sz).eq('event_slug', selectedEventSlug); 
                      
                      logs.push(`Updated: ${pid} ${sz} (Stock: ${cnt}, Price: ${ovr || 'Default'})`); 
                  } else { 
                      // Create new stock + price
                      await supabase.from('inventory').insert([{ 
                          product_id: pid, 
                          size: sz, 
                          count: cnt, 
                          cost_price: cst, 
                          override_price: ovr, // <--- SAVING PRICE
                          active: true,
                          event_slug: selectedEventSlug
                      }]); 
                      logs.push(`Created: ${pid} ${sz}`); 
                  } 
              } 
              setUploadLog(logs); 
              fetchInventory(); 
          } catch (e) { 
              setUploadLog([e.message]); 
          } 
          setLoading(false); 
      }; 
      r.readAsBinaryString(f); 
  };

  // *** NEW: REPAIR UTILITY ***
  const fixOrphanedProducts = async () => {
      setLoading(true);
      const { data: inv } = await supabase.from('inventory').select('product_id');
      const { data: prods } = await supabase.from('products').select('id');
      
      const invIds = [...new Set(inv.map(i => i.product_id))];
      const prodIds = prods.map(p => p.id);
      const missing = invIds.filter(id => !prodIds.includes(id));

      if(missing.length > 0) {
          const newProds = missing.map(id => ({
              id: id,
              name: id.replace(/_/g, ' ').toUpperCase(),
              base_price: 30,
              type: 'top',
              sort_order: 99
          }));
          await supabase.from('products').insert(newProds);
          alert(`Fixed ${missing.length} missing products!`);
          fetchInventory();
      } else {
          alert("All data is healthy!");
      }
      setLoading(false);
  };

  if (!mounted) return <div className="p-10 text-center text-gray-500 font-bold">Loading Admin Dashboard...</div>;
  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center bg-gray-100"><form onSubmit={handleLogin} className="bg-white p-8 rounded shadow"><h1 className="text-xl font-bold mb-4">Admin Login</h1><input type="password" onChange={e => setPasscode(e.target.value)} className="border p-2 w-full rounded" placeholder="Password"/></form></div>;

  // *** VISIBLE ORDERS FILTER: CONTROLLABLE ***
  const visibleOrders = orders.filter(o => {
      // Toggle logic
      if (!hideUnpaid) return o.status !== 'completed' && o.status !== 'refunded';

      const pStatus = (o.payment_status || '').toLowerCase();
      const isHostedEvent = paymentMode === 'hosted';
      // If HOSTED, trust the order exists. If RETAIL, require payment or free.
      const isPaid = isHostedEvent 
          ? (o.status !== 'incomplete' && o.status !== 'awaiting_payment') 
          : (pStatus === 'paid' || pStatus === 'succeeded' || Number(o.total_price) === 0 || (pStatus === '' && o.status === 'pending'));
      
      return isPaid && o.status !== 'completed' && o.status !== 'refunded';
  });

  const historyOrders = Array.isArray(orders) ? orders.filter(o => o.status === 'completed' || o.status === 'refunded') : [];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black font-sans">
      <audio ref={audioRef} src="/ding.mp3" preload="auto" />
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex flex-col">
              <h1 className="text-3xl font-black text-gray-900">{eventName || 'Admin Dashboard'}</h1>
              <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-gray-500 uppercase">Viewing Event:</span>
                  <select 
                      value={selectedEventSlug} 
                      onChange={(e) => setSelectedEventSlug(e.target.value)} 
                      className="bg-white border border-gray-300 text-sm font-bold rounded py-1 px-2 cursor-pointer shadow-sm hover:border-blue-500"
                  >
                      {availableEvents.map(evt => (
                          <option key={evt.id} value={evt.slug}>
                              {evt.event_name} ({evt.slug})
                          </option>
                      ))}
                  </select>
              </div>
          </div>
          <div className="flex bg-white rounded-lg p-1 shadow border border-gray-300">
            {['orders', 'history', 'inventory', 'guests', 'logos', 'terminals', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded font-bold ${activeTab === tab ? 'bg-blue-900 text-white' : 'hover:bg-gray-100'}`}>{tab}</button>
            ))}
          </div>
        </div>

        {activeTab === 'orders' && ( <div className="space-y-6"> 
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4"> 
            <div className="bg-white p-4 rounded shadow border-l-4 border-green-500"><p className="text-xs text-gray-500 font-bold uppercase">Gross Revenue</p><p className="text-3xl font-black text-green-700">${stats.revenue.toFixed(2)}</p></div> 
            <div className="bg-white p-4 rounded shadow border-l-4 border-blue-500"><p className="text-xs text-gray-500 font-bold uppercase">Paid Orders</p><p className="text-3xl font-black text-blue-900">{stats.count}</p></div> 
            <div className="bg-white p-4 rounded shadow border-l-4 border-pink-500"><p className="text-xs text-gray-500 font-bold uppercase">Est. Net Profit</p><p className="text-3xl font-black text-pink-600">${stats.net.toFixed(2)}</p></div>
            
            {/* TOGGLES UI */}
            <div className="bg-white p-4 rounded shadow border-l-4 border-purple-500 flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" id="autoPrint" checked={autoPrintEnabled} onChange={(e) => setAutoPrintEnabled(e.target.checked)} className="w-4 h-4 accent-blue-900 cursor-pointer" />
                    <label htmlFor="autoPrint" className="text-xs font-black text-gray-800 cursor-pointer uppercase">Auto-Print Paid</label>
                </div>
                <div className="flex items-center gap-2 border-t pt-2">
                    <input type="checkbox" id="hideUnpaid" checked={hideUnpaid} onChange={(e) => setHideUnpaid(e.target.checked)} className="w-4 h-4 accent-red-600 cursor-pointer" />
                    <label htmlFor="hideUnpaid" className="text-xs font-bold text-red-600 cursor-pointer uppercase">Hide Unpaid</label>
                </div>
            </div> 
          </div> 
          <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300 overflow-x-auto"> 
            <table className="w-full text-left min-w-[800px]"><thead className="bg-gray-200"><tr><th className="p-4 w-40">Status</th><th className="p-4">Date</th><th className="p-4">Customer</th><th className="p-4">Items</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>{visibleOrders.map((order) => {
                const safeItems = Array.isArray(order.cart_data) ? order.cart_data : [];
                
                // *** VISUAL LOGIC: HYBRID ***
                const pStatus = (order.payment_status || '').toLowerCase();
                const isHostedEvent = paymentMode === 'hosted';
                const isPaid = isHostedEvent
                    ? (order.status !== 'incomplete' && order.status !== 'awaiting_payment')
                    : (pStatus === 'paid' || pStatus === 'succeeded' || Number(order.total_price) === 0 || (pStatus === '' && order.status === 'pending'));
                
                const displayPaymentLabel = isPaid ? (isHostedEvent ? 'HOSTED' : 'PAID') : 'UNPAID';
                const displayColor = isPaid ? 'text-green-600' : 'text-red-500';

                return (
                <tr key={order.id} className={`border-b hover:bg-gray-50 ${order.printed ? 'bg-gray-50' : 'bg-white'}`}>
                    <td className="p-4 align-top">
                        <select value={order.status || 'pending'} onChange={(e) => handleStatusChange(order.id, e.target.value)} className={`p-2 rounded border-2 uppercase font-bold text-xs ${STATUSES[order.status || 'pending']?.color}`}>{Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                        <div className={`text-[10px] uppercase font-bold mt-1 ${displayColor}`}>{displayPaymentLabel}</div>
                    </td>
                    <td className="p-4 align-top text-sm text-gray-500 font-medium" suppressHydrationWarning>{new Date(order.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                    <td className="p-4 align-top"><div className="font-bold">{order.customer_name}</div><div className="text-sm">{order.phone}</div></td>
                    <td className="p-4 align-top text-sm">{safeItems.map((item, i) => {
                        const customs = item?.customizations || {};
                        return ( <div key={i} className="mb-2 border-b border-gray-100 pb-1 last:border-0"><span className="font-bold">{item?.productName}</span> ({item?.size})<div className="text-xs text-gray-500 mt-1">{customs.logos?.map(l => l.type).join(', ')} {customs.names?.map(n => n.text).join(', ')}</div></div> );
                    })}<div className="mt-2 text-right font-black text-green-800">${order.total_price}</div></td>
                    <td className="p-4 align-top text-right">
                        <button onClick={() => openEditModal(order)} className="p-2 rounded mr-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold">✏️</button>
                        {order.status !== 'refunded' && order.payment_intent_id && ( <button onClick={() => handleRefund(order.id, order.payment_intent_id)} className="p-2 rounded mr-2 bg-red-50 text-red-500 hover:bg-red-100 font-bold">💸</button> )}
                        <button onClick={() => printLabel(order)} className={`p-2 rounded mr-2 font-bold ${order.printed ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 text-black hover:bg-blue-100'}`}>🖨️</button>
                        <button onClick={() => deleteOrder(order.id, order.cart_data)} className="text-red-500 hover:text-red-700 font-bold text-lg">🗑️</button>
                    </td>
                </tr>
            )})}</tbody></table> 
          </div> 
        </div> )}

        {activeTab === 'history' && ( <div> <div className="bg-gray-800 text-white p-4 rounded-t-lg flex justify-between items-center"><h2 className="font-bold text-xl">Order Archive (Completed)</h2><button onClick={downloadCSV} className="bg-white text-black px-4 py-2 rounded font-bold hover:bg-gray-200 text-sm">📥 Download CSV</button></div> <div className="bg-white shadow rounded-b-lg overflow-hidden border border-gray-300 overflow-x-auto"> {historyOrders.length === 0 ? <div className="p-8 text-center text-gray-500">History is empty.</div> : ( <table className="w-full text-left min-w-[800px]"> <thead className="bg-gray-100 text-gray-500"> <tr> <th className="p-4">Event Name</th> <th className="p-4">Date</th> <th className="p-4">Customer</th> <th className="p-4">Items</th> <th className="p-4 text-right">Total</th> </tr> </thead> <tbody> {historyOrders.map((order) => { const safeItems = Array.isArray(order.cart_data) ? order.cart_data : []; return ( <tr key={order.id} className="border-b hover:bg-gray-50 opacity-75"> <td className="p-4 font-bold text-blue-900">{order.event_name || '-'}</td> <td className="p-4 text-sm" suppressHydrationWarning>{new Date(order.created_at).toLocaleString()}</td> <td className="p-4 font-bold">{order.customer_name}</td> <td className="p-4 text-sm">{safeItems.map(i => i?.productName).join(', ')}</td> <td className="p-4 text-right font-bold">${order.total_price}</td> </tr> ); })} </tbody> </table>)} </div> </div> )}

        {activeTab === 'inventory' && (
            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                        <h2 className="font-bold text-xl mb-4">Add New Item</h2>
                        <form onSubmit={handleAddProductWithSizeUpdates} className="space-y-3">
                            <div><label className="text-xs font-bold uppercase">ID (Unique)</label><input className="w-full border p-2 rounded" placeholder="e.g. jogger_grey" value={newProdId} onChange={e => setNewProdId(e.target.value)} /></div>
                            <div><label className="text-xs font-bold uppercase">Display Name</label><input className="w-full border p-2 rounded" placeholder="e.g. Grey Joggers" value={newProdName} onChange={e => setNewProdName(e.target.value)} /></div>
                            <div>
                                <label className="text-xs font-bold uppercase">Garment Type</label>
                                <select className="w-full border p-2 rounded bg-white" value={newProdType} onChange={e => setNewProdType(e.target.value)}>
                                    <option value="top">Top (Hoodie, Tee)</option>
                                    <option value="bottom">Bottom (Joggers, Shorts)</option>
                                </select>
                            </div>
                            <div><label className="text-xs font-bold uppercase">Image URL (Optional)</label><input className="w-full border p-2 rounded" placeholder="https://..." value={newProdImage} onChange={e => setNewProdImage(e.target.value)} /></div>
                            
                            {/* FIX: COST & PRICE INPUTS */}
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="text-xs font-bold uppercase">Price ($)</label><input type="number" className="w-full border p-2 rounded" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} /></div>
                                <div><label className="text-xs font-bold uppercase">Unit Cost ($)</label><input type="number" className="w-full border p-2 rounded" value={newProdCost} onChange={e => setNewProdCost(e.target.value)} /></div>
                            </div>

                            <button className="w-full bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700">Create Product</button>
                        </form>
                    </div>
                    <div className="bg-blue-50 p-6 rounded-lg shadow border border-blue-200">
                        <h2 className="font-bold text-lg mb-2 text-blue-900">📦 Bulk Stock Update</h2>
                        <div className="flex gap-2 mb-4">
                            <button onClick={downloadTemplate} className="text-xs bg-white border border-blue-300 px-3 py-1 rounded text-blue-700 font-bold hover:bg-blue-50">⬇️ Download Current Stock</button>
                            <button onClick={fixOrphanedProducts} className="text-xs bg-red-100 border border-red-300 px-3 py-1 rounded text-red-700 font-bold hover:bg-red-200">🛠️ Fix Missing Items</button>
                        </div>
                        <input type="file" accept=".xlsx, .xls" onChange={handleBulkUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200" />
                        {uploadLog.length > 0 && (<div className="mt-4 p-2 bg-black text-green-400 text-xs font-mono h-48 overflow-y-auto rounded border border-gray-700">{uploadLog.map((log, i) => <div key={i} className="mb-1 border-b border-gray-800 pb-1">{log}</div>)}</div>)}
                    </div>
                </div>
                <div className="md:col-span-2 space-y-6">
                    {/* FIX: Editable "Manage Prices" Table with Scrollbars */}
                    <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300 flex flex-col h-[600px]">
                        <div className="bg-blue-900 text-white p-4 font-bold uppercase text-sm tracking-wide shrink-0">Manage Product Info</div>
                        <div className="overflow-y-auto flex-1">
                            <table className="w-full text-left">
                                <thead className="bg-gray-100 border-b sticky top-0"><tr><th className="p-3 w-16">Img URL</th><th className="p-3">Product Name</th><th className="p-3 w-24">Price ($)</th><th className="p-3 text-right">Action</th></tr></thead>
                                <tbody>
                                    {products.map((prod) => (
                                        <tr key={prod.id} className="border-b hover:bg-gray-50">
                                            <td className="p-3">
                                                <div className="flex flex-col gap-1">
                                                    {prod.image_url ? <img src={prod.image_url} className="w-10 h-10 object-contain border bg-gray-50" /> : <div className="w-10 h-10 bg-gray-200 flex items-center justify-center text-[10px]">No Img</div>}
                                                    <input className="text-[10px] border p-1 w-full" placeholder="URL" value={prod.image_url || ''} onChange={(e) => updateProductInfo(prod.id, 'image_url', e.target.value)} />
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <input className="font-bold text-gray-700 border p-2 w-full rounded" value={prod.name} onChange={(e) => updateProductInfo(prod.id, 'name', e.target.value)} />
                                                <div className="text-xs text-gray-400 mt-1">ID: {prod.id}</div>
                                            </td>
                                            <td className="p-3">
                                                <input type="number" className="w-20 border border-gray-300 rounded p-1 font-bold text-black" value={prod.base_price || 0} onChange={(e) => updateProductInfo(prod.id, 'base_price', parseFloat(e.target.value))} />
                                            </td>
                                            <td className="p-3 text-right"><button onClick={() => deleteProduct(prod.id)} className="text-red-500 hover:text-red-700 font-bold" title="Delete Product">🗑️</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {/* Stock Table with Scrollbars */}
                    {/* Stock Table with Event Pricing */}
<div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300 flex flex-col h-[600px]">
    <div className="bg-gray-800 text-white p-4 font-bold uppercase text-sm tracking-wide shrink-0">
        Manage Stock & Prices ({selectedEventSlug})
    </div>
    <div className="overflow-y-auto flex-1">
        <table className="w-full text-left">
            <thead className="bg-gray-100 border-b sticky top-0">
                <tr>
                    <th className="p-4">Product</th>
                    <th className="p-4">Size</th>
                    <th className="p-4 text-center">Cost ($)</th>
                    <th className="p-4 text-center">Event Price ($)</th>
                    <th className="p-4 text-center">Stock</th>
                    <th className="p-4 text-center">Active</th>
                </tr>
            </thead>
            <tbody>
                {inventory.map((item) => {
                    // Find Global Price for reference
                    const globalProd = products.find(p => p.id === item.product_id);
                    const globalPrice = globalProd ? globalProd.base_price : 0;

                    return (
                        <tr key={`${item.product_id}_${item.size}`} className={`border-b ${!item.active ? 'bg-gray-100 opacity-50' : ''}`}>
                            <td className="p-4 font-bold text-sm">
                                {getProductName(item.product_id)}
                                <div className="text-[10px] text-gray-400">Global: ${globalPrice}</div>
                            </td>
                            <td className="p-4 text-sm">{item.size}</td>
                            
                            {/* Cost Input */}
                            <td className="p-4">
                                <input 
                                    type="number" 
                                    className="mx-auto block w-16 border rounded text-center text-sm" 
                                    value={item.cost_price || ''} 
                                    placeholder="8.50"
                                    onChange={(e) => updateStock(item.product_id, item.size, 'cost_price', parseFloat(e.target.value))} 
                                />
                            </td>

                            {/* NEW: Event Price Input */}
                            <td className="p-4">
                                <input 
                                    type="number" 
                                    className={`mx-auto block w-20 border rounded text-center font-bold ${item.override_price ? 'bg-green-50 text-green-800 border-green-300' : 'bg-gray-50'}`}
                                    value={item.override_price || ''} 
                                    placeholder={globalPrice} // Shows global price as ghost text
                                    onChange={(e) => updateStock(item.product_id, item.size, 'override_price', e.target.value ? parseFloat(e.target.value) : null)} 
                                />
                            </td>

                            {/* Stock Input */}
                            <td className="p-4">
                                <input 
                                    type="number" 
                                    className="mx-auto block w-16 border text-center font-bold" 
                                    value={item.count} 
                                    onChange={(e) => updateStock(item.product_id, item.size, 'count', parseInt(e.target.value))} 
                                />
                            </td>

                            {/* Active Toggle */}
                            <td className="p-4 text-center">
                                <input 
                                    type="checkbox" 
                                    checked={item.active ?? true} 
                                    onChange={(e) => updateStock(item.product_id, item.size, 'active', e.target.checked)} 
                                    className="w-5 h-5 cursor-pointer" 
                                />
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
</div>
                </div>
            </div>
        )}

        {/* ... (GUESTS, LOGOS, SETTINGS, EDIT MODAL remain exactly as before) ... */}
{activeTab === 'guests' && (
            <div className="max-w-4xl mx-auto">
                
                {/* --- NEW: QUICK ADD & BULK UPLOAD --- */}
                <div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200">
                    <h2 className="font-bold text-xl mb-4">Manage Guest List</h2>
                    
                    {/* Option 1: Quick Add Single Guest */}
                    <form onSubmit={addSingleGuest} className="flex gap-4 mb-6 pb-6 border-b border-gray-100">
                        <input 
                            className="flex-1 border p-2 rounded text-lg" 
                            placeholder="Type Name (e.g. John Doe)" 
                            value={newGuestName} 
                            onChange={e => setNewGuestName(e.target.value)} 
                        />
                        <button className="bg-green-600 text-white font-bold px-6 py-2 rounded hover:bg-green-700">
                            ➕ Add Guest
                        </button>
                    </form>

                    {/* Option 2: Bulk Upload */}
                    <div className="flex gap-4 items-center">
                        <div className="flex-1">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-1">Bulk Upload (Excel)</p>
                            <input type="file" accept=".xlsx, .xls" onChange={handleGuestUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                        </div>
                        <button onClick={clearGuestList} className="text-red-600 font-bold text-sm whitespace-nowrap border border-red-200 px-3 py-2 rounded hover:bg-red-50">
                            🗑️ Clear All Guests
                        </button>
                    </div>
                </div>

                {/* --- GUEST LIST TABLE (Unchanged) --- */}
                <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300">
                    <table className="w-full text-left">
                        <thead className="bg-gray-100 border-b">
                            <tr>
                                <th className="p-4">Guest Name</th>
                                <th className="p-4">Pre-Size</th>
                                <th className="p-4 text-center">Status</th>
                                <th className="p-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.isArray(guests) && guests.length === 0 ? (
                                <tr><td colSpan="4" className="p-8 text-center text-gray-500">No guests found.</td></tr>
                            ) : (
                                Array.isArray(guests) && guests.map((guest) => (
                                    <tr key={guest.id} className="border-b hover:bg-gray-50">
                                        <td className="p-4 font-bold">{guest.name}</td>
                                        <td className="p-4 font-mono text-sm text-blue-800">{guest.size || '-'}</td>
                                        <td className="p-4 text-center">
                                            {guest.has_ordered ? 
                                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">REDEEMED</span> : 
                                                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">Waiting</span>
                                            }
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-3">
                                                <button 
                                                    onClick={() => resetGuest(guest.id)} 
                                                    className="text-blue-600 hover:text-blue-800 font-bold text-xs underline"
                                                    title="Reset status to 'Waiting'"
                                                >
                                                    Reset
                                                </button>
                                                <button 
                                                    onClick={() => deleteGuest(guest.id, guest.name)} 
                                                    className="text-red-500 hover:text-red-700 font-bold text-lg leading-none"
                                                    title="Remove Guest"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}        {activeTab === 'logos' && (<div className="max-w-4xl mx-auto"><div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200"><h2 className="font-bold text-xl mb-4">Add New Logo Option</h2><form onSubmit={addLogo} className="grid md:grid-cols-2 gap-4"><input className="border p-2 rounded" placeholder="Name (e.g. State Champs)" value={newLogoName} onChange={e => setNewLogoName(e.target.value)} /><input className="border p-2 rounded" placeholder="Image URL (http://...)" value={newLogoUrl} onChange={e => setNewLogoUrl(e.target.value)} /><div className="col-span-2 flex items-center gap-6 bg-gray-50 p-2 rounded border border-gray-200"><span className="font-bold text-gray-700 text-sm">Type:</span><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="cat" checked={newLogoCategory === 'main'} onChange={() => setNewLogoCategory('main')} className="w-4 h-4" /><span className="text-sm">Main Design (Free)</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="cat" checked={newLogoCategory === 'accent'} onChange={() => setNewLogoCategory('accent')} className="w-4 h-4" /><span className="text-sm">Accent (+$5.00)</span></label></div><div className="col-span-2 flex items-center gap-6 bg-blue-50 p-2 rounded border border-blue-100">
    <span className="font-bold text-blue-900 text-sm">Visual Size:</span>
    <label className="flex items-center gap-2 cursor-pointer">
        <input type="radio" name="place" checked={newLogoPlacement === 'large'} onChange={() => setNewLogoPlacement('large')} className="w-4 h-4" />
        <span className="text-sm">Large (Full Front/Center)</span>
    </label>
    <label className="flex items-center gap-2 cursor-pointer">
        <input type="radio" name="place" checked={newLogoPlacement === 'small'} onChange={() => setNewLogoPlacement('small')} className="w-4 h-4" />
        <span className="text-sm">Small (Pocket/Chest)</span>
    </label>
</div>
<button className="bg-blue-900 text-white font-bold px-6 py-2 rounded hover:bg-blue-800 col-span-2">Add Logo</button></form></div><div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300"><table className="w-full text-left"><thead className="bg-gray-800 text-white"><tr><th className="p-4">Preview</th><th className="p-4">Label</th><th className="p-4">Type</th><th className="p-4 text-center">Visible?</th><th className="p-4 text-right">Action</th></tr></thead><tbody>{logos.map((logo) => (<tr key={logo.id} className="border-b hover:bg-gray-50"><td className="p-4">{logo.image_url ? <img src={logo.image_url} alt={logo.label} className="w-12 h-12 object-contain border rounded bg-gray-50" /> : <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-xs">No Img</div>}</td><td className="p-4 font-bold text-lg">{logo.label}</td><td className="p-4"><span className={`text-xs font-bold px-2 py-1 rounded uppercase ${logo.category === 'main' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{logo.category || 'accent'}</span></td><td className="p-4 text-center"><input type="checkbox" checked={logo.active} onChange={() => toggleLogo(logo.id, logo.active)} className="w-6 h-6 cursor-pointer" /></td><td className="p-4 text-right"><button onClick={() => deleteLogo(logo.id)} className="text-red-500 hover:text-red-700 font-bold" title="Delete Logo">🗑️</button></td></tr>))}</tbody></table></div></div>)}
        {activeTab === 'terminals' && (
            <div className="max-w-4xl mx-auto">
                <div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200">
                    <h2 className="font-bold text-xl mb-4">Manage Terminals</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        <input className="border p-2 rounded" placeholder="Kiosk Label (e.g. Front Desk Left)" value={newTermLabel} onChange={e => setNewTermLabel(e.target.value)} />
                        <input className="border p-2 rounded" placeholder="Square Device ID (tm_...)" value={newTermId} onChange={e => setNewTermId(e.target.value)} />
                        <button onClick={addTerminal} className="bg-blue-900 text-white font-bold px-6 py-2 rounded hover:bg-blue-800 col-span-2">Add Terminal</button>
                    </div>
                </div>
                <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300">
                    <table className="w-full text-left">
                        <thead className="bg-gray-800 text-white"><tr><th className="p-4">Label</th><th className="p-4">Device ID</th><th className="p-4 text-right">Action</th></tr></thead>
                        <tbody>
                            {terminals.map((t) => (
                                <tr key={t.id} className="border-b hover:bg-gray-50">
                                    <td className="p-4 font-bold">{t.label}</td>
                                    <td className="p-4 font-mono text-sm text-gray-600">{t.device_id}</td>
                                    <td className="p-4 text-right"><button onClick={() => deleteTerminal(t.id)} className="text-red-500 hover:text-red-700 font-bold">🗑️</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
        {activeTab === 'settings' && (
            <div className="max-w-xl mx-auto"><div className="bg-white p-8 rounded-lg shadow border border-gray-200"><h2 className="font-bold text-2xl mb-6">Event Settings</h2>
            
            <div className="mb-4"><label className="block text-gray-700 font-bold mb-2">Event Name</label><input className="w-full border p-3 rounded text-lg" placeholder="e.g. 2026 Winter Regionals" value={eventName} onChange={e => setEventName(e.target.value)} /></div>
            <div className="mb-6"><label className="block text-gray-700 font-bold mb-2">Event Logo URL</label><input className="w-full border p-3 rounded text-lg" placeholder="https://..." value={eventLogo} onChange={e => setEventLogo(e.target.value)} />{eventLogo && <img src={eventLogo} className="mt-4 h-24 mx-auto border rounded p-2" />}</div>
            <div className="mb-6"><label className="block text-gray-700 font-bold mb-2">Header Color</label><div className="flex gap-4 items-center"><input type="color" className="w-16 h-10 cursor-pointer border rounded" value={headerColor} onChange={e => setHeaderColor(e.target.value)} /><span className="text-sm text-gray-500">{headerColor}</span></div></div>
            
            <div className="mb-6 bg-purple-50 p-4 rounded border border-purple-200"><label className="block text-purple-900 font-bold mb-3 border-b border-purple-200 pb-2">Cloud Printing (PrintNode)</label><div className="flex items-center justify-between mb-3"><span className="text-gray-800">Enable Cloud Print?</span><input type="checkbox" checked={pnEnabled} onChange={e => setPnEnabled(e.target.checked)} className="w-5 h-5" /></div>{pnEnabled && (<div className="space-y-3"><input className="w-full p-2 border rounded text-sm" placeholder="API Key" value={pnApiKey} onChange={e => setPnApiKey(e.target.value)} /><div className="flex gap-2"><input className="flex-1 p-2 border rounded text-sm" placeholder="Printer ID" value={pnPrinterId} onChange={e => setPnPrinterId(e.target.value)} /><button onClick={discoverPrinters} className="bg-purple-600 text-white px-3 text-xs rounded font-bold">Find</button></div>{availablePrinters.length > 0 && (<div className="bg-white border p-2 rounded max-h-32 overflow-y-auto">{availablePrinters.map(p => (<div key={p.id} className="text-xs p-1 hover:bg-gray-100 cursor-pointer flex justify-between" onClick={() => setPnPrinterId(p.id)}><span>{p.name}</span><span className="font-mono text-gray-500">{p.id}</span></div>))}</div>)}</div>)}</div>
            <div className="mb-6 bg-gray-100 p-4 rounded border border-gray-200"><label className="block text-gray-800 font-bold mb-3 border-b border-gray-300 pb-2">Printer Output (Local)</label><div className="space-y-2"><label className="flex items-center gap-3 cursor-pointer"><input type="radio" name="printer_type" value="label" checked={printerType === 'label'} onChange={() => setPrinterType('label')} className="w-5 h-5 text-gray-900" /><div><span className="font-bold block text-gray-800">Thermal Label (4x6)</span><span className="text-xs text-gray-500">Standard for fast packing.</span></div></label><label className="flex items-center gap-3 cursor-pointer"><input type="radio" name="printer_type" value="standard" checked={printerType === 'standard'} onChange={() => setPrinterType('standard')} className="w-5 h-5 text-gray-900" /><div><span className="font-bold block text-gray-800">Standard Sheet (8.5x11)</span><span className="text-xs text-gray-500">Large font packing slip for laser printers.</span></div></label></div></div>
            
            {/* UPDATED PAYMENT SETTINGS */}
            <div className="mb-6 bg-blue-50 p-4 rounded border border-blue-200">
                <label className="block text-blue-900 font-bold mb-3 border-b border-blue-200 pb-2">Payment Mode</label>
                <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" name="payment_mode" value="retail" checked={paymentMode === 'retail'} onChange={() => setPaymentMode('retail')} className="w-5 h-5 text-blue-900" />
                        <div><span className="font-bold block text-gray-800">Retail (Stripe / Square)</span><span className="text-xs text-gray-500">Collect credit card payments from guests.</span></div>
                    </label>
                    
                    {/* NEW SUB-OPTION FOR RETAIL */}
                    {paymentMode === 'retail' && (
                        <div className="ml-8 bg-white p-3 rounded border border-blue-100 flex gap-4">
                            <span className="text-sm font-bold text-gray-600">Checkout Method:</span>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="retail_method" value="stripe" checked={retailPaymentMethod === 'stripe'} onChange={() => setRetailPaymentMethod('stripe')} className="w-4 h-4 text-purple-600" />
                                <span className="text-sm font-bold">Stripe Link (SMS/Email)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="retail_method" value="terminal" checked={retailPaymentMethod === 'terminal'} onChange={() => setRetailPaymentMethod('terminal')} className="w-4 h-4 text-green-600" />
                                <span className="text-sm font-bold">Square Terminal</span>
                            </label>
                        </div>
                    )}

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" name="payment_mode" value="hosted" checked={paymentMode === 'hosted'} onChange={() => setPaymentMode('hosted')} className="w-5 h-5 text-blue-900" />
                        <div><span className="font-bold block text-gray-800">Hosted (Party Mode)</span><span className="text-xs text-gray-500">Guests pay $0. Value is tracked for host invoice.</span></div>
                    </label>
                </div>
            </div>
            
            <div className="mb-6 bg-gray-50 p-4 rounded border"><label className="block text-gray-700 font-bold mb-3 border-b pb-2">Customization Options</label><div className="flex items-center justify-between mb-3"><span className="font-bold text-gray-800">Offer Back Name List?</span><input type="checkbox" checked={offerBackNames} onChange={(e) => setOfferBackNames(e.target.checked)} className="w-6 h-6" /></div><div className="flex items-center justify-between mb-3"><span className="font-bold text-gray-800">Offer Metallic Upgrade?</span><input type="checkbox" checked={offerMetallic} onChange={(e) => setOfferMetallic(e.target.checked)} className="w-6 h-6" /></div><div className="flex items-center justify-between"><span className="font-bold text-gray-800">Offer Custom Names?</span><input type="checkbox" checked={offerPersonalization} onChange={(e) => setOfferPersonalization(e.target.checked)} className="w-6 h-6" /></div></div><button onClick={saveSettings} className="w-full bg-blue-900 text-white font-bold py-3 rounded text-lg hover:bg-blue-800 shadow mb-8">Save Changes</button><div className="border-t pt-6 mt-6"><h3 className="font-bold text-red-700 mb-2 uppercase text-sm">Danger Zone</h3><button onClick={closeEvent} className="w-full bg-red-100 text-red-800 font-bold py-3 rounded border border-red-300 hover:bg-red-200">🏁 Close Event (Archive All)</button></div></div></div>
        )}

        {editingOrder && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div className="p-6 border-b flex justify-between bg-gray-50 rounded-t-xl"><h2 className="font-bold text-lg">Edit Order #{String(editingOrder.id).slice(0,8)}</h2><button onClick={closeEditModal} className="text-2xl text-gray-500 hover:text-black">×</button></div>
                    <div className="p-6 space-y-6">
                        <div className="bg-blue-50 p-4 rounded border border-blue-100"><label className="block text-xs font-bold uppercase text-blue-900 mb-1">Customer Name</label><input className="w-full p-2 border rounded font-bold" value={editingOrder.customer_name} onChange={(e) => handleEditChange('customer_name', e.target.value)} /></div>
                        {editingOrder.cart_data.map((item, idx) => (
                            <div key={idx} className="bg-white p-4 border rounded-lg shadow-sm">
                                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                                    <span className="font-bold text-lg">{item.productName}</span>
                                    <select className="border-2 p-1 rounded font-bold bg-gray-50" value={item.size} onChange={(e) => handleEditItem(idx, 'size', e.target.value)}>{SIZE_ORDER.map(s => <option key={s} value={s}>{s}</option>)}</select>
                                </div>
                                <div className="mb-4"><div className="text-xs font-bold text-gray-500 uppercase mb-1">Main Design</div><select className="w-full border p-2 rounded font-bold" value={item.customizations?.mainDesign || ''} onChange={(e) => handleUpdateMainDesign(idx, e.target.value)} ><option value="">(None)</option>{logos.filter(l => l.category === 'main').map(l => ( <option key={l.id} value={l.label}>{l.label}</option> ))}</select></div>
                                <div className="space-y-2 mb-4"><div className="text-xs font-bold text-gray-500 uppercase">Accents ($5)</div>{item.customizations?.logos?.map((l, lIdx) => (<div key={lIdx} className="flex gap-2"><select className="border p-2 rounded flex-1 text-sm font-bold" value={l.type} onChange={(e) => handleUpdateAccent(idx, lIdx, 'type', e.target.value)}>{logos.map(opt => <option key={opt.id} value={opt.label}>{opt.label}</option>)}</select><select className="border p-2 rounded w-40 text-sm" value={l.position} onChange={(e) => handleUpdateAccent(idx, lIdx, 'position', e.target.value)}>{POSITIONS.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}</select></div>))}<button onClick={() => handleAddAccent(idx)} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded font-bold text-blue-600">+ Add Accent</button></div>
                                <div className="space-y-2"><div className="text-xs font-bold text-gray-500 uppercase">Personalization ($5)</div>{item.customizations?.names?.map((n, nIdx) => (<div key={nIdx} className="flex gap-2"><input className="border p-2 rounded flex-1 text-sm uppercase font-bold" value={n.text} onChange={(e) => handleEditName(idx, nIdx, e.target.value)} placeholder="NAME" /><select className="border p-2 rounded w-40 text-sm" value={n.position} onChange={(e) => handleUpdateNamePos(idx, nIdx, e.target.value)}>{POSITIONS.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}</select></div>))}<button onClick={() => handleAddName(idx)} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded font-bold text-blue-600">+ Add Name</button></div>
                            </div>
                        ))}
                    </div>
                    <div className="p-6 border-t flex justify-end gap-3 bg-gray-50 rounded-b-xl"><button onClick={closeEditModal} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded">Cancel</button><button onClick={saveOrderEdits} className={`px-6 py-2 text-white font-bold rounded shadow transition-colors ${newOrderTotal > originalOrderTotal ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`} >{loading ? "Saving..." : (newOrderTotal > originalOrderTotal ? `Save & Pay Difference ($${(newOrderTotal - originalOrderTotal).toFixed(2)})` : "Save Changes")}</button></div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
