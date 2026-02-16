"use client";
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PostEventDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('all');
  const [loading, setLoading] = useState(true);

  // Set your average cost per blank/transfer here for profit estimates
  const AVG_COST_PER_ITEM = 12.00; 

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    const { data, error } = await supabase.from('orders').select('*');
    if (data) setOrders(data);
    setLoading(false);
  }

  // Filter logic
  const filteredOrders = selectedEvent === 'all' 
    ? orders 
    : orders.filter(o => o.event_slug === selectedEvent);

  const uniqueEvents = Array.from(new Set(orders.map(o => o.event_slug))).filter(Boolean);

  // Calculations
  const totalRevenue = filteredOrders.reduce((acc, curr) => acc + (curr.total_price || 0), 0);
  const cashSales = filteredOrders.filter(o => o.payment_method === 'cash').length;
  const cardSales = filteredOrders.length - cashSales;
  
  let totalItemsSold = 0;
  const itemCounts: any = {};
  const sizeCounts: any = {};

  filteredOrders.forEach(order => {
    order.cart_data?.forEach((item: any) => {
      totalItemsSold += 1;
      itemCounts[item.name] = (itemCounts[item.name] || 0) + 1;
      sizeCounts[item.size] = (sizeCounts[item.size] || 0) + 1;
    });
  });

  const estimatedCost = totalItemsSold * AVG_COST_PER_ITEM;
  const estimatedProfit = totalRevenue - estimatedCost;

  if (loading) return <div className="p-10 text-center font-bold">Loading Post-Event Stats...</div>;

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen font-sans text-gray-900">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-blue-900">Event Analytics</h1>
            <p className="text-gray-500">Post-event performance and inventory breakdown</p>
          </div>
          
          <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border">
            <span className="text-xs font-bold text-gray-400 uppercase ml-2">Filter Event:</span>
            <select 
              className="p-1 px-4 outline-none font-semibold text-blue-600 cursor-pointer"
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
            >
              <option value="all">All Events Combined</option>
              {uniqueEvents.map(slug => (
                <option key={slug} value={slug}>{slug}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Financial Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-blue-500">
            <p className="text-gray-400 text-xs font-bold uppercase mb-1">Total Revenue</p>
            <p className="text-3xl font-black">${totalRevenue.toLocaleString()}</p>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-green-500">
            <p className="text-gray-400 text-xs font-bold uppercase mb-1">Est. Net Profit</p>
            <p className="text-3xl font-black text-green-600">${estimatedProfit.toLocaleString()}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-orange-400">
            <p className="text-gray-400 text-xs font-bold uppercase mb-1">Items Sold</p>
            <p className="text-3xl font-black">{totalItemsSold}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-purple-500">
            <p className="text-gray-400 text-xs font-bold uppercase mb-1">Avg Order</p>
            <p className="text-3xl font-black">${filteredOrders.length > 0 ? (totalRevenue / filteredOrders.length).toFixed(2) : 0}</p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Item Breakdown */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="font-bold uppercase text-sm text-gray-600">Top Designs</h2>
            </div>
            <div className="p-6">
              {Object.entries(itemCounts).sort((a: any, b: any) => b[1] - a[1]).map(([name, count]: any) => (
                <div key={name} className="flex items-center mb-4">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-bold">{name}</span>
                      <span className="text-sm text-gray-500">{count} sold</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${(count / totalItemsSold) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Size Heatmap */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="font-bold uppercase text-sm text-gray-600">Size Distribution</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(sizeCounts).sort().map(([size, count]: any) => (
                  <div key={size} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <span className="font-black text-gray-700">{size}</span>
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Payment Summary */}
        <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm border flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <h3 className="font-bold text-lg">Payment Methods</h3>
            <p className="text-sm text-gray-500">Distribution of Cash vs. Card terminal sales</p>
          </div>
          <div className="flex-1 w-full max-w-md">
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-blue-600">CARD ({cardSales})</span>
              <span className="text-green-600">CASH ({cashSales})</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden flex">
              <div className="bg-blue-500 h-full" style={{ width: `${(cardSales/filteredOrders.length)*100}%` }}></div>
              <div className="bg-green-500 h-full" style={{ width: `${(cashSales/filteredOrders.length)*100}%` }}></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}