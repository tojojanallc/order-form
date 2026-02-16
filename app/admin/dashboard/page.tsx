"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Download, DollarSign, Package, LayoutDashboard, Search, X, ShoppingCart, Tag, Sparkles, Mail, Phone, Printer } from 'lucide-react';

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

  // --- AGGREGATION LOGIC ---
  const strokeStats: Record<string, number> = {};
  const logoStats: Record<string, number> = {};
  const sizeStats: Record<string, number> = {};
  const addonStats: Record<string, number> = { "Metallic Upgrade": 0, "Back Roster": 0, "Custom Names": 0 };
  let totalItemsSold = 0;
  
  filteredOrders.forEach(order => {
    const cart = Array.isArray(order.cart_data) ? order.cart_data : [];
    cart.forEach((item: any) => {
      totalItemsSold += 1;
      
      // Sizes
      if (item.size) sizeStats[item.size] = (sizeStats[item.size] || 0) + 1;

      // Strokes/Designs
      const stroke = item.mainDesign || item.customizations?.mainDesign;
      if (stroke) strokeStats[stroke] = (strokeStats[stroke] || 0) + 1;
      
      // Logos (Grouped by Name)
      const logos = item.logos || item.customizations?.logos;
      if (Array.isArray(logos)) {
        logos.forEach((logo: any) => {
          const type = logo.type || logo.name;
          if (type) logoStats[type] = (logoStats[type] || 0) + 1;
        });
      }

      // Add-ons
      if (item.metallicUpgrade || item.customizations?.metallicUpgrade) addonStats["Metallic Upgrade"] += 1;
      if (item.backNameList || item.customizations?.backNameList) addonStats["Back Roster"] += 1;
      if (item.names?.length > 0 || item.customizations?.names?.length > 0) addonStats["Custom Names"] += 1;
    });
  });

  // --- EXPORT HELPERS ---
  const saveCSV = (filename: string, headers: string[], rows: any[][]) => {
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const downloadOrders = () => {
    const rows = filteredOrders.map(o => [new Date(o.created_at).toLocaleDateString(), o.customer_name, o.email || 'N/A', o.phone || 'N/A', o.event_slug, o.payment_method, o.total_price]);
    saveCSV(`Orders_${eventFilter}`, ["Date", "Customer", "Email", "Phone", "Event", "Payment", "Total"], rows);
  };

  const downloadInventory = () => {
    const rows = Object.entries(sizeStats).map(([size, count]) => [size, count]);
    saveCSV(`Inventory_${eventFilter}`, ["Size", "Units Sold"], rows);
  };

  const downloadLogos = () => {
    const rows = Object.entries(logoStats).map(([name, count]) => [name, count]);
    saveCSV(`Logos_${eventFilter}`, ["Logo Name", "Total Used"], rows);
  };

  if (loading) return <div className="p-20 text-center font-black text-blue-600 animate-pulse">GENERATING MASTER REPORT...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 text-slate-900 font-sans relative">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER & TOP CONTROLS */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2 rounded-xl text-white shadow-lg"><LayoutDashboard size={24}/></div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">Merch HQ</h1>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <button onClick={downloadOrders} className="flex-1 lg:flex-none bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-md"><Download size={14}/> ORDERS</button>
            <button onClick={downloadInventory} className="flex-1 lg:flex-none bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-md"><Package size={14}/> INVENTORY</button>
            <button onClick={downloadLogos} className="flex-1 lg:flex-none bg-purple-600 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-purple-700 transition-all shadow-md"><Tag size={14}/> LOGOS</button>
            <select className="flex-1 lg:flex-none bg-white border-2 border-slate-200 px-4 py-2 rounded-xl font-bold text-xs shadow-sm text-slate-600 outline-none" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
              <option value="all">ALL EVENTS</option>
              {events.map((e: any) => <option key={e} value={e}>{String(e).toUpperCase()}</option>)}
            </select>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl border shadow-sm flex items-center gap-4">
            <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600 font-black text-xl">$</div>
            <div><p className="text-[10px] font-black text-slate-400 uppercase">Gross Revenue</p><p className="text-3xl font-black">${filteredOrders.reduce((a,b)=>a+(Number(b.total_price)||0),0).toFixed(2)}</p></div>
          </div>
          <div className="bg-white p-6 rounded-3xl border shadow-sm flex items-center gap-4 border-b-4 border-blue-500">
            <div className="p-4 bg-blue-50 rounded-2xl text-blue-600"><Package size={28}/></div>
            <div><p className="text-[10px] font-black text-slate-400 uppercase">Items Produced</p><p className="text-3xl font-black">{totalItemsSold}</p></div>
          </div>
          <div className="bg-white p-6 rounded-3xl border shadow-sm flex items-center gap-4">
            <div className="p-4 bg-purple-50 rounded-2xl text-purple-600"><ShoppingCart size={28}/></div>
            <div><p className="text-[10px] font-black text-slate-400 uppercase">Total Orders</p><p className="text-3xl font-black">{filteredOrders.length}</p></div>
          </div>
        </div>

        {/* VISUAL GRAPHS & AGGREGATES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><Tag size={14}/> Stroke Usage Totals</h3>
            <div className="space-y-4">
              {Object.entries(strokeStats).sort((a,b)=>b[1]-a[1]).map(([name, count]) => (
                <div key={name}>
                  <div className="flex justify-between text-xs font-bold mb-2 uppercase"><span>{name}</span><span>{count}</span></div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full" style={{ width: `${(count / (totalItemsSold || 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
             <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><Sparkles size={14}/> Add-on Performance</h3>
             <div className="grid grid-cols-1 gap-4">
                {Object.entries(addonStats).map(([name, count]) => (
                  <div key={name} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-sm font-bold text-slate-700">{name}</span>
                    <span className="bg-white px-4 py-1 rounded-full font-black text-emerald-600 shadow-sm">{count}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>

        {/* TRANSACTION LIST */}
        <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
          <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Order History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase text-slate-400 border-b">
                  <th className="p-8">Customer / Info</th>
                  <th className="p-8">Payment</th>
                  <th className="p-8">Total</th>
                  <th className="p-8 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredOrders.map(o => (
                  <tr key={o.id} className="hover:bg-blue-50 cursor-pointer transition-all" onClick={() => setSelectedOrder(o)}>
                    <td className="p-8">
                      <p className="font-bold text-slate-900">{o.customer_name}</p>
                      <p className="text-[11px] text-slate-400 font-medium">{o.email || 'No Email'}</p>
                    </td>
                    <td className="p-8 uppercase text-slate-400 font-bold text-[10px]">{o.payment_method}</td>
                    <td className="p-8 font-black text-slate-900">${o.total_price}</td>
                    <td className="p-8 text-right"><button className="bg-slate-100 text-slate-400 p-2 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all"><Search size={16}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-10 bg-slate-900 text-white flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-black tracking-tight mb-2 leading-none">{selectedOrder.customer_name}</h2>
                <div className="flex flex-col gap-1 opacity-60">
                  <p className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Mail size={12}/> {selectedOrder.email || 'N/A'}</p>
                  <p className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Phone size={12}/> {selectedOrder.phone || 'N/A'}</p>
                </div>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X/></button>
            </div>
            <div className="p-10 max-h-[50vh] overflow-y-auto">
              {selectedOrder.cart_data?.map((item: any, i: number) => (
                <div key={i} className="mb-6 p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div className="flex justify-between items-center mb-6">
                    <span className="font-black text-xl text-slate-900 uppercase italic tracking-tighter">{item.name || item.productName}</span>
                    <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-black">{item.size}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-8 text-[11px]">
                    <div>
                      <p className="font-black text-slate-400 uppercase mb-2">Main Stroke</p>
                      <p className="font-bold text-slate-700 text-sm">{item.mainDesign || item.customizations?.mainDesign || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="font-black text-slate-400 uppercase mb-2">Applied Logos</p>
                      {(item.logos || item.customizations?.logos)?.map((l:any, idx:number) => (
                        <p key={idx} className="font-bold text-blue-600 text-sm">{l.type || l.name}</p>
                      )) || <p className="text-slate-300 italic">No extra logos</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-10 border-t flex justify-between items-center bg-slate-50">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Total</span>
              <span className="text-4xl font-black text-slate-900">${selectedOrder.total_price}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}