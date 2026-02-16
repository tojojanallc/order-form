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

    // This forces the slug to be unique by adding a random string
    // If THIS fails with a duplicate key, then your DB is truly haunted.
    const uniqueSlug = `${form.slug.toLowerCase().trim().replace(/\s+/g, '-')}-${Math.random().toString(36).substring(7)}`;

    const { error } = await supabase.from('event_settings').insert([{
      event_name: form.name,
      slug: uniqueSlug,
      status: 'active',
      payment_mode: form.mode,
      header_color: '#1e3a8a'
    }]);

    if (error) {
      alert(`DB ERROR: ${error.message} (Code: ${error.code})`);
      setLoading(false);
    } else {
      alert(`🎉 SUCCESS! Created as ${uniqueSlug}`);
      window.location.href = '/admin';
    }
  };

  return (
    <div className="min-h-screen bg-white p-8 max-w-2xl mx-auto border-x-4 border-black font-sans text-black">
      <Link href="/admin" className="text-blue-600 font-black uppercase text-[10px]">← Back</Link>
      <h1 className="text-6xl font-black uppercase mt-4 mb-10 italic italic tracking-tighter">New Event</h1>
      <form onSubmit={handleCreate} className="space-y-8 bg-gray-50 p-8 border-4 border-black shadow-[10px_10px_0px_0px_black]">
        <input required className="w-full p-4 border-4 border-black font-bold text-2xl" placeholder="EVENT NAME" 
          onChange={e => setForm({...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})} />
        <div className="grid grid-cols-2 gap-4">
          <button type="button" onClick={() => setForm(f => ({...f, mode: 'retail'}))} className={`p-4 border-4 font-black ${form.mode === 'retail' ? 'bg-blue-900 text-white shadow-[4px_4px_0px_0px_black]' : 'bg-white'}`}>RETAIL</button>
          <button type="button" onClick={() => setForm(f => ({...f, mode: 'hosted'}))} className={`p-4 border-4 font-black ${form.mode === 'hosted' ? 'bg-pink-600 text-white shadow-[4px_4px_0px_0px_black]' : 'bg-white'}`}>HOSTED</button>
        </div>
        <button disabled={loading} className="w-full bg-black text-white py-8 font-black text-2xl hover:bg-green-600 transition-all">
          {loading ? 'DEPLOYING...' : 'FORCE CREATE'}
        </button>
      </form>
    </div>
  );
}