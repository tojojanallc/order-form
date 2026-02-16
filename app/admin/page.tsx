'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../supabase'; 

export default function MasterAdmin() {
  const [stats, setStats] = useState({
    totalStock: 0,
    lowStockItems: 0,
    activeEvents: 0,
    todaysRevenue: 0,
    openPOs: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      // 1. Inventory Health
      const { data: inventory } = await supabase.from('inventory_master').select('quantity_on_hand');
      const totalStock = inventory?.reduce((sum, i) => sum + i.quantity_on_hand, 0) || 0;
      const lowStockItems = inventory?.filter(i => i.quantity_on_hand < 10).length || 0;

      // 2. Active Events
      const { data: events } = await supabase.from('event_settings').select('slug');
      
      // 3. Today's Revenue
      const today = new Date().toISOString().split('T')[0];
      const { data: sales } = await supabase.from('sales_ledger').select('sale_price').gte('sold_at', today);
      const revenue = sales?.reduce((sum, s) => sum + s.sale_price, 0) || 0;

      // 4. Open POs (New Stat)
      const { count: openPOCount } = await supabase.from('purchases').select('*', { count: 'exact', head: true }).eq('status', 'ordered');

      setStats({ 
        totalStock, 
        lowStockItems, 
        activeEvents: events?.length || 0, 
        todaysRevenue: revenue,
        openPOs: openPOCount || 0
      });
    };

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black text-gray-900">Command Center</h1>
          <p className="text-gray-500">Lev Custom Merch Operations</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-gray-400 uppercase">Today's Revenue</div>
          <div className="text-3xl font-bold text-green-600">${stats.todaysRevenue.toLocaleString()}</div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="text-gray-400 text-xs font-bold uppercase mb-1">Total Inventory</div>
          <div className="text-3xl font-bold text-blue-900">{stats.totalStock}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="text-gray-400 text-xs font-bold uppercase mb-1">Low Stock Alerts</div>
          <div className={`text-3xl font-bold ${stats.lowStockItems > 0 ? 'text-red-600' : 'text-gray-900'}`}>{stats.lowStockItems}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="text-gray-400 text-xs font-bold uppercase mb-1">Open POs</div>
          <div className="text-3xl font-bold text-orange-600">{stats.openPOs}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="text-gray-400 text-xs font-bold uppercase mb-1">Active Events</div>
          <div className="text-3xl font-bold text-purple-900">{stats.activeEvents}</div>
        </div>
      </div>

      {/* OPERATIONS LINKS (The "Big Buttons") */}
      <h2 className="text-xl font-bold text-gray-800 mb-6">Inventory Operations</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-8 bg-white">
  
  {/* MANAGE POs */}
  <Link href="/admin/purchasing/list" className="border-4 border-black p-6 shadow-[8px_8px_0px_0px_black] bg-white hover:bg-gray-50 transition-all group flex flex-col justify-between h-full">
    <div>
      <div className="flex justify-between items-start">
        <h2 className="text-2xl font-black uppercase leading-tight text-black">Manage POs</h2>
        <span className="text-3xl">📋</span>
      </div>
      <p className="mt-4 font-bold text-gray-500 uppercase text-[10px] tracking-widest leading-relaxed">
        View history, check status, or cancel open orders.
      </p>
    </div>
  </Link>

  {/* RECEIVE STOCK */}
  <Link href="/admin/purchasing/receive" className="border-4 border-black p-6 shadow-[8px_8px_0px_0px_black] bg-white hover:bg-gray-50 transition-all group flex flex-col justify-between h-full">
    <div>
      <div className="flex justify-between items-start">
        <h2 className="text-2xl font-black uppercase leading-tight text-black">Receive Stock</h2>
        <span className="text-3xl">📦</span>
      </div>
      <p className="mt-4 font-bold text-gray-500 uppercase text-[10px] tracking-widest leading-relaxed">
        Scan incoming boxes against Open POs. Updates Warehouse.
      </p>
    </div>
  </Link>

  {/* LOAD TRUCK */}
  <Link href="/admin/inventory/transfer" className="border-4 border-black p-6 shadow-[8px_8px_0px_0px_black] bg-white hover:bg-gray-50 transition-all group flex flex-col justify-between h-full">
    <div>
      <div className="flex justify-between items-start">
        <h2 className="text-2xl font-black uppercase leading-tight text-black">Load Truck</h2>
        <span className="text-3xl">🚛</span>
      </div>
      <p className="mt-4 font-bold text-gray-500 uppercase text-[10px] tracking-widest leading-relaxed">
        Transfer stock from Warehouse to a specific Event Kiosk.
      </p>
    </div>
  </Link>

  {/* RECONCILE EVENT */}
  <Link href="/admin/inventory/reconcile" className="border-4 border-black p-6 shadow-[8px_8px_0px_0px_black] bg-white hover:bg-gray-50 transition-all group flex flex-col justify-between h-full">
    <div>
      <div className="flex justify-between items-start">
        <h2 className="text-2xl font-black uppercase leading-tight text-black">Reconcile Event</h2>
        <span className="text-3xl">🔄</span>
      </div>
      <p className="mt-4 font-bold text-gray-500 uppercase text-[10px] tracking-widest leading-relaxed">
        Count unsold items, return stock to warehouse, and close out the event.
      </p>
    </div>
  </Link>

  {/* EVENT ARCHIVE */}
  <Link href="/admin/events/history" className="border-4 border-black p-6 shadow-[8px_8px_0px_0px_black] bg-white hover:bg-gray-50 transition-all group flex flex-col justify-between h-full">
    <div>
      <div className="flex justify-between items-start">
        <h2 className="text-2xl font-black uppercase leading-tight text-black">Event Archive</h2>
        <span className="text-3xl">📁</span>
      </div>
      <p className="mt-4 font-bold text-gray-500 uppercase text-[10px] tracking-widest leading-relaxed">
        View past events, download CSV sales data, and manage historical records.
      </p>
    </div>
  </Link>

  {/* ADJUST STOCK */}
  <Link href="/admin/inventory/adjust" className="border-4 border-black p-6 shadow-[8px_8px_0px_0px_black] bg-white hover:bg-gray-50 transition-all group flex flex-col justify-between h-full">
    <div>
      <div className="flex justify-between items-start">
        <h2 className="text-2xl font-black uppercase leading-tight text-black">Adjust Stock</h2>
        <span className="text-3xl">🗑️</span>
      </div>
      <p className="mt-4 font-bold text-gray-500 uppercase text-[10px] tracking-widest leading-relaxed">
        Remove damaged goods, correct physical counts, or record write-offs.
      </p>
    </div>
  </Link>

</div>

      {/* Legacy/Event Management Section */}
      <div className="mt-12 border-t pt-10">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Event Configuration</h2>
        <div className="bg-white p-6 rounded-xl border border-gray-200 flex justify-between items-center">
           <div>
              <h3 className="font-bold text-gray-900">Event Settings Manager</h3>
              <p className="text-gray-500 text-sm">Manage logos, colors, payment modes, and themes.</p>
           </div>
           <Link href="/admin/events" className="bg-gray-900 text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-800">
              Manage Events →
           </Link>
        </div>
      </div>
    </div>
  );
}