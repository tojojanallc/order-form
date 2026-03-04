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
    const { data } = await supabase
      .from('inventory_master')
      .select('*')
      .gt('quantity_on_hand', 0)
      .order('item_name');
    if (data) setWarehouse(data);
  }

  // 1. Add item to cart using STRICT database pricing
  const addToCart = (item: any) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      if (existing.quantity >= item.quantity_on_hand) return alert("Not enough stock!");
      setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      // Removed the $30 auto-default; strictly uses DB value or 0.00
      const initialPrice = item.selling_price || 0.00; 
      setCart([...cart, { ...item, quantity: 1, price_at_sale: initialPrice }]);
    }
  };

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) {
      setCart(cart.filter(c => c.id !== id));
    } else {
      setCart(cart.map(c => c.id === id ? { ...c, quantity: qty } : c));
    }
  };

  // 2. Manual Price Override logic
  const updatePrice = (id: string, newPrice: number) => {
    setCart(cart.map(c => c.id === id ? { ...c, price_at_sale: newPrice } : c));
  };

  const calculateTotal = () => {
    return cart.reduce((acc, item) => acc + (item.price_at_sale * item.quantity), 0);
  };

  const processOrder = async () => {
    if (!customer) return alert("Please enter a Customer Name.");
    if (cart.length === 0) return alert("Cart is empty.");
    if (!confirm(`Confirm order for ${customer}? Total: $${calculateTotal().toFixed(2)}`)) return;

    setLoading(true);

    try {
      // Create Order Header
      const { data: order, error: orderErr } = await supabase
        .from('shop_orders')
        .insert({ 
          customer_name: customer, 
          qb_invoice_number: invoiceNum,
          total_amount: calculateTotal() 
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      // Process Line Items
      for (const item of cart) {
        await supabase.from('shop_order_items').insert({
          order_id: order.id,
          sku: item.sku,
          item_name: item.item_name,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          price_at_sale: item.price_at_sale 
        });

        // Deduct inventory
        await supabase.rpc('decrement_inventory', { 
          row_id: item.id, 
          qty: item.quantity 
        });
      }

      alert("✅ Order Logged & Inventory Updated!");
      router.push('/admin/shop/history');
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
        <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block">← COMMAND CENTER</Link>
        
        <div className="flex justify-between items-end mb-8">
            <h1 className="text-4xl font-black tracking-tight">New Shop Order</h1>
            <div className="text-right">
                <p className="text-[10px] font-black uppercase text-gray-400">Items in Cart</p>
                <p className="text-2xl font-black text-blue-600">{cart.reduce((a, c) => a + c.quantity, 0)}</p>
            </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
            {/* LEFT COLUMN: Input and Inventory */}
            <div className="col-span-8 space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                    <h2 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-4">Customer Details</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Name</label>
                            <input 
                                className="w-full p-3 bg-gray-50 rounded-xl font-bold border-none focus:ring-2 focus:ring-blue-500 outline-none" 
                                value={customer}
                                onChange={e => setCustomer(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Invoice #</label>
                            <input 
                                className="w-full p-3 bg-gray-50 rounded-xl font-bold border-none focus:ring-2 focus:ring-blue-500 outline-none" 
                                value={invoiceNum}
                                onChange={e => setInvoiceNum(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm min-h-[500px]">
                     <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xs font-black uppercase text-gray-400 tracking-widest">Inventory List</h2>
                        <input 
                            placeholder="Filter by name or SKU..." 
                            className="bg-gray-50 p-2 px-4 rounded-lg text-xs font-bold outline-none border border-transparent focus:border-blue-100"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                     </div>
                     <div className="overflow-y-auto max-h-[500px]">
                        <table className="w-full text-left">
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map(item => (
                                    <tr key={item.id} className="hover:bg-blue-50 transition-colors group cursor-pointer" onClick={() => addToCart(item)}>
                                        <td className="p-4">
                                            <div className="font-bold text-sm uppercase">{item.item_name}</div>
                                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                                              {item.sku} • {item.size} • {item.color}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded text-[10px] font-black uppercase mr-4">Stock: {item.quantity_on_hand}</span>
                                            <span className="text-blue-600 font-black text-sm">
                                              ${item.selling_price ? item.selling_price.toFixed(2) : '0.00'}
                                            </span>
                                            <button className="ml-4 text-blue-600 font-black text-xl">+</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                     </div>
                </div>
            </div>

            {/* RIGHT COLUMN: The Order Summary/Cart */}
            <div className="col-span-4">
                <div className="bg-slate-900 text-white p-6 rounded-[30px] shadow-2xl sticky top-6">
                    <h2 className="text-xs font-black uppercase text-gray-500 tracking-widest mb-6">Review Order</h2>
                    
                    {cart.length === 0 ? (
                        <div className="text-center py-20 text-gray-700 italic text-sm">Cart empty. Select items to begin.</div>
                    ) : (
                        <div className="space-y-4 mb-8 max-h-[450px] overflow-y-auto pr-1">
                            {cart.map(item => (
                                <div key={item.id} className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="max-w-[80%]">
                                            <div className="font-bold text-[11px] uppercase truncate">{item.item_name}</div>
                                            <div className="text-[9px] text-gray-500 font-bold uppercase">{item.size} / {item.color}</div>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); updateQty(item.id, 0); }} className="text-slate-600 hover:text-red-400">×</button>
                                    </div>
                                    
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-[8px] font-black text-gray-500 uppercase mb-1">Unit Price ($)</p>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                className={`w-24 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none transition-all ${item.price_at_sale !== item.selling_price ? 'text-orange-400 border-orange-500/30' : 'text-green-400'}`}
                                                value={item.price_at_sale}
                                                onChange={(e) => updatePrice(item.id, parseFloat(e.target.value))}
                                            />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[8px] font-black text-gray-500 uppercase mb-1">Quantity</p>
                                            <input 
                                                type="number" 
                                                className="w-14 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-center font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                                                value={item.quantity}
                                                onChange={(e) => updateQty(item.id, parseInt(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                    {item.price_at_sale !== (item.selling_price || 0) && (
                                      <p className="text-[7px] font-bold text-orange-500 uppercase mt-2 opacity-70 tracking-widest">Manual Override Active</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="border-t border-slate-800 pt-6 mt-4 flex justify-between items-center mb-6 px-2">
                        <span className="text-xs font-black uppercase text-gray-500">Order Total</span>
                        <span className="text-2xl font-black text-green-500">${calculateTotal().toFixed(2)}</span>
                    </div>

                    <button 
                        onClick={processOrder}
                        disabled={loading || cart.length === 0}
                        className="w-full py-4 rounded-2xl bg-blue-600 font-black uppercase tracking-widest text-xs hover:bg-blue-500 transition-all disabled:bg-slate-800 disabled:text-slate-600"
                    >
                        {loading ? 'Processing...' : 'Complete Order'}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
