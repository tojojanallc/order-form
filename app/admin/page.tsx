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

  // Auto-Print Logic
  useEffect(() => {
    if (!mounted || !autoPrintEnabled || orders.length === 0) return;
    if (orders.length > lastOrderCount.current) {
      const newestOrder = orders[0];
      if (!newestOrder.printed && (new Date() - new Date(newestOrder.created_at) < 30000)) {
        printLabel(newestOrder);
      }
    }
    lastOrderCount.current = orders.length;
  }, [orders, autoPrintEnabled, mounted]);

  // Recalculate Totals
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
        const revenue = activeOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
        const count = activeOrders.length;
        setStats({ revenue, count, net: revenue * 0.7, topItem: '-' });
    } catch (e) {}
  }, [orders, mounted]);

  // --- ACTIONS ---
  const handleLogin = async (e) => { e.preventDefault(); setLoading(true); try { const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: passcode }) }); const data = await res.json(); if (data.success) { setIsAuthorized(true); } else { alert("Wrong password"); } } catch (err) { alert("Login failed"); } setLoading(false); };
  const fetchOrders = async () => { if (!supabase) return; const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }); if (data) setOrders(data); };
  const fetchInventory = async () => { if (!supabase) return; const { data: p } = await supabase.from('products').select('*').order('sort_order'); const { data: i } = await supabase.from('inventory').select('*').order('product_id', { ascending: true }); if (p) setProducts(p); if (i) setInventory(i); };
  const fetchLogos = async () => { if (!supabase) return; const { data } = await supabase.from('logos').select('*').order('sort_order'); if (data) setLogos(data); };
  const fetchGuests = async () => { if (!supabase) return; const { data } = await supabase.from('guests').select('*').order('name'); if (data) setGuests(data); };
  const fetchSettings = async () => { if (!supabase) return; const { data } = await supabase.from('event_settings').select('*').single(); if (data) { setEventName(data.event_name); setEventLogo(data.event_logo_url || ''); setHeaderColor(data.header_color || '#1e3a8a'); setPaymentMode(data.payment_mode || 'retail'); setPrinterType(data.printer_type || 'label'); setPnEnabled(data.printnode_enabled || false); setPnApiKey(data.printnode_api_key || ''); setPnPrinterId(data.printnode_printer_id || ''); } };
  const saveSettings = async () => { await supabase.from('event_settings').update({ event_name: eventName, event_logo_url: eventLogo, header_color: headerColor, payment_mode: paymentMode, printnode_enabled: pnEnabled, printnode_api_key: pnApiKey, printnode_printer_id: pnPrinterId }).eq('id', 1); alert("Saved!"); };
  const handleStatusChange = async (orderId, newStatus) => { setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o)); await supabase.from('orders').update({ status: newStatus }).eq('id', orderId); };
  const deleteOrder = async (orderId) => { if (confirm("Delete Order?")) { await supabase.from('orders').delete().eq('id', orderId); fetchOrders(); } };

  const printLabel = async (order) => {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, printed: true } : o));
      await supabase.from('orders').update({ printed: true }).eq('id', order.id);
      try {
          const res = await fetch('/api/printnode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order, mode: pnEnabled ? 'cloud' : 'download', apiKey: pnApiKey, printerId: pnPrinterId })
          });
          const result = await res.json();
          if (result.success && !pnEnabled) {
              const pdfBytes = Uint8Array.from(atob(result.pdfBase64), c => c.charCodeAt(0));
              window.open(window.URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' })), '_blank');
          }
      } catch (e) {}
  };

  const openEditModal = (order) => { 
      const rawCart = Array.isArray(order.cart_data) ? order.cart_data : [];
      const cleanCart = rawCart.map(item => ({
            ...item,
            customizations: { mainDesign: item.customizations?.mainDesign || '', logos: item.customizations?.logos || [], names: item.customizations?.names || [] }
      }));
      setEditingOrder({ ...order, cart_data: cleanCart }); 
      setOriginalOrderTotal(order.total_price || 0);
  };

  // --- TABS RENDERING ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-black">{eventName || 'Admin'}</h1>
          <div className="flex bg-white rounded-lg p-1 shadow border">
            {['orders', 'history', 'inventory', 'guests', 'logos', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded font-bold capitalize ${activeTab === tab ? 'bg-blue-900 text-white' : ''}`}>{tab}</button>
            ))}
          </div>
        </div>

        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded shadow border-l-4 border-green-500"><p className="text-xs font-bold uppercase text-gray-400">Revenue</p><p className="text-2xl font-black">${stats.revenue.toFixed(2)}</p></div>
              <div className="bg-white p-4 rounded shadow border-l-4 border-blue-500"><p className="text-xs font-bold uppercase text-gray-400">Orders</p><p className="text-2xl font-black">{stats.count}</p></div>
              <div className="bg-blue-900 p-4 rounded shadow text-white flex justify-between items-center">
                <span className="text-xs font-bold uppercase">Auto-Print</span>
                <input type="checkbox" checked={autoPrintEnabled} onChange={e => setAutoPrintEnabled(e.target.checked)} className="w-6 h-6" />
              </div>
            </div>
            <div className="bg-white shadow rounded-lg overflow-hidden border">
              <table className="w-full text-left">
                <thead className="bg-gray-100"><tr><th className="p-4">Status</th><th className="p-4">Customer</th><th className="p-4">Items</th><th className="p-4 text-right">Actions</th></tr></thead>
                <tbody>{orders.filter(o => o.status !== 'completed').map(o => (
                  <tr key={o.id} className="border-b">
                    <td className="p-4">
                      <select value={o.status} onChange={e => handleStatusChange(o.id, e.target.value)} className={`p-2 rounded font-bold text-xs ${STATUSES[o.status || 'pending']?.color}`}>
                        {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td className="p-4 font-bold">{o.customer_name}</td>
                    <td className="p-4 text-sm">{(o.cart_data || []).map((i, idx) => <div key={idx}>{i.productName} ({i.size})</div>)}</td>
                    <td className="p-4 text-right">
                      <button onClick={() => openEditModal(o)} className="mr-4 text-blue-600 font-bold">Edit</button>
                      <button onClick={() => printLabel(o)} className={`font-bold ${o.printed ? 'text-gray-300' : 'text-green-600'}`}>Print</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded shadow border h-fit">
              <h2 className="font-bold mb-4">Add Product</h2>
              <div className="space-y-4">
                <input className="w-full border p-2" placeholder="ID (e.g. jogger_navy)" value={newProdId} onChange={e => setNewProdId(e.target.value)} />
                <input className="w-full border p-2" placeholder="Name" value={newProdName} onChange={e => setNewProdName(e.target.value)} />
                <button onClick={handleAddProductWithSizeUpdates} className="w-full bg-green-600 text-white font-bold py-2 rounded">Create</button>
                <hr />
                <button onClick={downloadTemplate} className="w-full bg-gray-100 py-2 text-xs font-bold rounded">Download Stock CSV</button>
                <input type="file" onChange={handleBulkUpload} className="text-xs" />
              </div>
            </div>
            <div className="col-span-2 bg-white rounded shadow border overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-100 text-xs uppercase"><tr><th className="p-3">Product</th><th className="p-3">Size</th><th className="p-3">Stock</th><th className="p-3">Cost</th><th className="p-3">Price</th></tr></thead>
                <tbody>{inventory.map(i => (
                  <tr key={`${i.product_id}-${i.size}`} className="border-b text-sm">
                    <td className="p-3 font-bold">{getProductName(i.product_id)}</td>
                    <td className="p-3">{i.size}</td>
                    <td className="p-3"><input type="number" className="w-16 border p-1" value={i.count} onChange={e => updateStock(i.product_id, i.size, 'count', e.target.value)} /></td>
                    <td className="p-3"><input type="number" className="w-16 border p-1" value={i.cost_price} onChange={e => updateStock(i.product_id, i.size, 'cost_price', e.target.value)} /></td>
                    <td className="p-3 font-bold text-green-700">${products.find(p => p.id === i.product_id)?.base_price || 0}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto bg-white p-8 rounded shadow border space-y-6">
            <h2 className="text-2xl font-black">Event Settings</h2>
            <div><label className="font-bold text-xs uppercase">Event Name</label><input className="w-full border p-3 mt-1" value={eventName} onChange={e => setEventName(e.target.value)} /></div>
            <div className="bg-purple-50 p-6 rounded border border-purple-200">
              <h3 className="font-bold text-purple-900 mb-4">PrintNode Cloud Setup</h3>
              <div className="flex justify-between items-center mb-4"><span>Enable Cloud Print</span><input type="checkbox" checked={pnEnabled} onChange={e => setPnEnabled(e.target.checked)} /></div>
              <div className="space-y-4">
                <input className="w-full border p-2 text-sm" placeholder="API Key" value={pnApiKey} onChange={e => setPnApiKey(e.target.value)} />
                <div className="flex gap-2">
                  <input className="flex-1 border p-2 text-sm" placeholder="Printer ID" value={pnPrinterId} onChange={e => setPnPrinterId(e.target.value)} />
                  <button onClick={() => alert("Searching...")} className="bg-purple-600 text-white px-4 rounded text-xs font-bold">Find Printers</button>
                </div>
              </div>
            </div>
            <button onClick={saveSettings} className="w-full bg-blue-900 text-white py-4 font-black rounded shadow">Save All Settings</button>
          </div>
        )}

        {/* Restore History, Guests, Logos with similar high-detail logic... */}
      </div>
    </div>
  );
}