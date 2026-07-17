import { NextResponse } from 'next/server';

const SS_BASE = 'https://api.ssactivewear.com/v2';
const SS_IMG = 'https://www.ssactivewear.com/';
const getHeaders = () => ({ 'Authorization': `Basic ${Buffer.from(`${process.env.SS_ACCOUNT_NUMBER}:${process.env.SS_API_KEY}`).toString('base64')}`, 'Content-Type': 'application/json' });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const partNumber = searchParams.get('style') || '';
  if (!partNumber) return NextResponse.json({ error: 'style required' }, { status: 400 });

  try {
    // Get all SKUs for this style - each row has color, size, price, qty
    const res = await fetch(`${SS_BASE}/products/?style=${encodeURIComponent(partNumber)}&mediatype=json`, { headers: getHeaders() });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    
    const skus: any[] = await res.json();

    // Group by color
    const colorMap: Record<string, any> = {};
    skus.forEach(sku => {
      const key = sku.colorCode;
      if (!colorMap[key]) {
        colorMap[key] = {
          colorCode: sku.colorCode,
          colorName: sku.colorName,
          color1: sku.color1,
          imageUrl: sku.colorFrontImage ? `${SS_IMG}${sku.colorFrontImage.replace('_fm', '_fl')}` : null,
          swatchUrl: sku.colorSwatchImage ? `${SS_IMG}${sku.colorSwatchImage}` : null,
          sizes: [],
        };
      }
      colorMap[key].sizes.push({
        sizeName: sku.sizeName,
        sizeCode: sku.sizeCode,
        sizeOrder: sku.sizeOrder,
        piecePrice: sku.customerPrice || sku.piecePrice,
        qty: sku.qty,
        sku: sku.sku,
      });
    });

    // Sort sizes within each color
    Object.values(colorMap).forEach((color: any) => {
      color.sizes.sort((a: any, b: any) => (a.sizeOrder || '').localeCompare(b.sizeOrder || ''));
    });

    const colors = Object.values(colorMap).sort((a: any, b: any) => a.colorName.localeCompare(b.colorName));
    return NextResponse.json({ colors, totalSkus: skus.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
