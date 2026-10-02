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
  const [event, setEvent] = useState(null);

  useEffect(() => {
    // One event only: ?event=slug, else /board/slug, else the iPad's last kiosk event, else the active event
    let slug = '';
    const resolveSlug = async () => {
      if (slug) return slug;
      const qs = new URLSearchParams(window.location.search).get('event');
      const parts = window.location.pathname.split('/').filter(Boolean);
      slug = qs || (parts.length > 1 ? parts[parts.length - 1] : '') || localStorage.getItem('event_slug') || '';
      if (!slug || slug === 'default') {
        const { data } = await supabase.from('event_settings').select('slug').eq('status', 'active').order('id', { ascending: false }).limit(1).single();
        slug = data?.slug || '';
      }
      const { data: ev } = await supabase.from('event_settings').select('slug, event_name, event_logo_url, header_color').eq('slug', slug).single();
      setEvent(ev || { slug });
      return slug;
    };
    const fetchOrders = async () => {
      if (!supabase) return;
      const eventSlug = await resolveSlug();
      if (!eventSlug) return;

      // Pickup only — ship-to-home orders aren't collected at the table
      const { data, error } = await supabase
        .from('orders')
        .select('id, customer_name, status')
        .eq('event_slug', eventSlug)
        .in('status', ['pending', 'in_progress', 'partially_fulfilled', 'ready'])
        .order('created_at', { ascending: true });

      if (error) {
        console.error("TV Board Error:", error);
      }

      if (data) {
        setPreparing(data.filter(o => ['pending', 'in_progress', 'partially_fulfilled'].includes(o.status)));
        setReady(data.filter(o => o.status === 'ready'));
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col">
      <div className="flex items-center justify-between px-8 py-4" style={{ backgroundColor: event?.header_color || '#0a2342' }}>
        <div className="flex items-center gap-4">
          {event?.event_logo_url && <img src={event.event_logo_url} alt="" className="h-14 object-contain" />}
          <span className="text-3xl font-black tracking-tight">{event?.event_name || ''}</span>
        </div>
        <img src="https://levcustom.com/logo_white.png" alt="Lev Custom Merch" className="h-10 opacity-90" onError={e => { e.currentTarget.style.display = 'none'; }} />
      </div>
      <div className="grid grid-cols-2 flex-1">
      
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

    </div>
  );
}