/**
 * Signal Detection Handler
 *
 * Detects trading signals in incoming messages using pattern matching.
 * This module distinguishes signal messages from regular chat messages.
 */

export interface SignalDetectionResult {
  isSignal: boolean;
  confidence: 'high' | 'medium' | 'low';
  matchedPatterns: string[];
}

/**
 * Detects if a message contains a trading signal
 *
 * Detection criteria (progressive matching):
 * 1. LONG/SHORT keywords (direction indicators)
 * 2. Symbol patterns (e.g., BTC/USDT, ETH/USD)
 * 3. Price level keywords (Entry, TP, SL, Target, Stop)
 *
 * @param text - The message text to analyze
 * @returns Detection result with confidence level
 */
export function detectSignal(text: string): SignalDetectionResult {
  if (!text || text.trim().length === 0) {
    return { isSignal: false, confidence: 'low', matchedPatterns: [] };
  }

  const matchedPatterns: string[] = [];

  // Pattern 1: Direction keywords (LONG/SHORT)
  const directionPattern = /\b(LONG|SHORT|long|short|Long|Short)\b/i;
  const hasDirection = directionPattern.test(text);
  if (hasDirection) {
    matchedPatterns.push('direction');
  }

  // Pattern 2: Symbol format (SYMBOL/QUOTE like BTC/USDT, ETH/USD, BNB/BUSD)
  // Matches: 2-5 uppercase letters, /, 2-5 uppercase letters
  const symbolPattern = /\b([A-Z]{2,5})\/([A-Z]{2,5})\b/;
  const hasSymbol = symbolPattern.test(text);
  if (hasSymbol) {
    matchedPatterns.push('symbol');
  }

  // Pattern 3: Price level keywords (Entry, TP/Target, SL/Stop)
  // Check for multiple price level indicators for stronger confidence
  const entryPattern = /\b(entry|entries|ENTRY)\b/i;
  const tpPattern = /\b(tp|TP|target|Target|TARGET|take\s*profit|TAKE\s*PROFIT)\b/i;
  const slPattern = /\b(sl|SL|stop|Stop|STOP|stop\s*loss|STOP\s*LOSS)\b/i;

  const hasEntry = entryPattern.test(text);
  const hasTP = tpPattern.test(text);
  const hasSL = slPattern.test(text);

  const priceLevelCount = [hasEntry, hasTP, hasSL].filter(Boolean).length;

  if (priceLevelCount > 0) {
    matchedPatterns.push('priceLevel');
  }

  // Determine if this is a signal based on matched patterns
  const patternCount = matchedPatterns.length;

  // Special case: Multiple price levels (Entry + TP + SL) is strong signal evidence
  // even without direction/symbol (e.g., "Entry: 50000 TP: 52000 SL: 48000")
  if (priceLevelCount >= 2) {
    return { isSignal: true, confidence: 'medium', matchedPatterns };
  }

  if (patternCount === 0) {
    // No signal indicators found
    return { isSignal: false, confidence: 'low', matchedPatterns };
  } else if (patternCount === 1) {
    // Single indicator - not enough evidence
    return { isSignal: false, confidence: 'low', matchedPatterns };
  } else if (patternCount === 2) {
    // Two indicators - likely a signal (medium confidence)
    // Example: "LONG BTC/USDT" or "BTC/USDT Entry: 50000"
    return { isSignal: true, confidence: 'medium', matchedPatterns };
  } else {
    // Three indicators - definitely a signal (high confidence)
    // Example: "LONG BTC/USDT Entry: 50000 TP: 52000 SL: 48000"
    return { isSignal: true, confidence: 'high', matchedPatterns };
  }
}
