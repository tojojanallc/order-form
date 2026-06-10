'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function CreateEventPage() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [mode, setMode] = useState<'retail' | 'hosted'>('retail');
  const [openGuestEntry, setOpenGuestEntry] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const buildSafeSlug = (v: string) => v.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const handleNameChange = (v: string) => {
    setName(v);
    setSlug(buildSafeSlug(v));
  };

  const createEvent = async () => {
    if (!name.trim()) { alert('Event name is required.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/create-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: name.trim(),
          slug: buildSafeSlug(slug || name),
          payment_mode: mode,
          header_color: '#1e3a8a',
          open_guest_entry: mode === 'hosted' ? openGuestEntry : false,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setDone(true);
    } catch (err: any) {
      alert('Error: ' + err.message);
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-black mb-4">"{name}" Created!</h1>
          <Link href="/admin/events" className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase">
            Go to Event Admin →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-lg mx-auto">
        <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase tracking-widest hover:underline">← Command Center</Link>
        <h1 className="text-4xl font-black mt-2 mb-8">Create Event</h1>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8 space-y-6">

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Event Name</label>
            <input
              className="w-full bg-gray-50 border border-gray-200 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Spring Tournament"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Slug</label>
            <input
              className="w-full bg-gray-50 border border-gray-200 p-4 rounded-2xl text-sm font-mono font-black outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="spring-tournament"
              value={slug}
              onChange={e => setSlug(buildSafeSlug(e.target.value))}
            />
            <p className="text-xs text-gray-400 mt-1">URL: /{slug || 'your-slug'}</p>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Payment Mode</label>
            <div className="grid grid-cols-2 gap-3">
              {(['retail', 'hosted'] as const).map(m => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`p-4 rounded-2xl border font-black text-xs uppercase tracking-widest transition-colors ${mode === m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-gray-200'}`}>
                  {m === 'retail' ? 'Retail (Collect Payment)' : 'Hosted (No Checkout)'}
                </button>
              ))}
            </div>
          </div>

          {mode === 'hosted' && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-slate-800">Open Guest Entry</p>
                <p className="text-xs text-gray-500 mt-0.5">Guests type their own name</p>
              </div>
              <input type="checkbox" checked={openGuestEntry} onChange={e => setOpenGuestEntry(e.target.checked)} className="w-5 h-5 cursor-pointer accent-indigo-600" />
            </div>
          )}

          <button
            type="button"
            disabled={loading || !name.trim()}
            onClick={createEvent}
            className="w-full px-8 py-4 rounded-2xl bg-blue-600 text-white font-black text-sm uppercase tracking-widest hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Creating...' : 'Create Event'}
          </button>

        </div>
      </div>
    </div>
  );
}
