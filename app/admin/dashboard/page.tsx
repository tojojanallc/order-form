"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Download, DollarSign, Package, LayoutDashboard, Search, X, ShoppingCart, Tag, MapPin, Sparkles } from 'lucide-react';

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

  // --- COMPONENT LOGIC: AGGREGATE LOGOS & ADD-ONS ---
  const strokeStats: Record<string, number> = {};
  const logoStats: Record<string, number> = {};
  const addonStats: Record<string, number> = { "Metallic Upgrade": 0, "Back Roster": 0, "Custom Names": 0 };
  
  // --- DEEP SCAN AGGREGATION ---
  const strokeStats: Record<string, number> = {};
  const logoStats: Record<string, number> = {};
  const addonStats: Record<string, number> = { "Metallic Upgrade": 0, "Back Roster": 0, "Custom Names": 0 };
  
  filteredOrders.forEach(order => {
    const cart = Array.isArray(order.cart_data) ? order.cart_data : [];
    
    cart.forEach((item: any) => {
      // 1. Identify the Stroke / Main Design
      // Checks item.mainDesign OR item.customizations.mainDesign
      const stroke = item.mainDesign || item.customizations?.mainDesign;
      if (stroke) {
        strokeStats[stroke] = (strokeStats[stroke] || 0) + 1;
      }
      
      // 2. Identify Logos & Positions
      const logos = item.logos || item.customizations?.logos;
      if (Array.isArray(logos)) {
        logos.forEach((logo: any) => {
          const type = logo.type || logo.name;
          const pos = logo.position || logo.pos;
          if (type) {
            const key = `${type} (${pos || 'Standard'})`;
            logoStats[key] = (logoStats[key] || 0) + 1;
          }
        });
      }

      // 3. Identify Add-ons (Checking top level and nested)
      if (item.metallicUpgrade || item.customizations?.metallicUpgrade) addonStats["Metallic Upgrade"] += 1;
      if (item.backNameList || item.customizations?.backNameList) addonStats["Back Roster"] += 1;
      
      const names = item.names || item.customizations?.names;
      if (names && names.length > 0) addonStats["Custom Names"] += 1;
    });
  });

  if (loading) return <div className="p-20 text-center font-black text-blue-600 animate-pulse">BUILDING REPORT...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 text-slate-900 font-sans relative">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2 rounded-xl text-white shadow-lg"><LayoutDashboard size={24}/></div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">Merch Command Center</h1>
          </div>
          <select className="bg-white border px-4 py-2 rounded-xl font-bold text-sm shadow-sm text-blue-600" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
            <option value="all">ALL EVENTS</option>
            {events.map((e: any) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        {/* TOP KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
            <div className="p-4 bg-blue-50 rounded-2xl text-blue-600"><Sparkles size={28}/></div>
            <div><p className="text-xs font-bold text-gray-400 uppercase">Total Add-ons</p><p className="text-3xl font-black">{Object.values(addonStats).reduce((a,b)=>a+b, 0)}</p></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4 border-b-4 border-blue-500">
            <div className="p-4 bg-slate-50 rounded-2xl text-slate-600"><Tag size={28}/></div>
            <div><p className="text-xs font-bold text-gray-400 uppercase">Logo Placements</p><p className="text-3xl font-black">{Object.values(logoStats).reduce((a,b)=>a+b, 0)}</p></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
            <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600"><DollarSign size={28}/></div>
            <div><p className="text-xs font-bold text-gray-400 uppercase">Revenue</p><p className="text-3xl font-black">${filteredOrders.reduce((a,b)=>a+(Number(b.total_price)||0),0).toFixed(2)}</p></div>
          </div>
        </div>

        {/* LOGO & STROKE BREAKDOWN */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-3xl border shadow-sm p-6">
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><MapPin size={14}/> Logo Usage & Location</h3>
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
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><Sparkles size={14}/> Add-on Performance</h3>
            <div className="space-y-4">
              {Object.entries(addonStats).map(([name, count]) => (
                <div key={name}>
                  <div className="flex justify-between text-sm font-bold mb-2"><span>{name}</span><span>{count}</span></div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${(count / (filteredOrders.length || 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TRANSACTION TABLE */}
        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr className="text-[10px] font-black uppercase text-slate-400">
                <th className="p-6">Customer</th>
                <th className="p-6">Total</th>
                <th className="p-6 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredOrders.map(o => (
                <tr key={o.id} className="hover:bg-blue-50 cursor-pointer group transition-all" onClick={() => setSelectedOrder(o)}>
                  <td className="p-6 font-bold text-slate-800">{o.customer_name}</td>
                  <td className="p-6 font-black text-slate-900">${o.total_price}</td>
                  <td className="p-6 text-right"><button className="bg-slate-100 text-slate-400 px-4 py-2 rounded-lg group-hover:bg-blue-600 group-hover:text-white font-bold text-xs transition-all">VIEW ORDER</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ORDER DETAILS WITH ADD-ONS */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-150">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black tracking-tighter">{selectedOrder.customer_name}</h2>
                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">{selectedOrder.event_name}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-white/10 rounded-full"><X/></button>
            </div>
            <div className="p-8 max-h-[70vh] overflow-y-auto">
              {selectedOrder.cart_data?.map((item: any, i: number) => (
                <div key={i} className="mb-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-black text-lg text-slate-800 uppercase italic">{item.name}</span>
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase">{item.size}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-xs">
                      <p className="font-black text-slate-400 uppercase mb-2">Main Design</p>
                      <p className="font-bold text-slate-700">{item.mainDesign || 'None'}</p>
                    </div>
                    <div className="text-xs">
                      <p className="font-black text-slate-400 uppercase mb-2">Logos & Positions</p>
                      {item.logos?.length > 0 ? item.logos.map((l:any, idx:number) => (
                        <p key={idx} className="font-bold text-blue-600">{l.type} - <span className="text-slate-500">Pos: {l.position}</span></p>
                      )) : <p className="text-slate-400">No extra logos</p>}
                    </div>
                  </div>

                  {/* ADD-ONS SECTION */}
                  {(item.metallicUpgrade || item.backNameList || item.names?.length > 0) && (
                    <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap gap-2">
                      {item.metallicUpgrade && <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded font-bold text-[10px] uppercase">✨ Metallic</span>}
                      {item.backNameList && <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold text-[10px] uppercase">📋 Roster List</span>}
                      {item.names?.length > 0 && <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-bold text-[10px] uppercase">🏷️ Custom Name</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}