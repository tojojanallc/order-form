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
        { id: 'full_front', label: 'Full Front', type: 'logo' }, { id: 'left_chest', label: 'Left Chest', type: 'logo' },
        { id: 'center_chest', label: 'Center Chest', type: 'logo' }, { id: 'left_sleeve', label: 'Left Sleeve', type: 'both' },
        { id: 'right_sleeve', label: 'Right Sleeve', type: 'both' }, { id: 'back_center', label: 'Back Center', type: 'both' },
        { id: 'back_bottom', label: 'Back Bottom', type: 'name' }
    ],
    bottom: [
        { id: 'left_thigh', label: 'Left Thigh (Upper)', type: 'both' }, { id: 'right_thigh', label: 'Right Thigh (Upper)', type: 'both' },
        { id: 'back_pocket', label: 'Back Pocket', type: 'logo' }, { id: 'rear', label: 'Rear (Center)', type: 'both' }           
    ]
};

// Parses "Colortone Spider T-Shirt | L | Silver" → { baseName: "Colortone Spider T-Shirt", size: "L", color: "Silver" }
const parseProductId = (id) => {
  const parts = id.split('|').map(s => s.trim());
  if (parts.length === 3) return { baseName: parts[0], size: parts[1], color: parts[2] };
  if (parts.length === 2) return { baseName: parts[0], size: parts[1], color: null };
  return { baseName: id, size: null, color: null };
};

