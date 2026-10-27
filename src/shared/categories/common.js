// Public field definitions and presentation helpers. No personal profile values.
export function field(key, label, aliases = [], extra = {}) {
  return { key, label, type: 'text', aliases, ...extra };
}
export function compact(value) { return String(value || '').trim(); }
export function formatProfileDate(value) {
  const match = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/.exec(compact(value));
  if (!match) return compact(value);
  const [, year, month, day] = match;
  return `${year}年${month ? `${Number(month)}月` : ''}${day ? `${Number(day)}日` : ''}`;
}
export function dateRange(record) {
  return [formatProfileDate(record.start), record.current ? '至今' : formatProfileDate(record.end)].filter(Boolean).join(' 至 ');
}
export function fieldSummary(fields, record) {
  return fields.filter(item => item.type !== 'checkbox').map(item => item.type === 'date'
    ? formatProfileDate(record[item.key]) : record[item.key]).filter(Boolean).join('｜');
}
