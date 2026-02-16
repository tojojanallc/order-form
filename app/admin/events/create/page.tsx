'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CreateEventAction() {
  const [form, setForm] = useState({ name: '', slug: '', mode: 'retail' });
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.slug) return alert("All fields are required.");
    setLoading(true);

    // CLEAN SLUG: Remove special chars and spaces
    const finalSlug = form.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const { error } = await supabase.from('event_settings').insert([{
      event_name: form.name,
      slug: finalSlug, // Primary Key usually
      status: 'active',
      payment_mode: form.mode,
      header_color: '#1e3a8a',
      offer_back_names: true,
      offer_metallic: true,
      offer_personalization: true
    }]);

    if (error) {
      // IF DUPLICATE, ALERT USER
      if (error.code === '23505') {
        alert("ERROR: That Slug is already taken. Please choose a different URL Slug.");
      } else {
        alert("DB Error: " + error.message);
      }
      setLoading(false);
    } else {
      alert("🎉 Event Created!");
      window.location.href = '/admin'; 
    }
  };

  return (
    <div className="min-h-screen bg-white text-black p-8 max-w-2xl mx-auto border-x-4 border-black font-sans">
      <Link href="/admin" className="text-blue-600 font-black uppercase text-xs hover:underline italic">← Command Center</Link>
      <h1 className="text-6xl font-black uppercase mt-4 mb-10 italic tracking-tighter">Launch Event</h1>

      <form onSubmit={handleCreate} className="space-y-8 bg-gray-50 p-8 border-4 border-black shadow-[10px_10px_0px_0px_black]">
        <div>
          <label className="block text-xs font-black uppercase mb-2">Event Title</label>
          <input 
            required 
            className="w-full p-4 border-4 border-black font-bold text-2xl outline-none focus:bg-yellow-50"
            placeholder="NICOLET INVITE 2026" 
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
          <p className="text-[10px] font-bold text-red-600 mt-2 uppercase">Warning: If this matches an existing event, it will fail.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button type="button" onClick={() => setForm({...form, mode: 'retail'})} 
            className={`p-6 border-4 border-black font-black uppercase transition-all ${form.mode === 'retail' ? 'bg-blue-900 text-white shadow-[5px_5px_0px_0px_black] -translate-y-1' : 'bg-white'}`}>Retail</button>
          <button type="button" onClick={() => setMode('hosted')} 
            className={`p-6 border-4 border-black font-black uppercase transition-all ${form.mode === 'hosted' ? 'bg-pink-600 text-white shadow-[5px_5px_0px_0px_black] -translate-y-1' : 'bg-white'}`}>Hosted</button>
        </div>

        <button disabled={loading} className="w-full bg-black text-white py-8 font-black uppercase text-3xl border-4 border-black hover:bg-green-600 active:translate-y-2 transition-all shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)]">
          {loading ? 'DEPLOYING...' : 'LAUNCH EVENT'}
        </button>
      </form>
    </div>
  );
}