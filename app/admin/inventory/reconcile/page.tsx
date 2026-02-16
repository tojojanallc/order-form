'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function Reconcile() {
  const [events, setEvents] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState('');

  useEffect(() => {
    // Get events to close
    supabase.from('event_settings').select('slug, event_name').then(({ data }) => setEvents(data || []));
  }, []);

  const closeEventEntirely = async () => {
    if (!selectedSlug) return alert("Select an event first.");
    
    const confirmClose = confirm(`This will PERMANENTLY wipe the kiosk stock for this event. It will not move back to warehouse. Proceed?`);
    if (!confirmClose) return;

    // 1. Delete all inventory tied to this specific event slug
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('event_slug', selectedSlug);

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("Event Closed and Kiosk Stock Cleared.");
      setSelectedSlug('');
    }
  };

  return (
    <div className="min-h-screen bg-white text-black p-8 max-w-4xl mx-auto border-x-4 border-black">
      <div className="flex justify-between items-center mb-10 border-b-4 border-black pb-4">
        <div>
          <Link href="/admin" className="text-blue-600 font-black uppercase text-xs hover:underline">← Dashboard</Link>
          <h1 className="text-4xl font-black uppercase mt-2">Close Events</h1>
        </div>
      </div>

      <div className="bg-gray-100 p-8 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h2 className="text-2xl font-black mb-4 uppercase">Select Weekend Event</h2>
        <select 
          className="w-full p-4 border-2 border-black font-bold text-xl mb-6"
          value={selectedSlug}
          onChange={(e) => setSelectedSlug(e.target.value)}
        >
          <option value="">-- Choose Event --</option>
          {events.map(e => (
            <option key={e.slug} value={e.slug}>{e.event_name}</option>
          ))}
        </select>

        <button 
          onClick={closeEventEntirely}
          className="w-full bg-black text-white py-6 font-black uppercase text-2xl hover:bg-red-600 transition-colors"
        >
          Wipe Event Stock & Close
        </button>
        <p className="mt-4 text-xs font-bold text-gray-500 text-center uppercase italic">
          *Note: This does not affect your Warehouse Master list or Sales records.
        </p>
      </div>
    </div>
  );
}