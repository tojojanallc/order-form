'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PairTerminalPage() {
  const [locations, setLocations] = useState<any[]>([]);
  const [locationId, setLocationId] = useState('');
  const [terminalName, setTerminalName] = useState('Terminal 3');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/generate-device-code')
      .then(r => r.json())
      .then(d => {
        if (d.locations?.length) {
          setLocations(d.locations);
          setLocationId(d.locations[0].id);
        }
      });
  }, []);

  const generate = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/generate-device-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: terminalName, location_id: locationId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-lg mx-auto">
        <Link href="/admin" className="text-blue-600 font-bold text-xs uppercase tracking-widest hover:underline">← Command Center</Link>
        <h1 className="text-4xl font-black mt-2 mb-2">📟 Pair New Terminal</h1>
        <p className="text-gray-500 text-sm mb-8">Generates a device code to pair a Square Terminal with your app.</p>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8 space-y-6">

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Terminal Name</label>
            <input
              className="w-full bg-gray-50 border border-gray-200 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
              value={terminalName}
              onChange={e => setTerminalName(e.target.value)}
            />
          </div>

          {locations.length > 1 && (
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Location</label>
              <select className="w-full bg-gray-50 border border-gray-200 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" value={locationId} onChange={e => setLocationId(e.target.value)}>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-sm uppercase tracking-widest hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Generating...' : 'Generate Device Code'}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 font-bold text-sm">{error}</div>
          )}

          {result && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
              <p className="text-xs font-black uppercase tracking-widest text-green-600 mb-2">Your Device Code</p>
              <p className="text-6xl font-black text-slate-900 tracking-widest mb-4">{result.code}</p>
              <div className="text-left space-y-2 text-sm text-gray-600 bg-white rounded-xl p-4 border border-green-100">
                <p className="font-black text-gray-800 mb-2">Now on the terminal:</p>
                <p>1. Go to <strong>Settings → General → About Terminal</strong></p>
                <p>2. Tap the version number several times to unlock pairing</p>
                <p>3. Select <strong>Pair with Device Code</strong></p>
                <p>4. Enter the code above: <strong>{result.code}</strong></p>
                <p>5. Terminal will restart into API mode ✅</p>
              </div>
              <p className="text-xs text-gray-400 mt-3">Code expires in 5 minutes. Generate a new one if it expires.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
