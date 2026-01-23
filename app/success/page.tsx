// @ts-nocheck
import Link from 'next/link';
import React from 'react';

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center text-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-3xl font-bold text-green-800 mb-2">Payment Successful!</h1>
        <p className="text-gray-600 mb-6">
          Your order has been placed and sent to our production team.
        </p>
        <Link href="/">
          <button className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700">
            Back to Home
          </button>
        </Link>
      </div>
    </div>
  );
}