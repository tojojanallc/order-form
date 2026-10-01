'use client'
import { usePathname } from 'next/navigation'

const PORTAL = 'https://portal.levcustom.com'
const LINKS = [
  { label: 'Command Center', href: '/admin', exact: true },
  { label: 'Event admin', href: '/admin/events' },
  { label: 'Shipping', href: '/admin/shipping' },
  { label: 'Analytics', href: '/admin/analytics' },
]

/** Top bar for every kiosk admin page — same look as the portal's. Hidden on login and the production board. */
export default function AdminBar() {
  const path = usePathname() || ''
  if (path === '/admin/login' || path.startsWith('/admin/production')) return null
  const on = (l: typeof LINKS[number]) => l.exact ? path === l.href : path === l.href || path.startsWith(l.href + '/')
  return (
    <div className="lev-admin-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, minWidth: 0 }}>
        <a href="/admin" className="lev-admin-wordmark">Lev <span>Kiosk</span></a>
        <nav style={{ display: 'flex', gap: 2, overflowX: 'auto' }}>
          {LINKS.map(l => <a key={l.href} href={l.href} className={`lev-admin-tab${on(l) ? ' on' : ''}`}>{l.label}</a>)}
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <a href="/" target="_blank" rel="noreferrer" className="lev-admin-tab">Open kiosk ↗</a>
        <a href={`${PORTAL}/admin/events`} target="_blank" rel="noreferrer" className="lev-admin-pill">Lev Portal ↗</a>
      </div>
    </div>
  )
}
