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
        
        {/* 1. CREATE PO (Buy) */}
        <Link href="/admin/purchasing/create" className="group">
          <div className="bg-white hover:bg-orange-50 border border-gray-200 hover:border-orange-300 p-8 rounded-xl transition-all cursor-pointer h-full">
            <div className="bg-orange-100 w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">🛒</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Create PO</h3>
            <p className="text-gray-500 text-sm">Order new stock from vendors. Generates PO #.</p>
          </div>
        </Link>

        {/* 2. RECEIVE PO (Inbound) */}
        <Link href="/admin/purchasing/receive" className="group">
          <div className="bg-white hover:bg-green-50 border border-gray-200 hover:border-green-300 p-8 rounded-xl transition-all cursor-pointer h-full relative">
            {stats.openPOs > 0 && <div className="absolute top-4 right-4 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">{stats.openPOs} Pending</div>}
            <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">📦</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Receive Stock</h3>
            <p className="text-gray-500 text-sm">Scan incoming boxes against Open POs. Updates Warehouse.</p>
          </div>
        </Link>

        {/* 3. LOAD OUT (Transfer) */}
        <Link href="/admin/inventory/transfer" className="group">
          <div className="bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 p-8 rounded-xl transition-all cursor-pointer h-full">
            <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">🚚</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Load Truck</h3>
            <p className="text-gray-500 text-sm">Transfer stock from Warehouse to a specific Event Kiosk.</p>
          </div>
        </Link>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 4. RECONCILE (Return) */}
        <Link href="/admin/inventory/reconcile" className="group">
          <div className="bg-white hover:bg-purple-50 border border-gray-200 hover:border-purple-300 p-8 rounded-xl transition-all cursor-pointer h-full">
            <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">↩️</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Reconcile Event</h3>
            <p className="text-gray-500 text-sm">Count unsold items, return to warehouse, and close event.</p>
          </div>
        </Link>

        {/* 5. WRITE OFF (Adjust) */}
        <Link href="/admin/inventory/adjust" className="group">
            <div className="bg-white hover:bg-red-50 border border-gray-200 hover:border-red-300 p-8 rounded-xl transition-all cursor-pointer h-full">
                <div className="bg-red-100 w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">🗑️</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Write Offs</h3>
                <p className="text-gray-500 text-sm">Remove damaged goods or correct stock counts manually.</p>
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