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

    // If "jr-dukes" is blocked, this makes it "jr-dukes-742" or similar
    const cleanSlug = form.slug.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const finalSlug = `${cleanSlug}-${Math.floor(100 + Math.random() * 900)}`;

    const { error } = await supabase.from('event_settings').insert([{
      event_name: form.name,
      slug: finalSlug, 
      status: 'active',
      payment_mode: form.mode,
      header_color: '#1e3a8a'
    }]);

    if (error) {
      alert(`DB ERROR: ${error.message}`);
      setLoading(false);
    } else {
      alert(`🎉 SUCCESS! Event created as: ${finalSlug}`);
      window.location.href = '/admin';
    }
  };

  return (
    <div className="min-h-screen bg-white p-8 max-w-2xl mx-auto border-x-4 border-black text-black font-sans">
      <h1 className="text-6xl font-black uppercase mb-10 italic">Launch Event</h1>
      <form onSubmit={handleCreate} className="space-y-6 bg-gray-50 p-8 border-4 border-black shadow-[10px_10px_0px_0px_black]">
        <input required className="w-full p-4 border-4 border-black font-bold text-2xl" placeholder="EVENT NAME" 
          onChange={e => setForm({...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})} />
        
        <div className="grid grid-cols-2 gap-4">
          <button type="button" onClick={() => setForm(f => ({...f, mode: 'retail'}))} className={`p-4 border-4 font-black ${form.mode === 'retail' ? 'bg-blue-900 text-white' : 'bg-white'}`}>RETAIL</button>
          <button type="button" onClick={() => setForm(f => ({...f, mode: 'hosted'}))} className={`p-4 border-4 font-black ${form.mode === 'hosted' ? 'bg-pink-600 text-white' : 'bg-white'}`}>HOSTED</button>
        </div>

        <button disabled={loading} className="w-full bg-black text-white py-6 font-black text-2xl hover:bg-green-600">
          {loading ? 'WAITING...' : 'FORCE CREATE EVENT'}
        </button>
      </form>
    </div>
  );
}