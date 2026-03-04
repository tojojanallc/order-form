'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/supabase';

export default function CreateEventPage() {
  const [form, setForm] = useState({ name: '', slug: '', mode: 'retail' as 'retail' | 'hosted' });
  const [loading, setLoading] = useState(false);

  const buildSafeSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return alert('Event name is required.');

    setLoading(true);

    const safeSlug = buildSafeSlug(form.slug || form.name);

    const { error } = await supabase.from('event_settings').insert([
      {
        event_name: form.name,
        slug: safeSlug,
        status: 'active',
        payment_mode: form.mode,
        header_color: '#1e3a8a',
      },
    ]);

    if (error) {
      alert(`DB ERROR: ${error.message}`);
      setLoading(false);
      return;
    }

    alert('🎉 SUCCESS! Event Created.');
    window.location.href = '/admin';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto">
        {/* HEADER */}
        <div className="flex justify-between items-end mb-10">
          <div>
            <Link
              href="/admin"
              className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-1 inline-block hover:underline"
            >
              ← Command Center
            </Link>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Create Event</h1>
            <p className="text-gray-500 font-medium">Launch a new kiosk / event.</p>
          </div>

          <div className="bg-white px-6 py-4 rounded-3xl shadow-sm border border-gray-100 text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</p>
            <p className="text-2xl font-black text-green-600">Active</p>
          </div>
        </div>

        {/* MAIN CARD */}
        <div className="bg-white rounded-[40px] border border-gray-200 shadow-sm overflow-hidden">
          <form onSubmit={handleCreate} className="p-8 space-y-8">
            {/* EVENT DETAILS */}
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Event Details</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Event Name</label>
                  <input
                    required
                    className="mt-2 w-full bg-gray-50 border border-gray-200 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Spring Tournament"
                    value={form.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setForm((f) => ({ ...f, name, slug: buildSafeSlug(name) }));
                    }}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Slug</label>
                  <input
                    required
                    className="mt-2 w-full bg-gray-50 border border-gray-200 p-4 rounded-2xl text-sm font-mono font-black outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="spring-tournament"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: buildSafeSlug(e.target.value) }))}
                  />
                  <p className="text-[10px] text-gray-400 font-bold mt-2">
                    URL will be: <span className="font-mono">/{form.slug || 'your-slug'}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* PAYMENT MODE */}
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Payment Mode</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, mode: 'retail' }))}
                  className={`p-4 rounded-2xl border font-black text-xs uppercase tracking-widest transition-colors ${
                    form.mode === 'retail'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Retail (Collect Payment)
                </button>

                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, mode: 'hosted' }))}
                  className={`p-4 rounded-2xl border font-black text-xs uppercase tracking-widest transition-colors ${
                    form.mode === 'hosted'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Hosted (No Checkout)
                </button>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
              <Link
                href="/admin"
                className="px-8 py-4 rounded-2xl border border-gray-200 text-slate-700 font-black text-xs uppercase tracking-widest hover:bg-gray-50 text-center"
              >
                Cancel
              </Link>

              <button
                disabled={loading}
                className="px-8 py-4 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest hover:bg-blue-700 disabled:opacity-40"
              >
                {loading ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>

        {/* FOOTER NOTE */}
        <p className="text-[10px] text-gray-400 font-bold mt-6">
          Creating an event inserts a row into <span className="font-mono">event_settings</span>.
        </p>
      </div>
    </div>
  );
}
