'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function CreateEventPage() {
  const [form, setForm] = useState({ name: '', slug: '', mode: 'retail' });
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // FIX: If the slug "jr-dukes" is causing a 23505, let's force a unique one 
    // to bypass whatever ghost record is in your DB.
    const uniqueSlug = `${form.slug.toLowerCase().trim().replace(/\s+/g, '-')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { error } = await supabase.from('event_settings').insert([{
      event_name: form.name,
      slug: uniqueSlug, // FORCED UNIQUE
      status: 'active',
      payment_mode: form.mode,
      header_color: '#1e3a8a'
    }]);

    if (error) {
      // If this STILL fails with 23505, your 'id' column is the problem, not the slug.
      console.error(error);
      alert(`DB REJECTED: ${error.message}. Your "id" column is likely stuck.`);
      setLoading(false);
    } else {
      alert(`🎉 SUCCESS! Created as: ${uniqueSlug}`);
      window.location.href = '/admin';
    }
  };

  return (
    <div className="min-h-screen bg-white p-8 max-w-2xl mx-auto border-x-4 border-black font-sans text-black">
      <Link href="/admin" className="text-blue-600 font-black uppercase text-[10px]">← Dashboard</Link>
      <h1 className="text-6xl font-black uppercase mt-4 mb-10 italic">New Event</h1>
      <form onSubmit={handleCreate} className="space-y-8 bg-gray-50 p-8 border-4 border-black">
        <div>
          <label className="block text-xs font-black uppercase mb-2">Title</label>
          <input required className="w-full p-4 border-4 border-black font-bold text-2xl" value={form.name} onChange={e => setForm({...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})} />
        </div>
        <div>
          <label className="block text-xs font-black uppercase mb-2">Base Slug</label>
          <input required className="w-full p-4 border-4 border-black font-mono text-lg" value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button type="button" onClick={() => setForm(prev => ({...prev, mode: 'retail'}))} className={`p-6 border-4 font-black uppercase ${form.mode === 'retail' ? 'bg-blue-900 text-white shadow-[4px_4px_0px_0px_black]' : 'bg-white'}`}>Retail</button>
          <button type="button" onClick={() => setForm(prev => ({...prev, mode: 'hosted'}))} className={`p-6 border-4 font-black uppercase ${form.mode === 'hosted' ? 'bg-pink-600 text-white shadow-[4px_4px_0px_0px_black]' : 'bg-white'}`}>Hosted</button>
        </div>
        <button disabled={loading} className="w-full bg-black text-white py-8 font-black uppercase text-3xl hover:bg-green-600">{loading ? '...' : 'LAUNCH'}</button>
      </form>
    </div>
  );
}