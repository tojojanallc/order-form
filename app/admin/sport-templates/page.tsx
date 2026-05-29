'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

type Template = {
  id: number;
  sport: string;
  label: string;
  image_url: string;
  category: string;
  placement: string;
  sort_order: number;
};

export default function SportTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState('');
  const [newSport, setNewSport] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newCategory, setNewCategory] = useState('accent');
  const [newPlacement, setNewPlacement] = useState('small');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data } = await supabase.from('logo_templates').select('*').order('sport').order('sort_order');
    if (data) setTemplates(data);
    setLoading(false);
  };

  const sports = [...new Set(templates.map(t => t.sport))];
  const activeSport = selectedSport || sports[0] || '';
  const sportTemplates = templates.filter(t => t.sport === activeSport);

  const addTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const sport = newSport.trim() || activeSport;
    if (!sport || !newLabel.trim()) return;
    setSaving(true);
    const maxSort = templates.filter(t => t.sport === sport).reduce((m, t) => Math.max(m, t.sort_order), 0);
    await supabase.from('logo_templates').insert({
      sport,
      label: newLabel.trim(),
      image_url: newImageUrl.trim(),
      category: newCategory,
      placement: newPlacement,
      sort_order: maxSort + 1,
    });
    setNewLabel(''); setNewImageUrl(''); setNewSport('');
    if (!sports.includes(sport)) setSelectedSport(sport);
    await fetchTemplates();
    setSaving(false);
  };

  const deleteTemplate = async (id: number) => {
    if (!confirm('Remove this logo from the template?')) return;
    setDeletingId(id);
    await supabase.from('logo_templates').delete().eq('id', id);
    await fetchTemplates();
    setDeletingId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <Link href="/admin" className="text-[10px] font-black uppercase text-blue-600 tracking-widest hover:underline">← Command Center</Link>
          <h1 className="text-4xl font-black tracking-tight mt-1">🏅 Sport Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Manage the logo add-ons that get bulk-applied to events by sport.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">

          {/* Left: Sport tabs + logos */}
          <div className="md:col-span-2">
            {/* Sport tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {sports.map(sport => (
                <button key={sport} onClick={() => setSelectedSport(sport)}
                  className={`px-4 py-2 rounded-xl font-black text-sm transition-all ${activeSport === sport ? 'bg-slate-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                  {sport}
                </button>
              ))}
              {sports.length === 0 && <p className="text-sm text-gray-400 italic">No sports yet — add one below.</p>}
            </div>

            {/* Logo list for active sport */}
            {activeSport && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b">
                  <h2 className="font-black text-lg">{activeSport} Logos</h2>
                  <p className="text-xs text-gray-400">{sportTemplates.length} logo{sportTemplates.length !== 1 ? 's' : ''} in this template</p>
                </div>
                {loading ? (
                  <div className="p-10 text-center text-gray-400 animate-pulse font-bold">Loading...</div>
                ) : sportTemplates.length === 0 ? (
                  <div className="p-10 text-center text-gray-400 font-bold">No logos yet for {activeSport}.</div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="text-[10px] uppercase tracking-widest text-gray-400 border-b">
                      <tr>
                        <th className="px-6 py-3">Preview</th>
                        <th className="px-6 py-3">Label</th>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Size</th>
                        <th className="px-6 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sportTemplates.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3">
                            {t.image_url
                              ? <img src={t.image_url} className="w-10 h-10 object-contain rounded border bg-gray-50" />
                              : <div className="w-10 h-10 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-400">—</div>}
                          </td>
                          <td className="px-6 py-3 font-bold">{t.label}</td>
                          <td className="px-6 py-3">
                            <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${t.category === 'main' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                              {t.category}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-gray-500 capitalize">{t.placement}</td>
                          <td className="px-6 py-3 text-right">
                            <button onClick={() => deleteTemplate(t.id)} disabled={deletingId === t.id}
                              className="text-red-400 hover:text-red-600 font-black text-lg disabled:opacity-40">
                              {deletingId === t.id ? '...' : '🗑️'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Right: Add logo form */}
          <div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sticky top-6">
              <h2 className="font-black text-lg mb-4">Add Logo to Template</h2>
              <form onSubmit={addTemplate} className="space-y-3">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-gray-400 mb-1 block">Sport</label>
                  <input
                    className="w-full border rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder={activeSport || 'e.g. Basketball'}
                    value={newSport}
                    onChange={e => setNewSport(e.target.value)}
                    list="sport-list"
                  />
                  <datalist id="sport-list">
                    {sports.map(s => <option key={s} value={s} />)}
                  </datalist>
                  <p className="text-[10px] text-gray-400 mt-1">Leave blank to add to <strong>{activeSport || 'selected sport'}</strong></p>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-gray-400 mb-1 block">Label *</label>
                  <input
                    required
                    className="w-full border rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="e.g. Backstroke"
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-gray-400 mb-1 block">Image URL</label>
                  <input
                    className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="https://..."
                    value={newImageUrl}
                    onChange={e => setNewImageUrl(e.target.value)}
                  />
                  {newImageUrl && <img src={newImageUrl} className="mt-2 w-16 h-16 object-contain border rounded-xl bg-gray-50 mx-auto" />}
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-gray-400 mb-1 block">Type</label>
                  <div className="flex gap-3">
                    {['main', 'accent'].map(cat => (
                      <label key={cat} className="flex items-center gap-2 cursor-pointer text-sm font-bold">
                        <input type="radio" name="cat" checked={newCategory === cat} onChange={() => setNewCategory(cat)} className="w-4 h-4" />
                        {cat === 'main' ? 'Main (Free)' : 'Accent (+$5)'}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-gray-400 mb-1 block">Size</label>
                  <div className="flex gap-3">
                    {['small', 'large'].map(p => (
                      <label key={p} className="flex items-center gap-2 cursor-pointer text-sm font-bold">
                        <input type="radio" name="place" checked={newPlacement === p} onChange={() => setNewPlacement(p)} className="w-4 h-4" />
                        {p === 'small' ? 'Small (Chest)' : 'Large (Full Front)'}
                      </label>
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={saving}
                  className="w-full bg-indigo-700 hover:bg-indigo-600 text-white font-black py-3 rounded-xl text-sm disabled:opacity-50 transition-all mt-2">
                  {saving ? 'Adding...' : '+ Add to Template'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
