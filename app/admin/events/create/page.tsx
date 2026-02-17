'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function CreateEventPage() {
  const [form, setForm] = useState({ name: '', slug: '', mode: 'retail' });
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const safeSlug = form.slug.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // BLIND INSERT: No ID sent. The DB will now use the sequence starting at 20,000.
    const { error } = await supabase.from('event_settings').insert([{
      event_name: form.name,
      slug: safeSlug,
      status: 'active',
      payment_mode: form.mode,
      header_color: '#1e3a8a'
    }]);

    if (error) {
      alert(`DB ERROR: ${error.message}\n(Did you run the SQL to create the 'seq_new' sequence?)`);
      setLoading(false);
    } else {
      alert("🎉 SUCCESS! Event Created.");
      window.location.href = '/admin';
    }
  };

  return (
    <div className="min-h-screen bg-white p-8 max-w-2xl mx-auto border-4 border-black font-sans text-black">
      <h1 className="text-5xl font-black uppercase mb-8 italic">New Event</h1>
      <form onSubmit={handleCreate} className="space-y-6 bg-gray-50 p-6 border-4 border-black">
        <input required className="w-full p-4 border-4 border-black font-bold text-xl" placeholder="EVENT NAME" 
          onChange={e => setForm({...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})} />
        <input required className="w-full p-4 border-4 border-black font-mono" value={form.slug} 
          onChange={e => setForm({...form, slug: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <button type="button" onClick={() => setForm(f => ({...f, mode: 'retail'}))} className={`p-4 border-4 font-black ${form.mode === 'retail' ? 'bg-blue-900 text-white' : 'bg-white'}`}>RETAIL</button>
          <button type="button" onClick={() => setForm(f => ({...f, mode: 'hosted'}))} className={`p-4 border-4 font-black ${form.mode === 'hosted' ? 'bg-pink-600 text-white' : 'bg-white'}`}>HOSTED</button>
        </div>
        <button disabled={loading} className="w-full bg-black text-white py-6 font-black text-2xl hover:bg-green-600">
          {loading ? 'PROCESSING...' : 'LAUNCH NOW'}
        </button>
      </form>
    </div>
  );
}