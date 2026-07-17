import { NextResponse } from 'next/server';

const SS_BASE = 'https://api.ssactivewear.com/v2';
const SS_IMG = 'https://www.ssactivewear.com/';
const getHeaders = () => ({ 'Authorization': `Basic ${Buffer.from(`${process.env.SS_ACCOUNT_NUMBER}:${process.env.SS_API_KEY}`).toString('base64')}` });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const styleID = searchParams.get('styleID') || '';
  if (!styleID) return NextResponse.json({ error: 'styleID required' }, { status: 400 });

  try {
    const res = await fetch(`${SS_BASE}/products?styleID=${styleID}&mediatype=json`, { headers: getHeaders() });
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
          imageUrl: sku.colorFrontImage ? `${SS_IMG}${sku.colorFrontImage.replace('_fm', '_fl')}` : null,
          swatchUrl: sku.colorSwatchImage ? `${SS_IMG}${sku.colorSwatchImage}` : null,
          sizes: [],
        };
      }
      colorMap[key].sizes.push({
        sizeName: sku.sizeName,
        sizeCode: sku.sizeCode,
        sizeOrder: sku.sizeOrder || 0,
        piecePrice: sku.customerPrice || sku.piecePrice || 0,
        qty: sku.qty || 0,
        sku: sku.sku,
      });
    });

    // Sort sizes within each color by sizeOrder
    Object.values(colorMap).forEach((color: any) => {
      color.sizes.sort((a: any, b: any) => a.sizeOrder - b.sizeOrder);
    });

    const colors = Object.values(colorMap).sort((a: any, b: any) => a.colorName.localeCompare(b.colorName));
    return NextResponse.json({ colors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
