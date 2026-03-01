'use client';
import { useState } from 'react';
import { supabase } from '@/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function generateSlug(input: string): string {
  return input.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export default function CreateEventPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', slug: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const safeSlug = generateSlug(form.slug);

    if (!safeSlug) {
      setError('Slug is required and must contain valid characters (letters, numbers, hyphens).');
      return;
    }

    setLoading(true);

    // BLIND INSERT: No ID sent. The DB will use the sequence starting at 20,000.
    const { error: dbError } = await supabase.from('event_settings').insert([{
      event_name: form.name,
      slug: safeSlug,
      status: 'active',
      payment_mode: 'retail',
      header_color: '#1e3a8a'
    }]);

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => router.push('/admin/events'), 1200);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-8 font-sans">
      <div className="w-full max-w-xl">

        {/* Back link */}
        <Link href="/admin/events" className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-500 transition-colors mb-8 inline-block">
          ← Back to Events
        </Link>

        <div className="bg-white rounded-[40px] p-10 shadow-sm border border-gray-100">
          {/* Header */}
          <div className="mb-10">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl mb-6">➕</div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Add New Event</h1>
            <p className="text-xs text-gray-400 font-medium mt-1">Create a new kiosk event with a unique slug and display name.</p>
          </div>

          {/* Success banner */}
          {success && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl px-5 py-4 text-green-700 font-bold text-sm">
              🎉 Event created! Redirecting to Events…
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-red-600 font-bold text-sm">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Event Name</label>
              <input
                type="text"
                required
                className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-500 font-bold outline-none"
                placeholder="e.g. Spring Classic 2025"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value, slug: generateSlug(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Slug</label>
              <input
                type="text"
                required
                className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-500 font-bold font-mono outline-none"
                placeholder="e.g. spring-classic-2025"
                value={form.slug}
                onChange={e => setForm({ ...form, slug: e.target.value })}
              />
              <p className="text-[10px] text-gray-400 font-medium mt-1 ml-1">Used in URLs. Lowercase letters, numbers, and hyphens only.</p>
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-60"
            >
              {loading ? 'Creating Event…' : 'Create Event →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}