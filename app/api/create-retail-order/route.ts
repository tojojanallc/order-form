import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: any) {
try {
const body = await req.json();

// Extracting all data from the iPad/Kiosk
const { 
  cart, 
  customerName, 
  customerPhone, 
  customerEmail, 
  total, 
  eventSlug, 
  eventName 
} = body; 

// Normalize slug (handle nulls) - This ensures it doesn't go to Event 1 by mistake
const currentEvent = eventSlug || 'default';
const currentEventName = eventName || 'General Event';

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
      phone: customerPhone || 'N/A', // FIX: Saves Phone
      email: customerEmail || '',    // FIX: Saves Email
      total_price: parseFloat(total),
      status: hasBackorder ? 'pending_shipping' : 'completed',
      cart_data: cart,
      payment_status: 'paid',
      payment_method: 'terminal',
      event_slug: currentEvent,      // FIX: Saves to Event 2 (or active event)
      event_name: currentEventName,  // FIX: Saves Event Name
      created_at: new Date().toISOString() // Better date format for Supabase
    },
  ])
  .select()
  .single();

if (orderError) {
  console.error('Supabase Insert Error:', orderError);
  throw orderError;
}

// 2. DECREMENT INVENTORY (ID-Based Update)
// This part is the bulk of your file to ensure stock counts stay accurate
for (const item of cart) {
    if (item.productId && item.size) {
        
        // A. Get ALL possible inventory rows for this Product+Size
        const { data: candidates } = await supabase
            .from('inventory')
            .select('*')
            .eq('product_id', item.productId)
            .eq('size', item.size);

        if (candidates && candidates.length > 0) {
            // B. Find the Best Match in Javascript
            // Priority 1: Exact Event Match (This ensures we pull from Event 2 stock)
            let targetRow = candidates.find(c => c.event_slug === currentEvent);
            
            // Priority 2: 'default' Event (fallback)
            if (!targetRow && currentEvent !== 'default') {
                targetRow = candidates.find(c => c.event_slug === 'default');
            }

            // Priority 3: Legacy Items (Null or Empty Slug)
            if (!targetRow) {
                targetRow = candidates.find(c => !c.event_slug || c.event_slug === '');
            }

            // C. Update the SPECIFIC ROW by ID
            if (targetRow) {
                console.log(`Reducing Stock for ID: ${targetRow.id} (Event: ${targetRow.event_slug})`);
                
                await supabase
                    .from('inventory')
                    .update({ count: Math.max(0, targetRow.count - 1) })
                    .eq('id', targetRow.id); 
            } else {
                console.log(`Item exists in Catalog but not in Inventory for this Event: ${item.productId}`);
            }
        }
    }
}

return NextResponse.json({ success: true, orderId: order.id });
} catch (error: any) {
console.error('Retail Order Error:', error);
return NextResponse.json({ success: false, error: error.message }, { status: 500 });
}
}