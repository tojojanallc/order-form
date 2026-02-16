'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function EventHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    // 1. Get the list of events
    const { data, error } = await supabase
      .from('event_settings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error("Error loading events:", error.message);
    setHistory(data || []);
    setLoading(false);
  };

  const downloadCSV = async (slug) => {
    // 2. THIS IS THE FIX: We read from the 'order' table now
    // NOTE: Ensure your order table has a column named 'event_slug'. 
    // If it's named 'slug' or 'event_id', change .eq('event_slug', slug) below.
    const { data, error } = await supabase
      .from('order')  
      .select('*')
      .eq('event_slug', slug); 

    if (error) {
      alert("Error loading orders: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert("No orders found for this event in the 'order' table.");
      return;
    }

    // 3. Generate CSV
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => 
      Object.values(row).map(val => {
        // Handle objects/arrays (like items list) so they don't break the CSV
        if (typeof val === 'object' && val !== null) return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        return `"${val}"`;
      }).join(",")
    );
    const csvContent = [headers, ...rows].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}_orders.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 uppercase">Event History</h1>
          <Link href="/admin" className="text-sm font-bold text-blue-600 hover:underline">← DASHBOARD</Link>
        </div>

        {loading ? (
          <p className="text-center py-20 font-bold text-gray-400">LOADING HISTORY...</p>
        ) : history.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-300 p-20 rounded-2xl text-center">
            <p className="text-gray-500 font-bold">NO ARCHIVED EVENTS FOUND</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {history.map(event => (
              <div key={event.slug} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition-all">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{event.event_name}</h2>
                  <p className="text-xs font-mono text-gray-400">{event.slug}</p>
                  <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${event.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {event.status || 'Archived'}
                  </span>
                </div>
                <button 
                  onClick={() => downloadCSV(event.slug)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-sm"
                >
                  DOWNLOAD DATA
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}