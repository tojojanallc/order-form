import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseServerClient() {
  // Prefer service role in routes when available (safer for server reads)
  const key = supabaseServiceKey || supabaseAnonKey;
  if (!supabaseUrl || !key) return null;
  return createClient(supabaseUrl, key);
}

export async function isInventoryEnabledForEvent(eventSlug: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return true; // fail-open: don’t break checkout if misconfigured

  const slug = eventSlug || 'default';

  const { data } = await supabase
    .from('event_settings')
    .select('inventory_enabled')
    .eq('slug', slug)
    .maybeSingle();

  // default behavior = inventory ON
  return data?.inventory_enabled ?? true;
}
