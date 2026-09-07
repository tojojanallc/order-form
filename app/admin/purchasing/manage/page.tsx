'use client'
import { useEffect } from 'react'

export default function ManagePOsRedirect() {
  useEffect(() => {
    window.location.href = 'https://portal.levcustom.com/admin/purchase-orders'
  }, [])
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#64748b' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Redirecting to Lev Portal...</div>
        <a href="https://portal.levcustom.com/admin/purchase-orders" style={{ color: '#29ABE2', fontSize: 13, marginTop: 8, display: 'block' }}>
          Click here if not redirected
        </a>
      </div>
    </div>
  )
}
