// @ts-nocheck
'use client'; 

import React, { useState, useEffect, useRef } from 'react'; 
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

// Youth / ladies / adult cuts of the same style share one product card: "Colortone Youth Multi-Color Tie-Dyed T-Shirt"
// and "Colortone Unisex Multi-Color Tie-Dyed T-Shirt" both → "Colortone Multi-Color Tie-Dyed T-Shirt"
const mergedName = (name) => name.replace(/\s*\b(Youth|Ladies|Unisex|Adult)\b\s*/gi, ' ').replace(/\s+/g, ' ').trim();
const colorHex = (c: string): string => {
  const map: Record<string, string> = {
    "black": "#111", "white": "#fff", "navy": "#1a2a5e", "red": "#c0392b",
    "royal": "#2851a3", "royal blue": "#2851a3", "carolina blue": "#56a0d3",
    "light blue": "#87ceeb", "baby blue": "#89cff0", "sky blue": "#87ceeb",
    "gold": "#f4c430", "yellow": "#f9e24b", "orange": "#e67e22",
    "purple": "#6c3483", "maroon": "#6d0026", "brown": "#795548",
    "green": "#2e7d32", "forest green": "#2e7d32", "kelly green": "#4caf50",
    "pink": "#e91e8c", "hot pink": "#ff69b4", "light pink": "#ffb6c1",
    "grey": "#9e9e9e", "gray": "#9e9e9e", "charcoal": "#4a4a4a",
    "heather grey": "#b0b0b0", "heather gray": "#b0b0b0",
    "heather charcoal": "#555", "heather navy": "#2c3e6b",
    "heather blue": "#5b8db8", "heather cassis": "#7b4b6a",
    "heather purist blue": "#6a9cc4", "natural": "#f5f0e8",
    "sand": "#c2b280", "tan": "#d2b48c", "cream": "#fffdd0",
    "cantaloupe": "#ff8c5a", "lagoon": "#00b4cc",
    "spider black": "#1a1a1a", "heather charcoal": "#555",
  };
  return map[c.toLowerCase()] || "#ccc";
};

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
  const [rosterImageUrl, setRosterImageUrl] = useState("");
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
  const [addOnQty, setAddOnQty] = useState<Record<string, number>>({});
  const [showAddOnModal, setShowAddOnModal] = useState(false);
  // Order lookup
  const [showLookup, setShowLookup] = useState(false);
  const [showAddon, setShowAddon] = useState(false);
  const [addonNames, setAddonNames] = useState([{ text: "", position: "Back Center" }]);
  const [addonNumbers, setAddonNumbers] = useState<{text:string,position:string}[]>([]);
  const [addonCustomerName, setAddonCustomerName] = useState("");
  const [addonCustomerPhone, setAddonCustomerPhone] = useState("");
  const [addonSubmitting, setAddonSubmitting] = useState(false);
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResults, setLookupResults] = useState<any[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [names, setNames] = useState([]);
  const [numbers, setNumbers] = useState([]); 
  const [discountAmount, setDiscountAmount] = useState(0);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountPin, setDiscountPin] = useState("");
  const [discountPinError, setDiscountPinError] = useState(false);
  const [discountType, setDiscountType] = useState<"percent"|"fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [discountUnlocked, setDiscountUnlocked] = useState(false);
  const [backNameList, setBackNameList] = useState(false);
  const [metallicHighlight, setMetallicHighlight] = useState(false);
  const [backListConfirmed, setBackListConfirmed] = useState(false);
  const [metallicName, setMetallicName] = useState('');
  const [metallicTeam, setMetallicTeam] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [availableTerminals, setAvailableTerminals] = useState([]);
  const [ignoreInventory, setIgnoreInventory] = useState(false);
  const [requireAddress, setRequireAddress] = useState(false);
  const [manualShipOverride, setManualShipOverride] = useState(false);
  // Staff mode: staff-only buttons (lookup, add-on, discount, cash, stock overrides) stay hidden from customers until
  // a staff member presses and holds the header and enters the manager PIN or staff passcode. Stays on (even through a
  // page reload) until someone taps Lock.
  const [staffMode, setStaffMode] = useState(false);
  useEffect(() => { try { if (sessionStorage.getItem('kiosk_staff_mode') === '1') setStaffMode(true); } catch {} }, []);
  useEffect(() => { try { staffMode ? sessionStorage.setItem('kiosk_staff_mode', '1') : sessionStorage.removeItem('kiosk_staff_mode'); } catch {} }, [staffMode]);
  const [showStaffPin, setShowStaffPin] = useState(false);
  const [staffPin, setStaffPin] = useState('');
  const [staffPinError, setStaffPinError] = useState(false);
  const pressTimer = useRef<any>(null);
  const startPress = () => { clearTimeout(pressTimer.current); pressTimer.current = setTimeout(() => { if (!staffMode) { setStaffPin(''); setStaffPinError(false); setShowStaffPin(true); } }, 1000); };
  const endPress = () => clearTimeout(pressTimer.current);
  const unlockStaff = async () => {
    try {
      const res = await fetch('/api/staff-unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: staffPin }) });
      const data = await res.json();
      if (data.success) { setStaffMode(true); setShowStaffPin(false); setStaffPin(''); } else { setStaffPinError(true); setStaffPin(''); }
    } catch { setStaffPinError(true); }
  };
  // Optional per-event features, switched on in the portal (event_settings.kiosk_extras) — all off by default
  const [extras, setExtras] = useState<any>({});
  const [showSpell, setShowSpell] = useState(false);       // "Is this spelled right?"
  const spellOk = useRef(false);
  const [attract, setAttract] = useState(false);           // welcome slideshow when idle
  const [attractIdx, setAttractIdx] = useState(0);
  const lastAny = useRef(Date.now());
  const [copyingFrom, setCopyingFrom] = useState('');      // "Add one for a sibling"
  const pendingColor = useRef('');
  const [bundleFor, setBundleFor] = useState<string | null>(null);   // suggested item that gets the bundle savings
  const [suggestOff, setSuggestOff] = useState(false);
  const [phonePay, setPhonePay] = useState<any>(null);     // { orderId, sessionId, qr, left }
  const [waitMins, setWaitMins] = useState(0);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [queued, setQueued] = useState(0);
  // What's missing, shown on the screen next to the thing to fix (instead of an iPad pop-up)
  const [needs, setNeeds] = useState<{ key: string; msg: string } | null>(null);
  const flag = (key: string, msg: string) => {
    setNeeds({ key, msg });
    setTimeout(() => document.getElementById(`need-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };
  const needMsg = (key: string) => needs?.key === key ? <p className="text-red-600 font-black text-base mt-2">⚠️ {needs.msg}</p> : null;
  const needBorder = (key: string, normal = 'border-gray-200') => needs?.key === key ? 'border-red-500 bg-red-50' : normal;
  const [upsellMode, setUpsellMode] = useState<null|"name"|"number"|"roster">(null);

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
        setRequireAddress(!!settings.require_address);
        setOpenGuestEntry(!!settings.open_guest_entry);
        setWelcomeMessage(settings.welcome_message || '');
        setRosterImageUrl(settings.roster_image_url || '');
        setExtras(settings.kiosk_extras || {});
      }

      const { data: productData } = await supabase.from('products').select('*').order('sort_order', { ascending: true });
      if (productData) setProducts(productData);

      const { data: logoData } = await supabase.from('logos').select('label, image_url, category, placement').eq('active', true).eq('event_slug', finalSlug).order('sort_order');
      if (logoData) {
          setLogoOptions(logoData);
          setMainOptions(logoData.filter(l => l.category === 'main'));
          setAccentOptions(logoData.filter(l => !l.category || l.category === 'accent'));
      }

      await loadInventoryMaps(finalSlug);

      const { data: guestData } = await supabase.from('guests').select('*').eq('event_slug', finalSlug); 
      if (guestData) setGuests(guestData);
    };

    fetchData();
  }, [params]);

  // Keys are `${product_id}_${size}` everywhere (visibility, stock, and calculateItemTotal)
  const loadInventoryMaps = async (slug) => {
    const { data: invData } = await supabase.from('inventory').select('*').eq('event_slug', slug);
    if (!invData) return;
    const stockMap = {}; const activeMap = {}; const priceMap = {};
    invData.forEach(item => {
      const key = `${item.product_id}_${item.size}`;
      stockMap[key] = item.count;
      activeMap[key] = item.active;
      if (item.override_price) priceMap[key] = item.override_price;
    });
    setInventory(stockMap); setActiveItems(activeMap); setPriceOverrides(priceMap);
  };

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

  // Price shown on the product picker: the event price (override) of its active variants, not the catalog base_price
  const pickerPrice = (p) => {
    const prices = products
      .filter(pp => mergedName(pp.name) === mergedName(p.name))
      .map(pp => {
        const { size: s } = parseProductId(pp.id);
        const key = `${pp.id}_${s}`;
        return s && activeItems[key] ? Number(priceOverrides[key] || pp.base_price || 0) : null;
      })
      .filter(v => v !== null);
    if (prices.length === 0) return `$${p.base_price}`;
    const min = Math.min(...prices), max = Math.max(...prices);
    return min === max ? `$${min}` : `from $${min}`;
  };

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
    const activeColors = [...new Set(
      products.filter(p =>
        mergedName(p.name) === mergedName(selectedProduct.name) &&
        (() => { const { size: s } = parseProductId(p.id); return s && activeItems[`${p.id}_${s}`] === true; })()
      ).map(p => parseProductId(p.id).color).filter(Boolean)
    )];
    // Auto-select if only one color, otherwise clear
    const keep = pendingColor.current; pendingColor.current = '';
    setSelectedColor(keep && activeColors.includes(keep) ? keep : activeColors.length === 1 ? activeColors[0] : '');
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
      mergedName(item.productName || '') === mergedName(selectedProduct.name) &&
      item.size === size &&
      (!hasMultipleColors || item.color === selectedColor)
    ).length;
    return totalBaseStock - qtyInCart;
  })();
  const isOutOfStock = manualShipOverride ? true : (ignoreInventory ? false : currentStock <= 0);
  // Same count for any size (for the size buttons)
  const stockFor = (sz) => {
    let n = 0;
    matchingProducts.forEach(p => {
      const parsed = parseProductId(p.id);
      if ((hasMultipleColors && parsed.color !== selectedColor) || parsed.size !== sz) return;
      n += (inventory[`${p.id}_${sz}`] || 0);
    });
    return n - cart.filter(item => mergedName(item.productName || '') === mergedName(selectedProduct?.name || '') && item.size === sz && (!hasMultipleColors || item.color === selectedColor)).length;
  };
  useEffect(() => { setNeeds(null); }, [size, selectedColor, selectedMainDesign, JSON.stringify(logos), JSON.stringify(names), JSON.stringify(numbers), customerName, customerPhone, shippingAddress, shippingCity, shippingState, shippingZip, cart.length]);

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

  // Customers don't know "Left Sleeve" from "Back Center", so every accent / name / number starts on the usual
  // spot that's still free on this garment — they can still change it.
  const POSITION_PREFS = {
    logo: ['Left Sleeve', 'Right Sleeve', 'Back Center', 'Left Thigh (Upper)', 'Right Thigh (Upper)', 'Rear (Center)', 'Back Pocket'],
    name: ['Back Center', 'Back Bottom', 'Left Sleeve', 'Right Sleeve', 'Left Thigh (Upper)', 'Right Thigh (Upper)', 'Rear (Center)'],
    number: ['Back Center', 'Left Sleeve', 'Right Sleeve', 'Back Bottom', 'Left Thigh (Upper)', 'Right Thigh (Upper)', 'Rear (Center)'],
  };
  const defaultPosition = (itemType, c = { logos, names, numbers }) => {
    const options = getPositionOptions(itemType, itemType === 'logo').map(o => o.label);
    if (!options.length) return '';
    // A name and a number can share the back (name over number); nothing else doubles up
    const taken = new Set([
      ...(c.logos || []).map(l => l.position),
      ...(itemType !== 'number' ? (c.names || []).map(n => n.position) : []),
      ...(itemType !== 'name' ? (c.numbers || []).map(n => n.position) : []),
    ].filter(Boolean));
    const ranked = [...(POSITION_PREFS[itemType] || []).filter(l => options.includes(l)), ...options];
    return ranked.find(l => !taken.has(l)) || ranked[0];
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
      return Math.max(0, calculateSubtotal() - discountAmount) * (taxRate / 100);
  };
  const calculateGrandTotal = () => Math.max(0, calculateSubtotal() - discountAmount) + calculateTax();

  // "Ready in about N minutes": orders waiting at this event × the minutes per order set in the portal
  const estimateWait = async () => {
      if (!extras.waitOn || !supabase || !actualEventSlug) return 0;
      try {
          const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true })
              .eq('event_slug', actualEventSlug).in('status', ['pending', 'in_progress', 'partially_fulfilled']);
          const per = Math.max(1, Number(extras.waitMinutes) || 3);
          return Math.max(5, Math.ceil(((count || 0) * per) / 5) * 5);
      } catch { return 0; }
  };
  // The server writes the text and sends it to the phone saved on the order (see /api/send-sms)
  const sendConfirmationSMS = async (name, phone, orderId = '') => {
      if (!phone || String(phone).replace(/\D/g, '').length < 10 || !orderId) return;
      const mins = await estimateWait();
      fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'confirmation', orderId, minutes: mins })
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
    if (hasMultipleColors && !selectedColor) { flag('color', 'Pick a color'); return; }
    if (!size) { flag('size', 'Pick a size'); return; }
    if (availableMainOptions.length > 0 && !selectedMainDesign) { flag('design', 'Pick a design'); return; }
    const missingLogoPos = logos.some(l => !l.position);
    const missingNamePos = names.some(n => !n.position);
    const missingNumberPos = numbers.some(n => !n.position);
    if (missingLogoPos) { flag('logo-pos', 'Pick where each accent goes'); return; }
    if (logos.some(l => l.binder !== undefined && !String(l.binder || '').trim())) { flag('logo-pos', 'Type the binder number / description for each binder design'); return; }
    if (missingNamePos || missingNumberPos) { flag('pers-pos', 'Pick where each name and number goes'); return; }
    if (names.some(n => !String(n.text || '').trim()) || numbers.some(n => !String(n.text || '').trim())) { flag('pers-pos', 'Type the name or number (or remove it)'); return; }
    if (metallicHighlight && !String(metallicName || '').trim()) { flag('pers-pos', 'Type the athlete name for the metallic highlight'); return; }

    // "Is this spelled right?" — big, the way it'll print, before it goes in the cart
    const toPrint = [...names.map(n => n.text), ...numbers.map(n => n.text), ...(metallicHighlight ? [metallicName] : []), ...logos.filter(l => l.binder !== undefined).map(l => l.binder)].filter(t => String(t || '').trim());
    if (extras.confirmNames && toPrint.length && !spellOk.current && !showAddOnModal) { setShowSpell(true); return; }
    spellOk.current = false;

    // If product has add-ons, show the modal first
    const productAddOns = selectedProductRecord?.add_ons || [];
    if (productAddOns.length > 0 && !showAddOnModal) {
      setAddOnQty({});
      setShowAddOnModal(true);
      return;
    }
    setShowAddOnModal(false);
    completeAddToCart();
  };

  const completeAddToCart = () => {
    // Name from the chosen size's own row: youth + adult share one card, so selectedProduct may be the other one
    const baseName = selectedProductRecord?.name || selectedProduct.name;
    const isYouthSize = ['YS','YM','YL','YXL','YXS'].includes(size) || /^youth\s/i.test(size);
    // Adult sizes (S, M, L...) must never read as youth on the cart, receipt, or order
    const displayName = isYouthSize
      ? (baseName.toLowerCase().includes('youth') ? baseName : `Youth ${baseName}`)
      : baseName.replace(/\s*\byouth\b\s*/gi, ' ').trim();

    // Calculate add-on total
    const productAddOns = selectedProductRecord?.add_ons || [];
    let addOnTotal = 0;
    const selectedAddOns: any[] = [];
    productAddOns.forEach((ao: any) => {
      const qty = addOnQty[ao.name] || 0;
      const extra = Math.max(0, qty - (ao.included || 0));
      addOnTotal += extra * ao.price;
      if (qty > 0) selectedAddOns.push({ name: ao.name, qty, extra, extraCost: extra * ao.price });
    });

    const newItem = {
      id: Date.now(),
      productId: selectedProductRecord.id,
      productName: displayName,
      size: size,
      color: hasMultipleColors ? selectedColor : null,
      needsShipping: isOutOfStock,
      custom_name: names.length > 0 ? names[0].text : (metallicHighlight ? metallicName : null),
      has_heat_sheet: backNameList,
      customizations: {
          mainDesign: selectedMainDesign, logos, names, numbers,
          backList: backNameList, metallic: metallicHighlight,
          metallicName: metallicHighlight ? metallicName : '',
          metallicTeam: metallicHighlight ? metallicTeam : '',
          addOns: selectedAddOns,
      },
      finalPrice: calculateItemTotal() + addOnTotal - bundleNow(),
    };
    if (bundleNow() > 0) newItem.customizations.bundleSavings = bundleNow();
    setBundleFor(null); setCopyingFrom('');
    
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
  // Bundle savings on the suggested item (retail only, when switched on and something else is already in the cart)
  const bundleNow = () => {
    const amt = Math.max(0, Number(extras.bundleDiscount) || 0);
    if (!extras.suggest || !amt || paymentMode !== 'retail' || !bundleFor || !selectedProduct || !cart.length) return 0;
    if (mergedName(selectedProduct.name) !== bundleFor) return 0;
    return Math.min(amt, calculateItemTotal());
  };
  // "Add one for a sibling": same item and customizations, blank names/numbers, pick a new size
  const copyItem = (item) => {
    const prod = products.find(p => p.id === item.productId);
    const c = JSON.parse(JSON.stringify(item.customizations || {}));
    pendingColor.current = item.color || '';
    if (prod) setSelectedProduct(prod);
    if (item.color) setSelectedColor(item.color);
    setSize('');
    setSelectedMainDesign(c.mainDesign || '');
    setLogos(c.logos || []);
    setNames((c.names || []).map(n => ({ ...n, text: '' })));
    setNumbers((c.numbers || []).map(n => ({ ...n, text: '' })));
    setBackNameList(!!c.backList); setMetallicHighlight(false); setMetallicName(''); setMetallicTeam(c.metallicTeam || '');
    setCopyingFrom(item.productName);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // "Complete the look": the first product on this event that isn't in the cart yet
  const suggestion = (() => {
    if (!extras.suggest || suggestOff || !cart.length) return null;
    const inCart = new Set(cart.map(i => mergedName(i.productName || '')));
    return visibleProducts.find(p => !inCart.has(mergedName(p.name))) || null;
  })();
  const takeSuggestion = (p) => {
    const design = cart[cart.length - 1]?.customizations?.mainDesign;
    setSelectedProduct(p);
    if (design) setTimeout(() => setSelectedMainDesign(d => availableMainOptions.some(o => o.label === design) ? design : d), 0);
    setBundleFor(mergedName(p.name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
  const addLogo = (logoLabel) => { setLogos([...logos, { type: logoLabel, position: defaultPosition('logo') }]); };
  // "From the binder": a DTF that isn't loaded in the kiosk. The customer types the binder # / description and it
  // becomes the accent's name ("Binder: #14 football"), so the cart, press queue and printouts all show it as-is.
  const addBinder = () => { setLogos([...logos, { type: 'Binder: ', binder: '', position: defaultPosition('logo') }]); };
  const setBinder = (i, text) => { const n = [...logos]; n[i] = { ...n[i], binder: text, type: `Binder: ${text.trim()}` }; setLogos(n); };
  const updateLogo = (i, f, v) => { const n = [...logos]; n[i][f] = v; setLogos(n); };
  const updateName = (i, f, v) => { const n = [...names]; n[i][f] = v; setNames(n); };
  const updateNumber = (i, f, v) => { const n = [...numbers]; n[i][f] = v; setNumbers(n); }; 
  // Admin "Require Address" makes every order collect a shipping address (e.g. out of transfers, orders ship later)
  const cartRequiresShipping = cart.some(item => item.needsShipping) || requireAddress;
  const showAddressForm = cartRequiresShipping && (paymentMode !== 'hosted' || requireAddress);
  const addressMissing = () => showAddressForm && ![shippingAddress, shippingCity, shippingState, shippingZip].every(v => v.trim());
  const getLogoImage = (type) => { const found = logoOptions.find(l => l.label === type); return found ? found.image_url : null; };

  const handleTerminalCheckout = async () => {
    if (cart.length === 0) return alert("Cart is empty");
    if (!customerName) return flag('cname', 'Enter your name');
    if (!assignedTerminalId) return alert("⚠️ SETUP ERROR: No Terminal ID assigned to this iPad.");
    if (!customerPhone) return flag('phone', "Enter your mobile number — we'll text you when it's ready");
    if (addressMissing()) return flag('address', 'Enter the full shipping address');
    setIsTerminalProcessing(true);
    setTerminalStatus("Creating Order...");
    try {
        const createRes = await fetch('/api/create-retail-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart, customerName, customerPhone, customerEmail, total: calculateGrandTotal(), taxCollected: calculateTax(), eventSlug: actualEventSlug, eventName, site: assignedSiteName, shippingInfo: cartRequiresShipping ? { address: shippingAddress, city: shippingCity, state: shippingState, zip: shippingZip } : null })
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
        // Stock comes off in the database (trigger_decrement_inventory on orders insert) — don't decrement again here
        const handleSuccess = () => {
            if (window.pollingRef) clearInterval(window.pollingRef);
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
    if (!customerName) return flag('cname', 'Enter your name');
    if (addressMissing()) return flag('address', 'Enter the full shipping address');
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
    if (!customerName) return flag('cname', 'Enter your name');
    if (addressMissing()) return flag('address', 'Enter the full shipping address');
    if (!confirm("Confirm Pay with Cash?")) return;
    setIsSubmitting(true); 
    try {
        const data = await postOrder('/api/create-cash-order', { cart, customerName, customerPhone, customerEmail, total: calculateGrandTotal(), taxCollected: calculateTax(), eventName, eventSlug: actualEventSlug, shippingInfo: cartRequiresShipping ? { address: shippingAddress, city: shippingCity, state: shippingState, zip: shippingZip } : null, site: assignedSiteName }, { name: customerName, phone: customerPhone });
        if (!data.success) throw new Error(data.error);
        if (data.offline) { setOfflineSaved(true); setOrderComplete(true); setIsSubmitting(false); return; }
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

  // Pay on your own phone: QR code → Stripe Checkout on the customer's phone; the kiosk watches for the payment
  const handlePhonePay = async () => {
    if (!customerName) return flag('cname', 'Enter your name');
    if (addressMissing()) return flag('address', 'Enter the full shipping address');
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/phone-pay', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', cart, customerName, customerPhone, customerEmail, total: calculateGrandTotal(), taxCollected: calculateTax(), eventName, eventSlug: actualEventSlug, shippingInfo: cartRequiresShipping ? { address: shippingAddress, city: shippingCity, state: shippingState, zip: shippingZip } : null, site: assignedSiteName }) });
      const data = await res.json();
      if (!data.url) throw new Error(data.error || 'Could not start the payment');
      const QR = (await import('qrcode')).default;
      const qr = await QR.toDataURL(data.url, { width: 360, margin: 1 });
      setPhonePay({ orderId: data.orderId, sessionId: data.sessionId, qr, left: 300 });
    } catch (err) { alert('Phone payment is not available right now — please use another way to pay. (' + err.message + ')'); }
    setIsSubmitting(false);
  };
  const cancelPhonePay = async () => {
    const pp = phonePay; setPhonePay(null);
    if (pp?.orderId) fetch('/api/phone-pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel', orderId: pp.orderId }) }).catch(() => {});
  };
  useEffect(() => {
    if (!phonePay?.sessionId) return;
    let stop = false;
    const t = setInterval(async () => {
      setPhonePay(p => p ? { ...p, left: p.left - 3 } : p);
      try {
        const d = await (await fetch(`/api/phone-pay?session=${encodeURIComponent(phonePay.sessionId)}`)).json();
        if (stop || !d.paid) return;
        stop = true; clearInterval(t);
        setLastOrderId(String(d.orderId || phonePay.orderId));
        if (customerPhone) sendConfirmationSMS(customerName, customerPhone, d.orderId);
        if (customerEmail) sendReceiptEmail(d.orderId, customerName, customerEmail, cart, calculateGrandTotal());
        setPhonePay(null); setOrderComplete(true);
      } catch { /* keep watching */ }
    }, 3000);
    return () => { stop = true; clearInterval(t); };
  }, [phonePay?.sessionId]);
  useEffect(() => { if (phonePay && phonePay.left <= 0) cancelPhonePay(); }, [phonePay?.left]);

  // ── Offline queue: cash + hosted orders save on the iPad if Wi-Fi is down, and send themselves later ──
  const QKEY = 'kiosk_offline_orders';
  const readQ = () => { try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch { return []; } };
  const writeQ = (q) => { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch {} setQueued(q.length); };
  const postOrder = async (endpoint, body, who) => {
    const payload = { ...body, clientRef: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}` };
    const queueIt = () => { writeQ([...readQ(), { endpoint, payload, name: who?.name || '', phone: who?.phone || '', at: Date.now() }]); return { success: true, offline: true }; };
    if (extras.offline && typeof navigator !== 'undefined' && navigator.onLine === false) return queueIt();
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      return await res.json();
    } catch (e) {
      if (extras.offline) return queueIt();
      throw e;
    }
  };
  const syncing = useRef(false);
  useEffect(() => {
    setQueued(readQ().length);
    const sync = async () => {
      if (syncing.current || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
      const q = readQ(); if (!q.length) return;
      syncing.current = true;
      let rest = [...q];
      for (const item of q) {
        try {
          const res = await fetch(item.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item.payload) });
          const d = await res.json().catch(() => ({}));
          if (d.success || res.status === 409) {
            rest = rest.filter(r => r.payload.clientRef !== item.payload.clientRef);
            writeQ(rest);
            if (d.success && !d.duplicate && item.phone) sendConfirmationSMS(item.name, item.phone, d.orderId);
          }
        } catch { break; }   // still offline
      }
      syncing.current = false;
    };
    sync();
    const t = setInterval(sync, 15000);
    window.addEventListener('online', sync);
    return () => { clearInterval(t); window.removeEventListener('online', sync); };
  }, []);

  const handleCheckout = async () => {
    if (addressMissing()) return flag('address', 'Enter the full shipping address');
    if (paymentMode === 'hosted' && selectedGuest) {
        setIsSubmitting(true);
        try {
            const data = await postOrder('/api/create-hosted-order', { cart, guestName: selectedGuest.name, guestId: selectedGuest.id, eventName, eventSlug: actualEventSlug, customerPhone, customerEmail, site: assignedSiteName, shippingInfo: cartRequiresShipping ? { address: shippingAddress, city: shippingCity, state: shippingState, zip: shippingZip } : null }, { name: selectedGuest.name, phone: customerPhone });
            if (!data.success) throw new Error(data.error);
            if (data.offline) { setOfflineSaved(true); setOrderComplete(true); setCart([]); setSelectedGuest(null); setGuestSearch(''); setIsSubmitting(false); return; }
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
            body: JSON.stringify({ cart, customerName, eventSlug: actualEventSlug, orderId: orderData.id }) 
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
      setDiscountAmount(0); setDiscountValue(''); setDiscountUnlocked(false);
      setIsSubmitting(false); setIsTerminalProcessing(false); setLastOrderId('');
      setManualShipOverride(false);
      setShowStaffPin(false); setNeeds(null);
      setOfflineSaved(false); setWaitMins(0); setBundleFor(null); setSuggestOff(false); setCopyingFrom(''); setShowSpell(false); spellOk.current = false;
      // refresh stock counts after the sale (finalSlug only exists inside the initial fetch)
      if (actualEventSlug) await loadInventoryMaps(actualEventSlug);
      window.scrollTo(0, 0);
  };

  // ── Walk-away reset ──────────────────────────────────────────────────────────
  // If a customer leaves mid-order, ask "Still there?" after IDLE_SECONDS without a tap, then start fresh so the
  // next person never sees their cart or details. Never while a payment is in progress or on the setup screen.
  const IDLE_SECONDS = 90, WARN_SECONDS = 20, DONE_SECONDS = 15;
  const [idleLeft, setIdleLeft] = useState<number | null>(null);
  const [doneLeft, setDoneLeft] = useState(DONE_SECONDS);
  const lastTouch = useRef(Date.now());
  const idleRef = useRef<any>({});

  const startOver = () => {
      resetApp();
      setSelectedGuest(null); setGuestSearch(''); setGuestError('');
      setBackNameList(false); setMetallicHighlight(false); setBackListConfirmed(false); setMetallicName(''); setMetallicTeam('');
      setUpsellMode(null); setAddOnQty({}); setShowAddOnModal(false);
      setShowLookup(false); setLookupQuery(''); setLookupResults([]);
      setShowAddon(false); setAddonNames([{ text: '', position: 'Back Center' }]); setAddonNumbers([]); setAddonCustomerName(''); setAddonCustomerPhone('');
      setShowDiscountModal(false); setDiscountPin(''); setDiscountPinError(false);
      setShowStaffPin(false); setStaffPin('');
      if (phonePay) cancelPhonePay();
      setIdleLeft(null);
  };
  idleRef.current = {
      startOver,
      busy: isSubmitting || isTerminalProcessing || addonSubmitting || showSetup || orderComplete || !!phonePay,
      attractOn: !!extras.attract && products.length > 0,
      inProgress: cart.length > 0 || logos.length > 0 || names.length > 0 || numbers.length > 0 || backNameList
          || !!(customerName || customerEmail || customerPhone || shippingAddress) || !!selectedGuest || !!guestSearch
          || showLookup || showAddon || showDiscountModal || showAddOnModal || discountAmount > 0 || showStaffPin,
  };

  useEffect(() => {
      const touched = () => { lastTouch.current = Date.now(); lastAny.current = Date.now(); };
      const evs = ['pointerdown', 'touchstart', 'keydown', 'input', 'scroll'];
      evs.forEach(e => window.addEventListener(e, touched, { capture: true, passive: true }));
      const t = setInterval(() => {
          const { busy, inProgress, startOver, attractOn } = idleRef.current;
          // Welcome slideshow after 60s untouched with nothing in progress
          if (attractOn && !busy && !inProgress && Date.now() - lastAny.current > 60000) setAttract(true);
          if (busy || !inProgress) { lastTouch.current = Date.now(); setIdleLeft(null); return; }
          const idle = (Date.now() - lastTouch.current) / 1000;
          if (idle < IDLE_SECONDS) { setIdleLeft(null); return; }
          const left = Math.ceil(IDLE_SECONDS + WARN_SECONDS - idle);
          if (left <= 0) { lastTouch.current = Date.now(); startOver(); window.scrollTo(0, 0); } else setIdleLeft(left);
      }, 1000);
      return () => { clearInterval(t); evs.forEach(e => window.removeEventListener(e, touched, { capture: true } as any)); };
  }, []);

  // The "You're all set!" screen goes back to the start on its own
  useEffect(() => {
      if (!orderComplete) return;
      setDoneLeft(DONE_SECONDS);
      const t = setInterval(() => setDoneLeft(s => s - 1), 1000);
      return () => clearInterval(t);
  }, [orderComplete]);
  useEffect(() => { if (orderComplete && doneLeft <= 0) idleRef.current.startOver(); }, [doneLeft, orderComplete]);
  useEffect(() => {
      if (!orderComplete || offlineSaved) return;
      if (!cartRequiresShipping) estimateWait().then(setWaitMins);
      if (extras.lowStockOn && actualEventSlug) fetch('/api/stock-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventSlug: actualEventSlug }) }).catch(() => {});
  }, [orderComplete]);
  // Welcome slideshow: next product every 4 seconds
  useEffect(() => {
      if (!attract) return;
      const t = setInterval(() => setAttractIdx(i => i + 1), 4000);
      return () => clearInterval(t);
  }, [attract]);

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
    <div className="min-h-screen font-sans kiosk-brand" style={{ background: `linear-gradient(160deg, ${headerColor} 0%, #0f172a 45%)` }}>
      <div className="w-[94%] lg:w-[85%] mx-auto py-8">
        <LevMark label="" className="mb-6" />
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
          <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative overflow-hidden kiosk-brand" style={{ background: `linear-gradient(160deg, ${headerColor} 0%, #0f172a 60%)` }}>
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
                  {offlineSaved
                    ? <p className="text-lg text-amber-200 font-bold mb-2 bg-white/10 py-2 px-4 rounded-xl">📶 Saved on this iPad — it sends automatically when Wi-Fi is back.</p>
                    : <p className="text-2xl font-mono text-white font-black mb-2 bg-white/10 py-2 px-4 rounded-xl inline-block">#{lastOrderId || '---'}</p>}
                  {waitMins > 0 && <p className="text-white font-black text-xl mt-3">⏱ Ready in about {waitMins} minutes</p>}
                  {paymentMode === 'hosted' ? <p className="text-white/70 mt-4 mb-8 text-lg">Your custom gear is being prepared. See you out there! 🙌</p> : <p className="text-white/70 mt-4 mb-8 text-lg">Your custom gear is being prepared. We'll text you when it's ready! 🙌</p>}
                  <button onClick={resetApp} className="text-gray-900 font-black py-4 px-8 rounded-2xl shadow-xl hover:opacity-90 w-full text-xl tracking-wide bg-white">Next Guest ➡️</button>
                  <p className="text-white/50 text-xs mt-3">Starting over for the next guest in {Math.max(0, doneLeft)}s</p>
              </div>
              <LevMark label="Thanks for ordering with" className="mt-8 relative z-10" />
          </div>
      );
  }

  const showPrice = paymentMode === 'retail';
  const garmentNow = isBottomSelected ? 'bottom' : isHoodieSelected ? 'hoodie' : 'top';
  const mainOpt = availableMainOptions.find(o => o.label === selectedMainDesign);
  const preview = (compact = false, view = 'both') => (
    <LivePreview compact={compact} view={view} color={selectedColor || parseProductId(selectedProductRecord?.id || '').color || ''} rosterImg={backNameList && rosterImageUrl ? rosterImageUrl : null}
      productImg={selectedProductRecord?.image_url} mainImg={mainOpt?.image_url} mainPlacement={mainOpt?.placement || 'large'} garment={garmentNow}
      accents={logos.map(l => ({ label: l.type, position: l.position, img: getLogoImage(l.type) }))} names={names} numbers={numbers} />
  );
  const livePreviewOn = !!extras.livePreview && !!selectedProductRecord?.image_url;
  const attractItems = (() => {
    const seen = new Set(); const out = [];
    for (const p of visibleProducts) { const k = mergedName(p.name); if (!p.image_url || seen.has(k)) continue; seen.add(k); out.push(p); }
    return out;
  })();
  const step1Done = !!(size && selectedProduct && (visibleColors.length === 0 || selectedColor));
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
      {idleLeft !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" style={{ background: 'rgba(15,23,42,0.75)' }}>
          <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
            <div className="text-6xl mb-3">👋</div>
            <h2 className="text-3xl font-black text-gray-900 mb-2">Still there?</h2>
            <p className="text-gray-500 text-lg mb-6">This order will clear in <b className="text-gray-900">{idleLeft}</b> second{idleLeft === 1 ? '' : 's'} so the next guest can start fresh.</p>
            <button onClick={() => setIdleLeft(null)} className="w-full text-white font-black py-4 rounded-2xl text-xl shadow-lg" style={{ backgroundColor: headerColor }}>I'm still here</button>
            <button onClick={() => { idleRef.current.startOver(); window.scrollTo(0, 0); }} className="w-full text-gray-500 font-bold py-3 mt-2 text-base">Start over</button>
          </div>
        </div>
      )}
      <div className="min-h-screen font-sans text-gray-900 kiosk-brand" style={{ background: `linear-gradient(160deg, ${headerColor} 0%, #0f172a 45%)`, animation: 'gradientShift 8s ease infinite', backgroundSize: '200% 200%' }}>
      <div className="w-[94%] lg:w-[85%] mx-auto py-6 grid lg:grid-cols-3 gap-6 lg:gap-8">
        <div className={`space-y-6 ${(paymentMode === 'retail' || selectedGuest) ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="glass-card shadow-2xl rounded-2xl overflow-hidden">
            <div className="text-white py-9 px-6 text-center relative select-none" style={{ backgroundColor: headerColor, WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
              onPointerDown={startPress} onPointerUp={endPress} onPointerLeave={endPress} onPointerCancel={endPress} onContextMenu={e => e.preventDefault()}>
              {eventLogo ? <img src={eventLogo} alt="Event Logo" draggable={false} className="h-36 mx-auto mb-3 pointer-events-none" /> : <h1 className="text-2xl font-bold uppercase tracking-wide">{eventName}</h1>}
              {!eventLogo && <p className="text-white text-opacity-80 text-sm mt-1">Order Form</p>}
              {queued > 0 && <div className="absolute top-9 right-2 text-xs bg-amber-400 text-amber-950 px-2 py-1 rounded font-black">⏳ {queued} order{queued === 1 ? '' : 's'} waiting for Wi-Fi</div>}
              {assignedTerminalId && <div className="absolute top-2 right-2 text-[10px] bg-black bg-opacity-20 px-2 py-1 rounded text-white">{assignedSiteName ? `📍 ${assignedSiteName}` : assignedTerminalId === 'BLUETOOTH_READER' ? '📱 BT' : `ID: ${assignedTerminalId.slice(-4)}`}</div>}
              {staffMode && <>
                <button onClick={() => { setShowLookup(true); setLookupQuery(''); setLookupResults([]); }} className="absolute bottom-2 right-2 text-sm bg-black bg-opacity-30 hover:bg-opacity-50 px-3 py-2 rounded-lg text-white font-bold transition-all">🔍 Lookup</button>
                <button onClick={() => setShowAddon(true)} className="absolute bottom-2 left-2 text-sm bg-black bg-opacity-30 hover:bg-opacity-50 px-3 py-2 rounded-lg text-white font-bold transition-all">✏️ Add-On</button>
                <button onClick={() => setStaffMode(false)} className="absolute top-2 left-2 text-sm bg-amber-400 text-amber-950 px-3 py-1.5 rounded-lg font-black shadow">🔓 Staff mode · Lock</button>
              </>}
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
                                {copyingFrom && (
                                  <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-3 font-bold text-base flex items-center justify-between gap-3">
                                    <span>➕ Copying {copyingFrom} — pick the size and type the new name below.</span>
                                    <button onClick={() => setCopyingFrom('')} className="text-blue-500 text-sm font-black">✕</button>
                                  </div>
                                )}
                                {bundleNow() > 0 && (
                                  <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 font-black text-base">🎁 Bundle: ${bundleNow().toFixed(2)} off this one</div>
                                )}
                                {livePreviewOn && <div className="mb-5">{preview()}</div>}
                                {!livePreviewOn && selectedProductRecord?.image_url && (
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

{staffMode && ignoreInventory && size && (!hasMultipleColors || selectedColor) && (
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
                                    <label className="text-sm font-black text-gray-900 uppercase tracking-widest">Item</label>
                                    {visibleProducts.length === 1 ? (
                                      // Single product — just show the name, no picker needed
                                      <p className="w-full p-3 border border-gray-400 rounded-lg bg-white text-black font-medium">
                                        {displayName(visibleProducts[0].name, products)}{showPrice ? ` — ${pickerPrice(visibleProducts[0])}` : ''}
                                      </p>
                                    ) : (
                                      // Multiple products — show image cards
                                      <div className="grid grid-cols-2 gap-2 mt-1">
                                        {visibleProducts.map(p => {
                                          const isSelected = mergedName(p.name) === mergedName(selectedProduct.name);
                                          // Get only active colors for this product in this event
                                          const productColors = products.filter(pp =>
                                            mergedName(pp.name) === mergedName(p.name) &&
                                            (() => { const { size: s } = parseProductId(pp.id); return s && activeItems[`${pp.id}_${s}`] === true; })()
                                          ).map(pp => parseProductId(pp.id).color).filter(Boolean);
                                          const uniqueColors = [...new Set(productColors)];
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
                                              <span className="text-sm font-bold leading-tight">{displayName(p.name, products)}</span>
                                              {showPrice && <span className="text-sm text-gray-500">{pickerPrice(p)}</span>}
                                              {uniqueColors.length > 0 && (
                                                <div className="flex flex-wrap justify-center gap-1 mt-1.5">
                                                  {uniqueColors.slice(0, 8).map(c => (
                                                    <div key={c} title={c}
                                                      style={{ backgroundColor: colorHex(c), width: 12, height: 12, borderRadius: '50%', border: '1px solid rgba(0,0,0,0.2)', flexShrink: 0 }}
                                                    />
                                                  ))}
                                                  {uniqueColors.length > 8 && <span className="text-[9px] text-gray-400">+{uniqueColors.length - 8}</span>}
                                                </div>
                                              )}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {/* COLOR — chips */}
                                  {visibleColors.length > 0 && (
                                    <div id="need-color" className={needs?.key === 'color' ? 'rounded-xl ring-4 ring-red-300 p-2 -m-2' : ''}>
                                      <label className="text-sm font-black text-gray-900 uppercase tracking-widest mb-2 block">Color</label>
                                      <div className="flex flex-wrap gap-2">
                                        {visibleColors.map(col => (
                                          <button key={col} type="button"
                                            onClick={() => { setSelectedColor(col); setSize(''); }}
                                            className={`px-5 py-3 rounded-xl font-bold text-base border-2 transition-all active:scale-95 flex items-center gap-2 ${selectedColor === col ? 'text-white border-transparent shadow-md' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'}`}
                                            style={selectedColor === col ? {backgroundColor: headerColor, borderColor: headerColor} : {}}
                                          >
                                            <span style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: colorHex(col), border: '1.5px solid rgba(0,0,0,0.15)', flexShrink: 0, display: 'inline-block' }} />
                                            {col}
                                          </button>
                                        ))}
                                      </div>
                                      {needMsg('color')}
                                    </div>
                                  )}

                                  {/* SIZE — chips */}
                                  {(!hasMultipleColors || selectedColor) && (
                                    <div id="need-size" className={needs?.key === 'size' ? 'rounded-xl ring-4 ring-red-300 p-2 -m-2' : ''}>
                                      <label className="text-sm font-black text-gray-900 uppercase tracking-widest mb-2 block">Size</label>
                                      <div className="flex flex-wrap gap-2">
                                        {visibleSizes.map(s => {
                                          // Sold out here → still orderable, ships home; low stock shows a count
                                          const left = ignoreInventory ? null : stockFor(s.value);
                                          const out = left !== null && left <= 0;
                                          const on = size === s.value;
                                          return (
                                          <button key={s.value} type="button"
                                            onClick={() => setSize(s.value)}
                                            className={`min-w-[64px] px-4 py-2.5 rounded-xl font-bold text-base border-2 transition-all active:scale-95 flex flex-col items-center leading-tight ${on ? 'text-white border-transparent shadow-md' : out ? 'bg-gray-100 border-dashed border-gray-300 text-gray-400' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'}`}
                                            style={on ? {backgroundColor: out ? '#9ca3af' : headerColor, borderColor: out ? '#9ca3af' : headerColor} : {}}
                                          >
                                            <span>{s.label}</span>
                                            {out ? <span className={`text-[11px] font-black uppercase ${on ? 'text-white' : 'text-orange-600'}`}>Ships</span>
                                              : left !== null && left <= 3 ? <span className={`text-[11px] font-bold ${on ? 'text-white/90' : 'text-amber-600'}`}>{left} left</span> : null}
                                          </button>
                                          );
                                        })}
                                      </div>
                                      {visibleSizes.some(s => !ignoreInventory && stockFor(s.value) <= 0) && <p className="text-sm text-gray-500 mt-2">Sizes marked <b className="text-orange-600">Ships</b> are sold out here — we'll ship them to your home.</p>}
                                      {needMsg('size')}
                                    </div>
                                  )}

                                </div>
                            </>
                        )}
                    </section>

                    {selectedProduct && availableMainOptions.length > 0 && (
                        <section id="need-design" className={needs?.key === 'design' ? 'rounded-2xl ring-4 ring-red-300 p-2' : ''}>
                            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100"><div className="flex items-center gap-3">{step2Done ? <span className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-500 text-white font-black text-sm shrink-0 transition-all">✓</span> : <span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0" style={{backgroundColor: headerColor}}>2</span>}<h2 className="font-black text-gray-900 text-base uppercase tracking-widest">Choose Design</h2></div><span className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold uppercase tracking-wide">Included</span></div>
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                <div className="col-span-2 grid grid-cols-2 gap-3">
                                    {availableMainOptions.map((opt) => (
                                        <button key={opt.label} onClick={() => setSelectedMainDesign(opt.label)} className={`border-2 rounded-xl p-2 flex flex-col items-center gap-2 transition-all active:scale-95 shadow-sm ${selectedMainDesign === opt.label ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-gray-100 bg-white hover:border-gray-300 hover:shadow-sm'}`}>
                                            {opt.image_url ? (<img src={opt.image_url} alt={opt.label} className="h-20 w-full object-contain" />) : (<div className="h-20 w-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">No Image</div>)}
                                            <span className={`text-sm font-bold text-center leading-tight ${selectedMainDesign === opt.label ? 'text-green-800' : 'text-gray-800'}`}>{opt.label}</span>
                                            {selectedMainDesign === opt.label && <span className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded-full font-bold">SELECTED ✓</span>}
                                        </button>
                                    ))}
                                </div>
                                <div className="col-span-1">
                                  {needMsg('design')}
                                  {(() => {
                                    const currentLogoObj = availableMainOptions.find(o => o.label === selectedMainDesign);
                                    const placement = currentLogoObj?.placement || 'large';
                                    const garmentType = isBottomSelected ? 'bottom' : isHoodieSelected ? 'hoodie' : 'top';
                                    return livePreviewOn ? preview(true, 'front') : <PlacementVisualizer garmentType={garmentType} logoSize={placement} />;
                                  })()}
                                </div>
                            </div>
                        </section>
                    )}

                    {selectedProduct && (availableAccentOptions.length > 0 || extras.binder) && (
                        <section>
                            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100"><div className="flex items-center gap-3"><span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0" style={{backgroundColor: headerColor}}>3</span><h2 className="font-black text-gray-900 text-base uppercase tracking-widest">Add Accents</h2></div>{showPrice && <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold uppercase tracking-wide">+$5 each</span>}</div>
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mb-4">
                                {availableAccentOptions.map((opt) => (
                                    <button key={opt.label} onClick={() => addLogo(opt.label)} className="bg-white border-2 border-gray-100 hover:border-blue-400 rounded-xl p-2 flex flex-col items-center gap-1 transition-all active:scale-95 shadow-sm">
                                        {opt.image_url ? <img src={opt.image_url} className="h-12 w-full object-contain" /> : <div className="h-12 w-full bg-gray-100 text-[10px] flex items-center justify-center">No Img</div>}
                                        <span className="text-xs font-bold text-center leading-tight truncate w-full">{opt.label}</span>
                                    </button>
                                ))}
                                {extras.binder && (
                                    <button onClick={addBinder} className="bg-amber-50 border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-xl p-2 flex flex-col items-center gap-1 transition-all active:scale-95 shadow-sm">
                                        <div className="h-12 w-full flex items-center justify-center text-3xl">📒</div>
                                        <span className="text-xs font-black text-amber-900 text-center leading-tight w-full">From the binder</span>
                                    </button>
                                )}
                            </div>
                            {logos.length > 0 && (
                                <div id="need-logo-pos" className="bg-slate-50 p-4 rounded-xl border border-gray-100 space-y-3">
                                    <h3 className="text-sm font-bold uppercase text-gray-500">Your accents — tap to change where they go</h3>
                                    {needMsg('logo-pos')}
                                    {logos.map((logo, index) => {
                                        const currentImage = getLogoImage(logo.type);
                                        return (
                                            <div key={index} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                                <div className="w-10 h-10 flex-shrink-0 border rounded bg-gray-50 flex items-center justify-center">{logo.binder !== undefined ? <span className="text-2xl">📒</span> : currentImage ? <img src={currentImage} className="max-h-8 max-w-8" /> : <span className="text-xs">IMG</span>}</div>
                                                {logo.binder !== undefined
                                                  ? <div className="flex-1 min-w-0"><div className="text-xs font-black uppercase text-amber-800 mb-1">From the binder</div>
                                                      <input value={logo.binder} onChange={(e) => setBinder(index, e.target.value)} maxLength={40} autoFocus placeholder="Binder # and what it is (e.g. #14 football)"
                                                        className={`w-full border-2 rounded-lg p-2 text-base font-bold text-black focus:outline-none ${String(logo.binder || '').trim() ? 'border-gray-300 focus:border-amber-500' : 'border-amber-400 bg-amber-50'}`} /></div>
                                                  : <div className="flex-1"><div className="text-sm font-bold">{logo.type}</div></div>}
                                                <select className={`border-2 p-2 rounded-lg text-base ${!logo.position ? 'border-red-400 bg-red-50 text-red-900' : 'border-gray-300 text-black'}`} value={logo.position} onChange={(e) => updateLogo(index, 'position', e.target.value)}>
                                                  <option value="">Position...</option>
                                                  {getPositionOptions('logo', true).map(pos => (<option key={pos.id} value={pos.label}>{pos.label}</option>))}
                                                </select>
                                                <button onClick={() => setLogos(logos.filter((_, i) => i !== index))} className="text-gray-400 hover:text-red-600 font-bold text-3xl px-3 leading-none" aria-label="Remove">×</button>
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
                            <div id="need-pers-pos">{needMsg('pers-pos')}</div>
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
                                    <button onClick={() => setNames([...names, { text: '', position: defaultPosition('name') }])} className="flex-1 py-3 border-2 border-dashed border-gray-200 text-gray-400 rounded-xl hover:border-blue-500 hover:text-blue-600 font-bold bg-white transition-all">+ Add Name</button>
                                )}
                                {showNumbers && (
                                    <button onClick={() => setNumbers([...numbers, { text: '', position: defaultPosition('number') }])} className="flex-1 py-3 border-2 border-dashed border-gray-200 text-gray-400 rounded-xl hover:border-blue-500 hover:text-blue-600 font-bold bg-white transition-all">+ Add Number</button>
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
                                    {rosterImageUrl && (
                                        <img src={rosterImageUrl} alt="Team Roster" className="w-full rounded-xl border border-yellow-200 shadow-sm" />
                                    )}
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
                    <p className="text-2xl font-bold">{showPrice ? `$${(calculateItemTotal() - bundleNow()).toFixed(2).replace(/\.00$/, '')}` : 'Free'}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    {cart.length > 0 && <button onClick={() => document.getElementById('cart')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="lg:hidden bg-white/15 border border-white/40 text-white px-4 py-3 rounded-xl font-black text-base">🛒 Cart ({cart.length}) ↓</button>}
                    <button
                      onClick={handleAddToCart}
                      className="bg-white text-black px-8 py-4 rounded-xl font-black shadow-lg active:scale-95 transition-all hover:opacity-90 uppercase tracking-wide text-base"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
            )}
          </div>
        </div>
        
        {(paymentMode === 'retail' || selectedGuest) && (
            <div className="lg:col-span-1" id="cart">
            <div className="glass-card shadow-2xl rounded-2xl overflow-hidden sticky top-4 slide-in-right">
                <div className="text-white p-5" style={{ backgroundColor: headerColor }}>
                  <h2 className="font-bold text-lg">Your Cart</h2>
                  <p className="text-white text-opacity-80 text-sm">{cart.length} item{cart.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
                {cart.length === 0 ? <p className="text-gray-500 text-center italic py-10">Cart is empty.</p> : cart.map((item) => (
                    <div key={item.id} className="border-b border-gray-200 pb-4 last:border-0 relative">
                    <div className="flex flex-wrap justify-end gap-1 mb-1">
                      {extras.sibling && <button onClick={() => copyItem(item)} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-black text-sm px-3 py-2 rounded-lg transition-all">➕ ANOTHER</button>}
                      <button onClick={() => editItem(item)} className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-black text-sm px-3 py-2 rounded-lg transition-all">EDIT</button>
                      <button onClick={() => removeItem(item.id)} className="bg-red-100 hover:bg-red-200 text-red-600 font-black text-sm px-3 py-2 rounded-lg transition-all">REMOVE</button>
                    </div>
                    <p className="font-black text-black text-lg">{item.productName}</p>
                    {item.needsShipping && (
                      <div className="mt-1 mb-2">
                        <span className="bg-orange-200 text-orange-800 text-xs font-bold px-2 py-1 rounded">Ship to Home</span>
                        {staffMode && <label className="flex items-center gap-2 mt-2 cursor-pointer w-fit">
                          <input type="checkbox" className="w-5 h-5 accent-green-600"
                            checked={!item.needsShipping || item.staffStockOverride}
                            onChange={e => {
                              setCart(cart.map(c => c.id === item.id ? { ...c, staffStockOverride: e.target.checked, needsShipping: !e.target.checked } : c));
                            }}
                          />
                          <span className="text-sm font-black text-green-700">Staff: We have this in stock</span>
                        </label>}
                      </div>
                    )}
                    {item.color && <p className="text-sm text-gray-600 font-bold">Color: {item.color}</p>}
                    <p className="text-sm text-gray-800 font-medium">Size: {item.size}</p>
                    <div className="text-xs text-blue-900 font-bold mt-1">Design: {item.customizations.mainDesign || 'None'}</div>
                    <div className="text-xs text-gray-800 mt-1 space-y-0.5 font-medium">
                        {item.customizations.logos.map((l, i) => <div key={'logo'+i}>• {l.type} ({l.position})</div>)}
                        {item.customizations.names.map((n, i) => <div key={'name'+i}>• "{n.text}" ({n.position})</div>)}
                        {item.customizations.numbers?.map((num, i) => <div key={'num'+i}>• #{num.text} ({num.position})</div>)}
                        {item.customizations.backList && <div>• Team Roster</div>}
                        {item.customizations.metallic && <div>• Metallic: {item.customizations.metallicName}{item.customizations.metallicTeam ? ` — ${item.customizations.metallicTeam}` : ''}</div>}
                        {item.customizations.bundleSavings > 0 && <div className="text-emerald-700 font-bold">• Bundle savings −${Number(item.customizations.bundleSavings).toFixed(2)}</div>}
                    </div>
                    {showPrice && <p className="font-bold text-right mt-2 text-blue-900 text-lg">${item.finalPrice.toFixed(2)}</p>}
                    </div>
                ))}
                </div>
                {suggestion && (
                  <div className="mx-4 mt-3 bg-sky-50 border border-sky-200 rounded-2xl p-4 flex items-center gap-3">
                    {suggestion.image_url ? <img src={suggestion.image_url} alt="" className="w-16 h-16 object-contain bg-white rounded-lg border border-sky-100" /> : null}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sky-900 text-sm">✨ Complete the look</p>
                      <p className="text-sm text-sky-800 font-bold truncate">{displayName(suggestion.name, products)}</p>
                      {showPrice && Number(extras.bundleDiscount) > 0 && <p className="text-xs text-emerald-700 font-black">Bundle: save ${Number(extras.bundleDiscount).toFixed(0)}</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => takeSuggestion(suggestion)} className="bg-sky-600 hover:bg-sky-700 text-white font-black text-sm px-4 py-2 rounded-xl">Add it →</button>
                      <button onClick={() => setSuggestOff(true)} className="text-xs text-sky-600 font-bold">No thanks</button>
                    </div>
                  </div>
                )}
                {cart.length > 0 && (() => {
                  const hasPersonalization = cart.some(i => (i.customizations?.names?.length > 0) || (i.customizations?.numbers?.length > 0) || i.customizations?.backList);
                  if (!(cart.length === 1 && !hasPersonalization && showPersonalization)) return null;

                  const addToCartItem = (type: 'name' | 'number', text: string, position: string) => {
                    if (!text.trim()) return;
                    const price = 5;
                    setCart(cart.map((item, i) => i === 0 ? {
                      ...item,
                      finalPrice: item.finalPrice + price,
                      customizations: {
                        ...item.customizations,
                        names: type === 'name' ? [...(item.customizations?.names || []), { text: text.trim(), position }] : (item.customizations?.names || []),
                        numbers: type === 'number' ? [...(item.customizations?.numbers || []), { text: text.trim(), position }] : (item.customizations?.numbers || []),
                      }
                    } : item));
                    setUpsellMode(null);
                  };

                  return (
                    <div className="mx-4 mt-3 mb-1 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                      {!upsellMode ? (
                        <>
                          <p className="font-black text-amber-800 text-sm mb-1">✨ Make it personal!</p>
                          <p className="text-xs text-amber-700 mb-3">Add a name, number, or team roster for just <strong>$5 more</strong>.</p>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => setUpsellMode('name')} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs py-2 rounded-xl transition-all">+ Add Name</button>
                            <button onClick={() => setUpsellMode('number')} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs py-2 rounded-xl transition-all">+ Add Number</button>
                            {showBackNames && <button onClick={() => {
                              setCart(cart.map((item, i) => i === 0 ? {
                                ...item,
                                finalPrice: item.finalPrice + 5,
                                customizations: { ...item.customizations, backList: true }
                              } : item));
                            }} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs py-2 rounded-xl transition-all">+ Team Roster</button>}
                            <button onClick={() => setUpsellMode(null)} className="text-xs text-amber-600 font-bold px-2">No thanks</button>
                          </div>
                        </>
                      ) : (() => {
                        let upsellText = '';
                        const upsellDefault = defaultPosition(upsellMode, cart[0]?.customizations || {}) || 'Back Center';
                        let upsellPosition = upsellDefault;
                        return (
                          <>
                            <p className="font-black text-amber-800 text-sm mb-3">{upsellMode === 'name' ? 'Add a Name (+$5)' : 'Add a Number (+$5)'}</p>
                            <input
                              autoFocus
                              type="text"
                              maxLength={upsellMode === 'name' ? 12 : 3}
                              placeholder={upsellMode === 'name' ? 'ENTER NAME' : 'e.g. 24'}
                              className="w-full border-2 border-amber-300 rounded-xl p-3 font-bold uppercase text-black text-lg focus:outline-none focus:border-amber-500 mb-2"
                              onChange={e => { upsellText = e.target.value; }}
                            />
                            <select className="w-full border-2 border-amber-200 rounded-xl p-3 font-bold bg-white mb-3 focus:outline-none"
                              onChange={e => { upsellPosition = e.target.value; }}
                              defaultValue={upsellDefault}>
                              {getPositionOptions(upsellMode).map(pos => (
                                <option key={pos.id} value={pos.label}>{pos.label}</option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <button onClick={() => addToCartItem(upsellMode, upsellText, upsellPosition)}
                                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm py-2 rounded-xl transition-all">Add +$5</button>
                              <button onClick={() => setUpsellMode(null)} className="text-xs text-amber-600 font-bold px-3">Cancel</button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  );
                })()}

                {cart.length > 0 && (
                <div className="p-5 bg-slate-50 border-t border-gray-100 rounded-b-2xl">
                    <h3 className="font-bold text-black mb-2">Checkout Details</h3>
                    {paymentMode === 'hosted' && selectedGuest ? (
                        <div className="bg-green-100 text-green-900 p-2 rounded mb-4 font-bold text-sm">Guest: {selectedGuest.name}</div>
                    ) : (
                        <>
                            {/* text-base (16px) so the iPad doesn't zoom in when a field is tapped */}
                            <div id="need-cname"><input className={`w-full p-3 border-2 ${needBorder('cname')} rounded-xl mb-2 text-base text-black focus:border-blue-400 focus:outline-none`} placeholder="Your name" autoComplete="off" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />{needMsg('cname')}</div>
                            <div id="need-phone"><input className={`w-full p-3 border-2 ${needBorder('phone')} rounded-xl mb-1 text-base text-black focus:border-blue-400 focus:outline-none`} placeholder="Mobile number — we text you when it's ready" type="tel" inputMode="tel" autoComplete="off" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />{needMsg('phone')}</div>
                            <p className="text-[11px] text-gray-500 leading-tight mb-3">By providing your phone number, you agree to receive automated transactional text messages from Lev Custom Merch.</p>
                            <input className="w-full p-3 border-2 border-gray-200 rounded-xl mb-1 text-base text-black focus:border-blue-400 focus:outline-none" placeholder="Email for a receipt (optional)" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                            {/* One tap fills in the domain — replaces anything already typed after "@" */}
                            {/* Swipeable row so no button gets squeezed off the narrow checkout panel */}
                            <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x" style={{ WebkitOverflowScrolling: 'touch' }}>
                                {['@gmail.com', '@yahoo.com', '@hotmail.com'].map(domain => (
                                    <button key={domain} type="button"
                                        onClick={() => setCustomerEmail(prev => prev.split('@')[0].trim() + domain)}
                                        className="shrink-0 snap-start whitespace-nowrap px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:border-blue-300 active:scale-95 transition-all">
                                        {domain}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                    {showAddressForm && (
                    <div id="need-address" className={`bg-orange-50 border p-3 rounded mb-4 ${needs?.key === 'address' ? 'border-red-500 ring-4 ring-red-200' : 'border-orange-200'}`}>
                      <h4 className="font-bold text-orange-800 text-base mb-2">🚚 Shipping Address Required</h4>
                      {needMsg('address')}
                      <input className="w-full p-3 border border-gray-300 rounded-lg mb-2 text-base" placeholder="Street Address" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} />
                      <div className="grid grid-cols-2 gap-2">
                        <input className="w-full p-3 border border-gray-300 rounded-lg mb-2 text-base" placeholder="City" value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} />
                        <input className="w-full p-3 border border-gray-300 rounded-lg mb-2 text-base" placeholder="State" value={shippingState} onChange={(e) => setShippingState(e.target.value)} />
                      </div>
                      <input className="w-full p-3 border border-gray-300 rounded-lg text-base" placeholder="Zip Code" value={shippingZip} onChange={(e) => setShippingZip(e.target.value)} />
                    </div>
                    )}
                    {showPrice && (
                        <div className="mt-4 border-t-2 border-gray-200 pt-4 space-y-2 mb-6">
                            <div className="flex justify-between text-sm font-bold text-gray-600 uppercase"><span>Subtotal</span><span>${calculateSubtotal().toFixed(2)}</span></div>
                            {taxEnabled && taxRate > 0 && (<div className="flex justify-between text-sm font-bold text-gray-600 uppercase"><span>Sales Tax ({taxRate}%)</span><span>${calculateTax().toFixed(2)}</span></div>)}
                            {discountAmount > 0 && (
                              <div className="flex justify-between items-center text-sm font-bold text-green-600">
                                <span>Discount Applied</span>
                                <div className="flex items-center gap-2">
                                  <span>-${discountAmount.toFixed(2)}</span>
                                  <button onClick={() => { setDiscountAmount(0); setDiscountValue(''); setDiscountUnlocked(false); }} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                                </div>
                              </div>
                            )}
                            <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-black uppercase tracking-widest">Total Due</span>
                                  {staffMode && !discountAmount && <button onClick={() => setShowDiscountModal(true)} className="text-xs bg-orange-100 text-orange-700 font-black px-2 py-1 rounded-lg hover:bg-orange-200 transition-all">% Discount</button>}
                                </div>
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
                        {paymentMode === 'retail' && extras.qrPay && (
                            <button onClick={handlePhonePay} disabled={isSubmitting || isTerminalProcessing} className="w-full py-3 bg-white border-2 font-black rounded-xl shadow transition-all flex flex-col items-center justify-center leading-tight" style={{ borderColor: headerColor, color: headerColor }}><span className="text-lg">📱 Pay on your phone</span><span className="text-xs font-bold opacity-70">Apple Pay · Google Pay · card</span></button>
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
      <LevMark className="pb-8 pt-2" />
    </div>

    {/* Is this spelled right? */}
    {showSpell && (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
          <div className="p-6 text-white text-center" style={{ backgroundColor: headerColor }}>
            <h2 className="font-black text-3xl">Is this spelled right?</h2>
            <p className="text-white/80 text-base mt-1">This is exactly what we'll print.</p>
          </div>
          <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
            {[...names.map(n => ({ t: String(n.text || '').toUpperCase(), pos: n.position, kind: 'Name' })),
              ...numbers.map(n => ({ t: String(n.text || ''), pos: n.position, kind: 'Number' })),
              ...(metallicHighlight ? [{ t: String(metallicName || '').toUpperCase(), pos: 'Metallic highlight', kind: 'Athlete' }] : []),
              ...logos.filter(l => l.binder !== undefined).map(l => ({ t: String(l.binder || ''), pos: l.position, kind: '📒 Binder design' }))]
              .filter(r => r.t.trim()).map((r, i) => (
              <div key={i} className="border-2 border-gray-200 rounded-2xl p-4 text-center">
                <div className="text-xs font-black uppercase tracking-widest text-gray-400">{r.kind} · {r.pos}</div>
                <div className="text-5xl font-black text-gray-900 tracking-wide break-all mt-1" style={{ fontFamily: 'var(--font-lev-heading), Impact, sans-serif' }}>{r.t.split('').join('\u2009')}</div>
              </div>
            ))}
            {livePreviewOn && <div className="pt-2">{preview(true, 'both')}</div>}
          </div>
          <div className="p-6 pt-0 grid grid-cols-2 gap-3">
            <button onClick={() => setShowSpell(false)} className="py-4 rounded-2xl border-2 border-gray-200 font-black text-lg text-gray-700">✏️ Fix it</button>
            <button onClick={() => { setShowSpell(false); spellOk.current = true; handleAddToCart(); }} className="py-4 rounded-2xl bg-emerald-600 text-white font-black text-lg">✓ Yes, it's right</button>
          </div>
        </div>
      </div>
    )}

    {/* Pay on your phone */}
    {phonePay && (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden text-center">
          <div className="p-6 text-white" style={{ backgroundColor: headerColor }}>
            <h2 className="font-black text-3xl">📱 Scan to pay</h2>
            <p className="text-white/80 text-base mt-1">Open your phone's camera and point it here.</p>
          </div>
          <div className="p-6">
            <img src={phonePay.qr} alt="Payment QR code" className="mx-auto w-72 h-72" />
            <p className="text-3xl font-black text-gray-900 mt-3">${calculateGrandTotal().toFixed(2)}</p>
            <p className="text-gray-500 font-semibold mt-1">Apple Pay, Google Pay or card. This screen updates when you've paid.</p>
            <p className="text-sm text-gray-400 mt-3 animate-pulse">Waiting for payment… ({Math.max(0, Math.floor(phonePay.left / 60))}:{String(Math.max(0, phonePay.left % 60)).padStart(2, '0')})</p>
            <button onClick={cancelPhonePay} className="mt-4 w-full py-3 rounded-2xl border-2 border-gray-200 font-black text-gray-600">Cancel — pay another way</button>
          </div>
        </div>
      </div>
    )}

    {/* Welcome slideshow when the kiosk is idle */}
    {attract && (
      <div className="fixed inset-0 z-[95] flex flex-col items-center justify-center p-8 text-center cursor-pointer kiosk-brand" style={{ background: `linear-gradient(160deg, ${headerColor} 0%, #0f172a 70%)` }}
        onClick={() => { setAttract(false); lastAny.current = Date.now(); }}>
        {eventLogo ? <img src={eventLogo} alt="" className="h-28 mb-6 object-contain" /> : <h1 className="text-5xl font-black text-white mb-6">{eventName}</h1>}
        {attractItems.length > 0 && (() => {
          const p = attractItems[attractIdx % attractItems.length];
          return (
            <div key={p.id} className="slide-in-up bg-white/95 rounded-[32px] shadow-2xl p-6 w-full max-w-md">
              <img src={p.image_url} alt="" className="h-72 w-full object-contain" />
              <p className="text-2xl font-black text-gray-900 mt-3">{displayName(p.name, products)}</p>
              {showPrice && <p className="text-lg font-bold text-gray-500">{pickerPrice(p)}</p>}
            </div>
          );
        })()}
        <p className="text-white text-4xl font-black mt-8 animate-pulse">👆 Tap to design yours</p>
        {welcomeMessage && <p className="text-white/70 text-lg mt-3 max-w-xl">{welcomeMessage}</p>}
        <LevMark className="mt-10" />
      </div>
    )}

    {/* Staff mode PIN */}
    {showStaffPin && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowStaffPin(false)}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="p-6 bg-amber-400">
            <h2 className="text-amber-950 font-black text-xl">🔓 Staff mode</h2>
            <p className="text-amber-900/80 text-sm mt-1">Shows Lookup, Add-On and Discount until someone taps Lock.</p>
          </div>
          <div className="p-6 space-y-4">
            <input type="password" autoFocus
              className={`w-full border-2 rounded-xl px-4 py-3 font-black text-center text-2xl tracking-widest focus:outline-none ${staffPinError ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-amber-400'}`}
              placeholder="PIN or passcode" value={staffPin}
              onChange={e => { setStaffPin(e.target.value); setStaffPinError(false); }}
              onKeyDown={e => { if (e.key === 'Enter') unlockStaff(); }} />
            {staffPinError && <p className="text-red-500 text-sm font-bold text-center">Wrong PIN</p>}
            <button onClick={unlockStaff} className="w-full bg-amber-400 hover:bg-amber-500 text-amber-950 font-black py-3 rounded-xl text-lg">Unlock</button>
            <button onClick={() => setShowStaffPin(false)} className="w-full text-gray-500 font-bold py-2">Cancel</button>
          </div>
        </div>
      </div>
    )}

    {/* Discount Modal */}
    {showDiscountModal && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowDiscountModal(false); setDiscountPin(''); setDiscountPinError(false); }}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="p-6 bg-orange-500">
            <h2 className="text-white font-black text-xl">% Manager Discount</h2>
            <p className="text-white/70 text-sm mt-1">Requires manager PIN</p>
          </div>
          <div className="p-6 space-y-4">
            {!discountUnlocked ? (
              <>
                <p className="text-sm text-gray-500 font-bold">Enter manager PIN to apply a discount</p>
                <input type="password" maxLength={6}
                  className={`w-full border-2 rounded-xl px-4 py-3 font-black text-center text-2xl tracking-widest focus:outline-none ${discountPinError ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-orange-400'}`}
                  placeholder="••••" value={discountPin}
                  onChange={e => { setDiscountPin(e.target.value); setDiscountPinError(false); }}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') {
                      const res = await fetch('/api/verify-price-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: discountPin }) });
                      const data = await res.json();
                      if (data.success) { setDiscountUnlocked(true); setDiscountPin(''); }
                      else { setDiscountPinError(true); setDiscountPin(''); }
                    }
                  }}
                />
                {discountPinError && <p className="text-red-500 text-xs font-bold text-center">Wrong PIN</p>}
                <button onClick={async () => {
                  const res = await fetch('/api/verify-price-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: discountPin }) });
                  const data = await res.json();
                  if (data.success) { setDiscountUnlocked(true); setDiscountPin(''); }
                  else { setDiscountPinError(true); setDiscountPin(''); }
                }} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-xl transition-all">Unlock</button>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setDiscountType('percent')}
                    className={`py-3 rounded-xl font-black text-sm transition-all ${discountType === 'percent' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    % Percent
                  </button>
                  <button onClick={() => setDiscountType('fixed')}
                    className={`py-3 rounded-xl font-black text-sm transition-all ${discountType === 'fixed' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    $ Fixed
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-xl">{discountType === 'percent' ? '%' : '$'}</span>
                  <input type="number" min="0" max={discountType === 'percent' ? 100 : calculateSubtotal()}
                    className="w-full border-2 border-orange-300 rounded-xl pl-10 pr-4 py-3 font-black text-2xl focus:outline-none focus:border-orange-500"
                    placeholder="0" value={discountValue}
                    onChange={e => setDiscountValue(e.target.value)} />
                </div>
                {discountValue && (
                  <div className="bg-orange-50 rounded-xl p-3 text-center">
                    <p className="text-sm text-orange-600 font-bold">
                      Subtotal: ${calculateSubtotal().toFixed(2)} → 
                      <span className="font-black ml-1">
                        ${Math.max(0, calculateSubtotal() - (discountType === 'percent' ? calculateSubtotal() * (parseFloat(discountValue) / 100) : parseFloat(discountValue || '0'))).toFixed(2)}
                      </span>
                    </p>
                  </div>
                )}
                <button onClick={() => {
                  const val = parseFloat(discountValue || '0');
                  const amt = discountType === 'percent' ? calculateSubtotal() * (val / 100) : val;
                  setDiscountAmount(Math.min(amt, calculateSubtotal()));
                  setShowDiscountModal(false);
                  setDiscountValue('');
                  setDiscountUnlocked(false);
                }} disabled={!discountValue || parseFloat(discountValue) <= 0}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-xl transition-all disabled:opacity-40">
                  Apply Discount
                </button>
              </>
            )}
            <button onClick={() => { setShowDiscountModal(false); setDiscountPin(''); setDiscountPinError(false); setDiscountUnlocked(false); }} className="w-full text-gray-400 font-bold py-2 text-sm">Cancel</button>
          </div>
        </div>
      </div>
    )}

    {/* Add-On Order Modal */}
    {showAddon && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddon(false)}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="p-6" style={{ backgroundColor: headerColor }}>
            <h2 className="text-white font-black text-xl">✏️ Add-On Order</h2>
            <p className="text-white/70 text-sm mt-1">Names & numbers on existing garment</p>
          </div>
          <div className="p-6 space-y-4">

            {/* Customer info */}
            <div className="grid grid-cols-2 gap-3">
              <input className="border-2 border-gray-200 rounded-xl px-4 py-3 font-bold focus:outline-none focus:border-blue-400"
                placeholder="Customer Name" value={addonCustomerName} onChange={e => setAddonCustomerName(e.target.value)} />
              <input className="border-2 border-gray-200 rounded-xl px-4 py-3 font-bold focus:outline-none focus:border-blue-400"
                placeholder="Phone" type="tel" value={addonCustomerPhone} onChange={e => setAddonCustomerPhone(e.target.value)} />
            </div>

            {/* Names */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-black uppercase tracking-wider text-gray-500">Names (+$5 each)</label>
                <button onClick={() => setAddonNames([...addonNames, { text: '', position: 'Back Center' }])}
                  className="text-xs font-black text-blue-600 hover:text-blue-800">+ Add Name</button>
              </div>
              {addonNames.map((n, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 font-bold uppercase focus:outline-none focus:border-blue-400"
                    placeholder="NAME" maxLength={12} value={n.text}
                    onChange={e => setAddonNames(addonNames.map((x, j) => j === i ? { ...x, text: e.target.value.toUpperCase() } : x))} />
                  <select className="border-2 border-gray-200 rounded-xl px-3 py-2 font-bold bg-white focus:outline-none"
                    value={n.position} onChange={e => setAddonNames(addonNames.map((x, j) => j === i ? { ...x, position: e.target.value } : x))}>
                    {getPositionOptions('name').map(p => <option key={p.id} value={p.label}>{p.label}</option>)}
                  </select>
                  {addonNames.length > 1 && <button onClick={() => setAddonNames(addonNames.filter((_, j) => j !== i))} className="text-red-400 font-black px-2">✕</button>}
                </div>
              ))}
            </div>

            {/* Numbers */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-black uppercase tracking-wider text-gray-500">Numbers (+$5 each)</label>
                <button onClick={() => setAddonNumbers([...addonNumbers, { text: '', position: 'Back Center' }])}
                  className="text-xs font-black text-blue-600 hover:text-blue-800">+ Add Number</button>
              </div>
              {addonNumbers.map((n, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-blue-400"
                    placeholder="00" maxLength={3} value={n.text}
                    onChange={e => setAddonNumbers(addonNumbers.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
                  <select className="border-2 border-gray-200 rounded-xl px-3 py-2 font-bold bg-white focus:outline-none"
                    value={n.position} onChange={e => setAddonNumbers(addonNumbers.map((x, j) => j === i ? { ...x, position: e.target.value } : x))}>
                    {getPositionOptions('number').map(p => <option key={p.id} value={p.label}>{p.label}</option>)}
                  </select>
                  <button onClick={() => setAddonNumbers(addonNumbers.filter((_, j) => j !== i))} className="text-red-400 font-black px-2">✕</button>
                </div>
              ))}
            </div>

            {/* Total */}
            {(() => {
              const validNames = addonNames.filter(n => n.text.trim());
              const validNumbers = addonNumbers.filter(n => n.text.trim());
              const total = (validNames.length + validNumbers.length) * 5;
              return total > 0 ? (
                <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center">
                  <span className="font-bold text-gray-600 text-sm">{validNames.length + validNumbers.length} customization{validNames.length + validNumbers.length !== 1 ? 's' : ''}</span>
                  <span className="font-black text-xl">${total}.00</span>
                </div>
              ) : null;
            })()}

            {/* Checkout button */}
            <button disabled={addonSubmitting || !addonCustomerName || (addonNames.every(n => !n.text.trim()) && addonNumbers.length === 0)}
              onClick={async () => {
                const validNames = addonNames.filter(n => n.text.trim());
                const validNumbers = addonNumbers.filter(n => n.text.trim());
                if (validNames.length + validNumbers.length === 0) return alert('Add at least one name or number');
                const total = (validNames.length + validNumbers.length) * 5;
                setAddonSubmitting(true);
                try {
                  const addonCart = [{
                    id: Date.now(), size: 'N/A', productId: 'addon-service', productName: 'Add-On Service',
                    finalPrice: total, needsShipping: false,
                    customizations: { names: validNames, numbers: validNumbers, logos: [], backList: false, metallic: false, mainDesign: 'Add-On Order', metallicName: '', metallicTeam: '' }
                  }];
                  const res = await fetch('/api/create-retail-order', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cart: addonCart, customerName: addonCustomerName, customerPhone: addonCustomerPhone, customerEmail: '', total, taxCollected: 0, eventSlug: actualEventSlug, eventName, site: assignedSiteName })
                  });
                  const data = await res.json();
                  if (!data.orderId) throw new Error('Order creation failed');
                  // Send to terminal
                  setAddonSubmitting(true);
                  const payRes = await fetch('/api/terminal-pay', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: data.orderId, amount: total, deviceId: assignedTerminalId })
                  });
                  if (!payRes.ok) throw new Error('Terminal payment failed');
                  // Poll for completion
                  const payData = await payRes.json();
                  let attempts = 0;
                  const poll = setInterval(async () => {
                    attempts++;
                    if (attempts > 60) { clearInterval(poll); setAddonSubmitting(false); return; }
                    const statusRes = await fetch(`/api/terminal-pay?checkoutId=${payData.checkoutId}`);
                    const status = await statusRes.json();
                    if (status.status === 'COMPLETED') {
                      clearInterval(poll);
                      await fetch('/api/printnode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: data.orderId, mode: 'cloud', printerId: assignedPrinterId }) });
                      if (addonCustomerPhone) await fetch('/api/send-sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'addon', orderId: data.orderId }) });
                      setShowAddon(false);
                      setAddonNames([{ text: '', position: 'Back Center' }]);
                      setAddonNumbers([]);
                      setAddonCustomerName('');
                      setAddonCustomerPhone('');
                      setAddonSubmitting(false);
                      alert(`✅ Add-On Order #${data.orderId} complete! Label printing.`);
                    } else if (status.status === 'CANCELED' || status.status === 'FAILED') {
                      clearInterval(poll);
                      setAddonSubmitting(false);
                      alert('Payment was cancelled or failed.');
                    }
                  }, 3000);
                } catch (err: any) {
                  alert('Error: ' + err.message);
                  setAddonSubmitting(false);
                }
              }}
              className={`w-full py-4 rounded-2xl font-black text-white text-lg transition-all ${addonSubmitting ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: headerColor, opacity: addonSubmitting ? 0.7 : 1 }}>
              {addonSubmitting ? '⏳ Processing...' : `📟 Pay with Terminal`}
            </button>

            <button onClick={() => setShowAddon(false)} className="w-full text-gray-400 font-bold py-2 text-sm">Cancel</button>
          </div>
        </div>
      </div>
    )}

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
      {/* Add-On Modal */}
      {showAddOnModal && selectedProductRecord?.add_ons?.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 24, padding: 36, width: 400, maxWidth: '90vw', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ fontFamily: 'sans-serif' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#1a1a1a', marginBottom: 4 }}>Add-Ons</div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>How many patches for this hat?</div>
              {(selectedProductRecord.add_ons || []).map((ao: any) => {
                const qty = addOnQty[ao.name] || ao.included || 0;
                const extra = Math.max(0, qty - (ao.included || 0));
                return (
                  <div key={ao.name} style={{ background: '#f8f8f8', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{ao.name}</div>
                        <div style={{ fontSize: 12, color: '#666' }}>{ao.included} included · +${ao.price} each additional</div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: extra > 0 ? '#16a34a' : '#999' }}>
                        {extra > 0 ? `+$${extra * ao.price}` : 'Included'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
                      <button onClick={() => setAddOnQty(p => ({ ...p, [ao.name]: Math.max(ao.included || 0, (p[ao.name] || ao.included || 0) - 1) }))}
                        style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid #ddd', background: '#fff', fontSize: 22, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 32, fontWeight: 900 }}>{qty}</div>
                        <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em' }}>patches</div>
                      </div>
                      <button onClick={() => setAddOnQty(p => ({ ...p, [ao.name]: Math.min(ao.max || 10, (p[ao.name] || ao.included || 0) + 1) }))}
                        style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid #000', background: '#000', color: '#fff', fontSize: 22, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={() => setShowAddOnModal(false)}
                  style={{ flex: 1, padding: '14px', border: '2px solid #ddd', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: '#fff' }}>
                  Cancel
                </button>
                <button onClick={() => { setShowAddOnModal(false); completeAddToCart(); }}
                  style={{ flex: 2, padding: '14px', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 900, cursor: 'pointer', background: '#000', color: '#fff' }}>
                  Add to Cart →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
// ── PlacementVisualizer ──
// "Powered by Lev Custom Merch" — the event's own logo and color stay the star; this sits quietly underneath.
// White logo from levcustom.com (same file the portal's quote page uses); falls back to a wordmark if it can't load.
const LevMark = ({ label = 'Powered by', className = '' }) => {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className={`flex flex-col items-center gap-1.5 select-none pointer-events-none ${className}`}>
      {label && <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-bold">{label}</span>}
      {imgOk
        ? <img src="https://levcustom.com/logo_white.png" alt="Lev Custom Merch" className="h-9 w-auto opacity-90" draggable={false} onError={() => setImgOk(false)} />
        : <>
            <span className="lev-heading text-white text-xl font-black tracking-tight">LEV <span className="text-[#29ABE2]">♥</span> CUSTOM MERCH</span>
            <span className="text-[11px] text-white/60 font-semibold">Personalized apparel, made on-site</span>
          </>}
    </div>
  );
};

// Live preview: the chosen design on a photo of the actual shirt and color (front), and the names / numbers / roster
// printed on its back. Positions are approximate (center chest for large designs, left chest for small, upper thigh
// on bottoms; names across the upper back with the number underneath).
// S&S photos come in pairs — "…_f_fm.jpg" is the front, "…_b_fm.jpg" the back; without one, a drawn outline in the color.
const backPhoto = (front) => (front && /_f_([a-z]+)\.(jpe?g|png)$/i.test(front)) ? front.replace(/_f_([a-z]+)\.(jpe?g|png)$/i, '_b_$1.$2') : null;

const GarmentOutline = ({ garment, fill }) => (
  <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
    {garment === 'hoodie'
      ? <path d="M38 10 Q50 2 62 10 L64 18 L80 22 L94 62 L84 66 L74 40 L74 94 L26 94 L26 40 L16 66 L6 62 L20 22 L36 18 Z" fill={fill} stroke="#00000033" strokeWidth="0.8" />
      : <path d="M38 10 Q50 16 62 10 L80 16 L96 34 L84 44 L76 36 L76 94 L24 94 L24 36 L16 44 L4 34 L20 16 Z" fill={fill} stroke="#00000033" strokeWidth="0.8" />}
  </svg>
);

const BackView = ({ productImg, garment, color, names = [], numbers = [], rosterImg = null, label = true }) => {
  const [photoOk, setPhotoOk] = useState(true);
  const photo = backPhoto(productImg);
  const top = garment === 'hoodie' ? 36 : 27;          // hoods take the top of the back
  const center = names.filter(n => String(n.text || '').trim() && /back center/i.test(n.position || ''));
  const bottom = names.filter(n => String(n.text || '').trim() && /back bottom/i.test(n.position || ''));
  const nums = numbers.filter(n => String(n.text || '').trim() && /back/i.test(n.position || ''));
  let y = top;
  // y is the top of the next line; each line sits below the one before (name over number)
  const text = (t, size, key) => {
    const base = y + size * 0.74;
    const el = <text key={key} x="50" y={base} textAnchor="middle" fontSize={size} fontWeight="900" letterSpacing={size > 14 ? 0 : 0.8}
      style={{ fontFamily: 'var(--font-lev-heading), Impact, sans-serif' }} fill="#ffffff">{t}</text>;
    y = base + 3;
    return el;
  };
  const longest = Math.max(1, ...center.map(n => String(n.text).length));
  const nameSize = Math.max(5, Math.min(9, 60 / longest));
  return (
    <div className="relative bg-white rounded-xl overflow-hidden w-full" style={{ aspectRatio: '1 / 1' }}>
      {photo && photoOk
        ? <img src={photo} alt="" className="absolute inset-0 w-full h-full object-contain" draggable={false} onError={() => setPhotoOk(false)} />
        : <GarmentOutline garment={garment} fill={color ? colorHex(color) : '#d1d5db'} />}
      {rosterImg && <img src={rosterImg} alt="" className="absolute object-contain" style={{ left: '30%', width: '40%', top: `${top + 2}%`, height: '42%' }} draggable={false} />}
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none">
        {!rosterImg && center.map((n, i) => text(String(n.text).toUpperCase(), nameSize, `n${i}`))}
        {!rosterImg && nums.map((n, i) => text(String(n.text), 24, `#${i}`))}
        {bottom.map((n, i) => { y = 78 + i * 8; return text(String(n.text).toUpperCase(), 6, `b${i}`); })}
      </svg>
      {label && <span className="absolute bottom-1.5 right-2 text-[10px] font-bold text-gray-400 bg-white/80 px-1.5 rounded">Back</span>}
    </div>
  );
};

// view: 'both' (front + back when there's something on the back), 'front', or 'back'
const LivePreview = ({ productImg, mainImg, mainPlacement, garment, color = '', accents = [], names = [], numbers = [], rosterImg = null, compact = false, view = 'both' }) => {
  const spot = garment === 'bottom' ? { left: '34%', top: '44%', width: '16%' }
    : mainPlacement === 'small' ? { left: '61%', top: garment === 'hoodie' ? '31%' : '27%', width: '13%' }
    : { left: '50%', top: garment === 'hoodie' ? '36%' : '31%', width: '30%' };
  const onBack = (t) => /back/i.test(t || '');
  const hasBack = garment !== 'bottom' && (names.some(n => String(n.text || '').trim() && onBack(n.position)) || numbers.some(n => String(n.text || '').trim() && onBack(n.position)) || !!rosterImg);
  const showFront = view !== 'back';
  const showBack = view === 'back' || (view === 'both' && hasBack);
  // Everything that isn't drawn on a picture (sleeves, legs) is listed underneath
  const elsewhere = [...names.filter(n => String(n.text || '').trim() && !onBack(n.position)).map(n => ({ t: String(n.text).toUpperCase(), big: false, pos: n.position })),
                     ...numbers.filter(n => String(n.text || '').trim() && !onBack(n.position)).map(n => ({ t: String(n.text), big: true, pos: n.position }))];
  const front = (
    <div className="relative bg-white rounded-xl overflow-hidden w-full" style={{ aspectRatio: '1 / 1' }}>
      <img src={productImg} alt="" className="absolute inset-0 w-full h-full object-contain" draggable={false} />
      {mainImg && <img src={mainImg} alt="" draggable={false} className="absolute object-contain drop-shadow-sm"
        style={{ ...spot, transform: spot.left === '50%' ? 'translateX(-50%)' : undefined, maxHeight: '34%' }} />}
      <span className="absolute bottom-1.5 right-2 text-[10px] font-bold text-gray-400 bg-white/80 px-1.5 rounded">{showBack ? 'Front' : 'Preview'}</span>
    </div>
  );
  const max = showFront && showBack ? (compact ? 400 : 560) : (compact ? 220 : 340);
  return (
    <div className={compact ? '' : 'bg-gray-50 p-3 rounded-2xl border border-gray-100'}>
      <div className="mx-auto grid gap-2" style={{ maxWidth: max, gridTemplateColumns: showFront && showBack ? '1fr 1fr' : '1fr' }}>
        {showFront && front}
        {showBack && <BackView productImg={productImg} garment={garment} color={color} names={names} numbers={numbers} rosterImg={rosterImg} />}
      </div>
      {(accents.length > 0 || elsewhere.length > 0) && view !== 'back' && (
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {accents.map((a, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-700">
              {a.img ? <img src={a.img} alt="" className="h-6 w-6 object-contain" /> : null}{a.label}{a.position ? <span className="text-gray-400 font-semibold">· {a.position}</span> : null}
            </div>
          ))}
          {elsewhere.map((b, i) => (
            <div key={`e${i}`} className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-center leading-none">
              <div className={`font-black text-gray-900 ${b.big ? 'text-2xl' : 'text-base tracking-wider'}`} style={{ fontFamily: 'var(--font-lev-heading), Impact, sans-serif' }}>{b.t}</div>
              <div className="text-[10px] text-gray-400 font-semibold mt-0.5">{b.pos}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

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
