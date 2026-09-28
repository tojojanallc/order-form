import { supabase } from '@/supabase';

export type UnmatchedStock = { product_id: string; size: string; count: number };

// Moves an event's unsold stock back to the portal inventory tracker (portal.levcustom.com/admin/inventory).
// Stock that was loaded from the old kiosk warehouse goes back to inventory_master instead. Rows that match
// neither stay on the event (never silently dropped) and are returned for the caller to show.
// All of it runs in one database transaction (lev_inventory_return_from_event).
export async function returnEventStockToWarehouse(eventSlug: string, userEmail?: string | null) {
  const { data, error } = await supabase.rpc('lev_inventory_return_from_event', { p_event_slug: eventSlug, p_by: userEmail || null });
  if (error) throw error;
  const toTracker = Number(data?.to_tracker || 0);
  const toLegacy = Number(data?.to_legacy || 0);
  return { returnedUnits: toTracker + toLegacy, toTracker, toLegacy, unmatched: (data?.unmatched || []) as UnmatchedStock[] };
}

export function describeUnmatched(unmatched: UnmatchedStock[]) {
  return unmatched.map(u => `• ${u.product_id} — ${u.count}`).join('\n');
}
