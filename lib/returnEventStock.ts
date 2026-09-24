import { supabase } from '@/supabase';

export type UnmatchedStock = { product_id: string; size: string; count: number };

// Event stock rows sometimes label youth sizes "Youth L" while the warehouse SKU uses "L"
function youthFallbackSku(productId: string, size: string): string | null {
  if (!size.startsWith('Youth ')) return null;
  return productId.replace(` | ${size} | `, ` | ${size.slice(6)} | `);
}

// Moves an event's unsold stock back into inventory_master. Rows that can't be matched to a
// warehouse SKU stay on the event (never silently dropped) and are returned for the caller to show.
export async function returnEventStockToWarehouse(eventSlug: string, userEmail?: string | null) {
  const { data: rows, error } = await supabase.from('inventory')
    .select('product_id, size, count').eq('event_slug', eventSlug).gt('count', 0);
  if (error) throw error;

  let returnedUnits = 0;
  const unmatched: UnmatchedStock[] = [];

  for (const row of rows || []) {
    const candidates = [row.product_id, youthFallbackSku(row.product_id, row.size)].filter(Boolean) as string[];
    const { data: masters, error: readError } = await supabase.from('inventory_master')
      .select('sku, quantity_on_hand').in('sku', candidates);
    if (readError) throw readError;
    const master = candidates.map(sku => masters?.find(m => m.sku === sku)).find(Boolean);

    if (!master) { unmatched.push(row); continue; }

    const { error: addError } = await supabase.from('inventory_master')
      .update({ quantity_on_hand: (master.quantity_on_hand || 0) + row.count }).eq('sku', master.sku);
    if (addError) throw addError;
    const { error: zeroError } = await supabase.from('inventory')
      .update({ count: 0 }).eq('event_slug', eventSlug).eq('product_id', row.product_id).eq('size', row.size);
    if (zeroError) throw zeroError;
    await supabase.from('inventory_logs').insert({
      sku: master.sku, event_slug: eventSlug, quantity: row.count, action_type: 'return_to_warehouse', user_email: userEmail || null,
    });
    returnedUnits += row.count;
  }

  return { returnedUnits, unmatched };
}

export function describeUnmatched(unmatched: UnmatchedStock[]) {
  return unmatched.map(u => `• ${u.product_id} — ${u.count}`).join('\n');
}
