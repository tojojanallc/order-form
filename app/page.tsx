// @ts-nocheck
'use client'; 

import React, { useState, useEffect } from 'react'; 
import { createClient } from '@supabase/supabase-js';
import { useParams } from 'next/navigation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const SIZE_ORDER = [
  'YXS', 'YS', 'YM', 'YL', 'YXL', 'YXL2',
  'Youth XS', 'Youth S', 'Youth M', 'Youth L', 'Youth XL',
  'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL',
  'Adult XS', 'Adult S', 'Adult M', 'Adult L', 'Adult XL', 'Adult XXL', 'Adult 3XL', 'Adult 4XL',
  '2T', '3T', '4T',
];

const ZONES = {
    top: [
        { id: 'full_front', label: 'Full Front', type: 'logo' }, { id: 'left_chest', label: 'Left Chest', type: 'logo' },
        { id: 'center_chest', label: 'Center Chest', type: 'logo' }, { id: 'left_sleeve', label: 'Left Sleeve', type: 'both' },
        { id: 'right_sleeve', label: 'Right Sleeve', type: 'both' }, { id: 'back_center', label: 'Back Center', type: 'both' },
        { id: 'back_bottom', label: 'Back Bottom', type: 'name' }
    ],
    hoodie: [
        { id: 'left_chest', label: 'Left Chest', type: 'logo' },
        { id: 'center_chest', label: 'Center Chest', type: 'logo' },
        { id: 'full_front', label: 'Full Front', type: 'logo' },
        { id: 'left_sleeve', label: 'Left Sleeve', type: 'both' },
        { id: 'right_sleeve', label: 'Right Sleeve', type: 'both' },
        { id: 'back_center', label: 'Back Center', type: 'both' },
        { id: 'back_bottom', label: 'Back Bottom', type: 'name' }
    ],
    bottom: [
        { id: 'left_thigh', label: 'Left Thigh (Upper)', type: 'both' }, { id: 'right_thigh', label: 'Right Thigh (Upper)', type: 'both' },
        { id: 'back_pocket', label: 'Back Pocket', type: 'logo' }, { id: 'rear', label: 'Rear (Center)', type: 'both' }           
    ]
};

// Parses "Colortone Spider T-Shirt | L | Silver" → { baseName, size, color }
const parseProductId = (id) => {
  const parts = id.split('|').map(s => s.trim());
  if (parts.length === 3) return { baseName: parts[0], size: parts[1], color: parts[2] };
  if (parts.length === 2) return { baseName: parts[0], size: parts[1], color: null };
  return { baseName: id, size: null, color: null };
};

const mergedName = (name) => name.replace(/\s*\b(Youth|Ladies)\b\s*/gi, ' ').trim();
const displayName = (name, allProducts) => {
  const merged = mergedName(name);
  const hasAdult = allProducts.some(p => mergedName(p.name) === merged && !p.name.match(/\b(Youth|Ladies)\b/i));
  if (!hasAdult && name.match(/\bYouth\b/i)) return merged + ' Youth';
  if (!hasAdult && name.match(/\bLadies\b/i)) return merged + ' Ladies';
  return merged;
};

