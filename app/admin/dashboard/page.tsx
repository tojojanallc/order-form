"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Download, DollarSign, Package, LayoutDashboard, Search, X, ShoppingCart, Tag, Sparkles, Mail, Phone } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function AnalyticsDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (data) setOrders(data);
      setLoading(false);
    }
    fetchData();
  }, []);

  const filteredOrders = eventFilter === 'all' ? orders : orders.filter(o => o.event_slug === eventFilter);
  const events = Array.from(new Set(orders.map(o => o.event_slug))).filter(Boolean);

  // --- REFINED AGGREGATION LOGIC ---
  const strokeStats: Record<string, number> = {};
  const logoStats: Record<string, number> = {};
  const addonStats: Record<string, number> = { "Metallic Upgrade": 0, "Back Roster": 0, "Custom Names": 0 };
  let totalItems = 0;
  
  filteredOrders.forEach(order => {
    const cart = Array.isArray(order.cart_data) ? order.cart_data : [];
    cart.forEach((item: any) => {
      totalItems += 1;

      // 1. Identify Main Stroke / Main Design
      const mainDesign = item.mainDesign || item.customizations?.mainDesign;
      if (mainDesign) {
        strokeStats[mainDesign] = (strokeStats[mainDesign] || 0) + 1;
      }
      
      // 2. Identify Logos & Stroke Add-ons
      const logos = item.logos || item.customizations?.logos;
      if (Array.isArray(logos)) {
        logos.forEach((logo: any) => {
          const type = logo.type || logo.name;
          if (type) {
            // Group everything into the Logo/Stroke list by name
            logoStats[type] = (logoStats[type] || 0) + 1;
          }
        });
      }

      // 3. Identify Technical Add-ons
      if (item.metallicUpgrade || item.customizations?.metallicUpgrade) addonStats["Metallic Upgrade"] += 1;
      if (item.backNameList || item.customizations?.backNameList) addonStats["Back Roster"] += 1;
      const names = item.names || item.customizations?.names;
      if (names && names.length > 0) addonStats["Custom Names"] += 1;
    });
  });

  // --- CSV DOWNLOADS ---
  const saveCSV = (filename: string, headers: string[], rows: any[][]) => {
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell)}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${filename}.csv`);
    link.click();
  };

  const downloadOrders = () => {
    const rows = filteredOrders.map(o => [new Date(o.created_at).toLocaleDateString(), o.customer_name, o.email, o.phone, o.total_price]);
    saveCSV("Customer_Orders", ["Date", "Customer", "Email", "Phone", "Total"], rows);
  };

  const downloadInventory = () => {
    const inv: Record<string, number> = {};
    filteredOrders.forEach(o => o.cart_data?.forEach((i:any) => {
      const key = `${i.name || i.productName} (${i.size})`;
      inv[key] = (inv[key] || 0) + 1;
    }));
    saveCSV("Inventory_Usage", ["Item", "Count"], Object.entries(inv));
  };

  const downloadUsage = () => {
    saveCSV("Stroke_and_Logo_Usage", ["Design Name", "Total Count"], Object.entries(logoStats));
  };

  if (loading) return <div className="p-20 text-center font-black text-blue-600 animate-pulse">SYNCING DATA...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2 rounded-xl text-white shadow-lg"><LayoutDashboard size={24}/></div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">Command Center</h1>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={downloadOrders} className="flex-1 bg-white border px-4 py-2 rounded-xl font-bold text-xs hover:bg-slate-50 shadow-sm">ORDERS</button>
            <button onClick={downloadInventory} className="flex-1 bg-white border px-4 py-2 rounded-xl font-bold text-xs hover:bg-slate-50 shadow-sm">INVENTORY</button>
            <button onClick={downloadUsage} className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md">USAGE</button>
            <select className="flex-1 bg-white border px-4 py-2 rounded-xl font-bold text-xs outline-none" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
              <option value="all">ALL EVENTS</option>
              {events.map((e: any) => <option key={e} value={e}>{String(e).toUpperCase()}</option>)}
            </select>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl border shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase">Revenue</p>
            <p className="text-3xl font-black">${filteredOrders.reduce((a,b)=>a+(Number(b.total_price)||0),0).toFixed(2)}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border shadow-sm border-b-4 border-blue-500">
            <p className="text-[10px] font-black text-slate-400 uppercase">Items Produced</p>
            <p className="text-3xl font-black">{totalItems}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase">Transactions</p>
            <p className="text-3xl font-black">{filteredOrders.length}</p>
          </div>
        </div>

        {/* DATA BREAKDOWN */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* STROKE & LOGO USAGE */}
          <div className="bg-white rounded-[2rem] border shadow-sm p-8">
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><Tag size={14}/> Designs & Add-on Strokes</h3>
            <div className="space-y-3">
              {Object.entries(logoStats).sort((a,b)=>b[1]-a[1]).map(([label, count]) => (
                <div key={label} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-sm font-bold text-slate-700">{label}</span>
                  <span className="bg-white px-3 py-1 rounded-lg shadow-sm font-black text-blue-600">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ADD-ON PERFORMANCE */}
          <div className="bg-white rounded-[2rem] border shadow-sm p-8">
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><Sparkles size={14}/> Special Upgrades</h3>
            <div className="space-y-4">
              {Object.entries(addonStats).map(([name, count]) => (
                <div key={name} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-sm font-bold text-slate-700">{name}</span>
                  <span className="bg-white px-4 py-1 rounded-full font-black text-emerald-600 shadow-sm">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ORDER LISTING */}
        <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr className="text-[10px] font-black uppercase text-slate-400">
                <th className="p-6">Customer</th>
                <th className="p-6">Total</th>
                <th className="p-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {filteredOrders.map(o => (
                <tr key={o.id} className="hover:bg-blue-50 cursor-pointer transition-all" onClick={() => setSelectedOrder(o)}>
                  <td className="p-6 font-bold">{o.customer_name}</td>
                  <td className="p-6 font-black">${o.total_price}</td>
                  <td className="p-6 text-right"><button className="bg-slate-100 p-2 rounded-lg"><Search size={16}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black tracking-tighter">{selectedOrder.customer_name}</h2>
                <div className="flex gap-4 mt-2 opacity-60">
                  <span className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Mail size={12}/> {selectedOrder.email || 'N/A'}</span>
                  <span className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Phone size={12}/> {selectedOrder.phone || 'N/A'}</span>
                </div>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-white/10 rounded-full"><X/></button>
            </div>
            <div className="p-8 max-h-[60vh] overflow-y-auto">
              {selectedOrder.cart_data?.map((item: any, i: number) => (
                <div key={i} className="mb-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-black text-slate-800 uppercase italic">{item.name || item.productName} ({item.size})</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="font-black text-slate-400 uppercase mb-1">Primary Design</p>
                      <p className="font-bold">{item.mainDesign || item.customizations?.mainDesign || 'None'}</p>
                    </div>
                    <div>
                      <p className="font-black text-slate-400 uppercase mb-1">Add-on Strokes/Logos</p>
                      {(item.logos || item.customizations?.logos)?.map((l:any, idx:number) => (
                        <p key={idx} className="font-bold text-blue-600">{l.type || l.name}</p>
                      )) || <p>None</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}