import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { event_name, slug, payment_mode, open_guest_entry, header_color } = body;

    if (!event_name || !slug) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase.from('event_settings').insert([{
      event_name,
      slug,
      status: 'active',
      payment_mode: payment_mode || 'retail',
      header_color: header_color || '#1e3a8a',
      open_guest_entry: open_guest_entry || false,
    }]).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, event: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
