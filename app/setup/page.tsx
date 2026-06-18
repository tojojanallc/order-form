'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function SetupPage() {
  const [terminals, setTerminals] = useState<any[]>([]);
  const [eventSites, setEventSites] = useState<any[]>([]);
  const [printers, setPrinters] = useState<any[]>([]);
  const [siteName, setSiteName] = useState('');
  const [printerId, setPrinterId] = useState('');
  const [currentTerminal, setCurrentTerminal] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSiteName(localStorage.getItem('site_name') || '');
    setPrinterId(localStorage.getItem('printer_id') || '');
    setCurrentTerminal(localStorage.getItem('square_terminal_id') || '');

    const hash = window.location.hash.slice(1);
    if (hash) setSiteName(decodeURIComponent(hash));

    const load = async () => {
      const eventSlug = localStorage.getItem('event_slug') || '';
      const [{ data: terms }, { data: sites }, { data: prns }] = await Promise.all([
        supabase.from('terminals').select('*').order('id'),
        eventSlug ? supabase.from('event_sites').select('*').eq('event_slug', eventSlug).order('id') : Promise.resolve({ data: [] }),
        supabase.from('printers').select('*').order('name'),
      ]);
      if (terms) setTerminals(terms);
      if (sites) setEventSites(sites);
      if (prns) setPrinters(prns);
      setLoading(false);
    };
    load();
  }, []);

  const handleSiteSelect = (site: any) => {
    setSiteName(site.name);
    if (site.printer_id) setPrinterId(site.printer_id);
  };

  const select = (terminalId: string) => {
    localStorage.setItem('square_terminal_id', terminalId);
    localStorage.setItem('site_name', siteName);
    localStorage.setItem('printer_id', printerId);
    setCurrentTerminal(terminalId);
    setSaved(true);
    setTimeout(() => {
      const params = new URLSearchParams();
      params.set('terminal', terminalId);
      if (siteName) params.set('site', siteName);
      if (printerId) params.set('printer', printerId);
      window.location.href = `/?${params.toString()}`;
    }, 1200);
  };

  if (saved) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-center p-8">
        <div>
          <div className="text-6xl mb-4">✅</div>
          <p className="text-2xl font-black mb-2">Saved!</p>
          <p className="text-gray-400 animate-pulse">Opening kiosk...</p>
        </div>
      </div>
    );
  }

  // Find printer name from ID for display
  const printerName = printers.find(p => p.printer_id === printerId)?.name || (printerId ? `ID: ${printerId}` : '');

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-black mb-1">🛠️ Kiosk Setup</h1>
      <p className="text-gray-400 text-center mb-6 text-sm">Configure this iPad's site, printer, and payment device</p>

      <div className="space-y-4 w-full max-w-md">

        {/* Site picker */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-600">
          <label className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2 block">Site</label>
          {!loading && eventSites.length > 0 ? (
            <div className="space-y-2">
              {eventSites.map(site => (
                <button key={site.id} onClick={() => handleSiteSelect(site)}
                  className={`w-full text-left p-3 rounded-lg border font-bold transition-all ${siteName === site.name ? 'bg-blue-700 border-blue-400 text-white' : 'bg-gray-700 border-gray-500 text-white hover:border-blue-400'}`}>
                  📍 {site.name}
                  {site.printer_id && <span className="block text-xs font-mono text-gray-400 mt-0.5">🖨️ {printers.find(p => p.printer_id === site.printer_id)?.name || site.printer_id}</span>}
                </button>
              ))}
            </div>
          ) : (
            <input
              className="w-full bg-gray-700 border border-gray-500 rounded-lg px-4 py-3 text-white font-bold text-lg focus:outline-none focus:border-blue-400"
              placeholder="e.g. Site A, North Entrance"
              value={siteName}
              onChange={e => setSiteName(e.target.value)}
            />
          )}
        </div>

        {/* Printer selector */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-600">
          <label className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2 block">Printer</label>
          {!loading && printers.length > 0 ? (
            <div className="space-y-2">
              {printers.map(p => (
                <button key={p.id} onClick={() => setPrinterId(p.printer_id)}
                  className={`w-full text-left p-3 rounded-lg border font-bold transition-all ${printerId === p.printer_id ? 'bg-blue-700 border-blue-400 text-white' : 'bg-gray-700 border-gray-500 text-white hover:border-blue-400'}`}>
                  🖨️ {p.name}
                  <span className="block text-xs font-mono text-gray-400 mt-0.5">{p.printer_id}</span>
                </button>
              ))}
            </div>
          ) : (
            <input
              className="w-full bg-gray-700 border border-gray-500 rounded-lg px-4 py-3 text-white font-mono font-bold focus:outline-none focus:border-blue-400"
              placeholder="e.g. 12345678"
              value={printerId}
              onChange={e => setPrinterId(e.target.value)}
            />
          )}
        </div>

        <div className="border-t border-gray-700 pt-4">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Payment Device</p>
        </div>

        <button onClick={() => select('BLUETOOTH_READER')}
          className={`w-full p-4 rounded-xl text-lg font-bold border transition-colors ${currentTerminal === 'BLUETOOTH_READER' ? 'bg-blue-700 border-blue-400' : 'bg-gray-800 border-gray-600 hover:bg-blue-600 hover:border-blue-400'}`}>
          📱 Bluetooth Reader
          <span className="block text-xs font-normal text-gray-400 mt-1">Square POS app + contactless reader</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-gray-700" />
          <span className="text-xs text-gray-500 uppercase tracking-widest">or Square Terminal</span>
          <div className="flex-1 border-t border-gray-700" />
        </div>

        {loading ? (
          <p className="text-center text-gray-500 animate-pulse">Loading terminals...</p>
        ) : terminals.length === 0 ? (
          <p className="text-center text-red-400 text-sm">No terminals found.</p>
        ) : (
          terminals.map(t => (
            <button key={t.id} onClick={() => select(t.device_id)}
              className={`w-full p-4 rounded-xl text-lg font-bold border transition-colors ${currentTerminal === t.device_id ? 'bg-blue-700 border-blue-400' : 'bg-gray-800 border-gray-600 hover:bg-blue-600 hover:border-blue-400'}`}>
              {t.label}
              <span className="block text-xs font-mono text-gray-500 mt-1">{t.device_id}</span>
            </button>
          ))
        )}

        {currentTerminal && (
          <p className="text-center text-xs text-green-400 font-bold pt-2">
            Currently: {currentTerminal === 'BLUETOOTH_READER' ? '📱 Bluetooth Reader' : terminals.find(t => t.device_id === currentTerminal)?.label || currentTerminal}
            {siteName ? ` — ${siteName}` : ''}
            {printerName ? ` — 🖨️ ${printerName}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function SetupPage() {
  const [terminals, setTerminals] = useState<any[]>([]);
  const [eventSites, setEventSites] = useState<any[]>([]);
  const [siteName, setSiteName] = useState('');
  const [printerId, setPrinterId] = useState('');
  const [currentTerminal, setCurrentTerminal] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load existing config
    setSiteName(localStorage.getItem('site_name') || '');
    setPrinterId(localStorage.getItem('printer_id') || '');
    setCurrentTerminal(localStorage.getItem('square_terminal_id') || '');

    // Check URL hash for pre-filled site name (from admin setup URL)
    const hash = window.location.hash.slice(1);
    if (hash) setSiteName(decodeURIComponent(hash));

    // Fetch terminals and event sites
    const load = async () => {
      const eventSlug = localStorage.getItem('event_slug') || '';

      const [{ data: terms }, { data: sites }] = await Promise.all([
        supabase.from('terminals').select('*').order('id'),
        eventSlug
          ? supabase.from('event_sites').select('*').eq('event_slug', eventSlug).order('id')
          : Promise.resolve({ data: [] }),
      ]);

      if (terms) setTerminals(terms);
      if (sites) setEventSites(sites);
      setLoading(false);
    };
    load();
  }, []);

  // When site is selected from dropdown, also set printer ID
  const handleSiteSelect = (site: any) => {
    setSiteName(site.name);
    if (site.printer_id) setPrinterId(site.printer_id);
  };

  const select = (terminalId: string) => {
    localStorage.setItem('square_terminal_id', terminalId);
    localStorage.setItem('site_name', siteName);
    localStorage.setItem('printer_id', printerId);
    setCurrentTerminal(terminalId);
    setSaved(true);

    setTimeout(() => {
      const params = new URLSearchParams();
      params.set('terminal', terminalId);
      if (siteName) params.set('site', siteName);
      if (printerId) params.set('printer', printerId);
      window.location.href = `/?${params.toString()}`;
    }, 1200);
  };

  if (saved) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-center p-8">
        <div>
          <div className="text-6xl mb-4">✅</div>
          <p className="text-2xl font-black mb-2">Saved!</p>
          <p className="text-gray-400 animate-pulse">Opening kiosk...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-black mb-1">🛠️ Kiosk Setup</h1>
      <p className="text-gray-400 text-center mb-6 text-sm">Configure this iPad's site, printer, and payment device</p>

      <div className="space-y-4 w-full max-w-md">

        {/* Site picker — from event admin if available, else manual */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-600">
          <label className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2 block">Site</label>
          {!loading && eventSites.length > 0 ? (
            <div className="space-y-2">
              {eventSites.map(site => (
                <button key={site.id} onClick={() => handleSiteSelect(site)}
                  className={`w-full text-left p-3 rounded-lg border font-bold transition-all ${siteName === site.name ? 'bg-blue-700 border-blue-400 text-white' : 'bg-gray-700 border-gray-500 text-white hover:border-blue-400'}`}>
                  📍 {site.name}
                  {site.printer_id && <span className="block text-xs font-mono text-gray-400 mt-0.5">🖨️ {site.printer_id}</span>}
                </button>
              ))}
            </div>
          ) : (
            <input
              className="w-full bg-gray-700 border border-gray-500 rounded-lg px-4 py-3 text-white font-bold text-lg focus:outline-none focus:border-blue-400"
              placeholder="e.g. Site A, North Entrance"
              value={siteName}
              onChange={e => setSiteName(e.target.value)}
            />
          )}
        </div>

        {/* Printer ID — only show manually if not set by site */}
        {(!eventSites.length || !eventSites.find(s => s.name === siteName)?.printer_id) && (
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-600">
            <label className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2 block">PrintNode Printer ID</label>
            <input
              className="w-full bg-gray-700 border border-gray-500 rounded-lg px-4 py-3 text-white font-mono font-bold focus:outline-none focus:border-blue-400"
              placeholder="e.g. 12345678"
              value={printerId}
              onChange={e => setPrinterId(e.target.value)}
            />
          </div>
        )}

        <div className="border-t border-gray-700 pt-4">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Payment Device</p>
        </div>

        {/* Bluetooth Reader */}
        <button onClick={() => select('BLUETOOTH_READER')}
          className={`w-full p-4 rounded-xl text-lg font-bold border transition-colors ${currentTerminal === 'BLUETOOTH_READER' ? 'bg-blue-700 border-blue-400' : 'bg-gray-800 border-gray-600 hover:bg-blue-600 hover:border-blue-400'}`}>
          📱 Bluetooth Reader
          <span className="block text-xs font-normal text-gray-400 mt-1">Square POS app + contactless reader</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-gray-700" />
          <span className="text-xs text-gray-500 uppercase tracking-widest">or Square Terminal</span>
          <div className="flex-1 border-t border-gray-700" />
        </div>

        {loading ? (
          <p className="text-center text-gray-500 animate-pulse">Loading terminals...</p>
        ) : terminals.length === 0 ? (
          <p className="text-center text-red-400 text-sm">No terminals found. Add them in Admin first.</p>
        ) : (
          terminals.map(t => (
            <button key={t.id} onClick={() => select(t.device_id)}
              className={`w-full p-4 rounded-xl text-lg font-bold border transition-colors ${currentTerminal === t.device_id ? 'bg-blue-700 border-blue-400' : 'bg-gray-800 border-gray-600 hover:bg-blue-600 hover:border-blue-400'}`}>
              {t.label}
              <span className="block text-xs font-mono text-gray-500 mt-1">{t.device_id}</span>
            </button>
          ))
        )}

        {currentTerminal && (
          <p className="text-center text-xs text-green-400 font-bold pt-2">
            Currently: {currentTerminal === 'BLUETOOTH_READER' ? '📱 Bluetooth Reader' : terminals.find(t => t.device_id === currentTerminal)?.label || currentTerminal}
            {siteName ? ` — ${siteName}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
