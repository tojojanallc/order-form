// @ts-nocheck
'use client'; 

import React, { useState, useEffect } from 'react'; 
import { createClient } from '@supabase/supabase-js';
import { useParams } from 'next/navigation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const SIZE_ORDER = ['Youth XS', 'Youth S', 'Youth M', 'Youth L', 'Youth XL', 'Adult S', 'Adult M', 'Adult L', 'Adult XL', 'Adult XXL', 'Adult 3XL', 'Adult 4XL'];

const ZONES = {
    top: [
        { id: 'full_front', label: 'Full Front', type: 'logo' },
        { id: 'left_chest', label: 'Left Chest', type: 'logo' },
        { id: 'center_chest', label: 'Center Chest', type: 'logo' },
        { id: 'left_sleeve', label: 'Left Sleeve', type: 'both' },
        { id: 'right_sleeve', label: 'Right Sleeve', type: 'both' },
        { id: 'back_center', label: 'Back Center', type: 'both' },
        { id: 'back_bottom', label: 'Back Bottom', type: 'name' }
    ],
    bottom: [
        { id: 'left_thigh', label: 'Left Thigh (Upper)', type: 'both' },
        { id: 'right_thigh', label: 'Right Thigh (Upper)', type: 'both' },
        { id: 'back_pocket', label: 'Back Pocket', type: 'logo' },
        { id: 'rear', label: 'Rear (Center)', type: 'both' }           
    ]
};