export default function OrderForm() {
  const params = useParams();
  
  const [actualEventSlug, setActualEventSlug] = useState('');
  const [cart, setCart] = useState([]); 
  const [cartPulse, setCartPulse] = useState(false);
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
  const [assignedSiteName, setAssignedSiteName] = useState('');
  const [assignedPrinterId, setAssignedPrinterId] = useState('');
  const [guests, setGuests] = useState([]);
  const [selectedGuest, setSelectedGuest] = useState(null); 
  const [guestSearch, setGuestSearch] = useState('');
  const [guestError, setGuestError] = useState(''); 
  const [openGuestEntry, setOpenGuestEntry] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [products, setProducts] = useState([]); 
  const [inventory, setInventory] = useState({});
  const [activeItems, setActiveItems] = useState({});
  const [logoOptions, setLogoOptions] = useState([]); 
  const [mainOptions, setMainOptions] = useState([]); 
  const [accentOptions, setAccentOptions] = useState([]); 
  const [eventName, setEventName] = useState('Lev Custom Merch');
  const [eventLogo, setEventLogo] = useState('');
  const [headerColor, setHeaderColor] = useState('#1e3a8a');
  const [welcomeMessage, setWelcomeMessage] = useState(''); 
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
  // Order lookup
  const [showLookup, setShowLookup] = useState(false);
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResults, setLookupResults] = useState<any[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [names, setNames] = useState([]);
  const [numbers, setNumbers] = useState([]); 
  const [backNameList, setBackNameList] = useState(false);
  const [metallicHighlight, setMetallicHighlight] = useState(false);
  const [backListConfirmed, setBackListConfirmed] = useState(false);
  const [metallicName, setMetallicName] = useState('');
  const [metallicTeam, setMetallicTeam] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [availableTerminals, setAvailableTerminals] = useState([]);
  const [ignoreInventory, setIgnoreInventory] = useState(false);
  const [manualShipOverride, setManualShipOverride] = useState(false);

  const isBottomSelected = selectedProduct ? (
    selectedProduct.type === 'bottom' || 
    (selectedProduct.name || '').toLowerCase().match(/jogger|sweatpant|short(?!.*hoodie)|pant(?!.*hoodie)/)
  ) : false;

  const isHoodieSelected = selectedProduct ? (
    selectedProduct.type === 'hoodie' ||
    (selectedProduct.name || '').toLowerCase().match(/hoodie|hooded/)
  ) : false;

  const availableMainOptions = mainOptions.filter(opt => !(isBottomSelected && opt.placement === 'large'));
  const availableAccentOptions = accentOptions.filter(opt => !(isBottomSelected && opt.placement === 'large'));

  useEffect(() => {
    if (availableMainOptions.length === 1) setSelectedMainDesign(availableMainOptions[0].label);
    else if (availableMainOptions.length === 0) setSelectedMainDesign('');
    else if (selectedMainDesign) {
        const isValid = availableMainOptions.find(o => o.label === selectedMainDesign);
        if (!isValid) {
            // Current selection invalid — default to large placement
            const largePref = availableMainOptions.find(o => o.placement === 'large');
            setSelectedMainDesign(largePref ? largePref.label : availableMainOptions[0].label);
        }
    } else {
        // Nothing selected yet — default to large
        const largePref = availableMainOptions.find(o => o.placement === 'large');
        if (largePref) setSelectedMainDesign(largePref.label);
    }
  }, [selectedProduct, mainOptions]);

  useEffect(() => {
    let slug = params?.slug;
    if (!slug && typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        slug = searchParams.get('event');
        if (!slug) {
            const reserved = ['setup', 'admin', 'pos-callback', 'success', 'board'];
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            const lastPart = pathParts[pathParts.length - 1];
            if (lastPart && !reserved.includes(lastPart)) {
                slug = lastPart;
            }
        }
    }
    // If no slug was found in the URL, leave it blank — fetchData will find the active event
    const urlSlug = slug || '';
    setActualEventSlug(urlSlug); // may be updated below once we resolve the active event

    // Read terminal ID from URL param first (?terminal=xxx), fall back to localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const urlTerminalId = urlParams.get('terminal');
    const urlSiteName = urlParams.get('site');
    const urlPrinterId = urlParams.get('printer');
    if (urlTerminalId) {
        setAssignedTerminalId(urlTerminalId);
        localStorage.setItem('square_terminal_id', urlTerminalId);
    } else {
        const savedId = localStorage.getItem('square_terminal_id');
        if (savedId) setAssignedTerminalId(savedId);
    }
    if (urlSiteName) {
        setAssignedSiteName(urlSiteName);
        localStorage.setItem('site_name', urlSiteName);
    } else {
        const savedSite = localStorage.getItem('site_name');
        if (savedSite) setAssignedSiteName(savedSite);
    }
    if (urlPrinterId) {
        setAssignedPrinterId(urlPrinterId);
        localStorage.setItem('printer_id', urlPrinterId);
    } else {
        const savedPrinter = localStorage.getItem('printer_id');
        if (savedPrinter) setAssignedPrinterId(savedPrinter);
    }

    if (typeof window !== 'undefined' && urlParams.get('setup') === 'true') {
        setShowSetup(true); 
        fetchTerminals(); 
    }

    const fetchData = async () => {
      if (!supabase) return;

      // Resolve slug: use URL slug if provided, otherwise find the active event
      let finalSlug = urlSlug;
      if (!finalSlug || finalSlug === 'default') {
        const { data: activeEvent } = await supabase
          .from('event_settings')
          .select('slug')
          .eq('status', 'active')
          .order('id', { ascending: false })
          .limit(1)
          .single();
        finalSlug = activeEvent?.slug || 'default';
      }
      setActualEventSlug(finalSlug);
      localStorage.setItem('event_slug', finalSlug);

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
        setIgnoreInventory(!!settings.ignore_inventory);
        setOpenGuestEntry(!!settings.open_guest_entry);
        setWelcomeMessage(settings.welcome_message || '');
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

  const selectTerminal = (id, siteName, printerId) => {
      localStorage.setItem('square_terminal_id', id);
      localStorage.setItem('site_name', siteName || '');
      localStorage.setItem('printer_id', printerId || '');
      setAssignedTerminalId(id);
      setAssignedSiteName(siteName || '');
      setAssignedPrinterId(printerId || '');
      const url = new URL(window.location.href);
      url.searchParams.set('terminal', id);
      if (siteName) url.searchParams.set('site', siteName);
      if (printerId) url.searchParams.set('printer', printerId);
      window.history.replaceState({}, '', url.toString());
      alert(`✅ iPad configured!\nSite: ${siteName || 'Default'}\nTerminal: ${id}\nPrinter: ${printerId || 'Default'}`);
      setShowSetup(false);
  };

  const verifyGuest = async () => {
      if (!guestSearch.trim()) return;
      setGuestError('');

      if (openGuestEntry) {
          // Open-entry mode: no pre-loaded list — check/create via API
          setGuestLoading(true);
          try {
              const res = await fetch('/api/check-or-create-guest', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: guestSearch.trim(), event_slug: actualEventSlug }),
              });
              const data = await res.json();
              if (data.status === 'already_ordered') {
                  setGuestError("🎁 Looks like you already got your swag! If you think this is a mistake, see a staff member.");
                  setSelectedGuest(null);
              } else if (data.status === 'ready') {
                  setSelectedGuest({ id: data.guestId, name: data.name, has_ordered: false });
                  setCustomerName(data.name);
                  setGuestError('');
              } else {
                  setGuestError("Something went wrong. Please try again.");
              }
          } catch {
              setGuestError("Network error. Please try again.");
          } finally {
              setGuestLoading(false);
          }
          return;
      }

      // Pre-loaded guest list mode (existing behavior)
      const search = guestSearch.trim().toLowerCase();
      const match = guests.find(g => g.name.toLowerCase() === search);
      if (match) {
          if (match.has_ordered) { setGuestError("❌ This name has already redeemed their item."); setSelectedGuest(null); } 
          else { setSelectedGuest(match); setCustomerName(match.name); setGuestError(''); }
      } else { setGuestError("❌ Name not found. Please type your full name exactly."); setSelectedGuest(null); }
  };

  // ─���─ PRODUCT VISIBILITY ───────────────────────────────────────────────────
  // Each product row in the DB represents exactly ONE size+color variant.
  // e.g. id = "Gildan Heavy Blend Hoodie | YL | Light Pink"
  // The inventory key is: product_id + "_" + size
  // e.g. "Gildan Heavy Blend Hoodie | YL | Light Pink_YL"
  // We read the size directly out of p.id via parseProductId — no scanning needed.
  // This guarantees youth products only ever show youth sizes and vice versa.

  const visibleProducts = [];
  const seenNames = new Set();
  products.forEach(p => {
    const { size: sizeInId } = parseProductId(p.id);
    if (!sizeInId) return;
    const key = `${p.id}_${sizeInId}`;
    const isActive = !!activeItems[key];
    const hasStock = paymentMode !== 'hosted' || (inventory[key] || 0) > 0;
        if (isActive && hasStock && !seenNames.has(mergedName(p.name))) {
            seenNames.add(mergedName(p.name));
      visibleProducts.push(p);
    }
  });

  useEffect(() => {
      if (visibleProducts.length > 0) {
                    if (!selectedProduct || !visibleProducts.find(p => mergedName(p.name) === mergedName(selectedProduct.name))) {
              setSelectedProduct(visibleProducts[0]);
          }
      } else {
          setSelectedProduct(null); 
      }
  }, [JSON.stringify(visibleProducts.map(p => p.id)), selectedProduct]);

  // All product rows sharing the selected product's display name (one row per size+color variant)
    const matchingProducts = selectedProduct
    ? products.filter(p => {
        if (mergedName(p.name) !== mergedName(selectedProduct.name)) return false;
        // Only include if there's an active inventory entry for this event
        const { size: sizeInId } = parseProductId(p.id);
        if (!sizeInId) return false;
        const key = `${p.id}_${sizeInId}`;
        return activeItems[key] === true;
      })
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
        const ids = products.filter(p => mergedName(p.name) === mergedName(selectedProduct.name));
    const colors = [...new Set(ids.map(p => parseProductId(p.id).color).filter(Boolean))];
    setSelectedColor(colors.length > 0 ? colors[0] : '');
    setSize('');
  }, [selectedProduct?.name]);

  // Sizes: read directly from each matching product's id — no inventory scanning needed.
  // Each product row IS one size. Filter by color if multi-color, then check active+stock.
 const getVisibleSizes = () => {
    const validSizes = new Map(); // size -> label
    matchingProducts.forEach(p => {
      const { size: sizeInId, color } = parseProductId(p.id);
      if (!sizeInId) return;
      if (hasMultipleColors && color !== selectedColor) return;
      const key = `${p.id}_${sizeInId}`;
      if (!activeItems[key]) return;
      if (paymentMode === 'hosted' && (inventory[key] || 0) <= 0) return;
      const isYouth = p.name.toLowerCase().includes('youth');
      const label = isYouth && !sizeInId.startsWith('Y') ? `Youth ${sizeInId}` : sizeInId;
      validSizes.set(sizeInId, { value: sizeInId, label });
    });
    return Array.from(validSizes.values()).sort((a, b) => {
      const ai = SIZE_ORDER.indexOf(a.value);
      const bi = SIZE_ORDER.indexOf(b.value);
      if (ai === -1 && bi === -1) return a.value.localeCompare(b.value);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
};

  const visibleSizes = getVisibleSizes();

  useEffect(() => {
      if (visibleSizes.length > 0 && selectedProduct) {
          if (!size || !visibleSizes.some(s => s.value === size)) {
              if (paymentMode === 'hosted' && selectedGuest?.size && visibleSizes.some(s => s.value === selectedGuest.size)) {
                  setSize(selectedGuest.size);
              } else {
                  setSize(visibleSizes[0]?.value);
              }
          }
      }
  }, [selectedProduct, selectedColor, visibleSizes.map(s => s.value).join(','), paymentMode, selectedGuest]);
  
  // Stock lookup: find the product row matching the selected color, use its key
  const currentStock = (() => {
    if (!selectedProduct || !size) return 0;
    let totalBaseStock = 0;
    matchingProducts.forEach(p => {
      const parsed = parseProductId(p.id);
      if (hasMultipleColors && parsed.color !== selectedColor) return;
      if (parsed.size !== size) return;
      const key = `${p.id}_${size}`;
      totalBaseStock += (inventory[key] || 0);
    });
    const qtyInCart = cart.filter(item =>
      item.productName === selectedProduct.name &&
      item.size === size &&
      (!hasMultipleColors || item.color === selectedColor)
    ).length;
    return totalBaseStock - qtyInCart;
  })();
  const isOutOfStock = manualShipOverride ? true : (ignoreInventory ? false : currentStock <= 0);

  // The color-specific product record (has the correct image_url for the selected color)
  const selectedProductRecord = (() => {
    if (!selectedProduct) return null;
    if (!hasMultipleColors) {
      // Find the row matching the currently selected size, or fall back to first
      return matchingProducts.find(p => parseProductId(p.id).size === size) || matchingProducts[0] || selectedProduct;
    }
    return matchingProducts.find(p => {
      const parsed = parseProductId(p.id);
      return parsed.color === selectedColor && parsed.size === size;
    }) || matchingProducts.find(p => parseProductId(p.id).color === selectedColor) || selectedProduct;
  })();

  const getPositionOptions = (itemType, isAccent = false) => {
      if (!selectedProduct) return [];
      const pType = isBottomSelected ? 'bottom' : isHoodieSelected ? 'hoodie' : 'top';
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

  const sendConfirmationSMS = async (name, phone, orderId = '') => {
      if (!phone || phone.length < 10) return;
      const orderRef = orderId ? ` Your order number is #${orderId}.` : '';
      fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phone, message: `Hi ${name}! Thanks for your order from Lev Custom Merch at ${eventName}.${orderRef} We will text you again when it's ready for pickup!` })
      }).catch(err => console.error("SMS Failed:", err));
  };


  const lookupOrders = async () => {
    if (!lookupQuery.trim() || !supabase) return;
    setLookupLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("event_slug", actualEventSlug)
      .ilike("customer_name", `%${lookupQuery.trim()}%`)
      .order("created_at", { ascending: false })
      .limit(10);
    setLookupResults(data || []);
    setLookupLoading(false);
  };

  const sendReceiptEmail = async (orderId, name, email, cartData, totalAmount) => {
      if (!email || !email.includes('@')) return;
      if (paymentMode === 'hosted') return;
      try {
          await fetch('/api/send-receipt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, name, cart: cartData, total: totalAmount, orderId, eventName, eventLogo, shippingInfo: cartRequiresShipping ? { address: shippingAddress, city: shippingCity, state: shippingState, zip: shippingZip } : null })
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
          metallicName: metallicHighlight ? metallicName : '',
          metallicTeam: metallicHighlight ? metallicTeam : ''
      },
      finalPrice: calculateItemTotal() 
    };
    
    setCart([...cart, newItem]);
    // Pulse the add-to-cart bar
    setCartPulse(true); setTimeout(() => setCartPulse(false), 500);
    // Play a subtle success chime
    try {
      const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      const play = (freq: number, t: number, dur: number) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.start(t); o.stop(t + dur);
      };
      play(523, ctx.currentTime, 0.12);
      play(659, ctx.currentTime + 0.1, 0.15);
      play(784, ctx.currentTime + 0.2, 0.2);
    } catch(e) {}
    setLogos([]); setNames([]); setNumbers([]);
    setBackNameList(false); setMetallicHighlight(false);
    setBackListConfirmed(false); setMetallicName(''); setMetallicTeam('');
    setManualShipOverride(false);
    if (availableMainOptions.length > 1) setSelectedMainDesign(''); 
  };

  const removeItem = (itemId) => setCart(cart.filter(item => item.id !== itemId));

  const editItem = (item) => {
    // Remove from cart
    setCart(cart.filter(c => c.id !== item.id));
    // Re-populate customization state
    const prod = products.find(p => p.id === item.productId);
    if (prod) setSelectedProduct(prod);
    setSize(item.size);
    setSelectedMainDesign(item.customizations?.mainDesign || '');
    setLogos(item.customizations?.logos || []);
    setNames(item.customizations?.names || []);
    setNumbers(item.customizations?.numbers || []);
    setMetallicHighlight(item.customizations?.metallic || false);
    setMetallicName(item.customizations?.metallicName || '');
    setMetallicTeam(item.customizations?.metallicTeam || '');
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
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
            body: JSON.stringify({ cart, customerName, customerPhone, customerEmail, total: calculateGrandTotal(), taxCollected: calculateTax(), eventSlug: actualEventSlug, eventName, site: assignedSiteName })
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
        if (!payRes.ok) {
            const errData = await payRes.json();
            throw new Error(errData.details || errData.error || 'Terminal connection failed');
        }
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
            sendConfirmationSMS(customerName, customerPhone, orderId);
            sendReceiptEmail(orderId, customerName, customerEmail, cart, calculateGrandTotal());
            setLastOrderId(orderId);
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

  const handleBluetoothCheckout = async () => {
    if (cart.length === 0) return alert('Cart is empty');
    if (!customerName) return alert('Please enter customer name');
    setIsSubmitting(true);
    try {
      // 1. Create order in Supabase first (pending)
      const res = await fetch('/api/create-retail-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart, customerName, customerPhone, customerEmail,
          total: calculateGrandTotal(), taxCollected: calculateTax(),
          eventName, eventSlug: actualEventSlug,
          shippingInfo: cartRequiresShipping ? { address: shippingAddress, city: shippingCity, state: shippingState, zip: shippingZip } : null,
          paymentMethod: 'bluetooth_reader',
          status: 'pending_bluetooth',
          site: assignedSiteName,
        }),
      });
      const orderData = await res.json();
      if (!orderData.orderId) throw new Error('Failed to create order');

      // 2. Stash order info for callback page
      localStorage.setItem('pos_pending_order_id', String(orderData.orderId));
      localStorage.setItem('pos_pending_order_total', String(calculateGrandTotal()));
      localStorage.setItem('pos_kiosk_url', window.location.href);

      // 3. Build Square POS deep link (iOS)
      const amountCents = Math.round(calculateGrandTotal() * 100);
      const callbackUrl = `${window.location.origin}/pos-callback`;
      const posData = {
        amount_money: { amount: String(amountCents), currency_code: 'USD' },
        callback_url: callbackUrl,
        client_id: 'sq0idp-scUIT7LGS8Sk4sEBJy8ElQ',
        version: '1.3',
        notes: `Order #${orderData.orderId} - ${eventName}`,
        options: { supported_tender_types: ['CREDIT_CARD', 'CASH', 'OTHER', 'SQUARE_GIFT_CARD'] },
      };

      // 4. Launch Square POS app
      window.location.href = `square-commerce-v1://payment/create?data=${encodeURIComponent(JSON.stringify(posData))}`;

    } catch (err: any) {
      alert(`Error: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  const handleCashCheckout = async () => {
    if (cart.length === 0) return alert('Cart is empty');
    if (!customerName) return alert("Please enter Name");
    if (!confirm("Confirm Pay with Cash?")) return;
    setIsSubmitting(true); 
    try {
        const res = await fetch('/api/create-cash-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart, customerName, customerPhone, customerEmail, total: calculateGrandTotal(), taxCollected: calculateTax(), eventName, eventSlug: actualEventSlug, shippingInfo: cartRequiresShipping ? { address: shippingAddress, city: shippingCity, state: shippingState, zip: shippingZip } : null, site: assignedSiteName })
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
        if (!ignoreInventory) {
  await decrementInventory(cart);
}
        setLastOrderId(data.orderId); 
        if (customerPhone) sendConfirmationSMS(customerName, customerPhone, data.orderId);
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
            sendConfirmationSMS(selectedGuest.name, customerPhone || "N/A", data.orderId);
            setOrderComplete(true);
            setCart([]);
            setSelectedGuest(null);
            setGuestSearch('');
            setIsSubmitting(false); 
        } catch (err) {
            // Network error — the order may have still gone through.
            // Check if the guest is now marked as having ordered.
            try {
                const check = await fetch('/api/check-or-create-guest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: selectedGuest.name, event_slug: actualEventSlug }),
                });
                const checkData = await check.json();
                if (checkData.status === 'already_ordered') {
                    // Order went through despite the network error — show success
                    setOrderComplete(true);
                    setCart([]);
                    setSelectedGuest(null);
                    setGuestSearch('');
                    setIsSubmitting(false);
                    return;
                }
            } catch (e2) { /* ignore secondary check failure */ }
            alert("Something went wrong. Please try again or see a staff member.");
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
      setManualShipOverride(false);
      // inventory / stock maps
if (!ignoreInventory) {
  const { data: invData } = await supabase
    .from('inventory')
    .select('*')
    .eq('event_slug', finalSlug);

  if (invData) {
    const stockMap = {};
    const activeMap = {};
    const priceMap = {};
    invData.forEach((item) => {
      const key = `${item.product_id}_${item.size}`;
      stockMap[key] = item.count;
      activeMap[key] = item.active;
      if (item.override_price != null) priceMap[item.product_id] = item.override_price;
    });
    setInventory(stockMap);
    setActiveItems(activeMap);
    setPriceOverrides(priceMap);
  }
} else {
  setInventory({});
  setActiveItems({});
  setPriceOverrides({});
}
      window.scrollTo(0, 0);
  };

  if (showSetup) {
      const [setupSiteName, setSetupSiteName] = (window as any)._setupState || [assignedSiteName, (v) => { (window as any)._setupState = [v, (window as any)._setupState?.[1]]; }];

      return (
          <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
              <h1 className="text-3xl font-bold mb-2">🛠️ Kiosk Setup</h1>
              <p className="text-gray-400 text-center mb-6 text-sm">Configure this iPad's site, printer, and payment device</p>
              <div className="space-y-4 w-full max-w-md">

                  {/* Site Name */}
                  <div className="bg-gray-800 rounded-xl p-4 border border-gray-600">
                      <label className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2 block">Site Name</label>
                      <input
                          className="w-full bg-gray-700 border border-gray-500 rounded-lg px-4 py-3 text-white font-bold text-lg focus:outline-none focus:border-blue-400"
                          placeholder="e.g. Site A, North Entrance, Main Table"
                          defaultValue={assignedSiteName}
                          id="setup-site-name"
                      />
                  </div>

                  {/* Printer ID */}
                  <div className="bg-gray-800 rounded-xl p-4 border border-gray-600">
                      <label className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2 block">PrintNode Printer ID</label>
                      <input
                          className="w-full bg-gray-700 border border-gray-500 rounded-lg px-4 py-3 text-white font-mono font-bold focus:outline-none focus:border-blue-400"
                          placeholder="e.g. 12345678"
                          defaultValue={assignedPrinterId}
                          id="setup-printer-id"
                      />
                      <p className="text-xs text-gray-500 mt-1">Find in Admin → Settings → Cloud Printing</p>
                  </div>

                  <div className="border-t border-gray-700 pt-4">
                      <p className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Payment Device</p>
                  </div>

                  {/* Bluetooth Reader option */}
                  <button onClick={() => {
                      const site = (document.getElementById('setup-site-name') as HTMLInputElement)?.value || '';
                      const printer = (document.getElementById('setup-printer-id') as HTMLInputElement)?.value || '';
                      selectTerminal('BLUETOOTH_READER', site, printer);
                  }} className={`w-full bg-gray-800 border p-4 rounded-lg text-lg font-bold hover:bg-blue-600 hover:border-blue-400 transition-colors ${assignedTerminalId === 'BLUETOOTH_READER' ? 'border-blue-400 bg-blue-700' : 'border-gray-600'}`}>
                    📱 Bluetooth Reader
                    <span className="block text-xs font-normal text-gray-400 mt-1">Square POS app + contactless reader</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 border-t border-gray-700" />
                    <span className="text-xs text-gray-500 uppercase tracking-widest">or Square Terminal</span>
                    <div className="flex-1 border-t border-gray-700" />
                  </div>

                  {availableTerminals.length === 0 ? (
                      <div className="text-center text-red-400">No Terminals Found. Add them in Admin Dashboard first.</div>
                  ) : (
                      availableTerminals.map(t => (
                          <button key={t.id} onClick={() => {
                              const site = (document.getElementById('setup-site-name') as HTMLInputElement)?.value || '';
                              const printer = (document.getElementById('setup-printer-id') as HTMLInputElement)?.value || '';
                              selectTerminal(t.device_id, site, printer);
                          }} className={`w-full bg-gray-800 border p-4 rounded-lg text-lg font-bold hover:bg-blue-600 hover:border-blue-400 transition-colors ${assignedTerminalId === t.device_id ? 'border-blue-400 bg-blue-700' : 'border-gray-600'}`}>
                              {t.label} <span className="block text-xs font-mono text-gray-500 mt-1">{t.device_id}</span>
                          </button>
                      ))
                  )}
                  <button onClick={() => setShowSetup(false)} className="w-full mt-4 text-gray-500 hover:text-white text-sm">Cancel</button>
              </div>
          </div>
      );
  }

  if (products.length === 0) return (
    <div className="min-h-screen font-sans" style={{ background: `linear-gradient(160deg, ${headerColor} 0%, #0f172a 45%)` }}>
      <div className="w-[85%] mx-auto py-8">
        <div className="glass-card shadow-2xl rounded-2xl overflow-hidden">
          <div className="h-44 shimmer-line" style={{ opacity: 0.6 }} />
          <div className="p-6 space-y-5">
            <div className="h-5 shimmer-line rounded-full w-2/3" />
            <div className="h-4 shimmer-line rounded-full w-1/2" />
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[...Array(3)].map((_,i) => <div key={i} className="h-28 shimmer-line rounded-xl" />)}
            </div>
            <div className="flex gap-2 mt-2">
              {['XS','S','M','L','XL','2XL'].map(s => <div key={s} className="h-10 w-14 shimmer-line rounded-xl" />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  if (!selectedProduct && paymentMode !== 'hosted') return <div className="p-10 text-center">No active products available.</div>;

  if (orderComplete) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative overflow-hidden" style={{ background: `linear-gradient(160deg, ${headerColor} 0%, #0f172a 60%)` }}>
              <style>{`
                @keyframes confettiFall {
                  0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
                  100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
                }
                .confetti-piece {
                  position: fixed;
                  width: 12px;
                  height: 12px;
                  animation: confettiFall linear infinite;
                  border-radius: 2px;
                }
                @keyframes popIn {
                  0% { transform: scale(0.5); opacity: 0; }
                  70% { transform: scale(1.1); }
                  100% { transform: scale(1); opacity: 1; }
                }
                .pop-in { animation: popIn 0.6s cubic-bezier(0.34,1.56,0.64,1) both; }
              `}</style>
              {[...Array(24)].map((_, i) => (
                <div key={i} className="confetti-piece" style={{
                  left: `${Math.random() * 100}%`,
                  animationDuration: `${2 + Math.random() * 3}s`,
                  animationDelay: `${Math.random() * 2}s`,
                  backgroundColor: ['#facc15','#f87171','#34d399','#60a5fa','#c084fc','#fb923c'][i % 6],
                  transform: `rotate(${Math.random()*360}deg)`,
                  borderRadius: i % 3 === 0 ? '50%' : '2px',
                }} />
              ))}
              <div className="pop-in bg-white/10 backdrop-blur-xl border border-white/20 p-10 rounded-3xl shadow-2xl max-w-md w-full relative z-10">
                  <div className="text-7xl mb-4">🎉</div>
                  <h1 className="text-4xl font-black text-white mb-3 tracking-tight">You're all set!</h1>
                  <p className="text-white/60 text-sm uppercase tracking-widest font-semibold mb-4">Order confirmed</p>
                  <p className="text-2xl font-mono text-white font-black mb-2 bg-white/10 py-2 px-4 rounded-xl inline-block">#{lastOrderId || '---'}</p>
                  {paymentMode === 'hosted' ? <p className="text-white/70 mt-4 mb-8 text-lg">Your custom gear is being prepared. See you out there! 🙌</p> : <p className="text-white/70 mt-4 mb-8 text-lg">Your custom gear is being prepared. We'll text you when it's ready! 🙌</p>}
                  <button onClick={resetApp} className="text-gray-900 font-black py-4 px-8 rounded-2xl shadow-xl hover:opacity-90 w-full text-xl tracking-wide bg-white">Next Guest ➡️</button>
              </div>
          </div>
      );
  }

  const showPrice = paymentMode === 'retail';
  const step1Done = !!(size && selectedProduct && (!hasMultipleColors || selectedColor));
  const step2Done = !!(selectedMainDesign);
  const step3Done = true; // optional
  const step4Done = true; // optional

  return (
    <>
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(32px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cartPulseAnim {
          0%,100% { transform: scale(1); }
          40% { transform: scale(1.03); }
          70% { transform: scale(0.98); }
        }
        @keyframes shimmer {
          0% { background-position: -700px 0; }
          100% { background-position: 700px 0; }
        }
        .section-card { animation: fadeSlideUp 0.35s ease both; }
        .slide-in-right { animation: slideInRight 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
        .slide-in-up { animation: slideInUp 0.45s cubic-bezier(0.34,1.2,0.64,1) both; }
        .cart-pulse { animation: cartPulseAnim 0.5s ease; }
        .shimmer-line {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 700px 100%;
          animation: shimmer 1.4s infinite linear;
        }
        .glass-card {
          background: rgba(255,255,255,0.92) !important;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
      `}</style>
      <div className="min-h-screen font-sans text-gray-900" style={{ background: `linear-gradient(160deg, ${headerColor} 0%, #0f172a 45%)`, animation: 'gradientShift 8s ease infinite', backgroundSize: '200% 200%' }}>
      <div className="w-[85%] mx-auto py-6 grid md:grid-cols-3 gap-8">
        <div className={`space-y-6 ${(paymentMode === 'retail' || selectedGuest) ? 'md:col-span-2' : 'md:col-span-3'}`}>
          <div className="glass-card shadow-2xl rounded-2xl overflow-hidden">
            <div className="text-white py-9 px-6 text-center relative" style={{ backgroundColor: headerColor }}>
              {eventLogo ? <img src={eventLogo} alt="Event Logo" className="h-36 mx-auto mb-3" /> : <h1 className="text-2xl font-bold uppercase tracking-wide">{eventName}</h1>}
              {!eventLogo && <p className="text-white text-opacity-80 text-sm mt-1">Order Form</p>}
              {assignedTerminalId && <div className="absolute top-2 right-2 text-[10px] bg-black bg-opacity-20 px-2 py-1 rounded text-white">{assignedSiteName ? `📍 ${assignedSiteName}` : assignedTerminalId === 'BLUETOOTH_READER' ? '📱 BT' : `ID: ${assignedTerminalId.slice(-4)}`}</div>}
              <button onClick={() => { setShowLookup(true); setLookupQuery(''); setLookupResults([]); }} className="absolute bottom-2 right-2 text-[10px] bg-black bg-opacity-20 hover:bg-opacity-40 px-2 py-1 rounded text-white font-bold transition-all">🔍 Lookup</button>
            </div>
            
            <div className="p-6 space-y-8">
              {paymentMode === 'hosted' && !selectedGuest && (
                  <div className="text-center py-16 px-4">
                      <h2 className="text-4xl font-black mb-5 tracking-tight text-gray-900">Welcome to the Party! 🎉</h2>
                      {welcomeMessage && (
                        <p className="mb-6 text-gray-500 text-xl max-w-lg mx-auto leading-relaxed">{welcomeMessage}</p>
                      )}
                      <p className="mb-8 text-gray-400 font-semibold uppercase tracking-widest text-xs">
                        {openGuestEntry ? "Enter your name to get started." : "Please verify your name to get started."}
                      </p>
                      <div className="flex gap-3 max-w-lg mx-auto">
                            <input
                              className="flex-1 p-4 border-2 border-gray-200 rounded-xl text-xl text-black focus:border-blue-400 focus:outline-none"
                              placeholder="Enter full name"
                              value={guestSearch}
                              disabled={guestLoading}
                              onChange={(e) => { setGuestSearch(e.target.value); setGuestError(''); }}
                              onKeyDown={(e) => e.key === 'Enter' && verifyGuest()}
                            />
                            <button
                              onClick={verifyGuest}
                              disabled={guestLoading || !guestSearch.trim()}
                              className="text-white font-black px-8 rounded-xl shadow-lg hover:opacity-90 disabled:opacity-50 text-base"
                              style={{ backgroundColor: headerColor }}
                            >
                              {guestLoading ? "Checking..." : "Start"}
                            </button>
                      </div>
                      {guestError && (
                        <p className={`text-sm font-bold mt-4 p-2 rounded inline-block ${guestError.startsWith('🎁') ? 'text-yellow-800 bg-yellow-50 border border-yellow-300' : 'text-red-600 bg-red-50'}`}>
                          {guestError}
                        </p>
                      )}
                  </div>
              )}

              {(paymentMode === 'retail' || selectedGuest) && (
                  <div className="slide-in-up">
                    <section className="section-card bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-white/60 shadow-sm">
                        <h2 className="sr-only">1. Select Garment</h2><div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-100">{step1Done ? <span className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-500 text-white font-black text-sm shrink-0 transition-all">✓</span> : <span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0" style={{backgroundColor: headerColor}}>1</span>}<h2 className="font-black text-gray-900 text-base uppercase tracking-widest">Select Garment</h2></div>
                        {selectedGuest && (
                            <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl mb-6 text-center shadow-sm">
                                <h2 className="text-2xl font-black text-emerald-900 mb-1">Hi {selectedGuest.name}! 👋</h2>
                                {selectedGuest.size ? (<p className="text-emerald-700 text-sm font-medium">We've pre-selected size <span className="font-bold bg-white px-2 py-0.5 rounded border border-green-300">{selectedGuest.size}</span> for you.</p>) : (<p className="text-emerald-700 text-sm font-medium">Please select your apparel below.</p>)}
                                <button onClick={() => { setSelectedGuest(null); setGuestSearch(''); setCart([]); }} className="text-xs text-green-600 underline mt-2 hover:text-green-800">Not you? Change Guest</button>
                            </div>
                        )}                        
                        {!selectedProduct ? (
                            <div className="text-center py-8 text-red-600 font-bold">Sorry, no products available.</div>
                        ) : (
                            <>
                                {selectedProductRecord?.image_url && (
                                  <div className="mb-5 bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-center">
                                    <img src={selectedProductRecord.image_url} alt={selectedProduct.name} className="h-48 object-contain" />
                                  </div>
                                )}
{!ignoreInventory && size && (!hasMultipleColors || selectedColor) && (
  isOutOfStock ? (
    <div
      className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-4"
      role="alert"
    >
      <p className="font-bold">⚠️ Out of Stock at Event</p>
      <p className="text-sm">We can ship this to your home!</p>
    </div>
  ) : (
    <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-2 mb-4 text-xs font-bold uppercase">
      ✓ In Stock ({currentStock} available)
    </div>
  )
)}

{ignoreInventory && size && (!hasMultipleColors || selectedColor) && (
  <div className={`mb-4 rounded-xl border-2 p-3 flex items-center justify-between transition-all ${manualShipOverride ? 'bg-orange-50 border-orange-400' : 'bg-gray-50 border-gray-200'}`}>
    <div>
      <p className={`font-black text-sm ${manualShipOverride ? 'text-orange-700' : 'text-gray-600'}`}>
        {manualShipOverride ? '⚠️ No Stock — Ship to Home' : 'In Stock'}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">Toggle if this size is not available at the event</p>
    </div>
    <button
      onClick={() => setManualShipOverride(!manualShipOverride)}
      className={`font-black text-xs px-4 py-2 rounded-lg transition-all ${manualShipOverride ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
      {manualShipOverride ? 'SHIP TO HOME' : 'Mark No Stock'}
    </button>
  </div>
)}
                                <div className="space-y-3">

                                  {/* PRODUCT */}
                                  <div>
                                    <label className="text-xs font-black text-gray-900 uppercase">Item</label>
                                    {visibleProducts.length === 1 ? (
                                      // Single product — just show the name, no picker needed
                                      <p className="w-full p-3 border border-gray-400 rounded-lg bg-white text-black font-medium">
                                        {displayName(visibleProducts[0].name, products)}{showPrice ? ` — $${visibleProducts[0].base_price}` : ''}
                                      </p>
                                    ) : (
                                      // Multiple products — show image cards
                                      <div className="grid grid-cols-2 gap-2 mt-1">
                                        {visibleProducts.map(p => {
                                          const isSelected = mergedName(p.name) === mergedName(selectedProduct.name);
                                          return (
                                            <button
                                              key={p.id}
                                              type="button"
                                              onClick={() => {
                                                const found = visibleProducts.find(vp => mergedName(vp.name) === mergedName(p.name));
                                                setSelectedProduct(found);
                                                setSelectedColor('');
                                                setSize('');
                                              }}
                                              className={`flex flex-col items-center rounded-xl border-2 p-2 text-center transition-all ${
                                                isSelected
                                                  ? 'border-blue-600 bg-blue-50 shadow-lg ring-2 ring-blue-100'
                                                  : 'border-gray-100 bg-white hover:border-gray-300 hover:shadow-sm'
                                              }`}
                                            >
                                              {p.image_url ? (
                                                <img src={p.image_url} alt={mergedName(p.name)} className="h-24 w-full object-contain mb-1" />
                                              ) : (
                                                <div className="h-24 w-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 mb-1 rounded">No Image</div>
                                              )}
                                              <span className="text-xs font-semibold leading-tight">{displayName(p.name, products)}</span>
                                              {showPrice && <span className="text-xs text-gray-500">${p.base_price}</span>}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {/* COLOR — chips */}
                                  {hasMultipleColors && (
                                    <div>
                                      <label className="text-xs font-black text-gray-900 uppercase tracking-widest mb-2 block">Color</label>
                                      <div className="flex flex-wrap gap-2">
                                        {visibleColors.map(col => (
                                          <button key={col} type="button"
                                            onClick={() => { setSelectedColor(col); setSize(''); }}
                                            className={`px-4 py-2 rounded-xl font-bold text-sm border-2 transition-all active:scale-95 ${selectedColor === col ? 'text-white border-transparent shadow-md' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'}`}
                                            style={selectedColor === col ? {backgroundColor: headerColor, borderColor: headerColor} : {}}
                                          >{col}</button>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* SIZE — chips */}
                                  {(!hasMultipleColors || selectedColor) && (
                                    <div>
                                      <label className="text-xs font-black text-gray-900 uppercase tracking-widest mb-2 block">Size</label>
                                      <div className="flex flex-wrap gap-2">
                                        {visibleSizes.map(s => (
                                          <button key={s.value} type="button"
                                            onClick={() => setSize(s.value)}
                                            className={`px-4 py-2 rounded-xl font-bold text-sm border-2 transition-all active:scale-95 ${size === s.value ? 'text-white border-transparent shadow-md' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'}`}
                                            style={size === s.value ? {backgroundColor: headerColor, borderColor: headerColor} : {}}
                                          >{s.label}</button>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                </div>
                            </>
                        )}
                    </section>

                    {selectedProduct && availableMainOptions.length > 0 && (
                        <section>
                            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100"><div className="flex items-center gap-3">{step2Done ? <span className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-500 text-white font-black text-sm shrink-0 transition-all">✓</span> : <span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0" style={{backgroundColor: headerColor}}>2</span>}<h2 className="font-black text-gray-900 text-base uppercase tracking-widest">Choose Design</h2></div><span className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold uppercase tracking-wide">Included</span></div>
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                <div className="col-span-2 grid grid-cols-2 gap-3">
                                    {availableMainOptions.map((opt) => (
                                        <button key={opt.label} onClick={() => setSelectedMainDesign(opt.label)} className={`border-2 rounded-xl p-2 flex flex-col items-center gap-2 transition-all active:scale-95 shadow-sm ${selectedMainDesign === opt.label ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-gray-100 bg-white hover:border-gray-300 hover:shadow-sm'}`}>
                                            {opt.image_url ? (<img src={opt.image_url} alt={opt.label} className="h-20 w-full object-contain" />) : (<div className="h-20 w-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">No Image</div>)}
                                            <span className={`text-xs font-bold text-center leading-tight ${selectedMainDesign === opt.label ? 'text-green-800' : 'text-gray-800'}`}>{opt.label}</span>
                                            {selectedMainDesign === opt.label && <span className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded-full font-bold">SELECTED ✓</span>}
                                        </button>
                                    ))}
                                </div>
                                <div className="col-span-1">
                                  {(() => {
                                    const currentLogoObj = availableMainOptions.find(o => o.label === selectedMainDesign);
                                    const placement = currentLogoObj?.placement || 'large';
                                    const garmentType = isBottomSelected ? 'bottom' : isHoodieSelected ? 'hoodie' : 'top';
                                    return <PlacementVisualizer garmentType={garmentType} logoSize={placement} />;
                                  })()}
                                </div>
                            </div>
                        </section>
                    )}

                    {selectedProduct && availableAccentOptions.length > 0 && (
                        <section>
                            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100"><div className="flex items-center gap-3"><span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0" style={{backgroundColor: headerColor}}>3</span><h2 className="font-black text-gray-900 text-base uppercase tracking-widest">Add Accents</h2></div>{showPrice && <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold uppercase tracking-wide">+$5 each</span>}</div>
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mb-4">
                                {availableAccentOptions.map((opt) => (
                                    <button key={opt.label} onClick={() => addLogo(opt.label)} className="bg-white border-2 border-gray-100 hover:border-blue-400 rounded-xl p-2 flex flex-col items-center gap-1 transition-all active:scale-95 shadow-sm">
                                        {opt.image_url ? <img src={opt.image_url} className="h-12 w-full object-contain" /> : <div className="h-12 w-full bg-gray-100 text-[10px] flex items-center justify-center">No Img</div>}
                                        <span className="text-[10px] font-bold text-center leading-tight truncate w-full">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                            {logos.length > 0 && (
                                <div className="bg-slate-50 p-4 rounded-xl border border-gray-100 space-y-3">
                                    <h3 className="text-xs font-bold uppercase text-gray-500">Selected Accents (Set Position)</h3>
                                    {logos.map((logo, index) => {
                                        const currentImage = getLogoImage(logo.type);
                                        return (
                                            <div key={index} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
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
                            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100"><div className="flex items-center gap-3"><span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0" style={{backgroundColor: headerColor}}>4</span><h2 className="font-black text-gray-900 text-base uppercase tracking-widest">Personalization</h2></div>{showPrice && <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold uppercase tracking-wide">+$5 each</span>}</div>
                            {names.map((nameItem, index) => (
                            <div key={`name-${index}`} className="mb-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                <div className="flex gap-2 items-center mb-2">
                                    <span className="text-xs font-black uppercase text-gray-400 flex-1">Name {names.length > 1 ? index + 1 : ''}</span>
                                    <button onClick={() => setNames(names.filter((_, i) => i !== index))} className="bg-red-100 hover:bg-red-200 text-red-600 font-black rounded-xl px-4 py-2 text-base transition-all">✕ Remove</button>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <input type="text" maxLength={12} placeholder="NAME" className="border-2 border-gray-200 p-3 rounded-lg w-full uppercase text-black font-bold focus:border-blue-400 focus:outline-none text-lg" value={nameItem.text} onChange={(e) => updateName(index, 'text', e.target.value)} />
                                    <select className="border-2 border-gray-200 p-3 rounded-lg w-full bg-white text-black font-bold" value={nameItem.position} onChange={(e) => updateName(index, 'position', e.target.value)}>
                                      <option value="">Select Position...</option>
                                      {getPositionOptions('name').map(pos => <option key={pos.id} value={pos.label}>{pos.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            ))}
                            {numbers.map((numItem, index) => (
                            <div key={`num-${index}`} className="mb-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                <div className="flex gap-2 items-center mb-2">
                                    <span className="text-xs font-black uppercase text-gray-400 flex-1">Number {numbers.length > 1 ? index + 1 : ''}</span>
                                    <button onClick={() => setNumbers(numbers.filter((_, i) => i !== index))} className="bg-red-100 hover:bg-red-200 text-red-600 font-black rounded-xl px-4 py-2 text-base transition-all">✕ Remove</button>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <input type="text" maxLength={3} placeholder="NO. (e.g. 24)" className="border-2 border-gray-200 p-3 rounded-lg w-full uppercase text-black font-mono font-bold text-center text-lg tracking-widest focus:border-blue-400 focus:outline-none" value={numItem.text} onChange={(e) => updateNumber(index, 'text', e.target.value.replace(/[^0-9]/g, ''))} />
                                    <select className="border-2 border-gray-200 p-3 rounded-lg w-full bg-white text-black font-bold" value={numItem.position} onChange={(e) => updateNumber(index, 'position', e.target.value)}>
                                      <option value="">Select Position...</option>
                                      {getPositionOptions('number').map(pos => <option key={pos.id} value={pos.label}>{pos.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            ))}
                            <div className="flex gap-2 mt-3">
                                {showPersonalization && (
                                    <button onClick={() => setNames([...names, { text: '', position: '' }])} className="flex-1 py-3 border-2 border-dashed border-gray-200 text-gray-400 rounded-xl hover:border-blue-500 hover:text-blue-600 font-bold bg-white transition-all">+ Add Name</button>
                                )}
                                {showNumbers && (
                                    <button onClick={() => setNumbers([...numbers, { text: '', position: '' }])} className="flex-1 py-3 border-2 border-dashed border-gray-200 text-gray-400 rounded-xl hover:border-blue-500 hover:text-blue-600 font-bold bg-white transition-all">+ Add Number</button>
                                )}
                            </div>
                        </section>
                    )}
                    
                    {selectedProduct && showBackNames && (
                        <section className="bg-amber-50 p-5 rounded-2xl border border-amber-200 space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-6 h-6 text-blue-800" checked={backNameList} onChange={(e) => { setBackNameList(e.target.checked); if (!e.target.checked) { setMetallicHighlight(false); setBackListConfirmed(false); setMetallicName(''); setMetallicTeam(''); setMetallicTeam(''); } }} />
                                <span className="font-bold text-black text-lg">Team Roster List {showPrice && '(+$5)'}</span>
                            </label>
                            {backNameList && (
                                <div className="ml-8 space-y-3 border-l-4 border-yellow-300 pl-4">
                                    <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded border border-yellow-200 shadow-sm">
                                      <input type="checkbox" className="w-6 h-6 text-green-600" checked={backListConfirmed} onChange={(e) => setBackListConfirmed(e.target.checked)} />
                                      <span className="text-sm font-bold text-red-600">I have checked the list at the table and found my team.</span>
                                    </label>
                                    {showMetallic && (
                                        <div className="pt-2">
                                            <label className="flex items-center gap-3 cursor-pointer mb-2">
                                              <input type="checkbox" className="w-5 h-5 text-blue-800" checked={metallicHighlight} onChange={(e) => setMetallicHighlight(e.target.checked)} />
                                              <span className="font-bold text-black">Add Metallic Highlight {showPrice && '(+$5)'}</span>
                                            </label>
                                            {metallicHighlight && (
                                                <div className="space-y-3 mt-2">
                                                  <div>
                                                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Athlete Name to Highlight:</label>
                                                    <input type="text" className="w-full p-3 border-2 border-blue-400 rounded-xl font-bold uppercase text-black focus:outline-none" placeholder="ATHLETE NAME" value={metallicName} onChange={(e) => setMetallicName(e.target.value)} />
                                                  </div>
                                                  <div>
                                                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Team / Event Name:</label>
                                                    <input type="text" className="w-full p-3 border-2 border-blue-400 rounded-xl font-bold uppercase text-black focus:outline-none" placeholder="TEAM NAME" value={metallicTeam} onChange={(e) => setMetallicTeam(e.target.value)} />
                                                  </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    )}
                  </div>
              )}
            </div>
            
            {(paymentMode === 'retail' || selectedGuest) && (
                <div className={`text-white px-6 py-4 sticky bottom-0 flex justify-between items-center shadow-[0_-4px_24px_rgba(0,0,0,0.25)] transition-all ${cartPulse ? 'cart-pulse' : ''}`} style={{ backgroundColor: headerColor }}>
                  <div>
                    <p className="text-white text-opacity-80 text-xs uppercase">{showPrice ? 'Current Item' : 'Your Selection'}</p>
                    <p className="text-2xl font-bold">{showPrice ? `$${calculateItemTotal()}` : 'Free'}</p>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    disabled={!selectedProduct || !size || (hasMultipleColors && !selectedColor)}
                    className="bg-white text-black px-8 py-3 rounded-xl font-black shadow-lg active:scale-95 transition-all hover:opacity-90 disabled:opacity-40 uppercase tracking-wide text-sm"
                  >
                    Add to Cart
                  </button>
                </div>
            )}
          </div>
        </div>
        
        {(paymentMode === 'retail' || selectedGuest) && (
            <div className="md:col-span-1">
            <div className="glass-card shadow-2xl rounded-2xl overflow-hidden sticky top-4 slide-in-right">
                <div className="text-white p-5" style={{ backgroundColor: headerColor }}>
                  <h2 className="font-bold text-lg">Your Cart</h2>
                  <p className="text-white text-opacity-80 text-sm">{cart.length} item{cart.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
                {cart.length === 0 ? <p className="text-gray-500 text-center italic py-10">Cart is empty.</p> : cart.map((item) => (
                    <div key={item.id} className="border-b border-gray-200 pb-4 last:border-0 relative">
                    <div className="absolute top-0 right-0 flex gap-1">
                      <button onClick={() => editItem(item)} className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-black text-xs px-3 py-1 rounded-lg transition-all">EDIT</button>
                      <button onClick={() => removeItem(item.id)} className="bg-red-100 hover:bg-red-200 text-red-600 font-black text-xs px-3 py-1 rounded-lg transition-all">REMOVE</button>
                    </div>
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
                        {item.customizations.metallic && <div>• Metallic: {item.customizations.metallicName}{item.customizations.metallicTeam ? ` — ${item.customizations.metallicTeam}` : ''}</div>}
                    </div>
                    {showPrice && <p className="font-bold text-right mt-2 text-blue-900 text-lg">${item.finalPrice.toFixed(2)}</p>}
                    </div>
                ))}
                </div>
                {cart.length > 0 && (
                <div className="p-5 bg-slate-50 border-t border-gray-100 rounded-b-2xl">
                    <h3 className="font-bold text-black mb-2">Checkout Details</h3>
                    {paymentMode === 'hosted' && selectedGuest ? (
                        <div className="bg-green-100 text-green-900 p-2 rounded mb-4 font-bold text-sm">Guest: {selectedGuest.name}</div>
                    ) : (
                        <>
                            <input className="w-full p-3 border-2 border-gray-200 rounded-xl mb-2 text-sm text-black focus:border-blue-400 focus:outline-none" placeholder="Full Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                            <input className="w-full p-3 border-2 border-gray-200 rounded-xl mb-2 text-sm text-black focus:border-blue-400 focus:outline-none" placeholder="Email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                            <input className="w-full p-3 border-2 border-gray-200 rounded-xl mb-1 text-sm text-black focus:border-blue-400 focus:outline-none" placeholder="Phone Number" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
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
                        {paymentMode === 'retail' && retailPaymentMethod === 'terminal' && assignedTerminalId === 'BLUETOOTH_READER' && (
                            <button onClick={handleBluetoothCheckout} disabled={isSubmitting} className={`w-full py-4 text-xl font-black rounded-xl shadow-lg transition-all text-white flex items-center justify-center gap-2 ${isSubmitting ? 'bg-blue-400 animate-pulse cursor-wait' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                {isSubmitting ? <span>⏳ Opening Square POS...</span> : <span>📱 Pay with Bluetooth Reader</span>}
                            </button>
                        )}
                        {paymentMode === 'retail' && retailPaymentMethod === 'terminal' && assignedTerminalId !== 'BLUETOOTH_READER' && (
                            <button onClick={handleTerminalCheckout} disabled={isSubmitting || isTerminalProcessing} className={`w-full py-4 text-xl font-black rounded-xl shadow-lg transition-all text-white flex items-center justify-center gap-2 ${isTerminalProcessing ? 'bg-purple-600 animate-pulse cursor-wait' : 'bg-purple-700 hover:bg-purple-800'}`}>
                                {isTerminalProcessing ? <span>📟 {terminalStatus}</span> : <span>📟 Pay with Card (Terminal)</span>}
                            </button>
                        )}
                        {((paymentMode === 'retail' && retailPaymentMethod !== 'terminal') || paymentMode === 'hosted') && (
                            <button onClick={handleCheckout} disabled={isSubmitting || isTerminalProcessing || (paymentMode === 'hosted' && !selectedGuest)} className={`w-full py-4 rounded-xl font-black shadow-lg transition-all text-white text-lg ${isSubmitting || isTerminalProcessing ? 'bg-gray-400' : 'hover:opacity-90'}`} style={{ backgroundColor: (isSubmitting || isTerminalProcessing) ? 'gray' : headerColor }}>
                                {isSubmitting ? "Processing..." : (paymentMode === 'hosted' ? "🎉 Submit Order (Free)" : "Pay via Stripe Link")}
                            </button>
                        )}
                        {paymentMode === 'retail' && (
                            <button onClick={handleCashCheckout} disabled={isSubmitting || isTerminalProcessing} className="w-full py-4 bg-emerald-600 text-white font-black rounded-xl shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 text-lg">💵 Pay with Cash</button>
                        )}
                    </div>
                </div>
                )}
            </div>
            </div>
        )}
      </div>
    </div>

    {/* Order Lookup Modal */}
    {showLookup && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowLookup(false)}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="bg-slate-900 px-6 py-5 flex justify-between items-center">
            <div>
              <h2 className="text-white font-black text-xl">🔍 Order Lookup</h2>
              <p className="text-white/50 text-xs mt-0.5">Search orders for this event</p>
            </div>
            <button onClick={() => setShowLookup(false)} className="text-white/60 hover:text-white text-2xl font-black">✕</button>
          </div>
          <div className="p-6">
            <div className="flex gap-2 mb-4">
              <input
                autoFocus
                className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-lg focus:outline-none focus:border-blue-400"
                placeholder="Customer name..."
                value={lookupQuery}
                onChange={e => setLookupQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && lookupOrders()}
              />
              <button onClick={lookupOrders} disabled={lookupLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 rounded-xl disabled:opacity-50 transition-all">
                {lookupLoading ? '...' : 'Search'}
              </button>
            </div>

            {lookupResults.length === 0 && lookupQuery && !lookupLoading && (
              <p className="text-center text-gray-400 font-bold py-6">No orders found for "{lookupQuery}"</p>
            )}

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {lookupResults.map(order => (
                <div key={order.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-black text-lg">{order.customer_name}</p>
                      <p className="text-xs text-gray-400 font-mono">#{String(order.id).slice(0, 8)} · {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <span className="font-black text-blue-700 text-lg">${Number(order.total_price || 0).toFixed(2)}</span>
                  </div>
                  <div className="space-y-1">
                    {(order.cart_data || []).map((item: any, i: number) => (
                      <div key={i} className="text-sm flex justify-between">
                        <span className="text-gray-700 font-bold">{item.productName} <span className="text-gray-400 font-normal">· {item.size}</span></span>
                        {item.customizations?.mainDesign && <span className="text-gray-400 text-xs">{item.customizations.mainDesign}</span>}
                      </div>
                    ))}
                  </div>
                  {order.shipping_address && (
                    <p className="text-xs text-orange-600 font-bold mt-2">🚚 Ship to: {order.shipping_address}, {order.shipping_city}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
// ── PlacementVisualizer ──
const PlacementVisualizer = ({ garmentType, logoSize }) => {
  const isBottom = garmentType === 'bottom';
  const accentColor = "#1e3a8a";

  const TopSVG = () => (
    <svg viewBox="0 0 200 220" className="w-28 h-28 drop-shadow">
      <path d="M60 30 L35 65 L60 75 L60 190 L140 190 L140 75 L165 65 L140 30 Q100 50 60 30Z" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="2" />
      <path d="M75 30 Q100 10 125 30 Q110 45 100 48 Q90 45 75 30Z" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" />
      <rect x="78" y="130" width="44" height="30" rx="3" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1" />
      {logoSize === 'large' ? (
        <rect x="72" y="75" width="56" height="48" rx="4" fill={accentColor} fillOpacity="0.75">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
        </rect>
      ) : (
        <circle cx="118" cy="85" r="10" fill={accentColor} fillOpacity="0.85">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );

  const BottomSVG = () => (
    <svg viewBox="0 0 200 220" className="w-28 h-28 drop-shadow">
      <rect x="55" y="20" width="90" height="18" rx="4" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" />
      <path d="M55 38 L65 200 L100 200 L100 38Z" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1.5" />
      <path d="M145 38 L135 200 L100 200 L100 38Z" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1.5" />
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
