export function formatPersonName(p: any, prefix = ''): string {
  if (!p) return prefix ? `${prefix} Unknown` : 'Unknown';
  if (p.name && String(p.name).trim()) return (prefix ? `${prefix} ` : '') + String(p.name).trim();
  const fn = p.firstName || p.first_name || '';
  const ln = p.lastName || p.last_name || '';
  const full = `${fn} ${ln}`.trim();
  if (full) return (prefix ? `${prefix} ` : '') + full;
  if (p.email) return (prefix ? `${prefix} ` : '') + p.email;
  return (prefix ? `${prefix} ` : '') + String(p.id ?? 'Unknown');
}
