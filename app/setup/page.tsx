'use client';
import { useEffect } from 'react';

export default function SetupRedirect() {
  useEffect(() => {
    const terminal = localStorage.getItem('square_terminal_id') || '';
    const site = localStorage.getItem('site_name') || '';
    const printer = localStorage.getItem('printer_id') || '';

    const params = new URLSearchParams();
    params.set('setup', 'true');
    if (terminal) params.set('terminal', terminal);
    if (site) params.set('site', site);
    if (printer) params.set('printer', printer);

    window.location.replace(`/?${params.toString()}`);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="text-6xl mb-4">⚙️</div>
        <p className="font-black text-xl animate-pulse">Opening Setup...</p>
      </div>
    </div>
  );
}
