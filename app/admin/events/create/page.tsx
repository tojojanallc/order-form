'use client';
import { useState } from 'react';
import { supabase } from '@/supabase'; 
import Link from 'next/link';

export default function CreateEvent() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [mode, setMode] = useState('retail');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) return alert("Missing fields");
    setLoading(true);

    const { error } = await supabase
      .from('event_settings')
      .insert([{
        event_name: name,
        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        status: 'active',
        payment_mode: mode,
        header_color: '#1e3a8a',
        offer_back_names: true,
        offer_metallic: true,
        offer_personalization: true
      }]);

    if (error) {
      alert("Error: " + error.message);
      setLoading(false);
    } else {
      alert("🎉 Event Created!");
      window.location.href = '/admin'; 
    }
  };

  return (
    <div className="min-h-screen bg-white text-black p-8 max-w-2xl mx-auto border-x-4 border-black">
      <Link href="/admin" className="text-blue-600 font-black uppercase text-xs hover:underline">← Command Center</Link>
      <h1 className="text-5xl font-black uppercase mt-4 mb-10 italic">New Event</h1>

      <form onSubmit={handleCreate} className="space-y-8 bg-gray-50 p-8 border-4 border-black shadow-[8px_8px_0px_0px_black]">
        <div>
          <label className="block text-xs font-black uppercase mb-2">Event Name</label>
          <input 
            required
            className="w-full p-4 border-2 border-black font-bold text-xl outline-none focus:bg-yellow-50"
            placeholder="Nicolet Invite 2026"
            value={name}
            onChange={e => {
                setName(e.target.value);
                setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
            }}
          />
        </div>

        <div>
          <label className="block text-xs font-black uppercase mb-2">URL Slug</label>
          <input 
            required
            className="w-full p-4 border-2 border-black font-mono text-lg outline-none focus:bg-yellow-50"
            value={slug}
            onChange={e => setSlug(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-black uppercase mb-4">Payment Mode</label>
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={() => setMode('retail')} className={`p-4 border-2 border-black font-black uppercase ${mode === 'retail' ? 'bg-blue-900 text-white shadow-[4px_4px_0px_0px_black]' : 'bg-white'}`}>Retail</button>
            <button type="button" onClick={() => setMode('hosted')} className={`p-4 border-2 border-black font-black uppercase ${mode === 'hosted' ? 'bg-pink-600 text-white shadow-[4px_4px_0px_0px_black]' : 'bg-white'}`}>Hosted</button>
          </div>
        </div>

        <button 
          disabled={loading}
          className="w-full bg-black text-white py-6 font-black uppercase text-2xl border-2 border-black hover:bg-blue-600 active:translate-y-1 transition-all"
        >
          {loading ? 'Building...' : 'Launch Event'}
        </button>
      </form>
    </div>
  );
}