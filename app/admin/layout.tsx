import { Outfit } from 'next/font/google'
import AdminBar from '@/components/AdminBar'
import './admin-brand.css'

// Kiosk admin, branded like the Lev portal (navy bar, Outfit headings, Lev blue accents)
const outfit = Outfit({ subsets: ['latin'], weight: ['600', '700', '800', '900'], variable: '--font-outfit' })

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`lev-admin ${outfit.variable}`}>
      <AdminBar />
      {children}
    </div>
  )
}
