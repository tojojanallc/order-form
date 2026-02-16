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
    // Fetch events and their total sales from the sales_ledger
    const { data, error } = await supabase
      .from('event_settings')
      .select(`
        slug, 
        event_name, 
        created_at,
        status
      `)
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    setHistory(data || []);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white text-black p-8 max-w-6xl mx-auto border-x-4 border-black">
      <div className="flex justify-between items-center mb-10 border-b-4 border-black pb-4">
        <div>
          <Link href="/admin" className="text-blue-600 font-black uppercase text-xs hover:underline">← Dashboard</Link>
          <h1 className="text-4xl font-black uppercase mt-2">Event Archive</h1>
        </div>
      </div>

      <div className="grid gap-6">
        {loading ? (
          <p className="font-black animate-pulse">RETRIVING ARCHIVES...</p>
        ) : history.length === 0 ? (
          <p className="text-gray-500 font-bold">No historical data found.</p>
        ) : (
          history.map(event => (
            <div key={event.slug} className="border-4 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex justify-between items-center bg-white">
              <div>
                <h2 className="text-2xl font-black uppercase">{event.event_name}</h2>
                <p className="font-bold text-gray-500">SLUG: {event.slug}</p>
                <p className="text-sm font-bold text-gray-400">{new Date(event.created_at).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <span className={`px-4 py-2 border-2 border-black font-black uppercase text-xs ${event.status === 'active' ? 'bg-green-400' : 'bg-gray-200'}`}>
                  {event.status}
                </span>
                <div className="mt-4">
                  <Link href={`/admin/reports/event?slug=${event.slug}`} className="text-blue-600 font-black uppercase text-sm underline">
                    View Full Report
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}