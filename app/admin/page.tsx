// @ts-nocheck
'use client'; 

import React, { useState, useEffect, useRef } from 'react'; 
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx'; 

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const STATUSES = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  pending_shipping: { label: 'To Be Shipped', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  partially_fulfilled: { label: 'Partially Fulfilled', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  ready: { label: 'Ready for Pickup', color: 'bg-green-100 text-green-800 border-green-300' },
  shipped: { label: 'Shipped', color: 'bg-green-200 text-green-900 border-green-400' },
  completed: { label: 'Completed', color: 'bg-gray-200 text-gray-600 border-gray-400' },
};

const SIZE_ORDER = [
    'Youth XS', 'Youth S', 'Youth M', 'Youth L', 
    'Adult S', 'Adult M', 'Adult L', 'Adult XL', 'Adult XXL', 'Adult 3XL', 'Adult 4XL'
];

export default function AdminPage() {
  const [passcode, setPasscode] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState('orders');
  
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [logos, setLogos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ revenue: 0, count: 0, topItem: '-' });
  const [uploadLog, setUploadLog] = useState([]); 

  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const audioRef = useRef(null);

  const [newProdId, setNewProdId] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState(30);
  const [newProdImage, setNewProdImage] = useState(''); 
  const [newLogoName, setNewLogoName] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventLogo, setEventLogo] = useState('');
  const [offerBackNames, setOfferBackNames] = useState(true);
  const [offerMetallic, setOfferMetallic] = useState(true);

  useEffect(() => {
    if (orders.length > 0) {
        const revenue = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
        const count = orders.length;
        const itemCounts = {};
        orders.forEach(o => {
            o.cart_data.forEach(item => {
                const key = `${item.productName} (${item.size})`;
                itemCounts[key] = (itemCounts[key] || 0) + 1;
            });
        });
        const topItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];
        setStats({ revenue, count, topItem: topItem ? `${topItem[0]} (${topItem[1]})` : '-' });
    }
  }, [orders]);

  useEffect(() => {
    let interval;
    if (isAuthorized && autoPrintEnabled) { interval = setInterval(() => { checkForNewLabels(); }, 5000); }
    return () => clearInterval(interval);
  }, [isAuthorized, autoPrintEnabled, orders]);

  const checkForNewLabels = () => {
    const unprinted = orders.filter(o => !o.printed && o.status !== 'completed' && o.status !== 'shipped').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (unprinted.length > 0) { if (audioRef.current) audioRef.current.play().catch(e => console.log("Audio fail", e)); printLabel(unprinted[0]); }
  };

  const printLabel = async (order) => {
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, printed: true } : o));
    await supabase.from('orders').update({ printed: true }).eq('id', order.id);
    const printWindow = window.open('', '', 'width=400,height=600');
    if (!printWindow) { alert("⚠️ POPUP BLOCKED"); return; }
    printWindow.document.write(`<html><head><title>Order #${order.id}</title><style>@page { size: 4in 6in; margin: 0; } body { font-family: 'Courier New', monospace; margin: 0.1in; padding: 0; width: 3.8in; } .header { text-align: center; border-bottom: 3px solid black; padding-bottom: 10px; margin-bottom: 15px; } h1 { font-size: 28px; font-weight: 900; margin: 0; text-transform: uppercase; line-height: 1.1; } h2 { font-size: 16px; margin: 5px 0 0 0; color: #333; } .items { text-align: left; } .item { margin-bottom: 15px; font-size: 18px; font-weight: bold; border-bottom: 1px dashed #999; padding-bottom: 5px; } .details { font-size: 14px; font-weight: normal; margin-top: 2px; } .footer { margin-top: 30px; text-align: center; font-size: 12px; border-top: 2px solid black; padding-top: 10px; } .shipping-alert { display: block; margin-top: 5px; background: black; color: white; font-size: 12px; padding: 2px 5px; border-radius: 4px; width: fit-content; }</style></head><body><div class="header"><h1>${order.customer_name}</h1><h2>Order #${order.id}</h2></div><div class="items">${order.cart_data.map(item => `<div class="item"><div style="display:flex; justify-content:space-between;"><span>${item.productName}</span><span>${item.size}</span></div>${item.customizations.logos.length > 0 ? `<div class="details">Logos: ${item.customizations.logos.map(l => l.type).join(', ')}</div>` : ''}${item.customizations.names.length > 0 ? `<div class="details">Names: ${item.customizations.names.map(n => n.text).join(', ')}</div>` : ''}${item.needsShipping ? `<span class="shipping-alert">📦 SHIP TO HOME</span>` : ''}</div>`).join('')}</div><div class="footer">${new Date(order.created_at).toLocaleString()}<br><strong>Total Items: ${order.cart_data.length}</strong></div></body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 500);
  };

  // --- PARANOID MODE BULK UPLOAD ---
  const handleBulkUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadLog(["Reading file..."]);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);

            if (!data || data.length === 0) { setUploadLog(["❌ Error: File empty."]); setLoading(false); return; }

            // 1. Get VALID Product IDs from DB to force matching
            const { data: dbProducts } = await supabase.from('products').select('id');
            const validIds = {}; 
            if (dbProducts) dbProducts.forEach(p => validIds[p.id.toLowerCase()] = p.id);

            const logs = [];
            let updatedCount = 0;
            let errorCount = 0;

            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                // Normalize keys
                const normalizedRow = {};
                Object.keys(row).forEach(k => { normalizedRow[k.toLowerCase().trim()] = row[k]; });

                const pid = normalizedRow['product_id'];
                const size = normalizedRow['size'];
                const count = normalizedRow['count'];

                if (!pid || !size || count === undefined) {
                    logs.push(`⚠️ Row ${i+2}: Skipped (Missing Data)`);
                    continue;
                }

                // SMART MATCHING
                const rawId = String(pid).trim();
                let finalId = rawId;
                if (!validIds[rawId] && validIds[rawId.toLowerCase()]) { finalId = validIds[rawId.toLowerCase()]; }

                const cleanSize = String(size).trim();
                const cleanCount = parseInt(count);

                // --- THE PARANOID CHECK ---
                // Find existing
                const { data: existing, error: findError } = await supabase.from('inventory').select('id').eq('product_id', finalId).eq('size', cleanSize).single();

                if (findError && findError.code !== 'PGRST116') { // PGRST116 is "Row not found", which is fine
                     logs.push(`❌ Row ${i+2}: DB Find Error: ${findError.message}`);
                     errorCount++;
                     continue;
                }

                if (existing) {
                    // UPDATE
                    const { error: updateError } = await supabase.from('inventory').update({ count: cleanCount }).eq('id', existing.id);
                    if (updateError) {
                        logs.push(`❌ Row ${i+2}: Update Failed! ${updateError.message}`);
                        errorCount++;
                    } else {
                        logs.push(`✅ Row ${i+2}: Updated ${finalId} (${cleanSize}) -> ${cleanCount}`);
                        updatedCount++;
                    }
                } else {
                    // INSERT
                    const { error: insertError } = await supabase.from('inventory').insert([{ product_id: finalId, size: cleanSize, count: cleanCount, active: true }]);
                    if (insertError) {
                        logs.push(`❌ Row ${i+2}: Insert Failed! ${insertError.message}`);
                        errorCount++;
                    } else {
                        logs.push(`✨ Row ${i+2}: Created ${finalId} (${cleanSize}) -> ${cleanCount}`);
                        updatedCount++;
                    }
                }
            }
            
            if (errorCount > 0) {
                setUploadLog([`⚠️ COMPLETED WITH ERRORS: ${errorCount} failed.`, ...logs]);
            } else {
                setUploadLog([`🎉 SUCCESS! Processed ${updatedCount} items.`, ...logs]);
            }
            
            await fetchInventory(); // Explicit fetch after done

        } catch (err) { console.error(err); setUploadLog(["❌ FATAL ERROR:", err.message]); }
        setLoading(false);
        e.target.value = null; 
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    if (inventory.length === 0) return alert("No inventory data found!");
    const data = inventory.map(item => ({ product_id: item.product_id, size: item.size, count: item.count, _Reference_Name: getProductName(item.product_id) }));
    data.sort((a, b) => { if (a._Reference_Name !== b._Reference_Name) return a._Reference_Name.localeCompare(b._Reference_Name); return SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size); });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "Lev_Inventory_Update.xlsx");
  };

  const handleLogin = async (e) => { e.preventDefault(); setLoading(true); try { const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: passcode }) }); const data = await res.json(); if (data.success) { setIsAuthorized(true); fetchOrders(); } else { alert("Wrong password"); } } catch (err) { alert("Login failed"); } setLoading(false); };
  const fetchOrders = async () => { if (!supabase) return; setLoading(true); const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }); if (data) setOrders(data); setLoading(false); };
  const fetchInventory = async () => { if (!supabase) return; setLoading(true); const { data: prodData } = await supabase.from('products').select('*').order('sort_order'); const { data: invData } = await supabase.from('inventory').select('*').order('product_id', { ascending: true }); if (prodData) setProducts(prodData); if (invData) setInventory(invData); setLoading(false); };
  const fetchLogos = async () => { if (!supabase) return; setLoading(true); const { data } = await supabase.from('logos').select('*').order('sort_order'); if (data) setLogos(data); setLoading(false); };
  const fetchSettings = async () => { if (!supabase) return; setLoading(true); const { data } = await supabase.from('event_settings').select('*').single(); if (data) { setEventName(data.event_name); setEventLogo(data.event_logo_url || ''); setOfferBackNames(data.offer_back_names ?? true); setOfferMetallic(data.offer_metallic ?? true); } setLoading(false); };
  const saveSettings = async () => { await supabase.from('event_settings').update({ event_name: eventName, event_logo_url: eventLogo, offer_back_names: offerBackNames, offer_metallic: offerMetallic }).eq('id', 1); alert("Event Settings Saved!"); };
  const closeEvent = async () => { const input = prompt("⚠️ CLOSE EVENT? Type 'CLOSE' to confirm:"); if (input !== 'CLOSE') return; setLoading(true); await supabase.from('orders').update({ status: 'completed' }).neq('status', 'completed'); alert("Event Closed!"); fetchOrders(); setLoading(false); };
  const handleStatusChange = async (orderId, newStatus) => { setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o)); await supabase.from('orders').update({ status: newStatus }).eq('id', orderId); if (newStatus === 'ready' || newStatus === 'partially_fulfilled') { const order = orders.find(o => o.id === orderId); let msg = newStatus === 'ready' ? "READY for pickup!" : "PARTIALLY READY. Pick up available items!"; if (order) try { await fetch('/api/send-text', { method: 'POST', body: JSON.stringify({ phone: order.phone, message: `Hi ${order.customer_name}! Your Swag Order is ${msg}` }) }); } catch (e) {} } };
  const deleteOrder = async (orderId, cartData) => { if (!confirm("⚠️ Cancel Order & Restore Inventory?")) return; setLoading(true); if (cartData && Array.isArray(cartData)) { for (const item of cartData) { if (item.productId && item.size) { const { data: currentItem } = await supabase.from('inventory').select('count').eq('product_id', item.productId).eq('size', item.size).single(); if (currentItem) { await supabase.from('inventory').update({ count: currentItem.count + 1 }).eq('product_id', item.productId).eq('size', item.size); } } } } await supabase.from('orders').delete().eq('id', orderId); fetchOrders(); fetchInventory(); setLoading(false); alert("Order deleted and inventory restored."); };
  const addLogo = async (e) => { e.preventDefault(); if (!newLogoName) return; await supabase.from('logos').insert([{ label: newLogoName, image_url: newLogoUrl, sort_order: logos.length + 1 }]); setNewLogoName(''); setNewLogoUrl(''); fetchLogos(); };
  const deleteLogo = async (id) => { if (!confirm("Delete this logo?")) return; await supabase.from('logos').delete().eq('id', id); fetchLogos(); };
  const deleteProduct = async (id) => { if (!confirm("Are you sure? This deletes the product AND inventory.")) return; await supabase.from('inventory').delete().eq('product_id', id); await supabase.from('products').delete().eq('id', id); fetchInventory(); };
  const updateStock = async (productId, size, field, value) => { setInventory(inventory.map(i => (i.product_id === productId && i.size === size) ? { ...i, [field]: value } : i)); await supabase.from('inventory').update({ [field]: value }).eq('product_id', productId).eq('size', size); };
  const updatePrice = async (productId, newPrice) => { setProducts(products.map(p => p.id === productId ? { ...p, base_price: newPrice } : p)); await supabase.from('products').update({ base_price: newPrice }).eq('id', productId); };
  const toggleLogo = async (id, currentStatus) => { setLogos(logos.map(l => l.id === id ? { ...l, active: !currentStatus } : l)); await supabase.from('logos').update({ active: !currentStatus }).eq('id', id); };
  const downloadCSV = () => { if (!orders.length) return; const headers = ['ID', 'Date', 'Customer', 'Phone', 'Address', 'Status', 'Total', 'Items']; const rows = orders.map(o => { const address = o.shipping_address ? `"${o.shipping_address}, ${o.shipping_city}, ${o.shipping_state}"` : "Pickup"; const items = o.cart_data.map(i => `${i.productName} (${i.size})`).join(' | '); return [o.id, new Date(o.created_at).toLocaleDateString(), `"${o.customer_name}"`, o.phone, address, o.status, o.total_price, `"${items}"`].join(','); }); const link = document.createElement("a"); link.href = "data:text/csv;charset=utf-8," + encodeURI([headers.join(','), ...rows].join('\n')); link.download = "orders.csv"; link.click(); };
  const getProductName = (id) => products.find(p => p.id === id)?.name || id;

  const handleAddProductWithSizeUpdates = async (e) => {
    e.preventDefault(); if (!newProdId || !newProdName) return alert("Missing fields"); const { error } = await supabase.from('products').insert([{ id: newProdId.toLowerCase().replace(/\s/g, '_'), name: newProdName, base_price: newProdPrice, image_url: newProdImage, type: 'top', sort_order: 99 }]); if (error) return alert("Error: " + error.message); const sizes = ['Youth XS', 'Youth S', 'Youth M', 'Youth L', 'Adult S', 'Adult M', 'Adult L', 'Adult XL', 'Adult XXL', 'Adult 3XL', 'Adult 4XL']; const invRows = sizes.map(s => ({ product_id: newProdId.toLowerCase().replace(/\s/g, '_'), size: s, count: 0, active: true })); await supabase.from('inventory').insert(invRows); alert("Product Created!"); setNewProdId(''); setNewProdName(''); setNewProdImage(''); fetchInventory();
  };

  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center bg-gray-100"><form onSubmit={handleLogin} className="bg-white p-8 rounded shadow"><h1 className="text-xl font-bold mb-4">Admin Login</h1><input type="password" onChange={e => setPasscode(e.target.value)} className="border p-2 w-full rounded" placeholder="Password"/></form></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black font-sans">
      <audio ref={audioRef} src="/ding.mp3" preload="auto" />
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-black text-gray-900">Admin Dashboard</h1>
          <div className="flex bg-white rounded-lg p-1 shadow border border-gray-300">
            <button onClick={() => { setActiveTab('orders'); fetchOrders(); }} className={`px-4 py-2 rounded font-bold ${activeTab === 'orders' ? 'bg-blue-900 text-white' : 'hover:bg-gray-100'}`}>Orders</button>
            <button onClick={() => { setActiveTab('inventory'); fetchInventory(); }} className={`px-4 py-2 rounded font-bold ${activeTab === 'inventory' ? 'bg-blue-900 text-white' : 'hover:bg-gray-100'}`}>Products</button>
            <button onClick={() => { setActiveTab('logos'); fetchLogos(); }} className={`px-4 py-2 rounded font-bold ${activeTab === 'logos' ? 'bg-blue-900 text-white' : 'hover:bg-gray-100'}`}>Logos</button>
            <button onClick={() => { setActiveTab('settings'); fetchSettings(); }} className={`px-4 py-2 rounded font-bold ${activeTab === 'settings' ? 'bg-blue-900 text-white' : 'hover:bg-gray-100'}`}>Settings</button>
          </div>
        </div>

        {activeTab === 'orders' && (
            <div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white p-4 rounded shadow border border-gray-200"><p className="text-xs text-gray-500 font-bold uppercase">Total Revenue</p><p className="text-3xl font-black text-green-700">${stats.revenue}</p></div>
                    <div className="bg-white p-4 rounded shadow border border-gray-200"><p className="text-xs text-gray-500 font-bold uppercase">Total Orders</p><p className="text-3xl font-black text-blue-900">{stats.count}</p></div>
                    <div className="bg-white p-4 rounded shadow border border-gray-200"><p className="text-xs text-gray-500 font-bold uppercase">Top Seller</p><p className="text-lg font-bold text-gray-800 truncate" title={stats.topItem}>{stats.topItem}</p></div>
                 </div>
                 
                 <div className="flex justify-between items-center mb-4 bg-gray-100 p-4 rounded border border-gray-200">
                    <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={autoPrintEnabled} onChange={e => setAutoPrintEnabled(e.target.checked)} />
                            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-900"></div>
                            <span className="ml-3 font-bold text-gray-900">Auto-Print</span>
                        </label>
                    </div>
                    <div className="flex gap-2"><button onClick={downloadCSV} className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700">📥 CSV</button><button onClick={fetchOrders} className="bg-gray-200 px-4 py-2 rounded font-bold hover:bg-gray-300 text-black">Refresh</button></div>
                 </div>
                 <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300 overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-gray-200"><tr><th className="p-4 w-40">Status</th><th className="p-4">Date</th><th className="p-4">Customer</th><th className="p-4">Items</th><th className="p-4 text-right">Actions</th></tr></thead>
                    <tbody>
                        {orders.map((order) => (
                        <tr key={order.id} className={`border-b hover:bg-gray-50 ${order.printed ? 'bg-gray-50' : 'bg-white'}`}>
                            <td className="p-4 align-top"><select value={order.status || 'pending'} onChange={(e) => handleStatusChange(order.id, e.target.value)} className={`p-2 rounded border-2 uppercase font-bold text-xs ${STATUSES[order.status || 'pending']?.color}`}>{Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></td>
                            <td className="p-4 align-top text-sm text-gray-500 font-medium">{new Date(order.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                            <td className="p-4 align-top"><div className="font-bold">{order.customer_name}</div><div className="text-sm">{order.phone}</div>{order.shipping_address && <div className="mt-2 text-sm bg-purple-50 p-2 rounded border border-purple-200 text-purple-900">🚚 <strong>Ship to:</strong><br/>{order.shipping_address}<br/>{order.shipping_city}, {order.shipping_state} {order.shipping_zip}</div>}</td>
                            <td className="p-4 align-top text-sm">{order.cart_data.map((item, i) => <div key={i} className="mb-2 border-b border-gray-100 pb-1 last:border-0"><span className="font-bold">{item.productName}</span> ({item.size}){item.needsShipping && <span className="ml-2 bg-purple-100 text-purple-800 text-xs px-1 rounded">SHIP</span>}<div className="text-xs text-gray-500">{item.customizations.logos.map(l => l.type).join(', ')}</div></div>)}<div className="mt-2 text-right font-black text-green-800">${order.total_price}</div></td>
                            <td className="p-4 align-top text-right"><button onClick={() => printLabel(order)} className={`p-2 rounded mr-2 ${order.printed ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-black hover:bg-blue-100'}`} title="Print Label">{order.printed ? '✅' : '🖨️'}</button><button onClick={() => deleteOrder(order.id, order.cart_data)} className="text-red-500 hover:text-red-700 font-bold text-lg" title="Cancel & Restore">🗑️</button></td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                 </div>
            </div>
        )}

        {/* INVENTORY TAB - UPDATED WITH PARANOID LOG */}
        {activeTab === 'inventory' && (
            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                        <h2 className="font-bold text-xl mb-4">Add New Item</h2>
                        <form onSubmit={handleAddProductWithSizeUpdates} className="space-y-3">
                            <div><label className="text-xs font-bold uppercase">ID (Unique)</label><input className="w-full border p-2 rounded" placeholder="e.g. hat_blue" value={newProdId} onChange={e => setNewProdId(e.target.value)} /></div>
                            <div><label className="text-xs font-bold uppercase">Display Name</label><input className="w-full border p-2 rounded" placeholder="e.g. Blue Hat" value={newProdName} onChange={e => setNewProdName(e.target.value)} /></div>
                            <div><label className="text-xs font-bold uppercase">Image URL (Optional)</label><input className="w-full border p-2 rounded" placeholder="https://..." value={newProdImage} onChange={e => setNewProdImage(e.target.value)} /></div>
                            <div><label className="text-xs font-bold uppercase">Price ($)</label><input type="number" className="w-full border p-2 rounded" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} /></div>
                            <button className="w-full bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700">Create Product</button>
                        </form>
                    </div>

                    <div className="bg-blue-50 p-6 rounded-lg shadow border border-blue-200">
                        <h2 className="font-bold text-lg mb-2 text-blue-900">📦 Bulk Stock Update</h2>
                        <p className="text-xs text-blue-800 mb-4">1. Download Current Stock<br/>2. Edit "count" numbers<br/>3. Upload back</p>
                        <div className="flex gap-2 mb-4"><button onClick={downloadTemplate} className="text-xs bg-white border border-blue-300 px-3 py-1 rounded text-blue-700 font-bold hover:bg-blue-50">⬇️ Download Current Stock</button></div>
                        <input type="file" accept=".xlsx, .xls" onChange={handleBulkUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200" />
                        
                        {/* DEBUG LOG */}
                        {uploadLog.length > 0 && (
                            <div className="mt-4 p-2 bg-black text-green-400 text-xs font-mono h-48 overflow-y-auto rounded border border-gray-700">
                                {uploadLog.map((log, i) => <div key={i} className="mb-1 border-b border-gray-800 pb-1">{log}</div>)}
                            </div>
                        )}
                    </div>
                </div>

                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300">
                        <div className="bg-blue-900 text-white p-4 font-bold uppercase text-sm tracking-wide">Manage Prices</div>
                        <table className="w-full text-left">
                            <thead className="bg-gray-100 border-b">
                                <tr>
                                    <th className="p-3">Image</th>
                                    <th className="p-3">Product Name</th>
                                    <th className="p-3">Base Price ($)</th>
                                    <th className="p-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map((prod) => (
                                    <tr key={prod.id} className="border-b hover:bg-gray-50">
                                        <td className="p-3">
                                            {prod.image_url ? 
                                                <img src={prod.image_url} alt={prod.name} className="w-12 h-12 object-contain border rounded bg-gray-50" /> 
                                                : <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">No Img</div>
                                            }
                                        </td>
                                        <td className="p-3 font-bold text-gray-700">{prod.name}</td>
                                        <td className="p-3"><div className="flex items-center gap-1"><span className="text-gray-500 font-bold">$</span><input type="number" className="w-20 border border-gray-300 rounded p-1 font-bold text-black" value={prod.base_price} onChange={(e) => updatePrice(prod.id, e.target.value)} /></div></td>
                                        <td className="p-3 text-right"><button onClick={() => deleteProduct(prod.id)} className="text-red-500 hover:text-red-700 font-bold" title="Delete Product">🗑️</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300"><div className="bg-gray-800 text-white p-4 font-bold uppercase text-sm tracking-wide">Manage Stock</div><table className="w-full text-left"><thead className="bg-gray-100 border-b"><tr><th className="p-4">Product</th><th className="p-4">Size</th><th className="p-4">Stock</th><th className="p-4">Active</th></tr></thead><tbody>{inventory.map((item) => (<tr key={`${item.product_id}_${item.size}`} className={`border-b ${!item.active ? 'bg-gray-100 opacity-50' : ''}`}><td className="p-4 font-bold">{getProductName(item.product_id)}</td><td className="p-4">{item.size}</td><td className="p-4"><input type="number" className="w-16 border text-center font-bold" value={item.count} onChange={(e) => updateStock(item.product_id, item.size, 'count', parseInt(e.target.value))} /></td><td className="p-4"><input type="checkbox" checked={item.active ?? true} onChange={(e) => updateStock(item.product_id, item.size, 'active', e.target.checked)} className="w-5 h-5" /></td></tr>))}</tbody></table></div>
                </div>
            </div>
        )}

        {/* LOGOS TAB */}
        {activeTab === 'logos' && (<div className="max-w-4xl mx-auto"><div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200"><h2 className="font-bold text-xl mb-4">Add New Logo Option</h2><form onSubmit={addLogo} className="grid md:grid-cols-2 gap-4"><input className="border p-2 rounded" placeholder="Name (e.g. State Champs)" value={newLogoName} onChange={e => setNewLogoName(e.target.value)} /><input className="border p-2 rounded" placeholder="Image URL (http://...)" value={newLogoUrl} onChange={e => setNewLogoUrl(e.target.value)} /><button className="bg-blue-900 text-white font-bold px-6 py-2 rounded hover:bg-blue-800 col-span-2">Add Logo</button></form></div><div className="bg-white shadow rounded-lg overflow-hidden border border-gray-300"><table className="w-full text-left"><thead className="bg-gray-800 text-white"><tr><th className="p-4">Preview</th><th className="p-4">Logo Label</th><th className="p-4 text-center">Visible?</th><th className="p-4 text-right">Action</th></tr></thead><tbody>{logos.map((logo) => (<tr key={logo.id} className="border-b hover:bg-gray-50"><td className="p-4">{logo.image_url ? <img src={logo.image_url} alt={logo.label} className="w-12 h-12 object-contain border rounded bg-gray-50" /> : <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-xs">No Img</div>}</td><td className="p-4 font-bold text-lg">{logo.label}</td><td className="p-4 text-center"><input type="checkbox" checked={logo.active} onChange={() => toggleLogo(logo.id, logo.active)} className="w-6 h-6 cursor-pointer" /></td><td className="p-4 text-right"><button onClick={() => deleteLogo(logo.id)} className="text-red-500 hover:text-red-700 font-bold" title="Delete Logo">🗑️</button></td></tr>))}</tbody></table></div></div>)}
        
        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (<div className="max-w-xl mx-auto"><div className="bg-white p-8 rounded-lg shadow border border-gray-200"><h2 className="font-bold text-2xl mb-6">Event Settings</h2><div className="mb-4"><label className="block text-gray-700 font-bold mb-2">Event Name</label><input className="w-full border p-3 rounded text-lg" placeholder="e.g. 2026 Winter Regionals" value={eventName} onChange={e => setEventName(e.target.value)} /></div><div className="mb-6"><label className="block text-gray-700 font-bold mb-2">Event Logo URL</label><input className="w-full border p-3 rounded text-lg" placeholder="https://..." value={eventLogo} onChange={e => setEventLogo(e.target.value)} />{eventLogo && <img src={eventLogo} className="mt-4 h-24 mx-auto border rounded p-2" />}</div><div className="mb-6 bg-gray-50 p-4 rounded border"><label className="block text-gray-700 font-bold mb-3 border-b pb-2">Customization Options</label><div className="flex items-center justify-between mb-3"><span className="font-bold text-gray-800">Offer Back Name List?</span><input type="checkbox" checked={offerBackNames} onChange={(e) => setOfferBackNames(e.target.checked)} className="w-6 h-6" /></div><div className="flex items-center justify-between"><span className="font-bold text-gray-800">Offer Metallic Upgrade?</span><input type="checkbox" checked={offerMetallic} onChange={(e) => setOfferMetallic(e.target.checked)} className="w-6 h-6" /></div></div><button onClick={saveSettings} className="w-full bg-blue-900 text-white font-bold py-3 rounded text-lg hover:bg-blue-800 shadow mb-8">Save Changes</button><div className="border-t pt-6 mt-6"><h3 className="font-bold text-red-700 mb-2 uppercase text-sm">Danger Zone</h3><p className="text-gray-500 text-sm mb-4">Clicking this will mark ALL active orders as "Completed" (clearing the TV Board). This does not delete sales data.</p><button onClick={closeEvent} className="w-full bg-red-100 text-red-800 font-bold py-3 rounded border border-red-300 hover:bg-red-200">🏁 Close Event (Archive All)</button></div></div></div>)}

      </div>
    </div>
  );
}