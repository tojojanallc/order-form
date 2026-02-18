'use client';
import { useState } from 'react';
import { supabase } from '@/supabase';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      alert(error.message);
      setLoading(false);
    } else {
      router.push('/admin'); // Sends you to the dashboard after success
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans text-slate-900">
      <div className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black tracking-tight">Command Center</h1>
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mt-2">Lev Custom Merch Security</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Work Email</label>
            <input 
              type="email" 
              className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-500 font-bold outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Password</label>
            <input 
              type="password" 
              className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-500 font-bold outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20"
          >
            {loading ? 'Verifying...' : 'Access Command Center →'}
          </button>
        </form>
      </div>
    </div>
  );
}