export default function OrderForm() {
  const params = useParams();
  
  const [actualEventSlug, setActualEventSlug] = useState('');
  const [cart, setCart] = useState([]); 
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [lastOrderId, setLastOrderId] = useState(''); 
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingZip, setShippingZip] = useState('');
  const [priceOverrides, setPriceOverrides] = useState({}); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [isTerminalProcessing, setIsTerminalProcessing] = useState(false);
  const [terminalStatus, setTerminalStatus] = useState('');
  const [assignedTerminalId, setAssignedTerminalId] = useState('');
  const [guests, setGuests] = useState([]);
  const [selectedGuest, setSelectedGuest] = useState(null); 
  const [guestSearch, setGuestSearch] = useState('');
  const [guestError, setGuestError] = useState(''); 
  const [products, setProducts] = useState([]); 
  const [inventory, setInventory] = useState({});
  const [activeItems, setActiveItems] = useState({});
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
  const [selectedColor, setSelectedColor] = useState('');
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

  // ── FIX 1: Only use .name and .type — never .id (id is now "Name | Size | Color") ──
  const isBottomSelected = selectedProduct ? (
    selectedProduct.type === 'bottom' || 
    (selectedProduct.name || '').toLowerCase().match(/jogger|pant|short/)
  ) : false;

  // Tops: both large & small logos available. Bottoms: small/pocket only (no large/full-front).
  const availableMainOptions = mainOptions.filter(opt => !(isBottomSelected && opt.placement === 'large'));
  const availableAccentOptions = accentOptions.filter(opt => !(isBottomSelected && opt.placement === 'large'));

  useEffect(() => {
    if (availableMainOptions.length === 1) setSelectedMainDesign(availableMainOptions[0].label);
    else if (availableMainOptions.length === 0) setSelectedMainDesign('');
    else if (selectedMainDesign) {
        const isValid = availableMainOptions.find(o => o.label === selectedMainDesign);
        if (!isValid) setSelectedMainDesign('');
    }
  }, [selectedProduct, mainOptions]);

  useEffect(() => {
    let slug = params?.slug;
    if (!slug && typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        slug = searchParams.get('event');
        if (!slug) {
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            slug = pathParts[pathParts.length - 1];
        }
    }
    const finalSlug = slug || 'default';
    setActualEventSlug(finalSlug);

    const savedId = localStorage.getItem('square_terminal_id');
    if (savedId) setAssignedTerminalId(savedId);

    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('setup') === 'true') {
        setShowSetup(true); 
        fetchTerminals(); 
    }

    const fetchData = async () => {
      if (!supabase || !finalSlug) return;

      const { data: settings } = await supabase.from('event_settings').select('*').eq('slug', finalSlug).single();
      if (settings) {
        setEventName(settings.event_name);
        setEventLogo(settings.event_logo_url);
        setHeaderColor(settings.header_color || '#1e3a8a'); 
        setPaymentMode(settings.payment_mode || 'retail');
        setRetailPaymentMethod(settings.retail_payment_method || 'stripe'); 
        setShowBackNames(settings.offer_back_names ?? true);
        setShowMetallic(settings.offer_metallic ?? true);
        setShowPersonalization(settings.offer_personalization ?? true);
        setShowNumbers(settings.offer_numbers ?? true); 
        setTaxEnabled(settings.tax_enabled || false);
        setTaxRate(settings.tax_rate || 0);
      }

      const { data: productData } = await supabase.from('products').select('*').order('sort_order', { ascending: true });
      if (productData) setProducts(productData);

      const { data: logoData } = await supabase.from('logos').select('label, image_url, category, placement').eq('active', true).eq('event_slug', finalSlug).order('sort_order');
      if (logoData) {
          setLogoOptions(logoData);
          setMainOptions(logoData.filter(l => l.category === 'main'));
          setAccentOptions(logoData.filter(l => !l.category || l.category === 'accent'));
      }

      const { data: invData } = await supabase.from('inventory').select('*').eq('event_slug', finalSlug); 
      if (invData) {
        const stockMap = {}; const activeMap = {}; const priceMap = {};
        invData.forEach(item => {
            const key = `${item.product_id}_${item.size}`;
            stockMap[key] = item.count;
            activeMap[key] = item.active;
            if (item.override_price) priceMap[key] = item.override_price;
        });
        setInventory(stockMap); setActiveItems(activeMap); setPriceOverrides(priceMap);
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
      localStorage.setItem('square_terminal_id', id);
      setAssignedTerminalId(id);
      alert("✅ This iPad is now linked to terminal: " + id);
      setShowSetup(false);
  };

  const verifyGuest = () => {
      if (!guestSearch.trim()) return;
      setGuestError('');
      const search = guestSearch.trim().toLowerCase();
      const match = guests.find(g => g.name.toLowerCase() === search);
      if (match) {
          if (match.has_ordered) { setGuestError("❌ This name has already redeemed their item."); setSelectedGuest(null); } 
          else { setSelectedGuest(match); setCustomerName(match.name); setGuestError(''); }
      } else { setGuestError("❌ Name not found. Please type your full name exactly."); setSelectedGuest(null); }
  };

  // ─── PRODUCT GROUPING ──────────────────────────────────────────
  // product.id  = "Colortone Spider T-Shirt | Adult M | Pink"
  // product.name = "Colortone Spider T-Shirt"   ← clean display name, shared across colors
  // inventory key = product_id + "_" + size  (no color column in inventory table)
  // ───────────────────────────────────────────────────────────────

  const visibleProducts = [];
  const seenNames = new Set();
  products.forEach(p => {
      const strictPrefix = p.id + '_';
      const hasActiveStock = Object.keys(activeItems).some(key => {
          if (!key.startsWith(strictPrefix)) return false;
          if (!activeItems[key]) return false;
          if (paymentMode === 'hosted' && (inventory[key] || 0) <= 0) return false;
          return true;
      });
      if (hasActiveStock && !seenNames.has(p.name)) {
          seenNames.add(p.name);
          visibleProducts.push(p);
      }
  });

  useEffect(() => {
      if (visibleProducts.length > 0) {
          if (!selectedProduct || !visibleProducts.find(p => p.name === selectedProduct.name)) {
              setSelectedProduct(visibleProducts[0]);
          }
      } else {
          setSelectedProduct(null); 
      }
  }, [JSON.stringify(visibleProducts.map(p => p.id)), selectedProduct]);

  // All product records that share the selected product's NAME (one per color variant)
  const matchingProducts = selectedProduct
    ? products.filter(p => p.name === selectedProduct.name)
    : [];

  // Colors parsed from product id: "Name | Size | Color" → "Color"
  const visibleColors = (() => {
    const colors = new Set();
    matchingProducts.forEach(p => {
      const { color } = parseProductId(p.id);
      if (color) colors.add(color);
    });
    return Array.from(colors);
  })();

  const hasMultipleColors = visibleColors.length > 1;

  // Reset color & size when product name changes
  useEffect(() => {
    if (!selectedProduct) return;
    const ids = products.filter(p => p.name === selectedProduct.name);
    const colors = [...new Set(ids.map(p => parseProductId(p.id).color).filter(Boolean))];
    setSelectedColor(colors.length > 0 ? colors[0] : '');
    setSize('');
  }, [selectedProduct?.name]);

  // Sizes: filtered to only those with active stock for the selected color
  const getVisibleSizes = () => {
      if (!selectedProduct) return [];
      const validSizes = new Set();
      matchingProducts.forEach(p => {
          const parsed = parseProductId(p.id);
          // If multiple colors exist, only show sizes for the selected color
          if (hasMultipleColors && parsed.color !== selectedColor) return;
          const prefix = p.id + '_';
          Object.keys(activeItems).forEach(key => {
              if (!key.startsWith(prefix)) return;
              if (!activeItems[key]) return;
              if (paymentMode === 'hosted' && (inventory[key] || 0) <= 0) return;
              validSizes.add(key.replace(prefix, ''));
          });
      });
      return Array.from(validSizes).sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
  };

  const visibleSizes = getVisibleSizes();

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
  }, [selectedProduct, selectedColor, visibleSizes.join(','), paymentMode, selectedGuest]);

  // Stock lookup: color-aware via matching product id, key = product_id_size
  const currentStock = (() => {
      if (!selectedProduct || !size) return 0;
      let totalBaseStock = 0;
      matchingProducts.forEach(p => {
          const parsed = parseProductId(p.id);
          if (hasMultipleColors && parsed.color !== selectedColor) return;
          totalBaseStock += (inventory[`${p.id}_${size}`] || 0);
      });
      const qtyInCart = cart.filter(item =>
        item.productName === selectedProduct.name &&
        item.size === size &&
        (!hasMultipleColors || item.color === selectedColor)
      ).length;
      return totalBaseStock - qtyInCart;
  })();
  
  const isOutOfStock = currentStock <= 0;

  // ── FIX 2: selectedProductRecord is the color-specific record (has the correct image_url) ──
  const selectedProductRecord = (() => {
    if (!selectedProduct) return null;
    if (!hasMultipleColors) return matchingProducts[0] || selectedProduct;
    return matchingProducts.find(p => parseProductId(p.id).color === selectedColor) || selectedProduct;
  })();

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

  const calculateItemTotal = () => {
    if (!selectedProductRecord) return 0;
    let basePrice = selectedProductRecord.base_price;
    if (size) {
        const key = `${selectedProductRecord.id}_${size}`;
        if (priceOverrides[key]) basePrice = priceOverrides[key];
    }
    let total = basePrice; 
    total += logos.length * 5;      
    total += names.length * 5;      
    total += numbers.length * 5; 
    if (backNameList) total += 5;   
    if (metallicHighlight) total += 5; 
    return total;
  };

  const calculateSubtotal = () => cart.reduce((sum, item) => sum + item.finalPrice, 0);
  const calculateTax = () => {
      if (!taxEnabled || taxRate <= 0 || paymentMode === 'hosted') return 0;
      return calculateSubtotal() * (taxRate / 100);
  };
  const calculateGrandTotal = () => calculateSubtotal() + calculateTax();

  const sendConfirmationSMS = async (name, phone) => {
      if (!phone || phone.length < 10) return;
      fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phone, message: `Hi ${name}! Thanks for your order from Lev Custom Merch at ${eventName}. We will text you again when it's ready for pickup!` })
      }).catch(err => console.error("SMS Failed:", err));
  };

  const sendReceiptEmail = async (orderId, name, email, cartData, totalAmount) => {
      if (!email || !email.includes('@')) return;
      try {
          await fetch('/api/send-receipt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, name, cart: cartData, total: totalAmount, orderId, eventName })
          });
      } catch (err) { console.error(`NETWORK ERROR: ${err.message}`); }
  };
  
  const handleAddToCart = () => {
    if (!selectedProduct) return;
    if (hasMultipleColors && !selectedColor) { alert("Please select a color."); return; }
    if (!size) { alert("Please select a size."); return; }
    if (availableMainOptions.length > 0 && !selectedMainDesign) { alert("Please select a Design."); return; }
    const missingLogoPos = logos.some(l => !l.position);
    const missingNamePos = names.some(n => !n.position);
    const missingNumberPos = numbers.some(n => !n.position);
    if (missingLogoPos || missingNamePos || missingNumberPos) { alert("Please select a Position for every Accent, Name, and Number."); return; }

    const newItem = {
      id: Date.now(),
      productId: selectedProductRecord.id,
      productName: selectedProduct.name,
      size: size,
      color: hasMultipleColors ? selectedColor : null,
      needsShipping: isOutOfStock, 
      custom_name: names.length > 0 ? names[0].text : (metallicHighlight ? metallicName : null),
      has_heat_sheet: backNameList,
      customizations: { 
          mainDesign: selectedMainDesign, logos, names, numbers,
          backList: backNameList, metallic: metallicHighlight,
          metallicName: metallicHighlight ? metallicName : ''
      },
      finalPrice: calculateItemTotal() 
    };
    
    setCart([...cart, newItem]);
    setLogos([]); setNames([]); setNumbers([]);
    setBackNameList(false); setMetallicHighlight(false);
    setBackListConfirmed(false); setMetallicName('');
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
    setIsTerminalProcessing(true);
    setTerminalStatus("Creating Order...");
    try {
        const createRes = await fetch('/api/create-retail-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart, customerName, customerPhone, customerEmail, total: calculateGrandTotal(), taxCollected: calculateTax(), eventSlug: actualEventSlug, eventName })
        });
        if (!createRes.ok) throw new Error("Order creation failed");
        const orderData = await createRes.json();
        const orderId = orderData.orderId;
        setTerminalStatus("Sent to Terminal... Please Tap Card.");
        const payRes = await fetch('/api/terminal-pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: orderId, amount: calculateGrandTotal(), taxCollected: calculateTax(), deviceId: assignedTerminalId })
        });
        if (!payRes.ok) throw new Error("Terminal connection failed");
        const decrementInventory = async (cartItems) => {
            for (const item of cartItems) {
                const { data: current } = await supabase.from('inventory').select('count').eq('event_slug', actualEventSlug).eq('product_id', item.productId).eq('size', item.size).single();
                if (current && current.count > 0) {
                    await supabase.from('inventory').update({ count: current.count - (item.quantity || 1) }).eq('event_slug', actualEventSlug).eq('product_id', item.productId).eq('size', item.size);
                }
            }
        };
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
        console.error("Checkout Error:", err);
        alert("System Error: " + err.message);
        if (window.pollingRef) clearInterval(window.pollingRef);
        setIsTerminalProcessing(false);
        setTerminalStatus('');
    }
  };

  const handleCashCheckout = async () => {
    if (cart.length === 0) return alert("Cart is empty");
    if (!customerName) return alert("Please enter Name");
    if (!confirm("Confirm Pay with Cash?")) return;
    setIsSubmitting(true); 
    try {
        const res = await fetch('/api/create-cash-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart, customerName, customerPhone, customerEmail, total: calculateGrandTotal(), taxCollected: calculateTax(), eventName, eventSlug: actualEventSlug, shippingInfo: cartRequiresShipping ? { address: shippingAddress, city: shippingCity, state: shippingState, zip: shippingZip } : null })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        const decrementInventory = async (cartItems) => {
            for (const item of cartItems) {
                const { data: current } = await supabase.from('inventory').select('count').eq('event_slug', actualEventSlug).eq('product_id', item.productId).eq('size', item.size).single();
                if (current && current.count > 0) {
                    await supabase.from('inventory').update({ count: current.count - (item.quantity || 1) }).eq('event_slug', actualEventSlug).eq('product_id', item.productId).eq('size', item.size);
                }
            }
        };
        await decrementInventory(cart);
        setLastOrderId(data.orderId); 
        if (customerPhone) sendConfirmationSMS(customerName, customerPhone);
        if (customerEmail) sendReceiptEmail(data.orderId, customerName, customerEmail, cart, calculateGrandTotal());
        setOrderComplete(true);
        setIsSubmitting(false); 
    } catch (err) {
        console.error("Cash Checkout Error:", err);
        alert("Error saving order: " + err.message);
        setIsSubmitting(false); 
    }
  };

  const handleCheckout = async () => {
    if (paymentMode === 'hosted' && selectedGuest) {
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/create-hosted-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cart, guestName: selectedGuest.name, guestId: selectedGuest.id, eventName, eventSlug: actualEventSlug, customerPhone, customerEmail }) 
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            setLastOrderId(data.orderId); 
            if (customerEmail) sendReceiptEmail(data.orderId, selectedGuest.name, customerEmail, cart, 0);
            sendConfirmationSMS(selectedGuest.name, customerPhone || 'N/A');
            setOrderComplete(true);
            setCart([]);
            setSelectedGuest(null);
            setGuestSearch('');
            setIsSubmitting(false); 
        } catch (err) {
            alert("Error: " + err.message);
            setIsSubmitting(false); 
        }
        return; 
    }
    setIsSubmitting(true);
    try {
        const { data: orderData, error } = await supabase.from('orders').insert([{ 
          customer_name: customerName, 
          phone: customerPhone || 'N/A',
          email: customerEmail, 
          cart_data: cart, 
          total_price: calculateGrandTotal(), 
          shipping_address: cartRequiresShipping ? shippingAddress : null,
          shipping_city: cartRequiresShipping ? shippingCity : null,
          shipping_state: cartRequiresShipping ? shippingState : null,
          shipping_zip: cartRequiresShipping ? shippingZip : null,
          status: cartRequiresShipping ? 'pending_shipping' : 'pending',
          event_name: eventName,
          event_slug: actualEventSlug 
        }]).select().single();
        if (error) throw error;
        const response = await fetch('/api/checkout', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ cart, customerName, eventSlug: actualEventSlug }) 
        });
        const data = await response.json();
        if (data.url) window.location.href = data.url; else alert("Payment Error");
    } catch (err) { 
        alert("Checkout failed."); 
        setIsSubmitting(false); 
    }
  };

  const resetApp = async () => {
      setCart([]); 
      setCustomerName(''); setCustomerEmail(''); setCustomerPhone(''); 
      setShippingAddress(''); setShippingCity(''); setShippingState(''); setShippingZip(''); 
      setOrderComplete(false); 
      setLogos([]); setNames([]); setNumbers([]); 
      setSelectedProduct(null); setSize(''); setSelectedColor('');
      setIsSubmitting(false); setIsTerminalProcessing(false); setLastOrderId(''); 
      const { data: invData } = await supabase.from('inventory').select('*').eq('event_slug', actualEventSlug); 
      if (invData) {
        const stockMap = {}; const activeMap = {}; const priceMap = {};
        invData.forEach(item => {
            const key = `${item.product_id}_${item.size}`;
            stockMap[key] = item.count; activeMap[key] = item.active;
            if (item.override_price) priceMap[key] = item.override_price;
        });
        setInventory(stockMap); setActiveItems(activeMap); setPriceOverrides(priceMap);
      }
      window.scrollTo(0, 0);
  };

  if (showSetup) {
      return (
          <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
              <h1 className="text-3xl font-bold mb-8">🛠️ Kiosk Setup Mode</h1>
              <div className="space-y-4 w-full max-w-md">
                  <p className="text-gray-400 text-center mb-4">Select which Terminal this iPad should trigger:</p>
                  {availableTerminals.length === 0 ? (
                      <div className="text-center text-red-400">No Terminals Found. Add them in Admin Dashboard first.</div>
                  ) : (
                      availableTerminals.map(t => (
                          <button key={t.id} onClick={() => selectTerminal(t.device_id)} className="w-full bg-gray-800 border border-gray-600 p-4 rounded-lg text-lg font-bold hover:bg-blue-600 hover:border-blue-400 transition-colors">
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
  if (!selectedProduct && paymentMode !== 'hosted') return <div className="p-10 text-center">No active products available.</div>;

  if (orderComplete) {
      return (
          <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-8 text-center">
              <div className="bg-white p-8 rounded-xl shadow-lg border border-green-200 max-w-md w-full">
                  <div className="text-6xl mb-4">🎉</div>
                  <h1 className="text-3xl font-black text-green-800 mb-2">Order Received!</h1>
                  <p className="text-xl font-mono text-blue-600 mb-6 bg-blue-50 p-2 rounded border border-blue-200">Order #{lastOrderId || '---'}</p>
                  <p className="text-gray-600 mb-6">Your gear is being prepared.</p>
                  <button onClick={resetApp} className="text-white font-bold py-4 px-8 rounded-lg shadow-lg hover:opacity-90 w-full text-xl" style={{ backgroundColor: headerColor }}>Next Order ➡️</button>
              </div>
          </div>
      );
  }

  const showPrice = paymentMode === 'retail';

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4 font-sans text-gray-900 flex justify-center items-start">
      <div className="w-full max-w-6xl mx-auto grid md:grid-cols-3 gap-8" style={{ zoom: '1.25' }}>
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-gray-300">
            <div className="text-white p-6 text-center relative" style={{ backgroundColor: headerColor }}>
              {eventLogo ? <img src={eventLogo} alt="Event Logo" className="h-16 mx-auto mb-2" /> : <h1 className="text-2xl font-bold uppercase tracking-wide">{eventName}</h1>}
              <p className="text-white text-opacity-80 text-sm mt-1">{eventLogo ? eventName : 'Order Form'}</p>
              {assignedTerminalId && <div className="absolute top-2 right-2 text-[10px] bg-black bg-opacity-20 px-2 py-1 rounded text-white">ID: {assignedTerminalId.slice(-4)}</div>}
            </div>
            
            <div className="p-6 space-y-8">
              {paymentMode === 'hosted' && !selectedGuest && (
                  <div className="text-center py-10">
                      <h2 className="text-2xl font-bold mb-4">Welcome to the Party! 🎉</h2>
                      <p className="mb-6 text-gray-600">Please verify your name to get started.</p>
                      <div className="flex gap-2 max-w-md mx-auto">
                            <input className="flex-1 p-3 border-2 border-gray-400 rounded-lg text-lg text-black" placeholder="Enter full name" value={guestSearch} onChange={(e) => { setGuestSearch(e.target.value); setGuestError(''); }} />
                            <button onClick={verifyGuest} className="text-white font-bold px-6 rounded-lg shadow hover:opacity-90" style={{ backgroundColor: headerColor }}>Start</button>
                      </div>
                      {guestError && <p className="text-red-600 text-sm font-bold mt-4 bg-red-50 p-2 rounded inline-block">{guestError}</p>}
                  </div>
              )}

              {(paymentMode === 'retail' || selectedGuest) && (
                  <>
                    <section className="bg-gray-50 p-4 rounded-lg border border-gray-300">
                        <h2 className="font-bold text-black mb-3 border-b border-gray-300 pb-2">1. Select Garment</h2>
                        {selectedGuest && (
                            <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-6 text-center shadow-sm">
                                <h2 className="text-xl font-bold text-green-900 mb-1">Hi {selectedGuest.name}! 👋</h2>
                                {selectedGuest.size ? (<p className="text-green-700 text-sm">We've pre-selected size <span className="font-bold bg-white px-2 py-0.5 rounded border border-green-300">{selectedGuest.size}</span> for you.</p>) : (<p className="text-green-700 text-sm">Please select your apparel below.</p>)}
                                <button onClick={() => { setSelectedGuest(null); setGuestSearch(''); setCart([]); }} className="text-xs text-green-600 underline mt-2 hover:text-green-800">Not you? Change Guest</button>
                            </div>
                        )}                        
                        {!selectedProduct ? (
                            <div className="text-center py-8 text-red-600 font-bold">Sorry, no products available.</div>
                        ) : (
                            <>
                                {/* ── FIX 3: Use selectedProductRecord.image_url so Pink shows pink image, Black shows black image ── */}
                                {selectedProductRecord?.image_url && (
                                  <div className="mb-4 bg-white p-2 rounded border border-gray-200 flex justify-center">
                                    <img src={selectedProductRecord.image_url} alt={selectedProduct.name} className="h-48 object-contain" />
                                  </div>
                                )}

                                {isOutOfStock ? (<div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-4" role="alert"><p className="font-bold">⚠️ Out of Stock at Event</p><p className="text-sm">We can ship this to your home!</p></div>) : <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-2 mb-4 text-xs font-bold uppercase">✓ In Stock ({currentStock} available)</div>}

                                <div className="space-y-3">

                                  {/* PRODUCT */}
                                  <div>
                                    <label className="text-xs font-black text-gray-900 uppercase">Item</label>
                                    <select
                                      className="w-full p-3 border border-gray-400 rounded-lg bg-white text-black font-medium"
                                      value={selectedProduct.name}
                                      onChange={(e) => {
                                        const found = visibleProducts.find(p => p.name === e.target.value);
                                        setSelectedProduct(found);
                                        setSelectedColor('');
                                        setSize('');
                                      }}
                                    >
                                      {visibleProducts.map(p => (
                                        <option key={p.id} value={p.name}>{p.name}{showPrice ? ` - $${p.base_price}` : ''}</option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* COLOR — only shown when 2+ colors exist */}
                                  {hasMultipleColors && (
                                    <div>
                                      <label className="text-xs font-black text-gray-900 uppercase">Color</label>
                                      <select
                                        className="w-full p-3 border border-gray-400 rounded-lg bg-white text-black font-medium"
                                        value={selectedColor}
                                        onChange={(e) => { setSelectedColor(e.target.value); setSize(''); }}
                                      >
                                        <option value="" disabled>-- Select Color --</option>
                                        {visibleColors.map(c => (
                                          <option key={c} value={c}>{c}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                  {/* SIZE — hidden until color is chosen (if multi-color product) */}
                                  {(!hasMultipleColors || selectedColor) && (
                                    <div>
                                      <label className="text-xs font-black text-gray-900 uppercase">Size</label>
                                      <select
                                        className="w-full p-3 border border-gray-400 rounded-lg bg-white text-black font-medium"
                                        value={size}
                                        onChange={(e) => setSize(e.target.value)}
                                      >
                                        <option value="" disabled>-- Select Size --</option>
                                        {visibleSizes.map(s => (
                                          <option key={s} value={s}>{s}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                </div>
                            </>
                        )}
                    </section>

                    {/* DESIGN SECTION — availableMainOptions already filters large logos for bottoms (FIX 1) */}
                    {selectedProduct && availableMainOptions.length > 0 && (
                        <section>
                            <div className="flex justify-between items-center mb-3 border-b border-gray-300 pb-2">
                              <h2 className="font-bold text-black">2. Choose Design</h2>
                              <span className="text-xs bg-green-100 text-green-900 px-2 py-1 rounded-full font-bold">Included</span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                <div className="col-span-2 grid grid-cols-2 gap-3">
                                    {availableMainOptions.map((opt) => (
                                        <button key={opt.label} onClick={() => setSelectedMainDesign(opt.label)} className={`border-2 rounded-lg p-2 flex flex-col items-center gap-2 transition-all active:scale-95 ${selectedMainDesign === opt.label ? 'border-green-600 bg-green-50 ring-2 ring-green-200' : 'border-gray-200 bg-white hover:border-gray-400'}`}>
                                            {opt.image_url ? (<img src={opt.image_url} alt={opt.label} className="h-20 w-full object-contain" />) : (<div className="h-20 w-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">No Image</div>)}
                                            <span className={`text-xs font-bold text-center leading-tight ${selectedMainDesign === opt.label ? 'text-green-800' : 'text-gray-800'}`}>{opt.label}</span>
                                            {selectedMainDesign === opt.label && <span className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded-full font-bold">SELECTED ✓</span>}
                                        </button>
                                    ))}
                                </div>
                                {/* ── FIX 3 (placement viz): garmentType uses .type then .name — never .id ── */}
                                <div className="col-span-1">
                                  {(() => {
                                    const currentLogoObj = availableMainOptions.find(o => o.label === selectedMainDesign);
                                    const placement = currentLogoObj?.placement || 'large';
                                    const garmentType = selectedProduct.type || (isBottomSelected ? 'bottom' : 'top');
                                    return <PlacementVisualizer garmentType={garmentType} logoSize={placement} />;
                                  })()}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ACCENTS — availableAccentOptions already filters large logos for bottoms (FIX 1) */}
                    {selectedProduct && availableAccentOptions.length > 0 && (
                        <section>
                            <div className="flex justify-between items-center mb-3 border-b border-gray-300 pb-2">
                              <h2 className="font-bold text-black">3. Add Accents (Optional)</h2>
                              {showPrice && <span className="text-xs bg-blue-100 text-blue-900 px-2 py-1 rounded-full font-bold">+$5.00 each</span>}
                            </div>
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mb-4">
                                {availableAccentOptions.map((opt) => (
                                    <button key={opt.label} onClick={() => addLogo(opt.label)} className="bg-white border border-gray-300 hover:border-blue-500 rounded p-2 flex flex-col items-center gap-1 transition-all active:scale-95">
                                        {opt.image_url ? <img src={opt.image_url} className="h-12 w-full object-contain" /> : <div className="h-12 w-full bg-gray-100 text-[10px] flex items-center justify-center">No Img</div>}
                                        <span className="text-[10px] font-bold text-center leading-tight truncate w-full">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                            {logos.length > 0 && (
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-300 space-y-3">
                                    <h3 className="text-xs font-bold uppercase text-gray-500">Selected Accents (Set Position)</h3>
                                    {logos.map((logo, index) => {
                                        const currentImage = getLogoImage(logo.type);
                                        return (
                                            <div key={index} className="flex items-center gap-3 bg-white p-2 rounded border border-gray-200 shadow-sm">
                                                <div className="w-10 h-10 flex-shrink-0 border rounded bg-gray-50 flex items-center justify-center">{currentImage ? <img src={currentImage} className="max-h-8 max-w-8" /> : <span className="text-xs">IMG</span>}</div>
                                                <div className="flex-1"><div className="text-sm font-bold">{logo.type}</div></div>
                                                <select className={`border-2 p-1 rounded text-sm ${!logo.position ? 'border-red-400 bg-red-50 text-red-900' : 'border-gray-300 text-black'}`} value={logo.position} onChange={(e) => updateLogo(index, 'position', e.target.value)}>
                                                  <option value="">Position...</option>
                                                  {getPositionOptions('logo', true).map(pos => (<option key={pos.id} value={pos.label}>{pos.label}</option>))}
                                                </select>
                                                <button onClick={() => setLogos(logos.filter((_, i) => i !== index))} className="text-gray-400 hover:text-red-600 font-bold text-xl px-2">×</button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    )}

                    {selectedProduct && (showPersonalization || showNumbers) && (
                        <section>
                            <div className="flex justify-between items-center mb-3 border-b border-gray-300 pb-2">
                              <h2 className="font-bold text-black">4. Personalization</h2>
                              {showPrice && <span className="text-xs bg-blue-100 text-blue-900 px-2 py-1 rounded-full font-bold">+$5.00 each</span>}
                            </div>
                            {names.map((nameItem, index) => (
                            <div key={`name-${index}`} className="flex flex-col md:flex-row gap-2 mb-3 bg-gray-50 p-3 rounded border border-gray-300">
                                <input type="text" maxLength={12} placeholder="NAME" className="border border-gray-400 p-2 rounded flex-1 uppercase text-black font-bold" value={nameItem.text} onChange={(e) => updateName(index, 'text', e.target.value)} />
                                <select className="border border-gray-400 p-2 rounded md:w-48 bg-white text-black" value={nameItem.position} onChange={(e) => updateName(index, 'position', e.target.value)}>
                                  <option value="">Select Position...</option>
                                  {getPositionOptions('name').map(pos => <option key={pos.id} value={pos.label}>{pos.label}</option>)}
                                </select>
                                <button onClick={() => setNames(names.filter((_, i) => i !== index))} className="text-red-600 font-bold px-2">×</button>
                            </div>
                            ))}
                            {numbers.map((numItem, index) => (
                            <div key={`num-${index}`} className="flex flex-col md:flex-row gap-2 mb-3 bg-gray-50 p-3 rounded border border-gray-300">
                                <input type="text" maxLength={3} placeholder="NO. (e.g. 24)" className="border border-gray-400 p-2 rounded flex-1 uppercase text-black font-mono font-bold text-center text-lg tracking-widest" value={numItem.text} onChange={(e) => updateNumber(index, 'text', e.target.value.replace(/[^0-9]/g, ''))} />
                                <select className="border border-gray-400 p-2 rounded md:w-48 bg-white text-black" value={numItem.position} onChange={(e) => updateNumber(index, 'position', e.target.value)}>
                                  <option value="">Select Position...</option>
                                  {getPositionOptions('number').map(pos => <option key={pos.id} value={pos.label}>{pos.label}</option>)}
                                </select>
                                <button onClick={() => setNumbers(numbers.filter((_, i) => i !== index))} className="text-red-600 font-bold px-2">×</button>
                            </div>
                            ))}
                            <div className="flex gap-2 mt-3">
                                {showPersonalization && (
                                    <button onClick={() => setNames([...names, { text: '', position: '' }])} className="flex-1 py-2 border-2 border-dashed border-gray-400 text-gray-700 rounded hover:border-blue-600 hover:text-blue-600 font-bold bg-white">+ Add Name</button>
                                )}
                                {showNumbers && (
                                    <button onClick={() => setNumbers([...numbers, { text: '', position: '' }])} className="flex-1 py-2 border-2 border-dashed border-gray-400 text-gray-700 rounded hover:border-blue-600 hover:text-blue-600 font-bold bg-white">+ Add Number</button>
                                )}
                            </div>
                        </section>
                    )}
                    
                    {selectedProduct && showBackNames && (
                        <section className="bg-yellow-50 p-4 rounded-lg border border-yellow-300 space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-6 h-6 text-blue-800" checked={backNameList} onChange={(e) => { setBackNameList(e.target.checked); if (!e.target.checked) { setMetallicHighlight(false); setBackListConfirmed(false); setMetallicName(''); } }} />
                                <span className="font-bold text-black text-lg">Back Name List {showPrice && '(+$5)'}</span>
                            </label>
                            {backNameList && (
                                <div className="ml-8 space-y-3 border-l-4 border-yellow-300 pl-4">
                                    <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded border border-yellow-200 shadow-sm">
                                      <input type="checkbox" className="w-6 h-6 text-green-600" checked={backListConfirmed} onChange={(e) => setBackListConfirmed(e.target.checked)} />
                                      <span className="text-sm font-bold text-red-600">I have checked the list at the table and found my athlete.</span>
                                    </label>
                                    {showMetallic && (
                                        <div className="pt-2">
                                            <label className="flex items-center gap-3 cursor-pointer mb-2">
                                              <input type="checkbox" className="w-5 h-5 text-blue-800" checked={metallicHighlight} onChange={(e) => setMetallicHighlight(e.target.checked)} />
                                              <span className="font-bold text-black">Add Metallic Highlight {showPrice && '(+$5)'}</span>
                                            </label>
                                            {metallicHighlight && (
                                                <div>
                                                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Athlete Name to Highlight:</label>
                                                  <input type="text" className="w-full p-3 border-2 border-blue-400 rounded font-bold uppercase text-black" placeholder="ENTER NAME HERE" value={metallicName} onChange={(e) => setMetallicName(e.target.value)} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    )}
                  </>
              )}
            </div>
            
            {(paymentMode === 'retail' || selectedGuest) && (
                <div className="text-white p-6 sticky bottom-0 flex justify-between items-center" style={{ backgroundColor: headerColor }}>
                  <div>
                    <p className="text-white text-opacity-80 text-xs uppercase">{showPrice ? 'Current Item' : 'Your Selection'}</p>
                    <p className="text-2xl font-bold">{showPrice ? `$${calculateItemTotal()}` : 'Free'}</p>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    disabled={!selectedProduct || !size || (hasMultipleColors && !selectedColor)}
                    className="bg-white text-black px-6 py-3 rounded-lg font-bold shadow-lg active:scale-95 transition-transform hover:opacity-90 disabled:opacity-40"
                  >
                    Add to Cart
                  </button>
                </div>
            )}
          </div>
        </div>
        
        {(paymentMode === 'retail' || selectedGuest) && (
            <div className="md:col-span-1">
            <div className="bg-white shadow-xl rounded-xl border border-gray-300 sticky top-4">
                <div className="text-white p-4 rounded-t-xl" style={{ backgroundColor: headerColor }}>
                  <h2 className="font-bold text-lg">Your Cart</h2>
                  <p className="text-white text-opacity-80 text-sm">{cart.length} item{cart.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
                {cart.length === 0 ? <p className="text-gray-500 text-center italic py-10">Cart is empty.</p> : cart.map((item) => (
                    <div key={item.id} className="border-b border-gray-200 pb-4 last:border-0 relative">
                    <button onClick={() => removeItem(item.id)} className="absolute top-0 right-0 text-red-500 hover:text-red-700 font-bold text-xs p-1">REMOVE</button>
                    <p className="font-black text-black text-lg pr-16">{item.productName}</p>
                    {item.needsShipping && <span className="bg-orange-200 text-orange-800 text-xs font-bold px-2 py-1 rounded">Ship to Home</span>}
                    {item.color && <p className="text-sm text-gray-600 font-bold">Color: {item.color}</p>}
                    <p className="text-sm text-gray-800 font-medium">Size: {item.size}</p>
                    <div className="text-xs text-blue-900 font-bold mt-1">Design: {item.customizations.mainDesign || 'None'}</div>
                    <div className="text-xs text-gray-800 mt-1 space-y-0.5 font-medium">
                        {item.customizations.logos.map((l, i) => <div key={'logo'+i}>• {l.type} ({l.position})</div>)}
                        {item.customizations.names.map((n, i) => <div key={'name'+i}>• "{n.text}" ({n.position})</div>)}
                        {item.customizations.numbers?.map((num, i) => <div key={'num'+i}>• #{num.text} ({num.position})</div>)}
                        {item.customizations.backList && <div>• Back Name List</div>}
                        {item.customizations.metallic && <div>• Metallic: {item.customizations.metallicName}</div>}
                    </div>
                    {showPrice && <p className="font-bold text-right mt-2 text-blue-900 text-lg">${item.finalPrice.toFixed(2)}</p>}
                    </div>
                ))}
                </div>
                {cart.length > 0 && (
                <div className="p-4 bg-gray-100 border-t border-gray-300 rounded-b-xl">
                    <h3 className="font-bold text-black mb-2">Checkout Details</h3>
                    {paymentMode === 'hosted' && selectedGuest ? (
                        <div className="bg-green-100 text-green-900 p-2 rounded mb-4 font-bold text-sm">Guest: {selectedGuest.name}</div>
                    ) : (
                        <>
                            <input className="w-full p-2 border border-gray-400 rounded mb-2 text-sm text-black" placeholder="Full Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                            <input className="w-full p-2 border border-gray-400 rounded mb-2 text-sm text-black" placeholder="Email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                            <input className="w-full p-2 border border-gray-400 rounded mb-1 text-sm text-black" placeholder="Phone Number" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                            <p className="text-[10px] text-gray-500 leading-tight mb-4">By providing your phone number, you agree to receive automated transactional text messages from Lev Custom Merch.</p>
                        </>
                    )}
                    {cartRequiresShipping && paymentMode !== 'hosted' && (
                    <div className="bg-orange-50 border border-orange-200 p-3 rounded mb-4">
                      <h4 className="font-bold text-orange-800 text-sm mb-2">🚚 Shipping Address Required</h4>
                      <input className="w-full p-2 border border-gray-300 rounded mb-2 text-sm" placeholder="Street Address" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} />
                      <div className="grid grid-cols-2 gap-2">
                        <input className="w-full p-2 border border-gray-300 rounded mb-2 text-sm" placeholder="City" value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} />
                        <input className="w-full p-2 border border-gray-300 rounded mb-2 text-sm" placeholder="State" value={shippingState} onChange={(e) => setShippingState(e.target.value)} />
                      </div>
                      <input className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="Zip Code" value={shippingZip} onChange={(e) => setShippingZip(e.target.value)} />
                    </div>
                    )}
                    {showPrice && (
                        <div className="mt-4 border-t-2 border-gray-200 pt-4 space-y-2 mb-6">
                            <div className="flex justify-between text-sm font-bold text-gray-600 uppercase"><span>Subtotal</span><span>${calculateSubtotal().toFixed(2)}</span></div>
                            {taxEnabled && taxRate > 0 && (<div className="flex justify-between text-sm font-bold text-gray-600 uppercase"><span>Sales Tax ({taxRate}%)</span><span>${calculateTax().toFixed(2)}</span></div>)}
                            <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
                                <span className="font-black text-black uppercase tracking-widest">Total Due</span>
                                <span className="font-black text-2xl text-blue-900">${calculateGrandTotal().toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                    <div className="space-y-3">
                        {paymentMode === 'retail' && retailPaymentMethod === 'terminal' && (
                            <button onClick={handleTerminalCheckout} disabled={isSubmitting || isTerminalProcessing} className={`w-full py-4 text-xl font-bold rounded-xl shadow-lg transition-all text-white flex items-center justify-center gap-2 ${isTerminalProcessing ? 'bg-purple-600 animate-pulse cursor-wait' : 'bg-purple-700 hover:bg-purple-800'}`}>
                                {isTerminalProcessing ? <span>📟 {terminalStatus}</span> : <span>📟 Pay with Card (Terminal)</span>}
                            </button>
                        )}
                        {((paymentMode === 'retail' && retailPaymentMethod !== 'terminal') || paymentMode === 'hosted') && (
                            <button onClick={handleCheckout} disabled={isSubmitting || isTerminalProcessing || (paymentMode === 'hosted' && !selectedGuest)} className={`w-full py-3 rounded-lg font-bold shadow transition-colors text-white ${isSubmitting || isTerminalProcessing ? 'bg-gray-400' : 'hover:opacity-90'}`} style={{ backgroundColor: (isSubmitting || isTerminalProcessing) ? 'gray' : headerColor }}>
                                {isSubmitting ? "Processing..." : (paymentMode === 'hosted' ? "🎉 Submit Order (Free)" : "Pay via Stripe Link")}
                            </button>
                        )}
                        {paymentMode === 'retail' && (
                            <button onClick={handleCashCheckout} disabled={isSubmitting || isTerminalProcessing} className="w-full py-3 bg-green-600 text-white font-bold rounded-lg shadow hover:bg-green-700 transition-colors flex items-center justify-center gap-2">💵 Pay with Cash</button>
                        )}
                    </div>
                </div>
                )}
            </div>
            </div>
        )}
      </div>
    </div>
  );
}

// ── PlacementVisualizer: shows where the logo sits on the garment ──
const PlacementVisualizer = ({ garmentType, logoSize }) => {
  // garmentType comes from product.type ('top' or 'bottom')
  const isBottom = garmentType === 'bottom';
  const accentColor = "#1e3a8a";

  const TopSVG = () => (
    <svg viewBox="0 0 200 220" className="w-28 h-28 drop-shadow">
      {/* Hoodie body */}
      <path d="M60 30 L35 65 L60 75 L60 190 L140 190 L140 75 L165 65 L140 30 Q100 50 60 30Z" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="2" />
      {/* Hood */}
      <path d="M75 30 Q100 10 125 30 Q110 45 100 48 Q90 45 75 30Z" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" />
      {/* Pocket */}
      <rect x="78" y="130" width="44" height="30" rx="3" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1" />

      {logoSize === 'large' ? (
        // Full front — large centered rectangle
        <rect x="72" y="75" width="56" height="48" rx="4" fill={accentColor} fillOpacity="0.75">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
        </rect>
      ) : (
        // Left chest — small circle
        <circle cx="82" cy="85" r="10" fill={accentColor} fillOpacity="0.85">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );

  const BottomSVG = () => (
    <svg viewBox="0 0 200 220" className="w-28 h-28 drop-shadow">
      {/* Jogger waistband */}
      <rect x="55" y="20" width="90" height="18" rx="4" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" />
      {/* Left leg */}
      <path d="M55 38 L65 200 L100 200 L100 38Z" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1.5" />
      {/* Right leg */}
      <path d="M145 38 L135 200 L100 200 L100 38Z" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1.5" />
      {/* Left thigh logo spot */}
      <circle cx="75" cy="80" r="10" fill={accentColor} fillOpacity="0.85">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );

  return (
    <div className="flex flex-col items-center justify-center p-3 bg-white rounded-lg border border-gray-200 h-full min-h-[140px]">
      {isBottom ? <BottomSVG /> : <TopSVG />}
      <p className="text-[10px] font-black text-gray-400 uppercase mt-2 text-center leading-tight">
        {isBottom
          ? 'Thigh / Pocket'
          : logoSize === 'large'
            ? 'Full Front / Center'
            : 'Left Chest / Pocket'}
      </p>
    </div>
  );
};