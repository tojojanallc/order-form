'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/supabase';
import { useRouter } from 'next/navigation';
import { microsoftEnabled, signInWithMicrosoft } from '../msSignIn';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ms, setMs] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const [next, setNext] = useState('/admin/events');

  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get('next') || '';
    const dest = n.startsWith('/admin') && !n.startsWith('/admin/login') ? n : '/admin/events';
    setNext(dest);
    // Already signed in → straight in
    supabase.auth.getSession().then(({ data }) => { if (data.session) router.replace(dest); });
    microsoftEnabled().then(on => { setMs(on); if (!on) setShowPassword(true); });
  }, []);

  // Event staff / admin passcode → signed cookie from /api/auth. Staff passcodes open Event admin and Production only.
  const [passcode, setPasscode] = useState('');
  const handlePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: passcode }) });
    const d = await res.json().catch(() => ({}));
    setLoading(false);
    if (!d.success) return alert(d.error || 'Wrong passcode');
    sessionStorage.setItem('admin_auth', 'true');
    sessionStorage.setItem('admin_role', d.role || 'staff');
    const staffPage = ['/admin/events', '/admin/production'].some(p => next === p || next.startsWith(p + '/') || next.startsWith(p + '?'));
    window.location.href = d.role === 'admin' || staffPage ? next : '/admin/events';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { alert(error.message); setLoading(false); }
    else router.push(next);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 font-sans text-slate-900" style={{ background: '#0a2342' }}>
      <div className="max-w-md w-full bg-white rounded-[28px] p-10 shadow-2xl">
        <div className="text-center mb-8">
          <div style={{ fontFamily: 'var(--font-outfit), Outfit, sans-serif', fontWeight: 900, fontSize: 30, color: '#0a2342', letterSpacing: '-0.5px' }}>Lev <span style={{ color: '#29ABE2' }}>Kiosk</span></div>
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mt-1">Admin sign-in</p>
        </div>

        {ms && (
          <button onClick={() => { setLoading(true); signInWithMicrosoft(next); }} disabled={loading}
            className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 border border-gray-200 hover:bg-gray-50 transition-all">
            <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
            {loading ? 'Opening Microsoft…' : 'Sign in with Microsoft 365'}
          </button>
        )}
        {ms === false && <p className="text-xs text-center text-gray-400 mb-4">Microsoft sign-in isn't switched on yet — use your email and password.</p>}

        {ms && !showPassword && (
          <button onClick={() => setShowPassword(true)} className="w-full mt-4 text-[11px] font-bold text-gray-400 hover:text-gray-600">Use email and password instead</button>
        )}

        {showPassword && (
          <form onSubmit={handleLogin} className={`space-y-5 ${ms ? 'mt-6 pt-6 border-t border-gray-100' : ''}`}>
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Work Email</label>
              <input type="email" className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 font-bold outline-none" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Password</label>
              <input type="password" className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 font-bold outline-none" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="w-full py-4 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all" style={{ background: '#29ABE2' }}>
              {loading ? 'Verifying…' : 'Sign in →'}
            </button>
          </form>
        )}

        <form onSubmit={handlePasscode} className="mt-6 pt-6 border-t border-gray-100 flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Event staff passcode</label>
            <input type="password" className="w-full p-3 bg-gray-50 rounded-2xl border-none focus:ring-2 font-bold outline-none" value={passcode} onChange={(e) => setPasscode(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading} className="px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-xs text-white" style={{ background: '#0a2342' }}>Go</button>
        </form>
      </div>
    </div>
  );
}
