'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CreateEventPage() {
  const [form, setForm] = useState({ name: '', slug: '', mode: 'retail' });
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.slug) return alert("Missing fields.");
    setLoading(true);

    // Clean Slug
    const safeSlug = form.slug.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // THE NUCLEAR INSERT: We only send Name, Slug, Status, and Mode.
    // If this fails with a PKEY error, your 'id' column is the problem.
    const { error } = await supabase.from('event_settings').insert([
      {
        event_name: form.name,
        slug: safeSlug,
        status: 'active',
        payment_mode: form.mode,
        header_color: '#1e3a8a',
        offer_back_names: true,
        offer_metallic: true,
        offer_personalization: true
      }
    ]);

    if (error) {
      console.error("Detailed DB Error:", error);
      // If it's code 23505, it's a duplicate.
      alert(`DATABASE REJECTED THIS: ${error.message} (Code: ${error.code}). Try changing the slug to something like ${safeSlug}-2026`);
      setLoading(false);
    } else {
      alert("🎉 SUCCESS! Event Created.");
      window.location.href = '/admin'; 
    }
  };

  return (
    <div className="min-h-screen bg-white text-black p-8 max-w-2xl mx-auto border-x-4 border-black font-sans">
      <Link href="/admin" className="text-blue-600 font-black uppercase text-[10px] hover:underline">← Command Center</Link>
      <h1 className="text-6xl font-black uppercase mt-4 mb-10 italic tracking-tighter">New Event</h1>

      <form onSubmit={handleCreate} className="space-y-8 bg-gray-50 p-8 border-4 border-black shadow-[12px_12px_0px_0px_black]">
        <div>
          <label className="block text-xs font-black uppercase mb-2">Event Title</label>
          <input 
            required 
            className="w-full p-4 border-4 border-black font-bold text-2xl outline-none focus:bg-yellow-50"
            placeholder="NSHS WINTER INVITE" 
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})} 
          />
        </div>

        <div>
          <label className="block text-xs font-black uppercase mb-2">Unique URL Slug</label>
          <input 
            required 
            className="w-full p-4 border-4 border-black font-mono text-lg outline-none focus:bg-yellow-50"
            value={form.slug} 
            onChange={e => setForm({...form, slug: e.target.value})} 
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <button 
            type="button" 
            onClick={() => setForm({...form, mode: 'retail'})} 
            className={`p-6 border-4 border-black font-black uppercase transition-all ${form.mode === 'retail' ? 'bg-blue-900 text-white shadow-[6px_6px_0px_0px_black] -translate-y-1' : 'bg-white'}`}
          >
            Retail
          </button>
          <button 
            type="button" 
            onClick={() => setForm({...form, mode: 'hosted'})} 
            className={`p-6 border-4 border-black font-black uppercase transition-all ${form.mode === 'hosted' ? 'bg-pink-600 text-white shadow-[6px_6px_0px_0px_black] -translate-y-1' : 'bg-white'}`}
          >
            Hosted
          </button>
        </div>

        <button disabled={loading} className="w-full bg-black text-white py-8 font-black uppercase text-3xl border-4 border-black hover:bg-green-500 hover:text-black transition-all">
          {loading ? 'DEPLOYING...' : 'LAUNCH EVENT'}
        </button>
      </form>
    </div>
  );
}