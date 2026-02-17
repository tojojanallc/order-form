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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8 bg-gray-50">
  
  {/* ROW 1: PURCHASING & LOGISTICS */}
  <Link href="/admin/purchasing/manage/" className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col justify-between h-full group">
    <div>
      <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        <span className="text-2xl">📋</span>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Manage POs</h2>
      <p className="text-gray-500 text-sm leading-relaxed">View history, check status, or cancel open orders.</p>
    </div>
  </Link>

  <Link href="/admin/purchasing/receive" className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col justify-between h-full group">
    <div>
      <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        <span className="text-2xl">📦</span>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Receive Stock</h2>
      <p className="text-gray-500 text-sm leading-relaxed">Scan incoming boxes against Open POs. Updates Warehouse.</p>
    </div>
  </Link>

  <Link href="/admin/inventory/transfer" className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col justify-between h-full group">
    <div>
      <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        <span className="text-2xl">🚛</span>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Load Truck</h2>
      <p className="text-gray-500 text-sm leading-relaxed">Transfer stock from Warehouse to a specific Event Kiosk.</p>
    </div>
  </Link>

  {/* ROW 2: EVENT MANAGEMENT & ADJUSTMENTS */}
  <Link href="/admin/inventory/reconcile" className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col justify-between h-full group">
    <div>
      <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        <span className="text-2xl">🔄</span>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Reconcile Event</h2>
      <p className="text-gray-500 text-sm leading-relaxed">Count unsold items, return stock to warehouse, and close event.</p>
    </div>
  </Link>

  <Link href="/admin/events/history" className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col justify-between h-full group">
    <div>
      <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        <span className="text-2xl">📁</span>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Event Archive</h2>
      <p className="text-gray-500 text-sm leading-relaxed">View past events, download CSV sales data, and manage historical records.</p>
    </div>
  </Link>

  <Link href="/admin/inventory/adjust" className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col justify-between h-full group">
    <div>
      <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        <span className="text-2xl">🗑️</span>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Write Offs</h2>
      <p className="text-gray-500 text-sm leading-relaxed">Remove damaged goods or correct stock counts manually.</p>
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