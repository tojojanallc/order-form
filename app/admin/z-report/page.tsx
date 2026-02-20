'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase';
import Link from 'next/link';

export default function ZReportDashboard() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventSlug, setSelectedEventSlug] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Cash Drawer State
  const [startingCash, setStartingCash] = useState<number>(100);
  const [actualCashCounted, setActualCashCounted] = useState<number | string>('');

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventSlug) {
      fetchOrders();
    }
  }, [selectedEventSlug]);

  async function fetchEvents() {
    setLoading(true);
    // FIX: Changed order('created_at') to order('id') to match your schema
    const { data, error } = await supabase
      .from('event_settings')
      .select('*')
      .order('id');

    if (error) console.error("Error loading events:", error);

    if (data && data.length > 0) {
      setEvents(data);
      const active = data.find(e => e.status === 'active');
      setSelectedEventSlug(active ? active.slug : data[0].slug);
    }
    setLoading(false);
  }

  async function fetchOrders() {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*') // Pulling everything just to be safe
      .eq('event_slug', selectedEventSlug);

    if (error) console.error("Error loading orders:", error);
    if (data) setOrders(data);
    setLoading(false);
  }

  // --- RECONCILIATION MATH ---
  const validOrders = orders.filter(o => o.status !== 'refunded' && o.status !== 'incomplete');
  
  const cashOrders = validOrders.filter(o => o.payment_method === 'cash');
  const cardOrders = validOrders.filter(o => o.payment_method !== 'cash');

  const totalCashSales = cashOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);
  const totalCardSales = cardOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);
  const grandTotalSales = totalCashSales + totalCardSales;

  const expectedCashInDrawer = startingCash + totalCashSales;
  const variance = Number(actualCashCounted) - expectedCashInDrawer;
  
  const isBalanced = actualCashCounted !== '' && variance === 0;
  const isOver = actualCashCounted !== '' && variance > 0;
  const isShort = actualCashCounted !== '' && variance < 0;

  return (
    <div className="min-h-screen bg-slate-100 p-8 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-gray-300 pb-6">
          <div>
            <Link href="/admin" className="text-[10px] font-black uppercase text-blue-600 tracking-widest hover:underline">← Command Center</Link>
            <h1 className="text-4xl font-black tracking-tight mt-1 uppercase flex items-center gap-3">
              <span>🧾</span> Z-Report
            </h1>
          </div>
          
          <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-3">Event:</span>
            <select 
              className="bg-gray-50 border border-gray-200 text-sm font-bold rounded-lg py-2 px-4 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedEventSlug || ''}
              onChange={(e) => setSelectedEventSlug(e.target.value)}
            >
              {events.map(evt => (
                <option key={evt.id} value={evt.slug}>
                  {evt.event_name} {evt.status === 'archived' ? '(Archived)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
           <div className="text-center py-20 font-black text-gray-400 uppercase tracking-widest">Calculating Till...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            <div className="space-y-6">
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-200">
                    <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-6">Gross Sales Breakdown</h2>
                    
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                        <span className="font-bold text-gray-600">Card / Terminal Sales ({cardOrders.length})</span>
                        <span className="text-xl font-black text-slate-800">${totalCardSales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                        <span className="font-bold text-emerald-600">Cash Sales ({cashOrders.length})</span>
                        <span className="text-xl font-black text-emerald-600">${totalCashSales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-6">
                        <span className="font-black uppercase tracking-widest text-sm text-gray-800">Total Net Sales</span>
                        <span className="text-3xl font-black text-blue-900">${grandTotalSales.toFixed(2)}</span>
                    </div>
                </div>

                <div className="bg-slate-900 text-white rounded-[32px] p-8 shadow-xl">
                    <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6 border-b border-slate-700 pb-4">Cash Drawer Math</h2>
                    
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-bold text-slate-300">Starting Till (Morning)</span>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-bold">$</span>
                            <input 
                                type="number" 
                                className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-2 text-right font-black outline-none focus:border-blue-500"
                                value={startingCash}
                                onChange={(e) => setStartingCash(Number(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-center mb-6">
                        <span className="font-bold text-slate-300">+ New Cash Received</span>
                        <span className="text-xl font-black text-emerald-400">${totalCashSales.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center pt-6 border-t border-slate-700">
                        <span className="font-black uppercase tracking-widest text-sm text-blue-400">Expected In Box</span>
                        <span className="text-4xl font-black text-white">${expectedCashInDrawer.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div>
                <div className={`rounded-[32px] p-8 shadow-2xl border-4 transition-all duration-500 ${isBalanced ? 'bg-emerald-50 border-emerald-400' : isOver ? 'bg-blue-50 border-blue-400' : isShort ? 'bg-red-50 border-red-400' : 'bg-white border-transparent'}`}>
                    <h2 className="text-sm font-black uppercase text-slate-800 tracking-widest mb-2">End of Day Count</h2>
                    <p className="text-slate-500 text-sm font-medium mb-8">Count the physical cash in your box and type it below to reconcile your drawer.</p>
                    
                    <div className="relative mb-8">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-4xl font-black text-slate-300">$</span>
                        <input 
                            type="number"
                            placeholder="0.00"
                            className="w-full bg-white border-2 border-gray-200 rounded-[24px] py-8 pl-16 pr-8 text-5xl font-black text-slate-900 outline-none focus:border-slate-900 transition-colors shadow-inner"
                            value={actualCashCounted}
                            onChange={(e) => setActualCashCounted(e.target.value)}
                        />
                    </div>

                    <div className="h-32 flex items-center justify-center">
                        {actualCashCounted === '' ? (
                            <div className="text-slate-300 font-black uppercase tracking-widest text-xl">Awaiting Count...</div>
                        ) : isBalanced ? (
                            <div className="text-center">
                                <div className="text-5xl mb-2">🎉</div>
                                <div className="text-emerald-600 font-black uppercase tracking-widest text-xl">Perfectly Balanced</div>
                            </div>
                        ) : isOver ? (
                            <div className="text-center">
                                <div className="text-blue-600 font-black uppercase tracking-widest text-xl mb-1">Till is Over</div>
                                <div className="text-3xl font-black text-blue-700">+ ${Math.abs(variance).toFixed(2)}</div>
                            </div>
                        ) : (
                            <div className="text-center">
                                <div className="text-red-600 font-black uppercase tracking-widest text-xl mb-1">Till is Short</div>
                                <div className="text-3xl font-black text-red-700">- ${Math.abs(variance).toFixed(2)}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}