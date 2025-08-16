export type ExtractResult =
  | { kind: 'LATIN'; base: string; source: 'paren_ko_en'|'paren_en_ko'|'pair'|'krw_phrase'|'list'; ctx?: any }
  | { kind: 'UNKNOWN'; baseAliasKorean: string | undefined; reason: 'NO_LATIN_TICKER_FOUND'|'AMBIGUOUS' };

const QUOTE_BLACKLIST = new Set(['KRW','USDT','BTC','ETH']);
const LATIN = String.raw`[A-Z0-9.\-]{2,10}`;
const P_HANGUL_EN = new RegExp(String.raw`([\p{Script=Hangul}A-Za-z0-9.\-]{1,30})\s*\(\s*(${LATIN})\s*\)`, 'u');
const P_EN_HANGUL = new RegExp(String.raw`(${LATIN})\s*\(\s*[\p{Script=Hangul}A-Za-z0-9.\-]{1,30}\s*\)`, 'u');

export function normalizeBrackets(s: string) {
  return s
    .replace(/[（）]/g, m => (m === '（' ? '(' : ')'))
    .replace(/[［］【】｛｝〈〉「」]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidBase(x: string) {
  if (!x) return false;
  if (x.length < 2 || x.length > 10) return false;
  if (QUOTE_BLACKLIST.has(x)) return false;
  if (!/^[A-Z0-9.\-]+$/.test(x)) return false;
  if (/[.\-]$/.test(x)) return false;
  return true;
}

export function extractBaseFromNotice(raw: string): ExtractResult {
  const text = normalizeBrackets(raw);

  // 1) KO(EN) - 타운즈(TOWNS)
  let m = text.match(P_HANGUL_EN);
  if (m && m[2]) {
    const base = m[2].toUpperCase();
    if (isValidBase(base)) return { kind:'LATIN', base, source:'paren_ko_en', ctx:{ ko:m[1] || '' } };
  }

  // 2) EN(KO) - TOWNS(타운즈)
  m = text.match(P_EN_HANGUL);
  if (m && m[1]) {
    const base = m[1].toUpperCase();
    if (isValidBase(base)) return { kind:'LATIN', base, source:'paren_en_ko' };
  }

  // 3) Paires KRW - KRW-TOWNS
  m = text.match(new RegExp(String.raw`\b(${LATIN})\s*[-/_]\s*KRW\b`));
  if (m && m[1]) { 
    const base = m[1].toUpperCase(); 
    if (isValidBase(base)) return { kind:'LATIN', base, source:'pair' }; 
  }
  m = text.match(new RegExp(String.raw`\bKRW\s*[-/_]\s*(${LATIN})\b`));
  if (m && m[1]) { 
    const base = m[1].toUpperCase(); 
    if (isValidBase(base)) return { kind:'LATIN', base, source:'pair' }; 
  }

  // 4) Phrase "원화|KRW … 마켓|시장"
  m = text.match(new RegExp(String.raw`\b(${LATIN})\s*(?:원화|KRW)\s*(?:마켓|시장)\b`));
  if (m && m[1]) { 
    const base = m[1].toUpperCase(); 
    if (isValidBase(base)) return { kind:'LATIN', base, source:'krw_phrase' }; 
  }

  // 5) Fallback: Hangul alias uniquement -> UNKNOWN
  const koAlias = (text.match(/[\p{Script=Hangul}]{2,}/u) || [])[0];
  return { kind:'UNKNOWN', baseAliasKorean: koAlias || undefined, reason:'NO_LATIN_TICKER_FOUND' };
}