"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Download, DollarSign, Package, LayoutDashboard, Search, X, ShoppingCart, Tag } from 'lucide-react';

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

  // Financials
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
  
  // Product & Size Aggregation
  const designStats: Record<string, number> = {};
  const sizeStats: Record<string, number> = {};
  let totalItems = 0;

  filteredOrders.forEach(order => {
    const cart = Array.isArray(order.cart_data) ? order.cart_data : [];
    cart.forEach((item: any) => {
      totalItems += 1;
      designStats[item.name] = (designStats[item.name] || 0) + 1;
      sizeStats[item.size] = (sizeStats[item.size] || 0) + 1;
    });
  });

  const downloadCSV = () => {
    const csvRows = [
      ["Date", "Customer", "Event", "Total", "Items"],
      ...filteredOrders.map(o => [new Date(o.created_at).toLocaleDateString(), o.customer_name, o.event_slug, o.total_price, o.cart_data?.length])
    ];
    const csvContent = csvRows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Lev-Reporting-${eventFilter}.csv`;
    link.click();
  };

  if (loading) return <div className="p-20 text-center font-black text-blue-600 animate-pulse">GENERATING REPORT...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 text-slate-900 font-sans relative">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200"><LayoutDashboard size={24}/></div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter">Event Insights</h1>
              <p className="text-xs font-bold text-slate-400">ADMIN CONTROL PANEL</p>
            </div>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
            <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600"><DollarSign size={28}/></div>
            <div><p className="text-xs font-bold text-gray-400 uppercase">Gross Revenue</p><p className="text-3xl font-black">${totalRevenue.toFixed(2)}</p></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4 border-b-4 border-blue-500">
            <div className="p-4 bg-blue-50 rounded-2xl text-blue-600"><Package size={28}/></div>
            <div><p className="text-xs font-bold text-gray-400 uppercase">Total Items Sold</p><p className="text-3xl font-black">{totalItems}</p></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
            <div className="p-4 bg-purple-50 rounded-2xl text-purple-600"><ShoppingCart size={28}/></div>
            <div><p className="text-xs font-bold text-gray-400 uppercase">Transactions</p><p className="text-3xl font-black">{filteredOrders.length}</p></div>
          </div>
        </div>

        {/* BREAKDOWN SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* PRODUCT SALES */}
          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
            <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">Design Popularity</h3>
              <Tag size={16} className="text-slate-300"/>
            </div>
            <div className="p-6">
              {Object.entries(designStats).sort((a,b) => b[1] - a[1]).map(([name, count]) => (
                <div key={name} className="mb-4 last:mb-0">
                  <div className="flex justify-between text-sm font-bold mb-2">
                    <span>{name}</span>
                    <span className="text-blue-600">{count} sold</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${(count / totalItems) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SIZE HEATMAP */}
          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
            <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">Inventory Movement</h3>
              <Package size={16} className="text-slate-300"/>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {Object.entries(sizeStats).sort().map(([size, count]) => (
                <div key={size} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                  <span className="font-black text-slate-400">{size}</span>
                  <span className="text-xl font-black text-slate-800">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ORDER LIST */}
        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center">
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">Recent Transactions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase text-slate-400 border-b">
                  <th className="p-6">Date</th>
                  <th className="p-6">Customer</th>
                  <th className="p-6">Method</th>
                  <th className="p-6">Total</th>
                  <th className="p-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-blue-50/50 cursor-pointer transition-colors group" onClick={() => setSelectedOrder(o)}>
                    <td className="p-6 text-sm text-slate-500">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="p-6 font-bold text-slate-800">{o.customer_name}</td>
                    <td className="p-6 text-xs font-black uppercase text-slate-400">{o.payment_method}</td>
                    <td className="p-6 font-black text-slate-900">${o.total_price}</td>
                    <td className="p-6">
                      <button className="bg-slate-100 text-slate-500 p-2 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <Search size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DETAIL OVERLAY (MODAL) */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black tracking-tight">{selectedOrder.customer_name}</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Order Details</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X/></button>
            </div>
            <div className="p-8">
              <div className="space-y-4 mb-8">
                {selectedOrder.cart_data?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-800">{item.name}</p>
                      <p className="text-xs font-black text-blue-600 uppercase">Size: {item.size}</p>
                    </div>
                    <p className="font-black text-slate-900">${item.price}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t pt-6">
                <span className="text-slate-400 font-bold uppercase text-xs">Total Paid</span>
                <span className="text-2xl font-black text-slate-900">${selectedOrder.total_price}</span>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="w-full mt-8 bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all">CLOSE DETAIL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}