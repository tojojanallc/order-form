"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Download, DollarSign, Package, LayoutDashboard, Search, X, ShoppingCart, Tag, Sparkles, Mail, Phone, MapPin, UserCircle, BarChart3, Calendar } from 'lucide-react';

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
  
  const eventMetadata = orders.reduce((acc: any, curr: any) => {
    const slug = curr.event_slug;
    if (!slug) return acc;
    const date = new Date(curr.created_at);
    if (!acc[slug]) {
      acc[slug] = { name: curr.event_name || slug, start: date, end: date };
    } else {
      if (date < acc[slug].start) acc[slug].start = date;
      if (date > acc[slug].end) acc[slug].end = date;
    }
    return acc;
  }, {});

  const getEventLabel = (slug: string) => {
    const meta = eventMetadata[slug];
    const startStr = meta.start.toLocaleDateString();
    const endStr = meta.end.toLocaleDateString();
    return `${startStr === endStr ? startStr : startStr + '-' + endStr} - ${meta.name}`;
  };

  // --- AGGREGATION LOGIC ---
  const mainStrokeStats: Record<string, number> = {};
  const addOnLogoStats: Record<string, number> = {};
  const garmentSizeStats: Record<string, number> = {};
  const addonStats: Record<string, number> = { "Metallic Upgrade": 0, "Back Roster": 0, "Custom Names": 0 };
  let totalItemsSold = 0;
  
  filteredOrders.forEach(order => {
    const cart = Array.isArray(order.cart_data) ? order.cart_data : [];
    cart.forEach((item: any) => {
      totalItemsSold += 1;
      const gName = item.name || item.productName || "Unknown Item";
      const gSize = item.size || item.customizations?.size || "N/A";
      const gKey = `${gName} - ${gSize}`;
      garmentSizeStats[gKey] = (garmentSizeStats[gKey] || 0) + 1;

      const mainDesign = item.mainDesign || item.customizations?.mainDesign;
      if (mainDesign) mainStrokeStats[mainDesign] = (mainStrokeStats[mainDesign] || 0) + 1;
      
      const logos = item.logos || item.customizations?.logos || item['Additional Imprints'];
      if (Array.isArray(logos)) {
        logos.forEach((logo: any) => {
          const type = logo.type || logo.name || logo;
          if (type && typeof type === 'string') addOnLogoStats[type] = (addOnLogoStats[type] || 0) + 1;
        });
      }

      if (item.metallicUpgrade || item.customizations?.metallicUpgrade) addonStats["Metallic Upgrade"] += 1;
      if (item.backNameList || item.customizations?.backNameList || item['Add Roster'] === 'Yes') addonStats["Back Roster"] += 1;
      const names = item.names || item.customizations?.names;
      if ((names && names.length > 0) || item['Add Names'] === 'Yes') addonStats["Custom Names"] += 1;
    });
  });

  const totalMainStroke = Object.values(mainStrokeStats).reduce((a, b) => a + b, 0);
  const totalAddOnLogos = Object.values(addOnLogoStats).reduce((a, b) => a + b, 0);
  const totalUpgrades = Object.values(addonStats).reduce((a, b) => a + b, 0);

  const chartData = Object.entries(garmentSizeStats)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value).slice(0, 10);

  // --- CSV DOWNLOAD HELPERS ---
  const saveCSV = (filename: string, headers: string[], rows: any[][]) => {
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${filename}_${eventFilter}.csv`);
    link.click();
  };

  const downloadOrders = () => {
    const headers = ["Date", "Customer", "Email", "Phone", "Total Price", "Items Purchased"];
    const rows = filteredOrders.map(o => [
      new Date(o.created_at).toLocaleDateString(),
      o.customer_name,
      o.email || 'N/A',
      o.phone || 'N/A',
      o.total_price,
      (o.cart_data || []).map((i: any) => `${i.name || i.productName} (${i.size || 'N/A'})`).join(" | ")
    ]);
    saveCSV("Orders_by_Customer", headers, rows);
  };

  const downloadInventory = () => {
    const sizeOrder: Record<string, number> = { 'YS': 1, 'YM': 2, 'YL': 3, 'YXL': 4, 'AS': 5, 'AM': 6, 'AL': 7, 'AXL': 8, 'A2XL': 9, 'A3XL': 10 };
    const rows = Object.entries(garmentSizeStats)
      .map(([key, qty]) => ({ style: key.split(" - ")[0], size: key.split(" - ")[1], qty }))
      .sort((a, b) => a.style.localeCompare(b.style) || (sizeOrder[a.size] || 99) - (sizeOrder[b.size] || 99))
      .map(i => [i.style, i.size, i.qty]);
    saveCSV("Inventory_Usage", ["Garment Style", "Size", "Quantity Sold"], rows);
  };

  const downloadLogos = () => {
    saveCSV("Logo_and_Stroke_Usage", ["Design Name", "Total Used"], Object.entries({ ...mainStrokeStats, ...addOnLogoStats }));
  };

  if (loading) return <div className="p-20 text-center font-black text-blue-600 animate-pulse uppercase tracking-widest">Compiling Full Command Center...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 text-slate-900 font-sans relative">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER & EXPORT BUTTONS */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2 rounded-xl text-white shadow-lg"><LayoutDashboard size={24}/></div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">Command Center</h1>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <button onClick={downloadOrders} className="flex-1 lg:flex-none bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-[10px] hover:bg-blue-700 shadow-md flex items-center justify-center gap-2"><ShoppingCart size={14}/> ORDERS</button>
            <button onClick={downloadInventory} className="flex-1 lg:flex-none bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-[10px] hover:bg-emerald-700 shadow-md flex items-center justify-center gap-2"><Package size={14}/> INVENTORY</button>
            <button onClick={downloadLogos} className="flex-1 lg:flex-none bg-purple-600 text-white px-4 py-2 rounded-xl font-bold text-[10px] hover:bg-purple-700 shadow-md flex items-center justify-center gap-2"><Tag size={14}/> LOGOS</button>
            <div className="flex-1 lg:flex-none relative">
              <Calendar className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <select className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded-xl font-bold text-[10px] outline-none shadow-sm appearance-none cursor-pointer text-slate-600" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
                <option value="all">ALL HISTORICAL EVENTS</option>
                {Object.keys(eventMetadata).sort((a, b) => eventMetadata[b].start - eventMetadata[a].start).map((slug) => (
                  <option key={slug} value={slug}>{getEventLabel(slug).toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-slate-900">
          <div className="bg-white p-6 rounded-3xl border shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue</p><p className="text-3xl font-black">${filteredOrders.reduce((a,b)=>a+(Number(b.total_price)||0),0).toFixed(2)}</p></div>
          <div className="bg-white p-6 rounded-3xl border shadow-sm border-b-4 border-blue-500"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Units Sold</p><p className="text-3xl font-black">{totalItemsSold}</p></div>
          <div className="bg-white p-6 rounded-3xl border shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transactions</p><p className="text-3xl font-black">{filteredOrders.length}</p></div>
        </div>

        {/* BREAKDOWN GRID WITH TOTALS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8 text-slate-900">
          <div className="bg-white rounded-[2rem] border shadow-sm p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2"><Tag size={14}/> Main Stroke Choices</h3>
              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-black">{totalMainStroke}</span>
            </div>
            <div className="space-y-3">
              {Object.entries(mainStrokeStats).sort((a,b)=>b[1]-a[1]).map(([label, count]) => (
                <div key={label} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100"><span className="text-sm font-bold text-slate-700">{label}</span><span className="bg-white px-3 py-1 rounded-lg shadow-sm font-black text-blue-600">{count}</span></div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-[2rem] border shadow-sm p-8 text-slate-900">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2"><MapPin size={14}/> Add-On Logo Usage</h3>
              <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-black">{totalAddOnLogos}</span>
            </div>
            <div className="space-y-3">
              {Object.entries(addOnLogoStats).sort((a,b)=>b[1]-a[1]).map(([label, count]) => (
                <div key={label} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100"><span className="text-sm font-bold text-slate-700">{label}</span><span className="bg-white px-3 py-1 rounded-lg shadow-sm font-black text-purple-600">{count}</span></div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-[2rem] border shadow-sm p-8 text-slate-900">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2"><Sparkles size={14}/> Upgrades</h3>
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-black">{totalUpgrades}</span>
            </div>
            <div className="space-y-4">
              {Object.entries(addonStats).map(([name, count]) => (
                <div key={name} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100"><span className="text-sm font-bold text-slate-700">{name}</span><span className="bg-white px-4 py-1 rounded-full font-black text-emerald-600 shadow-sm">{count}</span></div>
              ))}
            </div>
          </div>
        </div>

        {/* SIZE CHART WITH LABELS */}
        <div className="bg-white rounded-[2.5rem] border shadow-sm p-8 mb-8 text-slate-900">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2"><BarChart3 size={14}/> Size Usage Breakdown</h3>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-black">{totalItemsSold} Units</span>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={chartData} margin={{ left: 50, right: 80 }}>
                <XAxis type="number" hide /><YAxis dataKey="name" type="category" width={180} fontSize={10} fontWeight="900" axisLine={false} tickLine={false} />
                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={25}>
                  <LabelList dataKey="value" position="right" offset={10} style={{ fontSize: '12px', fontWeight: '900', fill: '#065f46' }} />
                  {chartData.map((e, i) => <Cell key={i} fill={i % 2 === 0 ? '#10b981' : '#34d399'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ORDER TABLE */}
        <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden text-slate-900 mb-20">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr className="text-[10px] font-black uppercase text-slate-400 font-mono"><th className="p-6">Customer / Contact</th><th className="p-6">Method</th><th className="p-6">Total</th><th className="p-6 text-right">Details</th></tr>
            </thead>
            <tbody className="divide-y text-sm">
              {filteredOrders.map(o => (
                <tr key={o.id} className="hover:bg-blue-50 cursor-pointer transition-all" onClick={() => setSelectedOrder(o)}>
                  <td className="p-6"><p className="font-bold">{o.customer_name}</p><p className="text-[10px] text-slate-400 font-medium italic">{o.email || 'No Email'}</p></td>
                  <td className="p-6 uppercase text-slate-400 font-bold text-[10px] tracking-widest">{o.payment_method}</td>
                  <td className="p-6 font-black text-blue-600">${o.total_price}</td>
                  <td className="p-6 text-right"><button className="bg-slate-100 text-slate-400 p-2 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><Search size={16}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-150 border-8 border-slate-900">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <div><h2 className="text-2xl font-black tracking-tighter mb-1 leading-none uppercase italic">{selectedOrder.customer_name}</h2><div className="flex gap-4 opacity-60"><span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 font-mono"><Mail size={12}/> {selectedOrder.email || 'N/A'}</span><span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 font-mono"><Phone size={12}/> {selectedOrder.phone || 'N/A'}</span></div></div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X/></button>
            </div>
            <div className="p-8 max-h-[60vh] overflow-y-auto text-slate-900">
              {selectedOrder.cart_data?.map((item: any, i: number) => {
                const legacyLogos = item['Additional Imprints'] ? String(item['Additional Imprints']).split(',') : [];
                const modernLogos = item.logos || item.customizations?.logos || [];
                const nameAddon = item.names || item.customizations?.names || [];
                return (
                  <div key={i} className="mb-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="flex justify-between items-center mb-4"><span className="font-black text-slate-800 uppercase italic tracking-tighter">{item.name || item.productName}</span><span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black font-mono">{item.size || item.customizations?.size || 'N/A'}</span></div>
                    <div className="grid grid-cols-2 gap-4 text-[10px] uppercase font-bold text-slate-400">
                      <div><p className="mb-1 tracking-widest text-[8px]">Main Design</p><p className="text-slate-700 text-xs">{item.mainDesign || item.customizations?.mainDesign || 'None'}</p></div>
                      <div><p className="mb-1 tracking-widest text-[8px]">Add-On Logos</p>{modernLogos.length > 0 ? modernLogos.map((l:any, idx:number) => (<p key={idx} className="text-blue-600 text-xs">{l.type || l.name}</p>)) : legacyLogos.length > 0 ? legacyLogos.map((l:any, idx:number) => (<p key={idx} className="text-blue-600 text-xs">{l}</p>)) : <p className="text-slate-300">None</p>}</div>
                    </div>
                    {nameAddon.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-200"><p className="mb-1 tracking-widest text-[8px] uppercase font-bold text-slate-400">Custom Names</p><div className="flex flex-wrap gap-2 mt-2">{nameAddon.map((n: any, idx: number) => (<span key={idx} className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-1 rounded-xl text-xs font-black text-emerald-600 shadow-sm"><UserCircle size={12}/> {n.text || n}</span>))}</div></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}