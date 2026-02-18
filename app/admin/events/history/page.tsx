'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';
import * as XLSX from 'xlsx';

export default function EventHistoryPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSimpleHistory();
  }, []);

  async function fetchSimpleHistory() {
    setLoading(true);
    
    // 1. Simple Fetch - No sorting by date yet to be safe
    const { data, error } = await supabase
      .from('event_settings')
      .select('*');

    if (error) {
      console.error("Error fetching events:", error);
      alert("Error loading events: " + error.message);
    }

    if (data) {
      setEvents(data);
    }
    setLoading(false);
  }

  // Excel Download (We keep this separate so it doesn't break the page load)
  const downloadReport = async (eventSlug: string, eventName: string) => {
    // Try to get orders for this event
    const { data: orders, error } = await supabase
        .from('orders') // Assumes table is named 'orders'
        .select('*')
        .eq('event_slug', eventSlug);

    if (error) return alert("Could not download: " + error.message);
    if (!orders || orders.length === 0) return alert("No orders found for " + eventName);

    const worksheet = XLSX.utils.json_to_sheet(orders);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales");
    XLSX.writeFile(workbook, `${eventName}_Sales.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        <div className="flex justify-between items-end mb-10">
          <div>
            <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block hover:underline">← Dashboard</Link>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Event Archive</h1>
            <p className="text-gray-500 font-medium">History for Schroeder, Nicolet, and other meets.</p>
          </div>
        </div>

        <div className="bg-white rounded-[40px] border border-gray-200 shadow-sm overflow-hidden">
             <table className="w-full text-left">
                <thead className="text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100 bg-white">
                    <tr>
                        <th className="p-6">Event Name</th>
                        <th className="p-6">Slug</th>
                        <th className="p-6 text-center">Status</th>
                        <th className="p-6 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {loading ? (
                        <tr><td colSpan={4} className="p-20 text-center font-bold text-gray-300 animate-pulse">LOADING...</td></tr>
                    ) : events.length === 0 ? (
                        <tr><td colSpan={4} className="p-20 text-center font-bold text-gray-400 italic">No events found in 'event_settings'.</td></tr>
                    ) : events.map(ev => (
                        <tr key={ev.id} className="group hover:bg-blue-50/30 transition-all">
                            <td className="p-6">
                                <div className="font-bold text-lg text-slate-900">{ev.event_name}</div>
                            </td>
                            <td className="p-6">
                                <span className="font-mono text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded">{ev.slug}</span>
                            </td>
                            <td className="p-6 text-center">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
                                    ${ev.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}
                                `}>
                                    {ev.status}
                                </span>
                            </td>
                            <td className="p-6 text-right">
                                <div className="flex gap-2 justify-end">
                                    <button 
                                        onClick={() => downloadReport(ev.slug, ev.event_name)}
                                        className="px-4 py-2 rounded-xl bg-white border border-green-200 text-green-600 font-black text-[10px] uppercase tracking-widest hover:bg-green-50 transition-colors shadow-sm"
                                    >
                                        Download Excel
                                    </button>
                                </div>
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