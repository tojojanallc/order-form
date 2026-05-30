'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

type Order = {
  id: number;
  event_slug: string;
  created_at: string;
  total_price: number;
  cart_data: any[];
  status: string;
  payment_status: string;
};

type Customer = {
  customer_name: string;
  phone: string;
  email: string;
  orders: Order[];
  total_spent: number;
  total_orders: number;
  events: string[];
  first_order: string;
  last_order: string;
  favorite_size: string;
  favorite_product: string;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filtered, setFiltered] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [sortBy, setSortBy] = useState<'orders' | 'spent' | 'recent'>('orders');

  useEffect(() => { fetchCustomers(); }, []);

  useEffect(() => {
    let result = [...customers];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.customer_name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (sortBy === 'orders') return b.total_orders - a.total_orders;
      if (sortBy === 'spent') return b.total_spent - a.total_spent;
      return new Date(b.last_order).getTime() - new Date(a.last_order).getTime();
    });
    setFiltered(result);
  }, [customers, search, sortBy]);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*')
      .not('customer_name', 'is', null)
      .neq('customer_name', '')
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    // Group by name+phone
    const map: Record<string, Customer> = {};
    data.forEach(order => {
      const key = `${order.customer_name?.toLowerCase().trim()}|${order.phone}`;
      if (!map[key]) {
        map[key] = {
          customer_name: order.customer_name,
          phone: order.phone,
          email: order.email,
          orders: [],
          total_spent: 0,
          total_orders: 0,
          events: [],
          first_order: order.created_at,
          last_order: order.created_at,
          favorite_size: '',
          favorite_product: '',
        };
      }
      const c = map[key];
      c.orders.push(order);
      c.total_spent += Number(order.total_price || 0);
      c.total_orders++;
      if (!c.events.includes(order.event_slug)) c.events.push(order.event_slug);
      if (order.created_at < c.first_order) c.first_order = order.created_at;
      if (order.created_at > c.last_order) c.last_order = order.created_at;
    });

    // Compute favorite size + product
    Object.values(map).forEach(c => {
      const sizes: Record<string, number> = {};
      const products: Record<string, number> = {};
      c.orders.forEach(o => {
        (o.cart_data || []).forEach((item: any) => {
          if (item?.size) sizes[item.size] = (sizes[item.size] || 0) + 1;
          if (item?.productName) products[item.productName] = (products[item.productName] || 0) + 1;
        });
      });
      c.favorite_size = Object.entries(sizes).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      c.favorite_product = Object.entries(products).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    });

    const list = Object.values(map);
    setCustomers(list);
    setLoading(false);
  };

  const repeatCustomers = customers.filter(c => c.total_orders > 1).length;
  const totalRevenue = customers.reduce((s, c) => s + c.total_spent, 0);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto p-6">

        {/* Header */}
        <div className="mb-8">
          <Link href="/admin" className="text-[10px] font-black uppercase text-blue-600 tracking-widest hover:underline">← Command Center</Link>
          <h1 className="text-4xl font-black tracking-tight mt-1">👥 Customer History</h1>
          <p className="text-sm text-gray-500 mt-1">Cross-event customer profiles and order history.</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Customers', value: customers.length, color: 'blue' },
            { label: 'Repeat Customers', value: repeatCustomers, color: 'green' },
            { label: 'Total Revenue', value: `$${totalRevenue.toFixed(0)}`, color: 'emerald' },
            { label: 'Avg Orders/Customer', value: customers.length ? (customers.reduce((s,c)=>s+c.total_orders,0)/customers.length).toFixed(1) : '0', color: 'purple' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-2xl font-black text-slate-900">{s.value}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Left: Customer list */}
          <div className="md:w-2/5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-gray-50 space-y-3">
                <input
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 font-bold text-sm focus:outline-none focus:border-blue-400"
                  placeholder="Search name, phone, email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <div className="flex gap-2">
                  {(['orders', 'spent', 'recent'] as const).map(s => (
                    <button key={s} onClick={() => setSortBy(s)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${sortBy === s ? 'bg-slate-900 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
                      {s === 'orders' ? '# Orders' : s === 'spent' ? '$ Spent' : 'Recent'}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="p-10 text-center text-gray-400 animate-pulse font-bold">Loading...</div>
              ) : (
                <div className="divide-y max-h-[600px] overflow-y-auto">
                  {filtered.map(c => (
                    <button key={`${c.customer_name}|${c.phone}`} onClick={() => setSelected(c)}
                      className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-all ${selected?.customer_name === c.customer_name && selected?.phone === c.phone ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-black text-sm">{c.customer_name}</p>
                          <p className="text-xs text-gray-400">{c.phone !== 'N/A' ? c.phone : c.email || 'No contact'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-blue-700">{c.total_orders} order{c.total_orders !== 1 ? 's' : ''}</p>
                          {c.total_spent > 0 && <p className="text-xs text-green-700 font-bold">${c.total_spent.toFixed(0)}</p>}
                          {c.total_orders > 1 && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-black">REPEAT</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {c.events.slice(0, 3).map(e => (
                          <span key={e} className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">{e.replace(/-/g, ' ')}</span>
                        ))}
                        {c.events.length > 3 && <span className="text-[9px] text-gray-400">+{c.events.length - 3} more</span>}
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 && <p className="text-center text-gray-400 font-bold py-10">No customers found.</p>}
                </div>
              )}
            </div>
          </div>

          {/* Right: Customer detail */}
          <div className="md:w-3/5">
            {!selected ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-64 flex items-center justify-center text-gray-400 font-bold">
                ← Select a customer to view their history
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Customer header */}
                <div className="bg-slate-900 text-white px-6 py-5">
                  <h2 className="text-2xl font-black">{selected.customer_name}</h2>
                  <div className="flex gap-4 mt-1 text-sm text-white/60">
                    {selected.phone !== 'N/A' && <span>📞 {selected.phone}</span>}
                    {selected.email && <span>✉️ {selected.email}</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="bg-white/10 rounded-xl p-3 text-center">
                      <p className="text-xl font-black">{selected.total_orders}</p>
                      <p className="text-[10px] uppercase tracking-wider text-white/60">Orders</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 text-center">
                      <p className="text-xl font-black">${selected.total_spent.toFixed(0)}</p>
                      <p className="text-[10px] uppercase tracking-wider text-white/60">Total Spent</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 text-center">
                      <p className="text-xl font-black">{selected.events.length}</p>
                      <p className="text-[10px] uppercase tracking-wider text-white/60">Events</p>
                    </div>
                  </div>
                </div>

                {/* Preferences */}
                {(selected.favorite_size || selected.favorite_product) && (
                  <div className="px-6 py-3 bg-blue-50 border-b flex gap-6 text-sm">
                    {selected.favorite_size && <span className="font-bold text-blue-800">👕 Usually orders: <span className="font-black">{selected.favorite_size}</span></span>}
                    {selected.favorite_product && <span className="font-bold text-blue-800 truncate">⭐ Fav item: <span className="font-black">{selected.favorite_product}</span></span>}
                  </div>
                )}

                {/* Order history */}
                <div className="divide-y max-h-[440px] overflow-y-auto">
                  {selected.orders.map(order => (
                    <div key={order.id} className="px-6 py-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-black text-sm capitalize">{order.event_slug.replace(/-/g, ' ')}</p>
                          <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                        <span className="font-black text-green-700">${Number(order.total_price || 0).toFixed(2)}</span>
                      </div>
                      <div className="space-y-1">
                        {(order.cart_data || []).map((item: any, i: number) => (
                          <div key={i} className="text-sm bg-gray-50 rounded-lg px-3 py-2">
                            <span className="font-bold">{item.productName}</span>
                            <span className="text-gray-400"> · {item.size}</span>
                            {item.customizations?.mainDesign && <span className="text-blue-600 text-xs ml-2">{item.customizations.mainDesign}</span>}
                            {(item.customizations?.names || []).length > 0 && (
                              <span className="text-purple-600 text-xs ml-2">"{item.customizations.names.map((n: any) => n.text).join(', ')}"</span>
                            )}
                            {(item.customizations?.logos || []).length > 0 && (
                              <span className="text-orange-600 text-xs ml-2">+{item.customizations.logos.map((l: any) => l.type).join(', ')}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
