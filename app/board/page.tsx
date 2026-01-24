// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export default function TVBoard() {
  const [preparing, setPreparing] = useState([]);
  const [ready, setReady] = useState([]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!supabase) return;
      
      // FIX: Changed 'updated_at' to 'created_at' to prevent database errors
      const { data, error } = await supabase
        .from('orders')
        .select('id, customer_name, status')
        .in('status', ['pending', 'pending_shipping', 'in_progress', 'partially_fulfilled', 'ready'])
        .order('created_at', { ascending: true }); // <--- CHANGED THIS

      if (error) {
        console.error("TV Board Error:", error);
      }

      if (data) {
        setPreparing(data.filter(o => ['pending', 'pending_shipping', 'in_progress', 'partially_fulfilled'].includes(o.status)));
        setReady(data.filter(o => o.status === 'ready'));
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans grid grid-cols-2">
      
      {/* LEFT: PREPARING */}
      <div className="border-r border-gray-700 p-8">
        <h1 className="text-4xl font-black uppercase text-yellow-400 mb-8 border-b-4 border-yellow-400 pb-4 tracking-wider flex items-center gap-3">
          🛠️ Preparing
        </h1>
        <div className="space-y-4">
          {preparing.length === 0 && <p className="text-gray-500 text-2xl italic">All caught up!</p>}
          {preparing.map(order => (
            <div key={order.id} className="flex items-center justify-between bg-gray-800 p-4 rounded-lg border border-gray-700">
              <span className="text-3xl font-bold text-gray-200 truncate">{order.customer_name}</span>
              <div className="flex gap-2">
                {order.status === 'partially_fulfilled' && <span className="bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded font-bold uppercase">Partial</span>}
                {order.status === 'pending_shipping' && <span className="bg-purple-900 text-purple-200 text-xs px-2 py-1 rounded font-bold uppercase">Ship</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: READY */}
      <div className="p-8 bg-green-900/10">
        <h1 className="text-4xl font-black uppercase text-green-400 mb-8 border-b-4 border-green-400 pb-4 tracking-wider flex items-center gap-3">
          ✅ Ready for Pickup
        </h1>
        <div className="grid grid-cols-1 gap-4">
          {ready.length === 0 && <p className="text-gray-500 text-2xl italic">Waiting for new orders...</p>}
          {ready.map(order => (
            <div key={order.id} className="bg-green-500 text-black text-4xl font-black p-6 rounded-xl shadow-lg transform scale-100 animate-pulse-slow flex justify-between items-center">
              <span>{order.customer_name}</span>
              <span className="text-xl">👉</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}