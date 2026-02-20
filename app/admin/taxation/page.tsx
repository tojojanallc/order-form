'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase';
import Link from 'next/link';

export default function TaxationDashboard() {
  const [eventStats, setEventStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ gross: 0, taxable: 0, tax: 0 });

  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);

  useEffect(() => {
    fetchTaxData();
  }, [startDate, endDate]);

  async function fetchTaxData() {
    setLoading(true);

    const { data: events } = await supabase
      .from('event_settings')
      .select('*')
      .eq('tax_enabled', true)
      .order('created_at', { ascending: false });

    // THE FIX: We now pull tax_collected from the database
    let query = supabase.from('orders').select('event_slug, total_price, tax_collected, status, created_at');
    
    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
    
    const { data: orders } = await query;

    if (events && orders) {
      let masterGross = 0;
      let masterTaxable = 0;
      let masterTax = 0;

      const stats = events.map(evt => {
        const eventOrders = orders.filter(o => o.event_slug === evt.slug && Number(o.total_price) > 0);
        
        if (eventOrders.length === 0) return null;

        // THE NEW MATH: Just add up the columns directly! No guessing.
        const grossRevenue = eventOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);
        const taxCollected = eventOrders.reduce((sum, o) => sum + Number(o.tax_collected || 0), 0);
        const taxableRevenue = grossRevenue - taxCollected;

        masterGross += grossRevenue;
        masterTaxable += taxableRevenue;
        masterTax += taxCollected;

        return {
          id: evt.id,
          name: evt.event_name,
          slug: evt.slug,
          rate: Number(evt.tax_rate) || 0,
          orderCount: eventOrders.length,
          grossRevenue,
          taxableRevenue,
          taxCollected
        };
      }).filter(Boolean);

      setEventStats(stats);
      setTotals({ gross: masterGross, taxable: masterTaxable, tax: masterTax });
    }

    setLoading(false);
  }

  const exportToCSV = () => {
    const headers = ['Event Name', 'Tax Rate (%)', 'Total Orders', 'Gross Revenue ($)', 'Taxable Revenue ($)', 'Tax Collected ($)'];
    const rows = eventStats.map(evt => [
      `"${evt.name}"`, 
      evt.rate.toFixed(2), 
      evt.orderCount, 
      evt.grossRevenue.toFixed(2), 
      evt.taxableRevenue.toFixed(2), 
      evt.taxCollected.toFixed(2)
    ]);

    rows.push(['"GRAND TOTALS"', '---', '---', totals.gross.toFixed(2), totals.taxable.toFixed(2), totals.tax.toFixed(2)]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + `"Tax Report: ${startDate} to ${endDate}"\n\n`
      + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `lev_custom_tax_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-[1400px] mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <Link href="/admin" className="text-[10px] font-black uppercase text-blue-600 tracking-widest hover:underline">← Command Center</Link>
            <h1 className="text-4xl font-black tracking-tight mt-1 uppercase">Tax Liability</h1>
          </div>
          
          <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex flex-col px-4">
                <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Start Date</label>
                <input 
                    type="date" 
                    className="border-none outline-none font-bold text-slate-700 bg-transparent"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                />
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            <div className="flex flex-col px-4">
                <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">End Date</label>
                <input 
                    type="date" 
                    className="border-none outline-none font-bold text-slate-700 bg-transparent"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                />
            </div>
          </div>

          <button 
            onClick={exportToCSV}
            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800 transition-all flex items-center gap-2"
          >
            📥 Export CSV
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Gross Revenue (Period)</p>
            <p className="text-4xl font-black text-slate-900">${totals.gross.toFixed(2)}</p>
            <p className="text-xs font-bold text-gray-400 mt-2">All cash & card receipts</p>
          </div>
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Taxable Sales (Period)</p>
            <p className="text-4xl font-black text-blue-600">${totals.taxable.toFixed(2)}</p>
            <p className="text-xs font-bold text-gray-400 mt-2">Your actual kept revenue</p>
          </div>
          <div className="bg-emerald-50 p-8 rounded-[32px] border border-emerald-100 shadow-sm">
            <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-1">Tax Collected (Period)</p>
            <p className="text-4xl font-black text-emerald-700">${totals.tax.toFixed(2)}</p>
            <p className="text-xs font-bold text-emerald-600/70 mt-2">Funds to remit</p>
          </div>
        </div>

        <div className="bg-white rounded-[40px] border border-gray-100 shadow-2xl overflow-hidden mb-20">
          <div className="grid grid-cols-12 bg-slate-100 p-6 px-10 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 border-b">
            <div className="col-span-4">Event Name</div>
            <div className="col-span-2 text-center">Tax Rate</div>
            <div className="col-span-2 text-right">Gross Receipts</div>
            <div className="col-span-2 text-right">Taxable Sales</div>
            <div className="col-span-2 text-right text-emerald-600">Tax Collected</div>
          </div>

          <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-10 text-center text-gray-400 font-bold uppercase tracking-widest">Calculating Liability...</div>
            ) : eventStats.length === 0 ? (
              <div className="p-10 text-center text-gray-400 font-bold uppercase tracking-widest">No taxable sales in this date range.</div>
            ) : (
              eventStats.map((evt) => (
                <div key={evt.id} className="grid grid-cols-12 p-6 px-10 items-center hover:bg-blue-50/30 transition-colors">
                  <div className="col-span-4">
                    <h3 className="text-lg font-black text-slate-900 uppercase leading-none truncate">{evt.name}</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{evt.orderCount} Orders Processed</p>
                  </div>
                  <div className="col-span-2 text-center">
                    <span className="bg-gray-100 text-slate-600 px-3 py-1 rounded-lg text-sm font-black border border-gray-200">{evt.rate}%</span>
                  </div>
                  <div className="col-span-2 text-right font-black text-slate-700 text-lg">
                    ${evt.grossRevenue.toFixed(2)}
                  </div>
                  <div className="col-span-2 text-right font-black text-blue-600 text-lg">
                    ${evt.taxableRevenue.toFixed(2)}
                  </div>
                  <div className="col-span-2 text-right font-black text-emerald-600 text-xl">
                    ${evt.taxCollected.toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}