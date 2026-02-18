'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    warehouseValue: 0,
    lowStock: 0,
    activeEvents: 0,
    todaysShopSales: 0,
    openPOs: 0
  });

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  async function fetchDashboardStats() {
    // 1. Warehouse Stats
    const { data: inventory } = await supabase.from('inventory_master').select('quantity_on_hand, cost_price');
    const warehouseValue = inventory?.reduce((sum, i) => sum + ((i.quantity_on_hand || 0) * (i.cost_price || 0)), 0) || 0;
    const lowStock = inventory?.filter(i => (i.quantity_on_hand || 0) < 10).length || 0;

    // 2. Active Events
    const { count: eventCount } = await supabase.from('event_settings').select('*', { count: 'exact', head: true }).eq('status', 'active');

    // 3. Shop Sales (Today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: shopCount } = await supabase.from('shop_orders').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString());

    // 4. Open POs
    const { count: poCount } = await supabase.from('purchases').select('*', { count: 'exact', head: true }).eq('status', 'ordered');

    setStats({
      warehouseValue,
      lowStock,
      activeEvents: eventCount || 0,
      todaysShopSales: shopCount || 0,
      openPOs: poCount || 0
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Command Center</h1>
            <p className="text-gray-500 font-medium">Lev Custom Merch Operations</p>
          </div>
          <div className="bg-white px-6 py-4 rounded-3xl shadow-sm border border-gray-100 text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Asset Value</p>
              <p className="text-3xl font-black text-green-500">${stats.warehouseValue.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <Link href="/admin/inventory" className="bg-white p-6 rounded-[32px] border border-red-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all group">
                <div>
                    <p className="text-4xl font-black text-red-500 group-hover:scale-110 transition-transform">{stats.lowStock}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Low Stock Alerts</p>
                </div>
                <div className="h-10 w-10 bg-red-50 rounded-full flex items-center justify-center text-red-500 text-xl">⚠️</div>
            </Link>
            <Link href="/admin/inventory/transfer" className="bg-white p-6 rounded-[32px] border border-blue-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all group">
                <div>
                    <p className="text-4xl font-black text-blue-600 group-hover:scale-110 transition-transform">{stats.activeEvents}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Active Trucks</p>
                </div>
                <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 text-xl">🚛</div>
            </Link>
            <Link href="/admin/shop/history" className="bg-white p-6 rounded-[32px] border border-purple-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all group">
                <div>
                    <p className="text-4xl font-black text-purple-600 group-hover:scale-110 transition-transform">{stats.todaysShopSales}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Direct Sales Today</p>
                </div>
                <div className="h-10 w-10 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 text-xl">🛍️</div>
            </Link>
            <Link href="/admin/purchasing/manage" className="bg-white p-6 rounded-[32px] border border-orange-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all group">
                <div>
                    <p className="text-4xl font-black text-orange-500 group-hover:scale-110 transition-transform">{stats.openPOs}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Open POs</p>
                </div>
                <div className="h-10 w-10 bg-orange-50 rounded-full flex items-center justify-center text-orange-500 text-xl">📋</div>
            </Link>
        </div>

        {/* MAIN CARDS */}
        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6 ml-2">Core Logistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
            <div className="bg-white p-8 rounded-[40px] border border-gray-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all group flex flex-col justify-between">
                <div>
                    <div className="h-14 w-14 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">📦</div>
                    <h3 className="text-2xl font-black text-slate-900 mb-2">Warehouse</h3>
                    <p className="text-xs text-gray-500 font-medium">Manage 1,300+ SKUs.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-8">
                    <Link href="/admin/inventory/warehouse" className="bg-slate-900 text-white py-3 rounded-xl text-center font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-colors">View Stock</Link>
                    <Link href="/admin/inventory/warehouse/?action=add" className="bg-gray-50 text-slate-600 py-3 rounded-xl text-center font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-colors">Add Item</Link>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-gray-200 shadow-sm hover:shadow-xl hover:border-green-200 transition-all group flex flex-col justify-between">
                <div>
                    <div className="h-14 w-14 bg-green-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">🚛</div>
                    <h3 className="text-2xl font-black text-slate-900 mb-2">Load Truck</h3>
                    <p className="text-xs text-gray-500 font-medium">Transfer stock to meets.</p>
                </div>
                <Link href="/admin/inventory/transfer" className="mt-8 block w-full bg-slate-900 text-white py-3 rounded-xl text-center font-black text-[10px] uppercase tracking-widest hover:bg-green-600 transition-colors">Start Loading →</Link>
            </div>

             <div className="bg-white p-8 rounded-[40px] border border-gray-200 shadow-sm hover:shadow-xl hover:border-purple-300 transition-all group relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 bg-purple-600 text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-widest">QB Sync</div>
                <div>
                    <div className="h-14 w-14 bg-purple-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">🛍️</div>
                    <h3 className="text-2xl font-black text-slate-900 mb-2">Shop Orders</h3>
                    <p className="text-xs text-gray-500 font-medium">Invoices & Walk-ins.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-8">
                    <Link href="/admin/shop" className="bg-slate-900 text-white py-3 rounded-xl text-center font-black text-[10px] uppercase tracking-widest hover:bg-purple-600 transition-colors">New Order</Link>
                    <Link href="/admin/shop/history" className="bg-gray-50 text-slate-600 py-3 rounded-xl text-center font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-colors">History</Link>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-gray-200 shadow-sm hover:shadow-xl hover:border-orange-300 transition-all group flex flex-col justify-between">
                <div>
                    <div className="h-14 w-14 bg-orange-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">📋</div>
                    <h3 className="text-2xl font-black text-slate-900 mb-2">Purchasing</h3>
                    <p className="text-xs text-gray-500 font-medium">Vendor Orders.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-8">
                    <Link href="/admin/purchasing/create" className="bg-slate-900 text-white py-3 rounded-xl text-center font-black text-[10px] uppercase tracking-widest hover:bg-orange-500 transition-colors">+ Create</Link>
                    <Link href="/admin/purchasing/manage" className="bg-gray-50 text-slate-600 py-3 rounded-xl text-center font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-colors">Manage</Link>
                </div>
            </div>
        </div>

        {/* UTILITIES GRID (Added Event History Here) */}
        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6 ml-2">Inventory Utilities</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">

            <Link href="/admin/purchasing/receive" className="bg-white p-6 rounded-[32px] border border-gray-200 hover:border-blue-300 transition-all group">
                <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center mb-4 text-xl">📥</div>
                <h4 className="font-black text-slate-900">Receive Stock</h4>
                <p className="text-xs text-gray-400 font-medium mt-1">Scan Shipments.</p>
            </Link>

            <Link href="/admin/inventory/reconcile" className="bg-white p-6 rounded-[32px] border border-gray-200 hover:border-blue-300 transition-all group">
                <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center mb-4 text-xl">↩️</div>
                <h4 className="font-black text-slate-900">Unload Truck</h4>
                <p className="text-xs text-gray-400 font-medium mt-1">Return & Reconcile.</p>
            </Link>

            <Link href="/admin/inventory/adjust" className="bg-white p-6 rounded-[32px] border border-gray-200 hover:border-blue-300 transition-all group">
                <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mb-4 text-xl">🔧</div>
                <h4 className="font-black text-slate-900">Adjustments</h4>
                <p className="text-xs text-gray-400 font-medium mt-1">Write-offs.</p>
            </Link>

             <Link href="/admin/events" className="bg-white p-6 rounded-[32px] border border-gray-200 hover:border-blue-300 transition-all group">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-xl">⚙️</div>
                <h4 className="font-black text-slate-900">Event Settings</h4>
                <p className="text-xs text-gray-400 font-medium mt-1">Manage Kiosks.</p>
            </Link>

            {/* NEW CARD: EVENT HISTORY */}
            <Link href="/admin/events/history" className="bg-white p-6 rounded-[32px] border border-gray-200 hover:border-cyan-300 transition-all group">
                <div className="w-10 h-10 bg-cyan-50 rounded-full flex items-center justify-center mb-4 text-xl">📁</div>
                <h4 className="font-black text-slate-900">Event History</h4>
                <p className="text-xs text-gray-400 font-medium mt-1">Past Results.</p>
            </Link>
        </div>

      </div>
    </div>
  ); 
}