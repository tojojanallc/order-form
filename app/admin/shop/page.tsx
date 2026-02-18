'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NewShopOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [warehouse, setWarehouse] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  // Order Details
  const [customer, setCustomer] = useState('');
  const [invoiceNum, setInvoiceNum] = useState('');
  const [cart, setCart] = useState<any[]>([]);

  useEffect(() => {
    fetchInventory();
  }, []);

  async function fetchInventory() {
    const { data } = await supabase.from('inventory_master').select('*').gt('quantity_on_hand', 0).order('item_name');
    if (data) setWarehouse(data);
  }

  // Add item to the "Cart" (Staging area)
  const addToCart = (item: any) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      if (existing.quantity >= item.quantity_on_hand) return alert("Not enough stock!");
      setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) {
      setCart(cart.filter(c => c.id !== id));
    } else {
      setCart(cart.map(c => c.id === id ? { ...c, quantity: qty } : c));
    }
  };

  const processOrder = async () => {
    if (!customer) return alert("Please enter a Customer Name.");
    if (cart.length === 0) return alert("Cart is empty.");
    if (!confirm(`Confirm order for ${customer}? This will permanently remove items from inventory.`)) return;

    setLoading(true);

    try {
      // 1. Create the Order Header
      const { data: order, error: orderErr } = await supabase
        .from('shop_orders')
        .insert({ customer_name: customer, qb_invoice_number: invoiceNum })
        .select()
        .single();

      if (orderErr) throw orderErr;

      // 2. Process Line Items & Deduct Inventory
      for (const item of cart) {
        // A. Add to Order Items Log
        await supabase.from('shop_order_items').insert({
          order_id: order.id,
          sku: item.sku,
          item_name: item.item_name,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          price_at_sale: item.selling_price
        });

        // B. Deduct from Master Warehouse
        const { error: stockErr } = await supabase.rpc('decrement_inventory', { 
          row_id: item.id, 
          qty: item.quantity 
        });
        
        // Fallback if RPC doesn't exist (Manual Update)
        if (stockErr) {
             const currentItem = warehouse.find(w => w.id === item.id);
             await supabase
               .from('inventory_master')
               .update({ quantity_on_hand: currentItem.quantity_on_hand - item.quantity })
               .eq('id', item.id);
        }
      }

      alert("✅ Order Logged & Inventory Updated!");
      router.push('/admin/shop/history'); // We'll build this history page next
    } catch (error: any) {
      alert("Error processing order: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = warehouse.filter(i => 
    i.item_name?.toLowerCase().includes(search.toLowerCase()) || 
    i.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto">
        <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block">← Dashboard</Link>
        <div className="flex justify-between items-end mb-8">
            <h1 className="text-4xl font-black tracking-tight">New Shop Order</h1>
            <div className="text-right">
                <p className="text-[10px] font-black uppercase text-gray-400">Total Items</p>
                <p className="text-2xl font-black text-blue-600">{cart.reduce((a, c) => a + c.quantity, 0)}</p>
            </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
            {/* LEFT: Order Form & Search */}
            <div className="col-span-8 space-y-6">
                {/* 1. Customer Info */}
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                    <h2 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-4">Invoice Details (QuickBooks)</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Customer Name</label>
                            <input 
                                className="w-full p-3 bg-gray-50 rounded-xl font-bold border-none focus:ring-2 focus:ring-blue-500" 
                                placeholder="e.g. Nicolet High School"
                                value={customer}
                                onChange={e => setCustomer(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">QB Invoice # (Optional)</label>
                            <input 
                                className="w-full p-3 bg-gray-50 rounded-xl font-bold border-none focus:ring-2 focus:ring-blue-500" 
                                placeholder="e.g. 1024"
                                value={invoiceNum}
                                onChange={e => setInvoiceNum(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Item Selector */}
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm min-h-[500px]">
                     <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xs font-black uppercase text-gray-400 tracking-widest">Add Items</h2>
                        <input 
                            placeholder="Search Inventory..." 
                            className="bg-gray-50 p-2 px-4 rounded-lg text-xs font-bold outline-none"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                     </div>
                     <div className="overflow-y-auto max-h-[400px]">
                        <table className="w-full text-left">
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map(item => (
                                    <tr key={item.id} className="hover:bg-blue-50 transition-colors group cursor-pointer" onClick={() => addToCart(item)}>
                                        <td className="p-3">
                                            <div className="font-bold text-sm uppercase">{item.item_name}</div>
                                            <div className="text-[10px] text-gray-400 font-bold">{item.sku} • {item.size} • {item.color}</div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-black uppercase">Stock: {item.quantity_on_hand}</span>
                                            <button className="ml-3 text-blue-600 font-black text-xl hover:scale-110 transition-transform">+</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                     </div>
                </div>
            </div>

            {/* RIGHT: The Cart Summary */}
            <div className="col-span-4">
                <div className="bg-slate-900 text-white p-6 rounded-[30px] shadow-2xl sticky top-6">
                    <h2 className="text-xs font-black uppercase text-gray-500 tracking-widest mb-6">Current Order</h2>
                    
                    {cart.length === 0 ? (
                        <div className="text-center py-10 text-gray-600 italic text-sm">No items added yet.</div>
                    ) : (
                        <div className="space-y-4 mb-8">
                            {cart.map(item => (
                                <div key={item.id} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                                    <div>
                                        <div className="font-bold text-xs uppercase">{item.item_name}</div>
                                        <div className="text-[10px] text-gray-400">{item.size} • {item.color}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="number" 
                                            className="w-12 bg-slate-900 border border-slate-600 rounded text-center font-bold text-white p-1"
                                            value={item.quantity}
                                            onChange={(e) => updateQty(item.id, parseInt(e.target.value))}
                                        />
                                        <button onClick={() => updateQty(item.id, 0)} className="text-red-400 hover:text-red-300">×</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="border-t border-slate-800 pt-6 mt-4">
                        <button 
                            onClick={processOrder}
                            disabled={loading || cart.length === 0}
                            className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all
                                ${loading || cart.length === 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-400 shadow-lg hover:shadow-green-500/20'}
                            `}
                        >
                            {loading ? 'Processing...' : 'Complete Order'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}