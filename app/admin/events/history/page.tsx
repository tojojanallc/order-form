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
    // Removed the .eq('status', 'archived') filter so you see EVERYTHING
    const { data, error } = await supabase
      .from('event_settings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error("Database Error:", error);
    setHistory(data || []);
    setLoading(false);
  };

  const downloadCSV = async (slug) => {
    const { data, error } = await supabase
      .from('sales_ledger')
      .select('*')
      .eq('event_slug', slug);

    if (error || !data || data.length === 0) {
      return alert("No sales data found for this event slug in the sales_ledger.");
    }

    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(","));
    const csvContent = [headers, ...rows].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}_final_sales.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-black text-gray-900 uppercase italic">Event History</h1>
          <Link href="/admin" className="bg-white border-2 border-black px-4 py-2 font-bold text-xs hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_0px_black]">
            ← BACK
          </Link>
        </div>

        {loading ? (
          <div className="p-20 text-center font-black text-gray-400 animate-pulse uppercase">Searching Archives...</div>
        ) : history.length === 0 ? (
          <div className="bg-white border-4 border-black p-16 text-center shadow-[8px_8px_0px_0px_black]">
            <p className="text-xl font-bold uppercase text-gray-400">No Events Found in Database</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map(event => (
              <div key={event.slug} className="bg-white border-4 border-black p-6 flex justify-between items-center shadow-[4px_4px_0px_0px_black] hover:translate-x-1 hover:-translate-y-1 transition-all">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">{event.event_name}</h2>
                  <p className="text-xs font-bold text-blue-600 font-mono uppercase">{event.slug}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 border-2 border-black text-[10px] font-black uppercase ${event.status === 'active' ? 'bg-green-400' : 'bg-gray-200'}`}>
                    {event.status || 'Archived'}
                  </span>
                  <button 
                    onClick={() => downloadCSV(event.slug)}
                    className="bg-black text-white px-6 py-3 font-black text-xs uppercase hover:bg-blue-600 transition-colors"
                  >
                    Export CSV
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}