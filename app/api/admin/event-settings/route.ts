import { NextResponse, type NextRequest } from 'next/server';
import { admin } from '@/app/lib/server';
import { kioskUser } from '@/lib/kioskAuth';

// Kiosk admin saves to event_settings (the table is read-only to the browser). Staff passcode: printer settings
// only. Lev accounts / admin passcode: printer settings plus closing the event and its closing totals.
const STAFF_FIELDS = ['printer_type', 'printnode_enabled', 'printnode_printer_id'];
const ADMIN_FIELDS = [...STAFF_FIELDS, 'status', 'staffing_cost', 'truck_rental_cost', 'travel_gas_cost', 'misc_expenses', 'total_processing_fees', 'total_invoiced_value'];

export async function PATCH(req: NextRequest) {
  const who = await kioskUser(req);
  if (!who) return NextResponse.json({ error: 'Sign in to the kiosk admin first' }, { status: 401 });
  const { slug, fields } = await req.json().catch(() => ({}));
  const allowed = who.role === 'admin' ? ADMIN_FIELDS : STAFF_FIELDS;
  const update: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if (!allowed.includes(k)) return NextResponse.json({ error: `Not allowed to change ${k}` }, { status: 403 });
    update[k] = v;
  }
  if (!slug || !Object.keys(update).length) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
  const { data, error } = await admin().from('event_settings').update(update).eq('slug', slug).select('slug');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
