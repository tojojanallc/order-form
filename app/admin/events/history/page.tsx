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

  const fetchHistory = async (statusFilter = '') => {
    setLoading(true);
    let query = supabase
      .from('event_settings')
      .select('slug, event_name, created_at, status')
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) console.error(error);
    setHistory(data || []);
    setLoading(false);
  };

  const downloadEventData = async (slug, name) => {
    // Fetch all sales for this specific event
    const { data, error } = await supabase
      .from('sales_ledger')
      .select('*')
      .eq('event_slug', slug);

    if (error || !data || data.length === 0) {
      alert("No sales data found for this event to export.");
      return;
    }

    // Convert JSON to CSV
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => 
      Object.values(row).map(val => `"${val}"`).join(",")
    );
    const csvContent = [headers, ...rows].join("\n");

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}_sales_export.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-white text-black p-8 max-w-6xl mx-auto border-x-4 border-black">
      <div className="flex justify-between items-center mb-10 border-b-4 border-black pb-4">
        <div>
          <Link href="/admin" className="text-blue-600 font-black uppercase text-xs hover:underline">← Dashboard</Link>
          <h1 className="text-4xl font-black uppercase mt-2">Event Archive</h1>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        <button onClick={() => fetchHistory('')} className="bg-black text-white px-4 py-2 font-black text-xs uppercase">All</button>
        <button onClick={() => fetchHistory('active')} className="border-2 border-black px-4 py-2 font-black text-xs uppercase hover:bg-gray-100">Active</button>
        <button onClick={() => fetchHistory('archived')} className="border-2 border-black px-4 py-2 font-black text-xs uppercase hover:bg-gray-100">Archived</button>
      </div>

      <div className="grid gap-6">
        {loading ? (
          <p className="font-black animate-pulse">EXTRACTING HISTORICAL DATA...</p>
        ) : (
          history.map(event => (
            <div key={event.slug} className="border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex justify-between items-center bg-white">
              <div>
                <h2 className="text-2xl font-black uppercase">{event.event_name}</h2>
                <p className="font-bold text-gray-500">SLUG: {event.slug}</p>
                <p className="text-sm font-bold text-gray-400">{new Date(event.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-col gap-3 items-end">
                <span className={`px-3 py-1 border-2 border-black font-black uppercase text-[10px] ${event.status === 'active' ? 'bg-green-400' : 'bg-gray-200'}`}>
                  {event.status}
                </span>
                <button 
                  onClick={() => downloadEventData(event.slug, event.event_name)}
                  className="bg-blue-600 text-white px-4 py-2 font-black uppercase text-xs border-2 border-black shadow-[2px_2px_0px_0px_black] hover:bg-blue-700 active:translate-y-0.5"
                >
                  Download CSV
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}