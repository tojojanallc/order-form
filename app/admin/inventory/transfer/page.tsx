'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function LoadTruck() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [warehouse, setWarehouse] = useState<any[]>([]);
  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'load' | 'history'>('load');
  
  const [selectedEvent, setSelectedEvent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [transferQty, setTransferQty] = useState<{ [key: string]: string }>({});
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    checkUser();
    fetchData();
    fetchLogs();
  }, []);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserEmail(user.email);
  }

  async function fetchData() {
    setLoading(true);
    const { data: inv } = await supabase.from('inventory_master').select('*').order('item_name');
    const { data: evts } = await supabase.from('event_settings').select('*').eq('status', 'active');
    setWarehouse(inv || []);
    setActiveEvents(evts || []);
    setLoading(false);
  }

  async function fetchLogs() {
    const { data } = await supabase
      .from('inventory_logs')
      .select('*, inventory_master(item_name, size)')
      .order('created_at', { ascending: false })
      .limit(50);
    setLogs(data || []);
  }

  const processTransfer = async (item: any) => {
    const qty = parseInt(transferQty[item.sku] || '0');
    if (!selectedEvent || qty <= 0) return alert("Select truck and enter qty.");

    setIsProcessing(true);
    try {
      // 1. Get current event stock
      const { data: existing } = await supabase.from('inventory').select('count').eq('event_slug', selectedEvent).eq('product_id', item.sku).eq('size', item.size).maybeSingle();

      // 2. UPSERT to Event Truck
      await supabase.from('inventory').upsert({
          event_slug: selectedEvent,
          product_id: item.sku,
          size: item.size,
          count: (existing?.count || 0) + qty,
          active: true,
          cost_price: item.cost_price || 0
      }, { onConflict: 'event_slug,product_id,size' });

      // 3. DEDUCT from Master Warehouse
      await supabase.from('inventory_master').update({ quantity_on_hand: item.quantity_on_hand - qty }).eq('sku', item.sku);

      // 4. CREATE LOG ENTRY (The Audit Trail)
      await supabase.from('inventory_logs').insert({
          sku: item.sku,
          event_slug: selectedEvent,
          quantity: qty,
          action_type: 'load_truck',
          user_email: userEmail
      });

      // Update UI
      setWarehouse(prev => prev.map(i => i.sku === item.sku ? { ...i, quantity_on_hand: i.quantity_on_hand - qty } : i));
      setTransferQty(prev => ({ ...prev, [item.sku]: '' }));
      fetchLogs();
      alert("🚛 Truck Loaded & Logged!");

    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-12">
            <div>
                <Link href="/admin" className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] hover:underline">← Command Center</Link>
                <h1 className="text-4xl font-black tracking-tight text-slate-900 mt-1">Truck Logistics</h1>
            </div>
            <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
                <button onClick={() => setActiveTab('load')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'load' ? 'bg-slate-900 text-white' : 'text-gray-400 hover:text-slate-900'}`}>Load Truck</button>
                <button onClick={() => setActiveTab('history')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-slate-900 text-white' : 'text-gray-400 hover:text-slate-900'}`}>Load History</button>
            </div>
        </div>

        {activeTab === 'load' ? (
          <>
            {/* CONTROLS AREA */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
                <div className="lg:col-span-4 bg-slate-900 p-8 rounded-[40px] shadow-2xl text-white">
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4">Target Destination</p>
                    <select className="w-full bg-slate-800 p-4 rounded-2xl border-none outline-none font-black text-blue-400 text-lg appearance-none" value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)}>
                        <option value="">-- Choose Truck --</option>
                        {activeEvents.map(evt => <option key={evt.id} value={evt.slug}>{evt.event_name}</option>)}
                    </select>
                </div>
                <div className="lg:col-span-8 bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm flex flex-col justify-center">
                    <input type="text" placeholder="Search Warehouse..." className="w-full p-5 pl-14 bg-gray-50 rounded-3xl border-none outline-none font-bold text-lg" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            </div>

            {/* WAREHOUSE LIST */}
            <div className="bg-white rounded-[48px] border border-gray-100 shadow-2xl overflow-hidden">
                <div className="grid grid-cols-12 bg-slate-100 p-6 px-10 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                    <div className="col-span-5">Warehouse Item</div>
                    <div className="col-span-2 text-center">In Stock</div>
                    <div className="col-span-5 text-right">Action</div>
                </div>
                <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                    {warehouse.filter(i => i.item_name.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                        <div key={item.sku} className="grid grid-cols-12 p-6 px-10 items-center hover:bg-blue-50/50 transition-colors">
                            <div className="col-span-5">
                                <h3 className="text-xl font-black text-slate-900 uppercase">{item.item_name}</h3>
                                <p className="text-[10px] font-bold text-blue-500 uppercase">{item.sku} • {item.size}</p>
                            </div>
                            <div className="col-span-2 text-center text-2xl font-black">{item.quantity_on_hand}</div>
                            <div className="col-span-5 flex justify-end gap-4">
                                <input type="number" placeholder="Qty" className="w-20 p-3 bg-gray-50 rounded-xl font-black text-center" value={transferQty[item.sku] || ''} onChange={(e) => setTransferQty({...transferQty, [item.sku]: e.target.value})} />
                                <button onClick={() => processTransfer(item)} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-green-600">Load 🚛</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </>
        ) : (
          /* HISTORY TAB */
          <div className="bg-white rounded-[48px] border border-gray-100 shadow-2xl overflow-hidden">
              <table className="w-full text-left">
                  <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                      <tr>
                          <th className="p-8">Timestamp</th>
                          <th className="p-8">User</th>
                          <th className="p-8">Item</th>
                          <th className="p-8">Destination</th>
                          <th className="p-8 text-right">Quantity</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                      {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                              <td className="p-8 text-[10px] font-bold text-gray-400">{new Date(log.created_at).toLocaleString()}</td>
                              <td className="p-8 text-xs font-black">{log.user_email || 'System'}</td>
                              <td className="p-8">
                                  <p className="font-black text-sm uppercase">{log.inventory_master?.item_name || log.sku}</p>
                                  <p className="text-[9px] text-blue-500 font-bold">SIZE {log.inventory_master?.size}</p>
                              </td>
                              <td className="p-8 text-xs font-bold text-slate-500 uppercase tracking-widest">{log.event_slug}</td>
                              <td className="p-8 text-right font-black text-green-600">+{log.quantity}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
        )}

      </div>
    </div>
  );
}
