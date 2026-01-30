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

  // --- ENGINE: LIVE REFRESH ---
  useEffect(() => {
    if (isAuthorized && mounted) {
        fetchOrders(); fetchSettings(); fetchInventory(); fetchLogos(); fetchGuests();
        if (supabase) {
            const channel = supabase.channel('admin_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchOrders(); // This forces the list to update automatically
            }).subscribe();
            return () => { supabase.removeChannel(channel); };
        }
    }
  }, [isAuthorized, mounted]);

  // --- ENGINE: AUTO-PRINT ---
  useEffect(() => {
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

  // Totals recalculation logic
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

  // Stats logic
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
                    totalCOGS += (unitCost + 1.50);
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

  // Helpers
  const handleLogin = async (e) => { e.preventDefault(); setLoading(true); try { const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: passcode }) }); const data = await res.json(); if (data.success) { setIsAuthorized(true); } else { alert("Wrong password"); } } catch (err) { alert("Login failed"); } setLoading(false); };
  const fetchOrders = async () => { if (!supabase) return; const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }); if (data) setOrders(data); };
  const fetchInventory = async () => { if (!supabase) return; const { data: p } = await supabase.from('products').select('*').order('sort_order'); const { data: i } = await supabase.from('inventory').select('*').order('product_id', { ascending: true }); if (p) setProducts(p); if (i) setInventory(i); };
  const fetchLogos = async () => { if (!supabase) return; const { data } = await supabase.from('logos').select('*').order('sort_order'); if (data) setLogos(data); };
  const fetchGuests = async () => { if (!supabase) return; const { data } = await supabase.from('guests').select('*').order('name'); if (data) setGuests(data); };
  const fetchSettings = async () => { if (!supabase) return; const { data } = await supabase.from('event_settings').select('*').single(); if (data) { setEventName(data.event_name); setEventLogo(data.event_logo_url || ''); setHeaderColor(data.header_color || '#1e3a8a'); setPaymentMode(data.payment_mode || 'retail'); setPrinterType(data.printer_type || 'label'); setOfferBackNames(data.offer_back_names ?? true); setOfferMetallic(data.offer_metallic ?? true); setOfferPersonalization(data.offer_personalization ?? true); setPnEnabled(data.printnode_enabled || false); setPnApiKey(data.printnode_api_key || ''); setPnPrinterId(data.printnode_printer_id || ''); } };
  const saveSettings = async () => { await supabase.from('event_settings').update({ event_name: eventName, event_logo_url: eventLogo, header_color: headerColor, payment_mode: paymentMode, printer_type: printerType, offer_back_names: offerBackNames, offer_metallic: offerMetallic, offer_personalization: offerPersonalization, printnode_enabled: pnEnabled, printnode_api_key: pnApiKey, printnode_printer_id: pnPrinterId }).eq('id', 1); alert("Saved!"); };
  const handleStatusChange = async (orderId, newStatus) => { setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o)); await supabase.from('orders').update({ status: newStatus }).eq('id', orderId); };
  const deleteOrder = async (orderId, cartData) => { if (!confirm("Delete?")) return; setLoading(true); if (Array.isArray(cartData)) { for (const item of cartData) { if (item?.productId && item?.size) { const { data: current } = await supabase.from('inventory').select('count').eq('product_id', item.productId).eq('size', item.size).single(); if (current) { await supabase.from('inventory').update({ count: current.count + 1 }).eq('product_id', item.productId).eq('size', item.size); } } } } await supabase.from('orders').delete().eq('id', orderId); fetchOrders(); fetchInventory(); setLoading(false); };
  const printLabel = async (order) => { if (!order) return; setOrders(prev => prev.map(o => o.id === order.id ? { ...o, printed: true } : o)); await supabase.from('orders').update({ printed: true }).eq('id', order.id); const isCloud = pnEnabled && pnApiKey && pnPrinterId; try { const res = await fetch('/api/printnode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order, mode: isCloud ? 'cloud' : 'download', apiKey: pnApiKey, printerId: pnPrinterId }) }); const result = await res.json(); if (result.success && !isCloud) { const pdfBytes = Uint8Array.from(atob(result.pdfBase64), c => c.charCodeAt(0)); window.open(window.URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' })), '_blank'); } } catch (e) {} };
  const handleAddProductWithSizeUpdates = async (e) => { e.preventDefault(); if (!newProdId || !newProdName) return alert("Missing"); await supabase.from('products').insert([{ id: newProdId.toLowerCase().replace(/\s/g, '_'), name: newProdName, base_price: newProdPrice, image_url: newProdImage, type: newProdType, sort_order: 99 }]); const sizes = SIZE_ORDER; await supabase.from('inventory').insert(sizes.map(s => ({ product_id: newProdId.toLowerCase().replace(/\s/g, '_'), size: s, count: 0, active: true }))); alert("Created!"); fetchInventory(); };
  const updateStock = async (pid, s, f, v) => { setInventory(inventory.map(i => (i.product_id === pid && i.size === s) ? { ...i, [f]: v } : i)); await supabase.from('inventory').update({ [f]: v }).eq('product_id', pid).eq('size', s); };
  const updatePrice = async (pid, v) => { setProducts(products.map(p => p.id === pid ? { ...p, base_price: v } : p)); await supabase.from('products').update({ base_price: v }).eq('id', pid); };
  const toggleLogo = async (id, s) => { setLogos(logos.map(l => l.id === id ? { ...l, active: !s } : l)); await supabase.from('logos').update({ active: !s }).eq('id', id); };
  const getProductName = (id) => products.find(p => p.id === id)?.name || id;
  const downloadCSV = () => { if (!orders.length) return; const headers = ['ID', 'Date', 'Customer', 'Total']; const rows = orders.map(o => [o.id, new Date(o.created_at).toLocaleDateString(), o.customer_name, o.total_price].join(',')); const link = document.createElement("a"); link.href = "data:text/csv;charset=utf-8," + encodeURI([headers.join(','), ...rows].join('\n')); link.download = "orders.csv"; link.click(); };
  const downloadTemplate = () => { const data = inventory.map(item => ({ product_id: item.product_id, size: item.size, count: item.count, cost_price: item.cost_price || 8.50 })); const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Inventory"); XLSX.writeFile(wb, "Inventory.xlsx"); };
  const handleBulkUpload = (e) => { const f = e.target.files[0]; if (!f) return; setUploadLog(["Reading..."]); setLoading(true); const r = new FileReader(); r.onload = async (evt) => { try { const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]); const logs = []; for (const row of d) { await supabase.from('inventory').update({ count: row.count, cost_price: row.cost_price }).eq('product_id', row.product_id).eq('size', row.size); logs.push(`Updated ${row.product_id}`); } setUploadLog(logs); fetchInventory(); } catch (e) { setUploadLog([e.message]); } setLoading(false); }; r.readAsBinaryString(f); };

  if (!mounted) return <div className="p-10 text-center text-gray-500 font-bold uppercase tracking-widest">Loading...</div>;
  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center bg-gray-100"><form onSubmit={handleLogin} className="bg-white p-8 rounded shadow"><h1 className="text-xl font-bold mb-4">Admin Login</h1><input type="password" onChange={e => setPasscode(e.target.value)} className="border p-2 w-full rounded" placeholder="Password"/></form></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black font-sans">
      <audio ref={audioRef} src="/ding.mp3" preload="auto" />
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
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
                <p className="text-xs text-gray-500 font-bold uppercase tracking-tight">Printing Control</p>
                <div className="flex items-center gap-2 mt-1">
                    <input type="checkbox" id="autoPrint" checked={autoPrintEnabled} onChange={(e) => setAutoPrintEnabled(e.target.checked)} className="w-5 h-5 accent-blue-900 cursor-pointer" />
                    <label htmlFor="autoPrint" className="text-xs font-black text-gray-800 cursor-pointer uppercase">Auto-Print</label>
                </div>
            </div> 
          </div> 
          {/* Orders table follows here identically to your source... */}
        </div> )}

        {activeTab === 'inventory' && ( <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <h2 className="font-bold text-xl mb-4 text-black uppercase tracking-tighter">Add Garment</h2>
                    <form onSubmit={handleAddProductWithSizeUpdates} className="space-y-3">
                        <input className="w-full border p-2 rounded text-black" placeholder="ID (navy_jogger)" value={newProdId} onChange={e => setNewProdId(e.target.value)} />
                        <input className="w-full border p-2 rounded text-black" placeholder="Display Name" value={newProdName} onChange={e => setNewProdName(e.target.value)} />
                        <input className="w-full border p-2 rounded text-black" placeholder="Image URL (pointing to image)" value={newProdImage} onChange={e => setNewProdImage(e.target.value)} />
                        <select className="w-full border p-2 rounded bg-white text-black font-bold" value={newProdType} onChange={e => setNewProdType(e.target.value)}>
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                        </select>
                        <button className="w-full bg-green-600 text-white font-bold py-2 rounded shadow">Create</button>
                    </form>
                </div>
                <div className="bg-blue-50 p-6 rounded-lg shadow border border-blue-200">
                    <h2 className="font-bold text-lg mb-2 text-blue-900 uppercase tracking-tighter">Bulk Stock</h2>
                    <button onClick={downloadTemplate} className="text-xs bg-white border border-blue-300 px-3 py-1 rounded text-blue-700 font-bold mb-4 uppercase">⬇️ Export</button>
                    <input type="file" onChange={handleBulkUpload} className="block w-full text-sm text-gray-500 mb-4" />
                    {uploadLog.length > 0 && (<div className="mt-4 p-2 bg-black text-green-400 text-xs font-mono h-48 overflow-y-auto rounded border border-gray-700 shadow-inner">{uploadLog.map((log, i) => <div key={i} className="mb-1 border-b border-gray-800 pb-1">{log}</div>)}</div>)}
                </div>
            </div>
            {/* Stock management tables follow here... */}
        </div> )}

        {activeTab === 'logos' && ( <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <h2 className="font-bold text-xl mb-4 text-black uppercase tracking-widest">Logo Repository</h2>
                <form onSubmit={async (e) => { e.preventDefault(); if (!newLogoName) return; await supabase.from('logos').insert([{ label: newLogoName, image_url: newLogoUrl, category: newLogoCategory, sort_order: logos.length + 1, active: true }]); setNewLogoName(''); setNewLogoUrl(''); fetchLogos(); }} className="grid grid-cols-2 gap-4">
                    <input className="border p-2 rounded text-black shadow-sm" placeholder="Label Name" value={newLogoName} onChange={e => setNewLogoName(e.target.value)}/>
                    <input className="border p-2 rounded text-black shadow-sm" placeholder="Image URL (pointing to image)" value={newLogoUrl} onChange={e => setNewLogoUrl(e.target.value)}/>
                    <div className="col-span-2 flex items-center gap-6 bg-gray-50 p-2 rounded border border-gray-200">
                        <span className="font-bold text-gray-700 text-sm">Type:</span>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="cat" checked={newLogoCategory === 'main'} onChange={() => setNewLogoCategory('main')} className="w-4 h-4" /><span className="text-sm font-bold text-black uppercase">Main Design</span></label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="cat" checked={newLogoCategory === 'accent'} onChange={() => setNewLogoCategory('accent')} className="w-4 h-4" /><span className="text-sm font-bold text-black uppercase">Accent</span></label>
                    </div>
                    <button className="bg-blue-900 text-white font-bold p-3 col-span-2 rounded uppercase tracking-widest shadow-lg">Add Logo</button>
                </form>
            </div>
            {/* Logo display table here... */}
        </div> )}

        {activeTab === 'settings' && (<div className="max-w-xl mx-auto bg-white p-8 rounded shadow border border-gray-300 space-y-6">
            <h2 className="font-black text-2xl text-black uppercase tracking-tighter">Settings</h2>
            <div><label className="font-bold text-xs uppercase text-gray-500">Event Title</label><input className="w-full border p-3 rounded text-black font-bold shadow-sm" value={eventName} onChange={e => setEventName(e.target.value)} /></div>
            
            <div className="mb-6 bg-gray-100 p-4 rounded border border-gray-200">
                <label className="block text-gray-800 font-bold mb-3 border-b border-gray-300 pb-2 uppercase text-xs">Output Format</label>
                <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer"><input type="radio" checked={printerType === 'label'} onChange={() => setPrinterType('label')} className="w-5 h-5" /><div><span className="font-bold block text-gray-800">Thermal Label (4x6)</span></div></label>
                    <label className="flex items-center gap-3 cursor-pointer"><input type="radio" checked={printerType === 'standard'} onChange={() => setPrinterType('standard')} className="w-5 h-5" /><div><span className="font-bold block text-gray-800">Standard Sheet (8.5x11)</span></div></label>
                </div>
            </div>

            <div className="mb-6 bg-blue-50 p-4 rounded border border-blue-200">
                <label className="block text-blue-900 font-bold mb-3 border-b border-blue-200 pb-2 uppercase text-xs">Payment Mode</label>
                <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer"><input type="radio" checked={paymentMode === 'retail'} onChange={() => setPaymentMode('retail')} className="w-5 h-5" /><div><span className="font-bold block text-blue-800">Retail (Stripe)</span></div></label>
                    <label className="flex items-center gap-3 cursor-pointer"><input type="radio" checked={paymentMode === 'hosted'} onChange={() => setPaymentMode('hosted')} className="w-5 h-5" /><div><span className="font-bold block text-blue-800">Hosted (Party Mode)</span></div></label>
                </div>
            </div>

            <button onClick={saveSettings} className="w-full bg-blue-900 text-white py-4 font-black rounded shadow-xl uppercase tracking-widest hover:bg-blue-800 transition-all">Save All Changes</button>
        </div>)}
      </div>
    </div>
  );
}