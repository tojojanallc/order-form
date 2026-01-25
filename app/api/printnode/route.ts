import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  console.log("🖨️ PrintNode API Route Hit"); // Debug Log

  try {
    const body = await req.json();
    const { content, title } = body;

    // 1. Get Settings
    const { data: settings, error: dbError } = await supabase.from('event_settings').select('*').single();
    
    if (dbError || !settings) {
        console.error("❌ DB Error:", dbError);
        return NextResponse.json({ success: false, error: "Database settings not found" }, { status: 500 });
    }

    console.log("⚙️ Settings Loaded:", { 
        enabled: settings.printnode_enabled, 
        hasKey: !!settings.printnode_api_key, 
        printerId: settings.printnode_printer_id 
    });

    if (!settings.printnode_enabled || !settings.printnode_api_key || !settings.printnode_printer_id) {
      console.error("❌ Missing Config");
      return NextResponse.json({ success: false, error: "PrintNode not configured in Admin" }, { status: 400 });
    }

    // 2. Prepare Job
    // Note: We use "raw_base64" for text. If using a Zebra printer, this should ideally be ZPL code.
    // For standard text, some printers might ignore it, but PrintNode should still receive the job.
    const printJob = {
      printerId: parseInt(settings.printnode_printer_id),
      title: title || "Swag Order",
      contentType: "raw_base64",
      content: content, 
      source: "Lev Custom App"
    };

    // 3. Send to PrintNode
    console.log("🚀 Sending to PrintNode...");
    const response = await fetch('https://api.printnode.com/printing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Authorization: Basic base64(apiKey:)
        'Authorization': 'Basic ' + Buffer.from(settings.printnode_api_key + ':').toString('base64')
      },
      body: JSON.stringify(printJob)
    });

    const respText = await response.text();
    console.log("📬 PrintNode Response:", response.status, respText);

    if (!response.ok) {
        return NextResponse.json({ success: false, error: "PrintNode API Error: " + respText }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: respText });

  } catch (err: any) {
    console.error("❌ Fatal Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}