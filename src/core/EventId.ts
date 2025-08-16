import { createHash } from 'crypto';

export type EventIdInput = {
  source: 'bithumb.notice' | 'bithumb.ws';
  base: string;            // ex: 'TOWNS'
  url?: string | null;     // présent pour notice T0, sinon ''
  markets?: string[];      // ex: ['KRW'] (triées)
  tradeTimeUtc?: string;   // ISO ou '' si trading "now" ou inconnu
};

// Normalise une URL pour la stabilité du hash: https, sans query volatile
export function normalizeUrl(u?: string | null): string {
  if (!u) return '';
  try {
    const url = new URL(u);
    url.protocol = 'https:';            // force https
    // option 1: on enlève la query entièrement (le plus simple)
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

export function buildEventId(input: EventIdInput): string {
  const base = (input.base || '').toUpperCase();
  const url = normalizeUrl(input.url);
  const markets = [...(input.markets || [])].map(m => m.toUpperCase()).sort();
  const tradeTime = input.tradeTimeUtc || '';
  const payload = `${input.source}|${base}|${url}|${markets.join(',')}|${tradeTime}`;
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Vérifie si un eventId est valide (format SHA256)
 */
export function isValidEventId(eventId: string): boolean {
  return /^[a-f0-9]{64}$/.test(eventId);
}
