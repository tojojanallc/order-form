import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: any) {
  try {
    const body = await req.json();
    const { cart, customerName, total, eventSlug } = body; 

    const safeSlug = eventSlug || 'default';

    if (!cart || cart.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    const hasBackorder = cart.some((item: any) => item.needsShipping);

    // 1. Create the Order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          customer_name: customerName || 'Retail Customer',
          total_price: parseFloat(total),
          status: hasBackorder ? 'pending_shipping' : 'completed',
          cart_data: cart,
          payment_status: 'paid',
          payment_method: 'terminal',
          event_slug: safeSlug,
          created_at: new Date()
        },
      ])
      .select()
      .single();

    if (orderError) throw orderError;

    // 2. DECREMENT INVENTORY (Smart Finder)
    for (const item of cart) {
        if (item.productId && item.size) {
            let targetSlug = safeSlug;

            // ATTEMPT 1: Look in the specific event
            let { data: currentStock } = await supabase
                .from('inventory')
                .select('*')
                .eq('product_id', item.productId)
                .eq('size', item.size)
                .eq('event_slug', safeSlug)
                .maybeSingle();

            // ATTEMPT 2: If not found, look in 'default'
            if (!currentStock && safeSlug !== 'default') {
                const { data: fallbackStock } = await supabase
                    .from('inventory')
                    .select('*')
                    .eq('product_id', item.productId)
                    .eq('size', item.size)
                    .eq('event_slug', 'default')
                    .maybeSingle();
                if (fallbackStock) {
                    currentStock = fallbackStock;
                    targetSlug = 'default';
                }
            }

            // ATTEMPT 3: If still not found, look for legacy (null slug)
            if (!currentStock) {
                 const { data: legacyStock } = await supabase
                    .from('inventory')
                    .select('*')
                    .eq('product_id', item.productId)
                    .eq('size', item.size)
                    .is('event_slug', null)
                    .maybeSingle();
                 if (legacyStock) {
                    currentStock = legacyStock;
                    targetSlug = null;
                 }
            }

            // 3. IF FOUND, SUBTRACT 1
            if (currentStock) {
                console.log(`📉 Decrementing: ${item.productId} (${item.size}) in [${targetSlug}]`);
                
                const newCount = Math.max(0, parseInt(currentStock.count) - 1);
                
                // Construct query based on whether slug is null or a string
                let updateQuery = supabase
                    .from('inventory')
                    .update({ count: newCount })
                    .eq('product_id', item.productId)
                    .eq('size', item.size);

                if (targetSlug === null) {
                    updateQuery = updateQuery.is('event_slug', null);
                } else {
                    updateQuery = updateQuery.eq('event_slug', targetSlug);
                }

                await updateQuery;
            } else {
                console.log(`⚠️ Inventory Item Not Found: ${item.productId} ${item.size}`);
            }
        }
    }

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (error: any) {
    console.error('Retail Order Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