export default function OrderForm() {
  const params = useParams();

  const [actualEventSlug, setActualEventSlug] = useState('');
  const [eventStock, setEventStock] = useState([]);
  const [products, setProducts] = useState([]); 

  const [cart, setCart] = useState([]); 
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [lastOrderId, setLastOrderId] = useState(''); 
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingZip, setShippingZip] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  
  const [isTerminalProcessing, setIsTerminalProcessing] = useState(false);
  const [terminalStatus, setTerminalStatus] = useState('');
  const [assignedTerminalId, setAssignedTerminalId] = useState('');

  const [guests, setGuests] = useState([]);
  const [selectedGuest, setSelectedGuest] = useState(null); 
  const [guestSearch, setGuestSearch] = useState('');
  const [guestError, setGuestError] = useState(''); 
  
  const [logoOptions, setLogoOptions] = useState([]); 
  const [mainOptions, setMainOptions] = useState([]); 
  const [accentOptions, setAccentOptions] = useState([]); 

  const [eventName, setEventName] = useState('Lev Custom Merch');
  const [eventLogo, setEventLogo] = useState('');
  const [headerColor, setHeaderColor] = useState('#1e3a8a'); 
  const [paymentMode, setPaymentMode] = useState('retail'); 
  const [retailPaymentMethod, setRetailPaymentMethod] = useState('stripe'); 
  const [showBackNames, setShowBackNames] = useState(true);
  const [showMetallic, setShowMetallic] = useState(true);
  const [showPersonalization, setShowPersonalization] = useState(true);
  const [showNumbers, setShowNumbers] = useState(true); 
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(0);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [size, setSize] = useState('');
  const [selectedMainDesign, setSelectedMainDesign] = useState(''); 
  const [logos, setLogos] = useState([]); 
  const [names, setNames] = useState([]);
  const [numbers, setNumbers] = useState([]); 
  const [backNameList, setBackNameList] = useState(false);
  const [metallicHighlight, setMetallicHighlight] = useState(false);
  const [backListConfirmed, setBackListConfirmed] = useState(false);
  const [metallicName, setMetallicName] = useState('');
  
  const [showSetup, setShowSetup] = useState(false);
  const [availableTerminals, setAvailableTerminals] = useState([]);

  // --- PLACEMENT FIX (SWEATSHIRT PROTECTION) ---
  const isBottomSelected = (() => {
      if (!selectedProduct) return false;
      const n = (selectedProduct.name || '').toLowerCase();
      const t = (selectedProduct.type || '').toLowerCase();
      if (n.includes('sweatshirt') || n.includes('hoodie')) return false; 
      if (t === 'bottom' || n.includes('jogger') || n.includes('pant') || n.includes('short')) return true;
      return false;
  })();

  const availableMainOptions = mainOptions.filter(opt => !(isBottomSelected && opt.placement === 'large'));
  const availableAccentOptions = accentOptions.filter(opt => !(isBottomSelected && opt.placement === 'large'));

  useEffect(() => {
    if (availableMainOptions.length === 1) setSelectedMainDesign(availableMainOptions[0].label);
    else if (availableMainOptions.length === 0) setSelectedMainDesign('');
  }, [selectedProduct, mainOptions]);

  // --- IRON-CLAD EVENT & DATA LOADER ---
  useEffect(() => {
    let resolvedSlug = params?.slug;
    if (!resolvedSlug && typeof window !== 'undefined') {
        const sp = new URLSearchParams(window.location.search);
        resolvedSlug = sp.get('event');
    }
    if (!resolvedSlug && typeof window !== 'undefined') {
        const parts = window.location.pathname.split('/').filter(Boolean);
        if (parts.length > 0 && parts[parts.length - 1] !== 'kiosk') {
            resolvedSlug = parts[parts.length - 1];
        }
    }
    const finalSlug = resolvedSlug || 'default';
    setActualEventSlug(finalSlug);

    const savedId = localStorage.getItem('square_terminal_id');
    if (savedId) setAssignedTerminalId(savedId);

    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('setup') === 'true') {
        setShowSetup(true); fetchTerminals(); 
    }

    const fetchData = async () => {
      if (!supabase) return;

      const { data: settings } = await supabase.from('event_settings').select('*').eq('slug', finalSlug).single();
      if (settings) {
        setEventName(settings.event_name); setEventLogo(settings.event_logo_url); setHeaderColor(settings.header_color || '#1e3a8a'); 
        setPaymentMode(settings.payment_mode || 'retail'); setRetailPaymentMethod(settings.retail_payment_method || 'stripe'); 
        setShowBackNames(settings.offer_back_names ?? true); setShowMetallic(settings.offer_metallic ?? true);
        setShowPersonalization(settings.offer_personalization ?? true); setShowNumbers(settings.offer_numbers ?? true);
        setTaxEnabled(settings.tax_enabled || false); setTaxRate(settings.tax_rate || 0);
      }

      // Load Master Products List
      const { data: productData } = await supabase.from('products').select('*').order('sort_order', { ascending: true });
      if (productData) setProducts(productData);

      // Load STRICT Event Stock
      const { data: invData } = await supabase.from('inventory').select('*').eq('event_slug', finalSlug).eq('active', true); 
      if (invData) setEventStock(invData);

      const { data: logoData } = await supabase.from('logos').select('*').eq('active', true).eq('event_slug', finalSlug).order('sort_order');
      if (logoData) {
          setLogoOptions(logoData);
          setMainOptions(logoData.filter(l => l.category === 'main'));
          setAccentOptions(logoData.filter(l => !l.category || l.category === 'accent'));
      }

      const { data: guestData } = await supabase.from('guests').select('*').eq('event_slug', finalSlug); 
      if (guestData) setGuests(guestData);
    };

    fetchData();
  }, [params]);

  const fetchTerminals = async () => {
      const { data } = await supabase.from('terminals').select('*');
      if (data) setAvailableTerminals(data);
  };

  const selectTerminal = (id) => {
      localStorage.setItem('square_terminal_id', id); setAssignedTerminalId(id);
      alert("✅ This iPad is now linked to terminal: " + id); setShowSetup(false);
  };

  const verifyGuest = () => {
      if (!guestSearch.trim()) return;
      setGuestError(''); const search = guestSearch.trim().toLowerCase();
      const match = guests.find(g => g.name.toLowerCase() === search);
      if (match) {
          if (match.has_ordered) { setGuestError("❌ This name has already redeemed their item."); setSelectedGuest(null); } 
          else { setSelectedGuest(match); setCustomerName(match.name); setGuestError(''); }
      } else { setGuestError("❌ Name not found. Please type your full name exactly."); setSelectedGuest(null); }
  };

  // --- PURE DROPDOWN LOGIC ---
  
  // 1. Only allow products that literally have a row in Event Stock
  const activeProductIds = Array.from(new Set(eventStock.map(item => item.product_id)));
  const visibleProducts = products.filter(p => activeProductIds.includes(p.id));

  useEffect(() => {
    if (visibleProducts.length > 0 && (!selectedProduct || !visibleProducts.find(p => p.id === selectedProduct.id))) {
        setSelectedProduct(visibleProducts[0]);
    } else if (visibleProducts.length === 0) {
        setSelectedProduct(null);
    }
  }, [visibleProducts, selectedProduct]);

  // 2. Only allow sizes that literally exist for this product in Event Stock
  const visibleSizes = selectedProduct ? eventStock
      .filter(inv => inv.product_id === selectedProduct.id && (paymentMode === 'hosted' ? inv.count > 0 : true))
      .map(inv => inv.size)
      .sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b)) : [];

  useEffect(() => {
    if (visibleSizes.length > 0 && selectedProduct) {
        if (!size || !visibleSizes.includes(size)) {
            if (paymentMode === 'hosted' && selectedGuest?.size && visibleSizes.includes(selectedGuest.size)) {
                setSize(selectedGuest.size);
            } else {
                setSize(visibleSizes[0]);
            }
        }
    }
  }, [selectedProduct, visibleSizes, size, paymentMode, selectedGuest]);

  // 3. Perfect Price & Stock calculation strictly from the row
  const currentInvRow = eventStock.find(i => i.product_id === selectedProduct?.id && i.size === size);
  const baseStock = currentInvRow ? currentInvRow.count : 0;
  const qtyInCart = cart.filter(item => item.productId === selectedProduct?.id && item.size === size).length;
  const currentStock = baseStock - qtyInCart;
  const isOutOfStock = currentStock <= 0;

  const calculateItemTotal = () => {
    if (!selectedProduct) return 0;
    
    let basePrice = selectedProduct.base_price;
    if (currentInvRow && currentInvRow.override_price !== null && currentInvRow.override_price !== undefined) {
        basePrice = currentInvRow.override_price;
    }
    
    return basePrice + (logos.length * 5) + (names.length * 5) + (numbers.length * 5) + (backNameList ? 5 : 0) + (metallicHighlight ? 5 : 0);
  };

  const getPositionOptions = (itemType, isAccent = false) => {
      if (!selectedProduct) return [];
      const pType = isBottomSelected ? 'bottom' : 'top';
      const availableZones = ZONES[pType] || ZONES.top;
      
      let options = [];
      if (itemType === 'logo') options = availableZones.filter(z => z.type === 'logo' || z.type === 'both');
      else if (itemType === 'name' || itemType === 'number') options = availableZones.filter(z => z.type === 'name' || z.type === 'both');
      else options = availableZones;
      
      if (isAccent && pType === 'top') {
          const forbidden = ['full_front', 'left_chest', 'center_chest'];
          options = options.filter(z => !forbidden.includes(z.id));
      }
      return options;
  };

  const calculateSubtotal = () => cart.reduce((sum, item) => sum + item.finalPrice, 0);
  const calculateTax = () => (!taxEnabled || paymentMode === 'hosted') ? 0 : calculateSubtotal() * (taxRate / 100);
  const calculateGrandTotal = () => calculateSubtotal() + calculateTax();

  const sendConfirmationSMS = async (name, phone) => {
      if (!phone || phone.length < 10) return;
      fetch('/api/send-sms', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phone, message: `Hi ${name}! Thanks for your order from Lev Custom Merch at ${eventName}. We will text you again when it's ready for pickup!` })
      }).catch(err => console.error("SMS Failed:", err));
  };

  const sendReceiptEmail = async (orderId, name, email, cartData, totalAmount) => {
      if (!email || !email.includes('@')) return;
      try {
          await fetch('/api/send-receipt', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, name, cart: cartData, total: totalAmount, orderId, eventName })
          });
      } catch (err) { console.error(`NETWORK ERROR: ${err.message}`); }
  };
  
  const handleAddToCart = () => {
    if (!selectedProduct) return;
    if (availableMainOptions.length > 0 && !selectedMainDesign) { alert("Please select a Design."); return; }
    
    const missingLogoPos = logos.some(l => !l.position);
    const missingNamePos = names.some(n => !n.position);
    const missingNumberPos = numbers.some(n => !n.position);
    if (missingLogoPos || missingNamePos || missingNumberPos) { alert("Please select a Position for every Accent, Name, and Number."); return; }

    const newItem = {
      id: Date.now(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      size: size,
      needsShipping: isOutOfStock, 
      custom_name: names.length > 0 ? names[0].text : (metallicHighlight ? metallicName : null),
      has_heat_sheet: backNameList,
      customizations: { 
          mainDesign: selectedMainDesign, logos, names, numbers, backList: backNameList, metallic: metallicHighlight, metallicName: metallicHighlight ? metallicName : ''
      },
      finalPrice: calculateItemTotal() 
    };
    
    setCart([...cart, newItem]);
    setLogos([]); setNames([]); setNumbers([]); setBackNameList(false); setMetallicHighlight(false); setBackListConfirmed(false); setMetallicName('');
    if (availableMainOptions.length > 1) setSelectedMainDesign(''); 
  };

  const removeItem = (itemId) => setCart(cart.filter(item => item.id !== itemId));
  const addLogo = (logoLabel) => { setLogos([...logos, { type: logoLabel, position: '' }]); };
  const updateLogo = (i, f, v) => { const n = [...logos]; n[i][f] = v; setLogos(n); };
  const updateName = (i, f, v) => { const n = [...names]; n[i][f] = v; setNames(n); };
  const updateNumber = (i, f, v) => { const n = [...numbers]; n[i][f] = v; setNumbers(n); };
  const cartRequiresShipping = cart.some(item => item.needsShipping);
  const getLogoImage = (type) => { const found = logoOptions.find(l => l.label === type); return found ? found.image_url : null; };

  const handleTerminalCheckout = async () => {
    if (cart.length === 0) return alert("Cart is empty");
    if (!customerName) return alert("Please enter Name");
    if (!assignedTerminalId) return alert("⚠️ SETUP ERROR: No Terminal ID assigned to this iPad.");
    if (!customerPhone) return alert("Please enter Phone Number for SMS Receipt.");

    setIsTerminalProcessing(true); setTerminalStatus("Creating Order...");

    try {
        const createRes = await fetch('/api/create-retail-order', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart, customerName, customerPhone, customerEmail, total: calculateGrandTotal(), taxCollected: calculateTax(), eventSlug: actualEventSlug, eventName })
        });
        if (!createRes.ok) throw new Error("Order creation failed");
        const orderData = await createRes.json();
        const orderId = orderData.orderId;
        setTerminalStatus("Sent to Terminal... Please Tap Card.");

        const payRes = await fetch('/api/terminal-pay', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: orderId, amount: calculateGrandTotal(), taxCollected: calculateTax(), deviceId: assignedTerminalId })
        });
        if (!payRes.ok) throw new Error("Terminal connection failed");

        const handleSuccess = () => {
            if (window.pollingRef) clearInterval(window.pollingRef);
            decrementInventory(cart);
            sendConfirmationSMS(customerName, customerPhone);
            sendReceiptEmail(orderId, customerName, customerEmail, cart, calculateGrandTotal());
            setOrderComplete(true);
            setIsTerminalProcessing(false);
        };

        window.pollingRef = setInterval(async () => {
            const { data } = await supabase.from('orders').select('payment_status').eq('id', orderId).single();
            if (data && data.payment_status === 'paid') handleSuccess();
        }, 2000);

    } catch (err) {
        console.error("Checkout Error:", err); alert("System Error: " + err.message);
        if (window.pollingRef) clearInterval(window.pollingRef);
        setIsTerminalProcessing(false); setTerminalStatus('');
    }
  };

  const handleCashCheckout = async () => {
    if (cart.length === 0) return alert("Cart is empty");
    if (!customerName) return alert("Please enter Name");
    
    if(!confirm("Confirm Pay with Cash?")) return;
    setIsSubmitting(true); 

    try {
        const res = await fetch('/api/create-cash-order', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart, customerName, customerPhone, customerEmail, total: calculateGrandTotal(), taxCollected: calculateTax(), eventName, eventSlug: actualEventSlug, shippingInfo: cartRequiresShipping ? { address: shippingAddress, city: shippingCity, state: shippingState, zip: shippingZip } : null })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        await decrementInventory(cart);
        setLastOrderId(data.orderId); 
        if (customerPhone) sendConfirmationSMS(customerName, customerPhone);
        if (customerEmail) sendReceiptEmail(data.orderId, customerName, customerEmail, cart, calculateGrandTotal());
        setOrderComplete(true); setIsSubmitting(false); 

    } catch (err) {
        console.error("Cash Checkout Error:", err); alert("Error saving order: " + err.message); setIsSubmitting(false); 
    }
  };

  const handleCheckout = async () => {
    if (paymentMode === 'hosted' && selectedGuest) {
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/create-hosted-order', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cart, guestName: selectedGuest.name, guestId: selectedGuest.id, eventName, eventSlug: actualEventSlug, customerPhone, customerEmail }) 
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            setLastOrderId(data.orderId); 
            if (customerEmail) sendReceiptEmail(data.orderId, selectedGuest.name, customerEmail, cart, 0);
            sendConfirmationSMS(selectedGuest.name, customerPhone || 'N/A');
            
            setOrderComplete(true); setCart([]); setSelectedGuest(null); setGuestSearch(''); setIsSubmitting(false); 
        } catch (err) { alert("Error: " + err.message); setIsSubmitting(false); }
        return; 
    }
    
    setIsSubmitting(true);
    try {
        const { data: orderData, error } = await supabase.from('orders').insert([{ 
          customer_name: customerName, phone: customerPhone || 'N/A', email: customerEmail, cart_data: cart, 
          total_price: calculateGrandTotal(), shipping_address: cartRequiresShipping ? shippingAddress : null,
          shipping_city: cartRequiresShipping ? shippingCity : null, shipping_state: cartRequiresShipping ? shippingState : null,
          shipping_zip: cartRequiresShipping ? shippingZip : null, status: cartRequiresShipping ? 'pending_shipping' : 'pending',
          event_name: eventName, event_slug: actualEventSlug 
        }]).select().single();

        if (error) throw error;
        const response = await fetch('/api/checkout', { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ cart, customerName, eventSlug: actualEventSlug }) 
        });
        const data = await response.json();
        if (data.url) window.location.href = data.url; else alert("Payment Error");
    } catch (err) { alert("Checkout failed."); setIsSubmitting(false); }
  };

  const decrementInventory = async (cartItems) => {
      for (const item of cartItems) {
          const { data: current } = await supabase.from('inventory').select('count').eq('event_slug', actualEventSlug).eq('product_id', item.productId).eq('size', item.size).single();
          if (current && current.count > 0) {
              await supabase.from('inventory').update({ count: current.count - 1 }).eq('event_slug', actualEventSlug).eq('product_id', item.productId).eq('size', item.size);
          }
      }
  };

  if (showSetup) {
      return (
          <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
              <h1 className="text-3xl font-bold mb-8">🛠️ Kiosk Setup Mode</h1>
              <div className="space-y-4 w-full max-w-md">
                  <p className="text-gray-400 text-center mb-4">Select which Terminal this iPad should trigger:</p>
                  {availableTerminals.length === 0 ? (
                      <div className="text-center text-red-400">No Terminals Found.</div>
                  ) : (
                      availableTerminals.map(t => (
                          <button key={t.id} onClick={() => selectTerminal(t.device_id)} className="w-full bg-gray-800 border border-gray-600 p-4 rounded-lg text-lg font-bold hover:bg-blue-600">
                              {t.label} <span className="block text-xs font-mono text-gray-500 mt-1">{t.device_id}</span>
                          </button>
                      ))
                  )}
                  <button onClick={() => setShowSetup(false)} className="w-full mt-8 text-gray-500 hover:text-white">Cancel</button>
              </div>
          </div>
      );
  }

  if (products.length === 0) return <div className="p-10 text-center font-bold">Loading Menu...</div>;
  if (!selectedProduct && paymentMode !== 'hosted') return <div className="p-10 text-center text-red-600 font-bold">No active products assigned to this event.</div>;

  if (orderComplete) {
      return (
          <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-8 text-center">
              <div className="bg-white p-8 rounded-xl shadow-lg border border-green-200 max-w-md w-full">
                  <h1 className="text-3xl font-black text-green-800 mb-2">Order Received! 🎉</h1>
                  <p className="text-xl font-mono text-blue-600 mb-6 bg-blue-50 p-2 rounded border border-blue-200">Order #{lastOrderId || '---'}</p>
                  <button onClick={() => window.location.reload()} className="text-white font-bold py-4 px-8 rounded-lg w-full text-xl" style={{ backgroundColor: headerColor }}>Next Order ➡️</button>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4 text-gray-900 font-sans">
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8" style={{ zoom: '1.2' }}>
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-300">
            <div className="p-6 text-white text-center relative" style={{ backgroundColor: headerColor }}>
                {eventLogo ? <img src={eventLogo} className="h-16 mx-auto mb-2" /> : <h1 className="text-3xl font-black">{eventName}</h1>}
                {assignedTerminalId && <div className="absolute top-2 right-2 text-[10px] bg-black bg-opacity-20 px-2 py-1 rounded text-white">ID: {assignedTerminalId.slice(-4)}</div>}
            </div>
            <div className="p-6 space-y-8">
                <section className="bg-gray-50 p-4 rounded-xl border border-gray-300">
                    <h2 className="font-bold text-lg mb-4 border-b pb-2">1. Select Garment</h2>
                    {selectedProduct && (
                        <>
                            {selectedProduct.image_url && <div className="mb-4 flex justify-center"><img src={selectedProduct.image_url} className="h-48 object-contain" /></div>}
                            {isOutOfStock ? <div className="bg-orange-100 text-orange-700 p-3 mb-4 rounded font-bold">⚠️ Out of Stock (Will Ship)</div> : <div className="bg-green-100 text-green-700 p-2 mb-4 text-xs font-bold rounded">✓ In Stock ({currentStock} available)</div>}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-black text-gray-900 uppercase">Item</label>
                                    <select className="w-full p-4 border-2 rounded-xl bg-white text-black font-bold text-lg" onChange={(e) => setSelectedProduct(visibleProducts.find(p => p.id === e.target.value))} value={selectedProduct.id}>
                                        {visibleProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-black text-gray-900 uppercase">Size</label>
                                    <select className="w-full p-4 border-2 rounded-xl bg-white text-black font-bold text-lg" value={size} onChange={(e) => setSize(e.target.value)}>
                                        {visibleSizes.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                        </>
                    )}
                </section>

                {availableMainOptions.length > 0 && (
                    <section>
                        <h2 className="font-bold text-lg mb-4 border-b pb-2">2. Choose Design</h2>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2 grid grid-cols-2 gap-3">
                                {availableMainOptions.map(opt => (
                                    <button key={opt.label} onClick={() => setSelectedMainDesign(opt.label)} className={`border-2 rounded-xl p-2 flex flex-col items-center ${selectedMainDesign === opt.label ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                                        <img src={opt.image_url} className="h-20 object-contain mb-2" />
                                        <span className="text-xs font-bold">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="col-span-1">
                                <PlacementVisualizer garmentType={isBottomSelected ? 'bottom' : 'top'} logoSize={availableMainOptions.find(o => o.label === selectedMainDesign)?.placement || 'large'} />
                            </div>
                        </div>
                    </section>
                )}

                {(showPersonalization || showNumbers) && (
                    <section>
                        <h2 className="font-bold text-lg mb-4 border-b pb-2">3. Personalization (+$5)</h2>
                        <div className="flex gap-4">
                            {showPersonalization && <button onClick={() => setNames([...names, { text: '', position: '' }])} className="flex-1 py-4 border-2 border-dashed border-gray-400 rounded-xl font-bold bg-white text-gray-700">+ Add Name</button>}
                            {showNumbers && <button onClick={() => setNumbers([...numbers, { text: '', position: '' }])} className="flex-1 py-4 border-2 border-dashed border-gray-400 rounded-xl font-bold bg-white text-gray-700">+ Add Number</button>}
                        </div>
                        {names.map((n, i) => (
                            <div key={`name-${i}`} className="flex gap-2 mt-4 bg-gray-100 p-3 rounded-xl">
                                <input placeholder="NAME" className="flex-1 p-3 rounded-lg border-2 uppercase font-black" value={n.text} onChange={(e) => { const x = [...names]; x[i].text = e.target.value; setNames(x); }} />
                                <select className="p-3 border-2 rounded-lg font-bold" value={n.position} onChange={(e) => { const x = [...names]; x[i].position = e.target.value; setNames(x); }}>
                                    <option value="">Position...</option>
                                    {(isBottomSelected ? ZONES.bottom : ZONES.top).filter(z => z.type !== 'logo').map(z => <option key={z.id} value={z.label}>{z.label}</option>)}
                                </select>
                            </div>
                        ))}
                        {numbers.map((n, i) => (
                            <div key={`num-${i}`} className="flex gap-2 mt-4 bg-gray-100 p-3 rounded-xl">
                                <input placeholder="00" className="flex-1 p-3 rounded-lg border-2 font-mono font-black text-center text-xl" value={n.text} onChange={(e) => { const x = [...numbers]; x[i].text = e.target.value.replace(/\D/g,''); setNumbers(x); }} maxLength={3} />
                                <select className="p-3 border-2 rounded-lg font-bold" value={n.position} onChange={(e) => { const x = [...numbers]; x[i].position = e.target.value; setNumbers(x); }}>
                                    <option value="">Position...</option>
                                    {(isBottomSelected ? ZONES.bottom : ZONES.top).filter(z => z.type !== 'logo').map(z => <option key={z.id} value={z.label}>{z.label}</option>)}
                                </select>
                            </div>
                        ))}
                    </section>
                )}
            </div>
            <div className="p-6 sticky bottom-0 bg-white border-t flex justify-between items-center shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                <div className="text-3xl font-black text-blue-900">${calculateItemTotal()}</div>
                <button onClick={handleAddToCart} className="bg-blue-900 text-white px-10 py-4 rounded-xl font-bold text-xl shadow-lg active:scale-95" disabled={!selectedProduct}>Add to Cart</button>
            </div>
          </div>
        </div>

        <div className="md:col-span-1 space-y-6">
            <div className="bg-white shadow-xl rounded-2xl border border-gray-300 sticky top-4 overflow-hidden">
                <div className="p-4 text-white font-bold text-center" style={{ backgroundColor: headerColor }}>Your Order</div>
                <div className="p-4 space-y-4 max-h-[40vh] overflow-y-auto">
                    {cart.length === 0 ? <p className="text-center text-gray-400 py-10">Empty Cart</p> : cart.map(item => (
                        <div key={item.id} className="border-b pb-3">
                            <div className="flex justify-between font-bold"><span>{item.productName}</span><button onClick={() => setCart(cart.filter(c => c.id !== item.id))} className="text-red-500">REMOVE</button></div>
                            <div className="text-xs font-bold text-blue-800">{item.size} | {item.customizations.mainDesign}</div>
                        </div>
                    ))}
                </div>
                {cart.length > 0 && (
                    <div className="p-4 bg-gray-50 border-t">
                        <input placeholder="Full Name" className="w-full p-3 border-2 rounded-xl mb-3 font-bold" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                        <input placeholder="Phone" className="w-full p-3 border-2 rounded-xl mb-4 font-bold" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                        <div className="text-2xl font-black text-center mb-4 text-blue-900">Total: ${calculateGrandTotal().toFixed(2)}</div>
                        <div className="space-y-2">
                            {retailPaymentMethod === 'terminal' ? (
                                <button onClick={handleTerminalCheckout} className="w-full py-4 bg-purple-700 text-white rounded-xl font-bold text-lg">📟 Pay with Card</button>
                            ) : (
                                <button onClick={handleCheckout} className="w-full py-4 bg-blue-900 text-white rounded-xl font-bold text-lg">Pay with Card</button>
                            )}
                            <button onClick={handleCashCheckout} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold">💵 Pay with Cash</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}

const PlacementVisualizer = ({ garmentType, logoSize }) => {
  const isTop = garmentType === 'top';
  const color = "#1e3a8a"; 
  return (
      <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-gray-200">
          <svg viewBox="0 0 200 200" className="w-32 h-32">
              {isTop ? (
                  <path d="M60 20 L40 50 L60 60 L60 180 L140 180 L140 60 L160 50 L140 20 Q100 40 60 20" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="2" />
              ) : (
                  <path d="M70 20 L130 20 L140 60 L130 180 L110 180 L100 80 L90 180 L70 180 L60 60 Z" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="2" />
              )}
              {isTop && logoSize === 'large' ? <rect x="75" y="70" width="50" height="50" fill={color} fillOpacity="0.5" rx="4" /> : null}
              {isTop && logoSize !== 'large' ? <circle cx="125" cy="70" r="10" fill={color} fillOpacity="0.5" /> : null}
              {!isTop && <circle cx="80" cy="50" r="10" fill={color} fillOpacity="0.5" />}
          </svg>
          <span className="text-xs font-black uppercase mt-2 text-gray-400">{isTop ? 'Tops' : 'Bottoms'}</span>
      </div>
  );
};