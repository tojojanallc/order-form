'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

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
  shop_order_items: OrderItem[];
}

export default function ShopOrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [processingVoid, setProcessingVoid] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    setLoading(true);
    const { data } = await supabase
      .from('shop_orders')
      .select(`*, shop_order_items (*)`)
      .order('created_at', { ascending: false });

    if (data) setOrders(data);
    setLoading(false);
  }

  const handleVoid = async (order: Order) => {
    const confirmMessage = `⚠️ ARE YOU SURE?\n\nThis will delete the order for ${order.customer_name} and RESTOCK ${order.shop_order_items.reduce((a,c)=>a+c.quantity,0)} items back into the warehouse.\n\nThis cannot be undone.`;
    
    if (!confirm(confirmMessage)) return;
    setProcessingVoid(true);

    try {
      // 1. Restock Inventory Master
      for (const item of order.shop_order_items) {
        // We find the master item by SKU to be safe
        const { data: masterItem } = await supabase
          .from('inventory_master')
          .select('id, quantity_on_hand')
          .eq('sku', item.sku)
          .maybeSingle();

        if (masterItem) {
          await supabase
            .from('inventory_master')
            .update({ quantity_on_hand: masterItem.quantity_on_hand + item.quantity })
            .eq('id', masterItem.id);
        } else {
          console.warn(`Could not restock ${item.sku} - item might have been deleted from master.`);
        }
      }

      // 2. Delete the Order (Cascading delete will remove items)
      const { error } = await supabase.from('shop_orders').delete().eq('id', order.id);
      if (error) throw error;

      alert("✅ Order Voided & Stock Returned.");
      fetchHistory(); // Refresh the list

    } catch (err: any) {
      alert("Error voiding order: " + err.message);
    } finally {
      setProcessingVoid(false);
    }
  };

  const filtered = orders.filter(o => 
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) || 
    o.qb_invoice_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-end mb-8">
            <div>
                <Link href="/admin/shop" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block hover:underline">← Back to Shop</Link>
                <h1 className="text-4xl font-black tracking-tight">Shop Order Log</h1>
                <p className="text-gray-500 font-medium">Audit trail for direct warehouse sales.</p>
            </div>
            
            <div className="flex gap-4">
                <div className="bg-white px-6 py-3 rounded-2xl border border-gray-200 shadow-sm text-right hidden md:block">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Orders</p>
                    <p className="text-2xl font-black text-slate-900">{orders.length}</p>
                </div>
            </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-sm mb-6 flex gap-4 items-center">
            <span className="text-2xl pl-2">🔍</span>
            <input 
                placeholder="Search Customer or Invoice #..." 
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
                <div className="text-center py-20 text-gray-400 italic">No orders found.</div>
            ) : (
                filtered.map(order => {
                    const isOpen = expandedId === order.id;
                    const totalValue = order.shop_order_items.reduce((sum, i) => sum + (i.quantity * i.price_at_sale), 0);

                    return (
                        <div key={order.id} className={`bg-white rounded-3xl border transition-all overflow-hidden ${isOpen ? 'border-red-100 shadow-lg' : 'border-gray-200 shadow-sm hover:border-blue-300'}`}>
                            
                            {/* Header (Summary) */}
                            <div 
                                onClick={() => setExpandedId(isOpen ? null : order.id)}
                                className="p-6 cursor-pointer flex flex-col md:flex-row justify-between items-center gap-4 relative z-10 bg-white"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="font-black text-lg uppercase text-slate-800">{order.customer_name}</h3>
                                        {order.qb_invoice_number && (
                                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide">
                                                QB #{order.qb_invoice_number}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                                        {new Date(order.created_at).toLocaleDateString()}
                                    </p>
                                </div>

                                <div className="flex gap-8 text-right items-center">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</p>
                                        <p className="font-black text-xl text-green-600">${totalValue.toFixed(2)}</p>
                                    </div>
                                    <span className={`transform transition-transform text-gray-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                                </div>
                            </div>

                            {/* Details (Expanded) */}
                            {isOpen && (
                                <div className="bg-gray-50 border-t border-gray-100 p-6 animate-in slide-in-from-top-2">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-xs font-black uppercase text-gray-400 tracking-widest">Order Manifest</h4>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleVoid(order); }}
                                            disabled={processingVoid}
                                            className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-colors shadow-sm"
                                        >
                                            {processingVoid ? 'Restocking...' : '🗑️ Void & Restock'}
                                        </button>
                                    </div>

                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-[9px] font-black uppercase text-gray-400 border-b border-gray-200">
                                                <th className="pb-2 pl-2">SKU</th>
                                                <th className="pb-2">Item</th>
                                                <th className="pb-2 text-center">Size/Color</th>
                                                <th className="pb-2 text-right">Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {order.shop_order_items.map(item => (
                                                <tr key={item.id} className="text-sm">
                                                    <td className="py-2 pl-2 font-mono text-blue-600 font-bold text-[10px]">{item.sku}</td>
                                                    <td className="py-2 font-bold text-slate-700 text-xs">{item.item_name}</td>
                                                    <td className="py-2 text-center text-[10px] text-gray-500 font-bold uppercase">
                                                        {item.size} <span className="text-gray-300 mx-1">/</span> {item.color}
                                                    </td>
                                                    <td className="py-2 text-right font-black text-slate-900">
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