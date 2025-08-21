/**
 * Module robuste d'extraction de tickers depuis les notices Bithumb
 * Supporte les encodages corrompus, parenthèses full-width et multi-tickers
 */

export interface TickerExtractionResult {
  tickers: string[];
  confidence: number; // 0-1, basé sur la qualité de l'extraction
  hasHangul: boolean;
  replacementChars: number;
}

/**
 * Normalise les parenthèses et guillemets Unicode vers ASCII
 */
export function normalizeBrackets(s: string): string {
  return s
    // Parenthèses full-width
    .replace(/[（）]/g, m => (m === '（' ? '(' : ')'))
    // Guillemets full-width
    .replace(/[「」]/g, '"')
    .replace(/[『』]/g, "'")
    // Autres brackets full-width
    .replace(/[［］【】｛｝〈〉]/g, ' ')
    // Espaces multiples
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrait tous les tickers depuis un texte
 * Supporte les formats: (TICKER), TICKER(KR), KRW-TICKER, etc.
 */
export function extractTickersFromText(text: string): string[] {
  const normalized = normalizeBrackets(text);
  
  // Pattern principal: (TICKER) où TICKER est 2-10 caractères alphanumériques
  const tickerPattern = /\(([A-Z0-9]{2,10})\)/g;
  const matches = Array.from(normalized.matchAll(tickerPattern));
  
  // Extraire et filtrer les tickers
  const tickers = matches
    .map(match => match[1]?.toUpperCase())
    .filter(ticker => {
      if (!ticker) return false;
      
      // Filtrer les tokens de base (KRW, USDT, BTC, etc.)
      const blacklist = new Set(['KRW', 'USDT', 'BTC', 'ETH', 'BNB', 'ADA', 'DOT']);
      if (blacklist.has(ticker)) return false;
      
      // Validation basique
      if (ticker.length < 2 || ticker.length > 10) return false;
      if (!/^[A-Z0-9]+$/.test(ticker)) return false;
      
      return true;
    });
  
  // Dédupliquer et trier par priorité (longueur 2-6 d'abord, puis ordre d'apparition)
  const uniqueTickers = Array.from(new Set(tickers));
  const sortedTickers = uniqueTickers.sort((a, b) => {
    if (!a || !b) return 0;
    const aPriority = a.length >= 2 && a.length <= 6 ? 0 : 1;
    const bPriority = b.length >= 2 && b.length <= 6 ? 0 : 1;
    
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    // Même priorité: ordre d'apparition
    const aIndex = tickers.indexOf(a);
    const bIndex = tickers.indexOf(b);
    return aIndex - bIndex;
  });
  
  return sortedTickers.filter((ticker): ticker is string => ticker !== undefined);
}

/**
 * Calcule la confiance d'une extraction basée sur la qualité du texte
 */
export function calculateExtractionConfidence(
  originalText: string, 
  decodedText: string, 
  tickers: string[]
): number {
  let confidence = 1.0;
  
  // Pénaliser les caractères de remplacement ()
  const replacementChars = (decodedText.match(/\uFFFD/g) || []).length;
  if (replacementChars > 0) {
    confidence -= Math.min(0.3, replacementChars * 0.1);
  }
  
  // Bonus si Hangul détecté (indique un bon décodage)
  const hasHangul = /\p{Script=Hangul}/u.test(decodedText);
  if (hasHangul) {
    confidence += 0.1;
  }
  
  // Bonus si tickers trouvés
  if (tickers.length > 0) {
    confidence += 0.2;
  }
  
  // Pénaliser si le texte original est très court
  if (originalText.length < 10) {
    confidence -= 0.2;
  }
  
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Extrait les tickers avec métadonnées de confiance
 */
export function extractTickersWithConfidence(
  originalText: string, 
  decodedText: string
): TickerExtractionResult {
  const tickers = extractTickersFromText(decodedText);
  const confidence = calculateExtractionConfidence(originalText, decodedText, tickers);
  const hasHangul = /\p{Script=Hangul}/u.test(decodedText);
  const replacementChars = (decodedText.match(/\uFFFD/g) || []).length;
  
  return {
    tickers,
    confidence,
    hasHangul,
    replacementChars
  };
}
