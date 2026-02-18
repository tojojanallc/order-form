'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function EventHistoryPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    setLoading(true);
    // Fetch event settings to see names, dates, and active add-ons
    const { data, error } = await supabase
      .from('event_settings')
      .select('*')
      .order('start_date', { ascending: false });

    if (data) setEvents(data);
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
        </div>

        <div className="bg-white rounded-[40px] border border-gray-200 shadow-sm overflow-hidden">
             <table className="w-full text-left">
                <thead className="text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100 bg-white">
                    <tr>
                        <th className="p-6">Event Details</th>
                        <th className="p-6">Configuration & Add-ons</th>
                        <th className="p-6 text-center">Status</th>
                        <th className="p-6 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {loading ? (
                        <tr><td colSpan={4} className="p-20 text-center font-bold text-gray-300 animate-pulse">LOADING ARCHIVE...</td></tr>
                    ) : events.map(ev => (
                        <tr key={ev.id} className="group hover:bg-blue-50/30 transition-all">
                            <td className="p-6">
                                <div className="font-black text-lg text-slate-900">{ev.event_name}</div>
                                <div className="text-[10px] font-mono text-blue-500 font-bold uppercase mb-1">{ev.slug}</div>
                                <div className="text-xs font-bold text-gray-400">{ev.location || 'No Location Set'}</div>
                            </td>
                            
                            <td className="p-6">
                                <div className="flex flex-wrap gap-2">
                                    {/* Displaying Add-ons/Features if they exist as boolean flags */}
                                    {ev.enable_custom_names && (
                                        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide">
                                            Custom Names
                                        </span>
                                    )}
                                    {ev.enable_heat_sheets && (
                                        <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide">
                                            Heat Sheets
                                        </span>
                                    )}
                                    {/* If no specific flags, show generic config badge */}
                                    <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide">
                                        Standard Config
                                    </span>
                                </div>
                            </td>

                            <td className="p-6 text-center">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
                                    ${ev.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}
                                `}>
                                    {ev.status}
                                </span>
                            </td>

                            <td className="p-6 text-right">
                                <Link 
                                    href={`/admin/events/history/${ev.slug}`}
                                    className="px-6 py-3 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-colors shadow-lg"
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