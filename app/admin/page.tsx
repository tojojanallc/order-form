'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/supabase';

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
      // 1. Inventory Health from inventory_master
      const { data: inventory } = await supabase.from('inventory_master').select('quantity_on_hand');
      const totalStock = inventory?.reduce((sum, i) => sum + i.quantity_on_hand, 0) || 0;
      const lowStockItems = inventory?.filter(i => i.quantity_on_hand < 10).length || 0;

      // 2. Active Events
      const { data: events } = await supabase.from('event_settings').select('slug').eq('status', 'active');
      
      // 3. Today's Revenue (Estimate from orders for simplicity)
      const today = new Date().toISOString().split('T')[0];
      const { data: sales } = await supabase.from('orders').select('total_price').gte('created_at', today);
      const revenue = sales?.reduce((sum, s) => sum + (Number(s.total_price) || 0), 0) || 0;

      // 4. Open POs
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
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Command Center</h1>
          <p className="text-gray-500 font-medium">Lev Custom Merch Operations</p>
        </div>
        <div className="text-right bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Today's Sales</div>
          <div className="text-3xl font-black text-green-600">${stats.todaysRevenue.toLocaleString()}</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="text-gray-400 text-xs font-bold uppercase mb-1">Warehouse Units</div>
          <div className="text-3xl font-black text-blue-900">{stats.totalStock.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="text-gray-400 text-xs font-bold uppercase mb-1">Low Stock Alerts</div>
          <div className={`text-3xl font-black ${stats.lowStockItems > 0 ? 'text-red-600' : 'text-gray-900'}`}>{stats.lowStockItems}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="text-gray-400 text-xs font-bold uppercase mb-1">Incoming POs</div>
          <div className="text-3xl font-black text-orange-600">{stats.openPOs}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="text-gray-400 text-xs font-bold uppercase mb-1">Active Trucks</div>
          <div className="text-3xl font-black text-purple-900">{stats.activeEvents}</div>
        </div>
      </div>

      {/* Operations Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  
        {/* ROW 1: CORE DATA & LOGISTICS */}
        <Link href="/admin/inventory/warehouse" className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col justify-between h-full group">
          <div>
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-2xl">🏬</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Warehouse Master</h2>
            <p className="text-gray-500 text-sm leading-relaxed">Central product catalog. Update images, SKUs, and verify total physical stock counts.</p>
          </div>
          <div className="mt-6 text-blue-600 font-bold text-xs uppercase tracking-widest group-hover:translate-x-1 transition-transform">Manage Catalog →</div>
        </Link>

        <Link href="/admin/inventory/transfer" className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col justify-between h-full group">
          <div>
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-2xl">🚛</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Load Truck</h2>
            <p className="text-gray-500 text-sm leading-relaxed">Transfer inventory from the warehouse to specific event kiosks for onsite sales.</p>
          </div>
          <div className="mt-6 text-blue-600 font-bold text-xs uppercase tracking-widest group-hover:translate-x-1 transition-transform">Load Truck →</div>
        </Link>

        <Link href="/admin/purchasing/receive" className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col justify-between h-full group">
          <div>
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-2xl">📦</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Receive Stock</h2>
            <p className="text-gray-500 text-sm leading-relaxed">Scan or log incoming shipments. Automatically increases Warehouse Master counts.</p>
          </div>
          <div className="mt-6 text-blue-600 font-bold text-xs uppercase tracking-widest group-hover:translate-x-1 transition-transform">Check In Items →</div>
        </Link>

        {/* ROW 2: MANAGEMENT & FINANCE */}
        <Link href="/admin/inventory/reconcile" className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col justify-between h-full group">
          <div>
            <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-2xl">🔄</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Unload Truck</h2>
            <p className="text-gray-500 text-sm leading-relaxed">Return unsold event stock back to the master warehouse and reconcile final counts.</p>
          </div>
          <div className="mt-6 text-blue-600 font-bold text-xs uppercase tracking-widest group-hover:translate-x-1 transition-transform">Reconcile Event →</div>
        </Link>

        <Link href="/admin/purchasing/manage" className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col justify-between h-full group">
          <div>
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-2xl">📋</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Purchase Orders</h2>
            <p className="text-gray-500 text-sm leading-relaxed">Review historical buying data or manage existing open orders with vendors.</p>
          </div>
          <div className="mt-6 text-blue-600 font-bold text-xs uppercase tracking-widest group-hover:translate-x-1 transition-transform">Manage POs →</div>
        </Link>

        <Link href="/admin/inventory/adjust" className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col justify-between h-full group">
          <div>
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-2xl">🗑️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Inventory Adjust</h2>
            <p className="text-gray-500 text-sm leading-relaxed">Manually adjust master counts for write-offs, damages, or shrinkage corrections.</p>
          </div>
          <div className="mt-6 text-blue-600 font-bold text-xs uppercase tracking-widest group-hover:translate-x-1 transition-transform">Adjust Master →</div>
        </Link>

        {/* ROW 3: CONFIGURATION (THE NEW CARDS) */}
        <Link href="/admin/events" className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col justify-between h-full group">
          <div>
            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-2xl">⚙️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Event Settings</h2>
            <p className="text-gray-500 text-sm leading-relaxed">Configure kiosk themes, branding, payment methods, and live event toggles.</p>
          </div>
          <div className="mt-6 text-blue-600 font-bold text-xs uppercase tracking-widest group-hover:translate-x-1 transition-transform">Manage Settings →</div>
        </Link>

        <Link href="/admin/events/history" className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col justify-between h-full group">
          <div>
            <div className="w-12 h-12 bg-cyan-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-2xl">📁</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Event Archive</h2>
            <p className="text-gray-500 text-sm leading-relaxed">Review sales data and inventory performance for all previously closed events.</p>
          </div>
          <div className="mt-6 text-blue-600 font-bold text-xs uppercase tracking-widest group-hover:translate-x-1 transition-transform">View History →</div>
        </Link>

        {/* PLACEHOLDER FOR FUTURE EXPANSION */}
        <div className="bg-gray-100/50 p-8 rounded-2xl border border-dashed border-gray-200 flex items-center justify-center">
            <span className="text-gray-400 font-bold text-xs uppercase tracking-widest">Future Module</span>
        </div>

      </div>
    </div>
  );
}