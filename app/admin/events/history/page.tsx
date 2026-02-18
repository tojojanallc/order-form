'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function EventHistoryPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    setLoading(true);
    setErrorMsg('');
    
    // CHANGED: Removed 'location' from this select query to fix the error
    const { data, error } = await supabase
      .from('event_settings')
      .select('id, slug, event_name, status') 
      .order('event_name', { ascending: true });

    if (error) {
      console.error("Error loading events:", error);
      setErrorMsg(error.message);
    } else {
      setEvents(data || []);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex justify-between items-end mb-10">
          <div>
            <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block hover:underline">← Dashboard</Link>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Event Archive</h1>
            <p className="text-gray-500 font-medium">Performance history & configurations.</p>
          </div>
          <button onClick={fetchHistory} className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-xs font-bold uppercase hover:bg-gray-100">
            Refresh List
          </button>
        </div>

        {errorMsg && (
             <div className="bg-red-50 border border-red-200 p-6 rounded-3xl mb-8">
                <h3 className="text-red-600 font-black uppercase text-sm mb-1">Database Error</h3>
                <p className="text-red-800 font-medium">{errorMsg}</p>
             </div>
        )}

        <div className="bg-white rounded-[40px] border border-gray-200 shadow-sm overflow-hidden">
             <table className="w-full text-left">
                <thead className="text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100 bg-white">
                    <tr>
                        <th className="p-6">Event Name</th>
                        <th className="p-6">Slug (ID)</th>
                        <th className="p-6 text-center">Status</th>
                        <th className="p-6 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {loading ? (
                        <tr><td colSpan={4} className="p-20 text-center font-bold text-gray-300 animate-pulse">LOADING ARCHIVE...</td></tr>
                    ) : events.length === 0 ? (
                        <tr><td colSpan={4} className="p-20 text-center font-bold text-gray-400 italic">No events found.</td></tr>
                    ) : events.map(ev => (
                        <tr key={ev.id} className="group hover:bg-blue-50/30 transition-all">
                            <td className="p-6">
                                <div className="font-black text-lg text-slate-900">{ev.event_name}</div>
                            </td>
                            <td className="p-6">
                                <span className="font-mono text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                    {ev.slug}
                                </span>
                            </td>
                            <td className="p-6 text-center">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
                                    ${ev.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}
                                `}>
                                    {ev.status || 'Archived'}
                                </span>
                            </td>
                            <td className="p-6 text-right">
                                <Link 
                                    href={`/admin/events/history/${ev.slug}`}
                                    className="px-6 py-3 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-colors shadow-lg inline-block"
                                >
                                    View Dashboard
                                </Link>
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
        </div>
      </div>
    </div>
  );
}