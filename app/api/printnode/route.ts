import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  console.log("🖨️ PrintNode API Hit");

  try {
    const body = await req.json();
    const { content, title } = body;

    // 1. Fetch Settings
    const { data: settings, error: dbError } = await supabase.from('event_settings').select('*').single();
    
    if (dbError || !settings) {
        console.error("❌ DB Settings Error:", dbError);
        return NextResponse.json({ success: false, error: "Database settings not found." }, { status: 500 });
    }

    if (!settings.printnode_enabled || !settings.printnode_api_key || !settings.printnode_printer_id) {
        console.error("❌ PrintNode not configured in settings.");
        return NextResponse.json({ success: false, error: "PrintNode not fully configured." }, { status: 400 });
    }

    console.log(`✅ Config Found. Sending to Printer ID: ${settings.printnode_printer_id}`);

    // 2. Prepare Job
    // 'content' is already base64 encoded from the frontend (btoa).
    // PrintNode expects base64 for "raw_base64" content type.
    const printJob = {
      printerId: parseInt(settings.printnode_printer_id),
      title: title || "Swag Order",
      contentType: "raw_base64",
      content: content, 
      source: "Lev Custom App"
    };

    // 3. Send to PrintNode API
    const authHeader = 'Basic ' + btoa(settings.printnode_api_key + ':');
    
    const response = await fetch('https://api.printnode.com/printing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(printJob)
    });

    const responseText = await response.text();
    console.log(`📬 PrintNode Response (${response.status}):`, responseText);

    if (!response.ok) {
        // If response is 401, key is wrong. If 422, content is wrong.
        return NextResponse.json({ success: false, error: `API Error ${response.status}: ${responseText || 'Unknown PrintNode Error'}` }, { status: 500 });
    }

    // Success returns the Job ID (e.g. 123456)
    return NextResponse.json({ success: true, id: responseText });

  } catch (err: any) {
    console.error("❌ Fatal Route Error:", err);
    return NextResponse.json({ success: false, error: "Server Error: " + err.message }, { status: 500 });
  }
}