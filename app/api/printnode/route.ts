import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { content, title } = await req.json();

    // 1. Get Settings (API Key & Printer ID)
    const { data: settings } = await supabase.from('event_settings').select('*').single();
    
    if (!settings?.printnode_enabled || !settings?.printnode_api_key || !settings?.printnode_printer_id) {
      return NextResponse.json({ success: false, error: "PrintNode not configured" }, { status: 400 });
    }

    // 2. Construct PrintJob
    // We send this as "Raw" PDF base64. 
    // Note: The frontend must send us a Base64 PDF string in 'content'.
    const printJob = {
      printerId: parseInt(settings.printnode_printer_id),
      title: title || "Swag Order",
      contentType: "pdf_base64",
      content: content, // Base64 PDF string
      source: "Lev Custom App"
    };

    // 3. Send to PrintNode API
    const response = await fetch('https://api.printnode.com/printing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(settings.printnode_api_key + ':').toString('base64')
      },
      body: JSON.stringify(printJob)
    });

    if (!response.ok) {
        const errText = await response.text();
        return NextResponse.json({ success: false, error: errText }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: await response.json() });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}