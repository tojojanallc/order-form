'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';
import { format } from 'date-fns'; // You might need to install date-fns: npm install date-fns

// Types matching your database structure
interface OrderItem {
  id: string;
  sku: string;
  item_name: string;
  size: string;
  color: string;
  quantity: number;
  price_at_sale: number;
}

interface Order {
  id: string;
  created_at: string;
  customer_name: string;
  qb_invoice_number: string;
  notes: string;
  shop_order_items: OrderItem[];
}

export default function ShopOrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    setLoading(true);
    // Fetch orders AND their related items in one go
    const { data, error } = await supabase
      .from('shop_orders')
      .select(`
        *,
        shop_order_items (*)
      `)
      .order('created_at', { ascending: false });

    if (data) setOrders(data);
    setLoading(false);
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filter by Customer Name or QB Invoice #
  const filtered = orders.filter(o => 
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) || 
    o.qb_invoice_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-end mb-8">
            <div>
                <Link href="/admin/shop/new" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block hover:underline">← New Order</Link>
                <h1 className="text-4xl font-black tracking-tight">Shop Order Log</h1>
                <p className="text-gray-500 font-medium">Audit trail for inventory invoiced in QuickBooks.</p>
            </div>
            <div className="bg-white px-6 py-3 rounded-2xl border border-gray-200 shadow-sm text-right">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Orders</p>
                <p className="text-2xl font-black text-slate-900">{orders.length}</p>
            </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-sm mb-6 flex gap-4 items-center">
            <span className="text-2xl pl-2">🔍</span>
            <input 
                placeholder="Search by Customer or QB Invoice #..." 
                className="flex-1 p-2 bg-white font-bold outline-none text-gray-700 placeholder:font-medium"
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
        </div>

        {/* Orders List */}
        <div className="space-y-4">
            {loading ? (
                <div className="text-center py-20 animate-pulse font-black text-gray-300 uppercase">Loading Records...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 text-gray-400 italic">No orders found matching your search.</div>
            ) : (
                filtered.map(order => {
                    const isOpen = expandedId === order.id;
                    const totalItems = order.shop_order_items.reduce((sum, i) => sum + i.quantity, 0);
                    const totalValue = order.shop_order_items.reduce((sum, i) => sum + (i.quantity * i.price_at_sale), 0);

                    return (
                        <div key={order.id} className={`bg-white rounded-3xl border transition-all overflow-hidden ${isOpen ? 'border-blue-500 shadow-lg' : 'border-gray-200 shadow-sm hover:border-blue-300'}`}>
                            {/* Header (Clickable) */}
                            <div 
                                onClick={() => toggleExpand(order.id)}
                                className="p-6 cursor-pointer flex flex-col md:flex-row justify-between items-center gap-4 bg-white z-10 relative"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="font-black text-lg uppercase">{order.customer_name}</h3>
                                        {order.qb_invoice_number && (
                                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide">
                                                QB #{order.qb_invoice_number}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                                        {new Date(order.created_at).toLocaleDateString()} at {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </p>
                                </div>

                                <div className="flex gap-8 text-right">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Items</p>
                                        <p className="font-black text-xl">{totalItems}</p>
                                    </div>
                                    <div className="pr-4">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Value</p>
                                        <p className="font-black text-xl text-green-600">${totalValue.toFixed(2)}</p>
                                    </div>
                                    <div className="flex items-center text-gray-300">
                                        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                                    </div>
                                </div>
                            </div>

                            {/* Details (Expandable) */}
                            {isOpen && (
                                <div className="bg-gray-50 border-t border-gray-100 p-6 animate-in slide-in-from-top-2">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-200">
                                                <th className="pb-3 pl-2">Product SKU</th>
                                                <th className="pb-3">Item Name</th>
                                                <th className="pb-3 text-center">Size/Color</th>
                                                <th className="pb-3 text-right pr-2">Qty Deducted</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {order.shop_order_items.map(item => (
                                                <tr key={item.id} className="text-sm">
                                                    <td className="py-3 pl-2 font-mono text-blue-600 font-bold text-xs">{item.sku}</td>
                                                    <td className="py-3 font-bold text-slate-700">{item.item_name}</td>
                                                    <td className="py-3 text-center text-xs text-gray-500 uppercase font-semibold">
                                                        {item.size} <span className="text-gray-300">•</span> {item.color}
                                                    </td>
                                                    <td className="py-3 text-right pr-2 font-black text-slate-900">
                                                        {item.quantity}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
      </div>
    </div>
  );
}