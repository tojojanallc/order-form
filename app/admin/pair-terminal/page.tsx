import { redirect } from 'next/navigation';

// Terminal pairing lives in the Lev portal now (Setup → Card terminals)
export default function PairTerminalPage() {
  redirect('https://portal.levcustom.com/admin/settings/terminals');
}
