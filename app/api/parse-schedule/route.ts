import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { base64 } = await req.json();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: `Analyze this tournament/meet schedule PDF and extract info. Return ONLY valid JSON, no markdown, no explanation:\n{"eventName":"name of event","divisions":[{"ageGroup":"e.g. 10U","numTeams":4,"athletesPerTeam":12,"notes":""}],"totalTeams":0,"estimatedAthletes":0,"eventDates":"date range"}` }
          ]
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data.error?.message || 'API error' }, { status: 500 });

    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return NextResponse.json({ success: true, schedule: parsed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
