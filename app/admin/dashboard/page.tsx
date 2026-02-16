"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function PostEventDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState('all');

  useEffect(() => {
    async function getOrders() {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setOrders(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    getOrders();
  }, []);

  const filteredOrders = selectedEvent === 'all' 
    ? orders 
    : orders.filter(o => o.event_slug === selectedEvent);

  const totalRevenue = filteredOrders.reduce((acc, curr) => acc + (Number(curr.total_price) || 0), 0);
  const uniqueEvents = Array.from(new Set(orders.map(o => o.event_slug))).filter(Boolean);

  if (loading) return <div className="p-10">Loading...</div>;

  return (
    <div className="p-8 bg-white min-h-screen text-black">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Event Dashboard</h1>
        <select 
          className="border p-2 rounded"
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
        >
          <option value="all">All Events</option>
          {uniqueEvents.map((slug: any) => (
            <option key={slug} value={slug}>{slug}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="border p-6 rounded shadow">
          <p className="text-sm text-gray-500 uppercase">Revenue</p>
          <p className="text-3xl font-bold">${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="border p-6 rounded shadow">
          <p className="text-sm text-gray-500 uppercase">Total Orders</p>
          <p className="text-3xl font-bold">{filteredOrders.length}</p>
        </div>
      </div>

      <div className="border rounded overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-4">Customer</th>
              <th className="p-4">Event</th>
              <th className="p-4">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.id} className="border-t">
                <td className="p-4">{order.customer_name}</td>
                <td className="p-4">{order.event_slug}</td>
                <td className="p-4">${order.total_price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}