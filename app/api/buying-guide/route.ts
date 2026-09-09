import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { form } = body

  // Fetch real historical size data
  const { data: sizeData } = await supabase
    .from('sales_ledger')
    .select('size, qty, sale_price, event_slug')
    .not('size', 'is', null)
    .gt('qty', 0)

  // Normalize size names and aggregate
  const sizeMap: Record<string, number> = {}
  const normalize: Record<string, string> = {
    'Adult S': 'S', 'Adult M': 'M', 'Adult L': 'L', 'Adult XL': 'XL', 'Adult XXL': '2XL',
    'Youth S': 'YS', 'Youth M': 'YM', 'Youth L': 'YL', 'Youth XL': 'YXL',
  }
  let total = 0
  for (const row of sizeData || []) {
    const sz = normalize[row.size] || row.size
    if (['YS','YM','YL','YXL','S','M','L','XL','2XL','3XL'].includes(sz)) {
      sizeMap[sz] = (sizeMap[sz] || 0) + row.qty
      total += row.qty
    }
  }
  const sizePcts = Object.entries(sizeMap)
    .map(([sz, qty]) => `${sz}: ${((qty/total)*100).toFixed(1)}%`)
    .sort((a, b) => {
      const order = ['YS','YM','YL','YXL','S','M','L','XL','2XL','3XL']
      return order.indexOf(a.split(':')[0]) - order.indexOf(b.split(':')[0])
    })
    .join(', ')

  const productList = (form.products || []).map((p: any) =>
    `- ${p.name} (${p.type}) @ $${p.price}${p.colors ? ` in ${p.colors}` : ''}`
  ).join('\n')

  const prompt = `You are a merchandise buying expert for onsite events. Generate a specific buying recommendation.

EVENT DETAILS:
- Sport/Type: ${form.sport}
- Age Groups: ${form.age_group}
- Attendance per Day: ${form.expected_attendance}
- Number of Days: ${form.num_days}
- Total Person-Days: ${parseInt(form.expected_attendance) * parseInt(form.num_days)}
- Notes: ${form.notes || 'None'}

PRODUCTS BEING SOLD:
${productList}

REAL HISTORICAL SIZE DISTRIBUTION (from ${total} actual units sold at past events):
${sizePcts}

Target a 65% sell-through rate — buy enough so you rarely run out but don't overbuy. 
Adjust size mix based on the age group (more youth sizes for youth-heavy events).
Give a specific qty for EACH size for EACH product.

Respond ONLY with valid JSON (no markdown):
{
  "summary": "2-3 sentence buying strategy",
  "total_units": number,
  "products": [
    {
      "name": "exact product name from list",
      "type": "t-shirt or hoodie etc",
      "price": number,
      "total": number,
      "sizes": {"YS":0,"YM":0,"YL":0,"YXL":0,"S":0,"M":0,"L":0,"XL":0,"2XL":0,"3XL":0},
      "notes": "one buying tip for this item"
    }
  ],
  "tips": ["tip1","tip2","tip3"],
  "risk_items": ["watch out for this"],
  "safe_bets": ["will sell well"]
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
  })

  const data = await res.json()
  return NextResponse.json(data)
}
