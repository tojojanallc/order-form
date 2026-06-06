import { Suspense } from 'react';
import PosCallbackInner from './PosCallbackInner';

export default function PosCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 text-center">
          <div className="text-5xl mb-4 animate-pulse">⏳</div>
          <p className="font-black text-xl">Processing payment...</p>
        </div>
      </div>
    }>
      <PosCallbackInner />
    </Suspense>
  );
}
