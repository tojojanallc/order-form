import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { name, event_slug } = await req.json();

    if (!name || !event_slug) {
      return NextResponse.json({ error: 'Missing name or event_slug' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Check if this name already exists for this event (case-insensitive)
    const { data: existing, error: lookupError } = await supabase
      .from('guests')
      .select('id, name, has_ordered')
      .eq('event_slug', event_slug)
      .ilike('name', trimmedName)
      .maybeSingle();

    if (lookupError) {
      console.error('Guest lookup error:', lookupError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (existing) {
      if (existing.has_ordered) {
        return NextResponse.json({ status: 'already_ordered', name: existing.name });
      }
      return NextResponse.json({ status: 'ready', guestId: existing.id, name: existing.name });
    }

    // New guest — insert them
    const { data: newGuest, error: insertError } = await supabase
      .from('guests')
      .insert({ name: trimmedName, event_slug, has_ordered: false })
      .select('id, name')
      .single();

    if (insertError) {
      console.error('Guest insert error:', insertError);
      return NextResponse.json({ error: 'Failed to register guest' }, { status: 500 });
    }

    return NextResponse.json({ status: 'ready', guestId: newGuest.id, name: newGuest.name });
  } catch (err: any) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
