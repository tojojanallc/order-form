// Browser helper: event_settings writes go through /api/admin/event-settings (the table is read-only to the browser)
export async function saveEventFields(slug: string, fields: Record<string, any>): Promise<string | null> {
  const res = await fetch('/api/admin/event-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, fields }) });
  if (res.ok) return null;
  return (await res.json().catch(() => ({}))).error || `Save failed (${res.status})`;
}
