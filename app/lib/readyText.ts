// The "your order is ready" text. Adds the event's online store link when it's switched on in the portal
// (event_settings.kiosk_extras.storeOn + storeUrl).
export async function readyText(supabase: any, name: string, eventSlug?: string | null) {
  let msg = `Hi ${name}! Your order is ready for pickup. Please head to the Lev Custom Merch team and start wearing your new gear!`;
  if (!supabase || !eventSlug) return msg;
  try {
    const { data } = await supabase.from('event_settings').select('kiosk_extras').eq('slug', eventSlug).maybeSingle();
    const x = data?.kiosk_extras || {};
    if (x.storeOn && /^https?:\/\//.test(String(x.storeUrl || ''))) msg += ` Want more? Order online anytime: ${x.storeUrl}`;
  } catch { /* plain text if the lookup fails */ }
  return msg;
}
