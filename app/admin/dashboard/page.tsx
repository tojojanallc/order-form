"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
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

  // --- AGGREGATION LOGIC ---
  const strokeStats: Record<string, number> = {};
  const logoStats: Record<string, number> = {};
  const addonStats: Record<string, number> = { "Metallic Upgrade": 0, "Back Roster": 0, "Custom Names": 0 };
  let totalItems = 0;
  
  filteredOrders.forEach(order => {
    const cart = Array.isArray(order.cart_data) ? order.cart_data : [];
    cart.forEach((item: any) => {
      totalItems += 1;
      const stroke = item.mainDesign || item.customizations?.mainDesign;
      if (stroke) strokeStats[stroke] = (strokeStats[stroke] || 0) + 1;
      
      const logos = item.logos || item.customizations?.logos;
      if (Array.isArray(logos)) {
        logos.forEach((logo: any) => {
          const type = logo.type || logo.name;
          if (type) logoStats[type] = (logoStats[type] || 0) + 1;
        });
      }

      if (item.metallicUpgrade || item.customizations?.metallicUpgrade) addonStats["Metallic Upgrade"] += 1;
      if (item.backNameList || item.customizations?.backNameList) addonStats["Back Roster"] += 1;
      const names = item.names || item.customizations?.names;
      if (names && names.length > 0) addonStats["Custom Names"] += 1;
    });
  });

  const downloadCSV = () => {
    const csvRows = [
      ["Date", "Customer", "Email", "Phone", "Event", "Total", "Items"],
      ...filteredOrders.map(o => [
        new Date(o.created_at).toLocaleDateString(), 
        o.customer_name, 
        o.email || 'N/A', 
        o.phone || 'N/A', 
        o.event_slug, 
        o.total_price, 
        o.cart_data?.length
      ])
    ];
    const csvContent = csvRows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Lev-Report-${eventFilter}.csv`;
    link.click();
  };

  if (loading) return <div className="p-20 text-center font-black text-blue-600 animate-pulse uppercase">Syncing Admin Data...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 text-slate-900 font-sans relative">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2 rounded-xl text-white shadow-lg"><LayoutDashboard size={24}/></div>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-800">Command Center</h1>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={downloadCSV} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border px-4 py-2 rounded-xl font-bold text-sm shadow-sm hover:bg-gray-50 transition-all">
              <Download size={16} /> EXPORT CSV
            </button>
            <select className="flex-1 md:flex-none bg-white border px-4 py-2 rounded-xl font-bold text-sm shadow-sm outline-none text-blue-600" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
              <option value="all">ALL EVENTS</option>
              {events.map((e: any) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>

        {/* TOP KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-slate-800">
          <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
            <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600"><DollarSign size={28}/></div>
            <div><p className="text-xs font-bold text-gray-400 uppercase">Revenue</p><p className="text-3xl font-black">${filteredOrders.reduce((a,b)=>a+(Number(b.total_price)||0),0).toFixed(2)}</p></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4 border-b-4 border-blue-500">
            <div className="p-4 bg-blue-50 rounded-2xl text-blue-600"><Package size={28}/></div>
            <div><p className="text-xs font-bold text-gray-400 uppercase">Items Produced</p><p className="text-3xl font-black">{totalItems}</p></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4 text-slate-800">
            <div className="p-4 bg-purple-50 rounded-2xl text-purple-600"><ShoppingCart size={28}/></div>
            <div><p className="text-xs font-bold text-gray-400 uppercase">Orders</p><p className="text-3xl font-black">{filteredOrders.length}</p></div>
          </div>
        </div>

        {/* LOGO & ADD-ON BREAKDOWN */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-3xl border shadow-sm p-6">
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6">Logo Usage (Total Units)</h3>
            <div className="space-y-3">
              {Object.entries(logoStats).sort((a,b)=>b[1]-a[1]).map(([label, count]) => (
                <div key={label} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-sm font-bold text-slate-700">{label}</span>
                  <span className="bg-white px-3 py-1 rounded-lg shadow-sm font-black text-blue-600">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border shadow-sm p-6">
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6">Add-on Performance</h3>
            <div className="space-y-4 pt-2">
              {Object.entries(addonStats).map(([name, count]) => (
                <div key={name}>
                  <div className="flex justify-between text-sm font-bold mb-2"><span>{name}</span><span>{count}</span></div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(count / (totalItems || 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TRANSACTION TABLE */}
        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden text-slate-800">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b">
              <tr className="text-[10px] font-black uppercase text-slate-400">
                <th className="p-6">Customer Info</th>
                <th className="p-6">Method</th>
                <th className="p-6">Total</th>
                <th className="p-6 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredOrders.map(o => (
                <tr key={o.id} className="hover:bg-blue-50 cursor-pointer group transition-all" onClick={() => setSelectedOrder(o)}>
                  <td className="p-6">
                    <p className="font-bold text-slate-800">{o.customer_name}</p>
                    <p className="text-[11px] text-slate-400 font-medium">{o.email || 'No Email'}</p>
                  </td>
                  <td className="p-6 uppercase text-slate-400 font-bold text-[10px]">{o.payment_method}</td>
                  <td className="p-6 font-black text-slate-900">${o.total_price}</td>
                  <td className="p-6 text-right"><button className="bg-slate-100 text-slate-400 p-2 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all"><Search size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-150">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black tracking-tighter leading-tight">{selectedOrder.customer_name}</h2>
                <div className="flex gap-4 mt-2">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-blue-400 uppercase tracking-widest"><Mail size={12}/> {selectedOrder.email || 'N/A'}</span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-blue-400 uppercase tracking-widest"><Phone size={12}/> {selectedOrder.phone || 'N/A'}</span>
                </div>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-white/10 rounded-full"><X/></button>
            </div>
            <div className="p-8 max-h-[60vh] overflow-y-auto">
              {selectedOrder.cart_data?.map((item: any, i: number) => (
                <div key={i} className="mb-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-black text-slate-800 uppercase italic">{item.name || item.productName}</span>
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black">{item.size}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="font-black text-slate-400 uppercase mb-1">Design</p>
                      <p className="font-bold">{item.mainDesign || item.customizations?.mainDesign || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="font-black text-slate-400 uppercase mb-1">Logos</p>
                      {(item.logos || item.customizations?.logos)?.map((l:any, idx:number) => (
                        <p key={idx} className="font-bold text-blue-600">{l.type || l.name}</p>
                      )) || <p>None</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-8 border-t flex justify-between items-center bg-slate-50">
              <p className="font-bold text-slate-400 text-xs">TOTAL TRANSACTION</p>
              <p className="text-3xl font-black text-slate-900">${selectedOrder.total_price}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}