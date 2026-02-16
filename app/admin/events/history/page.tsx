'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function EventHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      // We are removing ALL filters. If it's in the table, it WILL show up.
      const { data, error } = await supabase
        .from('event_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) console.error("Database Error:", error.message);
      setHistory(data || []);
      setLoading(false);
    };

    fetchHistory();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 uppercase">Event History</h1>
          <Link href="/admin" className="text-sm font-bold text-blue-600 hover:underline">← DASHBOARD</Link>
        </div>

        {loading ? (
          <p className="text-center py-20 font-bold text-gray-400">LOADING DATABASE...</p>
        ) : history.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-300 p-20 rounded-2xl text-center">
            <p className="text-gray-500 font-bold">ZERO EVENTS FOUND IN 'event_settings'</p>
            <p className="text-xs text-gray-400 mt-2 italic">Check your Supabase table for data.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {history.map(event => (
              <div key={event.slug} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{event.event_name}</h2>
                  <p className="text-xs font-mono text-gray-400">{event.slug}</p>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded bg-gray-100 text-[10px] font-bold uppercase text-gray-500">
                    {event.status || 'No Status'}
                  </span>
                </div>
                <div className="text-sm font-bold text-gray-400">
                  {new Date(event.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}