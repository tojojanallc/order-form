"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, DollarSign, Package, LayoutDashboard } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function AnalyticsDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState('all');

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

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
  const totalItems = filteredOrders.reduce((sum, o) => sum + (o.cart_data?.length || 0), 0);

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

  if (loading) return <div className="p-20 text-center font-black text-blue-600 animate-pulse">SYNCING DATA...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white"><LayoutDashboard size={24}/></div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">Event Insights</h1>
          </div>
          
          <div className="flex gap-3 mt-4 md:mt-0">
            <button onClick={downloadCSV} className="flex items-center gap-2 bg-white border px-4 py-2 rounded-lg font-bold text-sm shadow-sm hover:bg-gray-50">
              <Download size={16} /> EXPORT EXCEL
            </button>
            <select className="bg-white border px-4 py-2 rounded-lg font-bold text-sm" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
              <option value="all">ALL EVENTS</option>
              {events.map((e: any) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-xl text-green-600"><DollarSign/></div>
            <div><p className="text-xs font-bold text-gray-400 uppercase">Revenue</p><p className="text-2xl font-black">${totalRevenue.toFixed(2)}</p></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4 border-b-4 border-blue-500">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><Package/></div>
            <div><p className="text-xs font-bold text-gray-400 uppercase">Units Sold</p><p className="text-2xl font-black">{totalItems}</p></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-xl text-purple-600"><LayoutDashboard/></div>
            <div><p className="text-xs font-bold text-gray-400 uppercase">Orders</p><p className="text-2xl font-black">{filteredOrders.length}</p></div>
          </div>
        </div>

        {/* GRAPH */}
        <div className="bg-white p-8 rounded-3xl border shadow-sm mb-10">
          <h3 className="font-bold text-gray-400 uppercase text-[10px] tracking-widest mb-6">Recent Sales Velocity</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredOrders.slice(0, 15).reverse().map(o => ({ name: o.customer_name?.split(' ')[0], amount: o.total_price }))}>
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}