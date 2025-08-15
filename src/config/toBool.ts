export function toBool(v: string | undefined, def = false): boolean {
  if (v == null) return def;
  const s = v.trim().toLowerCase();
  if (['1','true','yes','y','on'].includes(s)) return true;
  if (['0','false','no','n','off'].includes(s)) return false;
  return def;
}
