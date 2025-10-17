/**
 * Signal Parser Module
 *
 * Extracts structured trading signal data from raw message text.
 * Handles various signal formats and provides validation via Zod.
 */

import {
  SignalSchema,
  SignalDirection,
  SignalStatus,
  ParsedSignal,
} from '@signal-tracker/types';
import type { Signal } from '@signal-tracker/types';

/**
 * Parse a trading signal message into structured data
 *
 * @param text - Raw message text
 * @param groupId - Telegram group ID
 * @param groupName - Telegram group name
 * @param messageId - Telegram message ID
 * @returns Parsed signal result with validation
 */
export function parseSignal(
  text: string,
  groupId: string,
  groupName: string,
  messageId: number
): ParsedSignal {
  if (!text || text.trim().length === 0) {
    return {
      success: false,
      error: 'Empty message text',
    };
  }

  try {
    // Extract all signal components
    const symbol = extractSymbol(text);
    const direction = extractDirection(text);
    const leverage = extractLeverage(text);
    const entryPrices = extractEntryPrice(text);
    const stopLoss = extractStopLoss(text);
    const takeProfits = extractTakeProfits(text);

    // Validate that we have minimum required fields (symbol and direction)
    if (!symbol || !direction) {
      return {
        success: false,
        error: `Missing required fields - symbol: ${symbol}, direction: ${direction}`,
      };
    }

    // Build signal object
    const signalData: Omit<Signal, 'id' | 'createdAt' | 'updatedAt'> = {
      groupId,
      groupName,
      messageId,
      timestamp: new Date(),
      symbol,
      direction,
      leverage,
      ...entryPrices,
      stopLoss,
      takeProfits,
      status: SignalStatus.PENDING,
      rawMessage: text,
    };

    // Validate with Zod schema
    const validation = SignalSchema.safeParse(signalData);

    if (!validation.success) {
      return {
        success: false,
        error: `Validation failed: ${validation.error.message}`,
      };
    }

    return {
      success: true,
      signal: signalData,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    };
  }
}

/**
 * Extract trading symbol (e.g., BTC/USDT, ETH/USD, $EDEN)
 *
 * Supports multiple formats:
 * - Standard format: BTC/USDT, ETH/USD
 * - $ prefix format: $EDEN, $BTC (converts to EDEN/USDT, BTC/USDT)
 */
export function extractSymbol(text: string): string | undefined {
  // Pattern 1: Standard format (BTC/USDT, ETH/USD)
  const standardPattern = /\b([A-Z]{2,5})\/([A-Z]{2,5})\b/;
  const standardMatch = text.match(standardPattern);
  if (standardMatch) {
    return standardMatch[0];
  }

  // Pattern 2: $ prefix format ($EDEN, $BTC)
  // Extract the symbol and default to USDT as quote currency
  const dollarPattern = /\$([A-Z]{2,10})\b/;
  const dollarMatch = text.match(dollarPattern);
  if (dollarMatch) {
    const baseSymbol = dollarMatch[1];
    return `${baseSymbol}/USDT`; // Default to USDT pair
  }

  return undefined;
}

/**
 * Extract signal direction (LONG or SHORT)
 *
 * Detects: LONG, SHORT, long, short, Long, Short
 */
export function extractDirection(text: string): SignalDirection | undefined {
  const directionPattern = /\b(LONG|SHORT|long|short|Long|Short)\b/i;
  const match = text.match(directionPattern);

  if (!match) return undefined;

  const direction = match[1].toUpperCase();
  return direction === 'LONG' ? SignalDirection.LONG : SignalDirection.SHORT;
}

/**
 * Extract entry price information
 *
 * Supports:
 * - Single value: "Entry: 50000"
 * - Range: "Entry: 50000-51000"
 * - Multiple entries: "Entry: 50000, 51000"
 * - Numbered entries: "Entry 1 (30%): 0.1745 Entry 2 (70%): 0.1571"
 *
 * @returns Object with entryPrice (single), entryPriceMin/Max (range), or undefined
 */
export function extractEntryPrice(text: string): {
  entryPrice?: number;
  entryPriceMin?: number;
  entryPriceMax?: number;
} {
  const values: number[] = [];

  // Pattern 1: Entry 1, Entry 2 format with percentages
  const numberedEntryPattern = /(?:entry|Entry|ENTRY)\s*\d+\s*(?:\([^)]+\))?[:\s]+([0-9.]+)/gi;
  let match;
  while ((match = numberedEntryPattern.exec(text)) !== null) {
    const value = parseFloat(match[1]);
    if (!Number.isNaN(value)) {
      values.push(value);
    }
  }

  // Pattern 2: Simple entry format
  if (values.length === 0) {
    const entryPattern =
      /(?:entry|entries|ENTRY)[:\s]+([0-9.,\s-]+?)(?=\s*(?:tp|TP|target|Target|sl|SL|stop|Stop|leverage|Leverage|$))/i;
    const simpleMatch = text.match(entryPattern);

    if (simpleMatch) {
      const priceText = simpleMatch[1].trim();

      // Check for range format (e.g., "50000-51000")
      const rangeMatch = priceText.match(/([0-9.]+)\s*-\s*([0-9.]+)/);
      if (rangeMatch) {
        const min = parseFloat(rangeMatch[1]);
        const max = parseFloat(rangeMatch[2]);
        if (!Number.isNaN(min) && !Number.isNaN(max)) {
          return { entryPriceMin: min, entryPriceMax: max };
        }
      }

      // Check for comma-separated values (e.g., "50000, 51000")
      const simpleValues = priceText
        .split(/[,\s]+/)
        .map((v) => parseFloat(v.replace(/,/g, '')))
        .filter((v) => !Number.isNaN(v));

      values.push(...simpleValues);
    }
  }

  if (values.length === 0) return {};

  if (values.length === 1) {
    return { entryPrice: values[0] };
  }

  // Multiple values treated as range (min to max)
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { entryPriceMin: min, entryPriceMax: max };
}

/**
 * Extract take profit levels
 *
 * Supports:
 * - Single TP: "TP: 52000"
 * - Multiple TPs: "TP: 52000, 54000, 56000"
 * - Dash-separated: "TP: 0.1904 - 0.2094 - 0.2313 - 0.2515"
 * - TP1, TP2 format: "TP1: 52000 TP2: 54000"
 *
 * @returns Array of take profit prices, or undefined
 */
export function extractTakeProfits(text: string): number[] | undefined {
  const takeProfits: number[] = [];

  // Pattern 1: TP/Target keyword followed by numbers (including dashes)
  const tpPattern =
    /(?:tp|TP|target|Target|TARGET|take\s*profit|TAKE\s*PROFIT)[:\s]+([0-9.,\s-]+?)(?=\s*(?:sl|SL|stop|Stop|leverage|Leverage|Available|$))/gi;

  let match;
  while ((match = tpPattern.exec(text)) !== null) {
    const priceText = match[1].trim();
    // Split by comma, space, or dash
    const values = priceText
      .split(/[,\s-]+/)
      .map((v) => parseFloat(v.replace(/,/g, '')))
      .filter((v) => !Number.isNaN(v));
    takeProfits.push(...values);
  }

  // Pattern 2: TP1, TP2, TP3 format
  const tpIndexedPattern = /(?:tp|TP)(\d+)[:\s]+([0-9.]+)/gi;
  while ((match = tpIndexedPattern.exec(text)) !== null) {
    const value = parseFloat(match[2]);
    if (!Number.isNaN(value) && !takeProfits.includes(value)) {
      takeProfits.push(value);
    }
  }

  // Remove duplicates and sort
  const uniqueTPs = [...new Set(takeProfits)].sort((a, b) => a - b);

  return uniqueTPs.length > 0 ? uniqueTPs : undefined;
}

/**
 * Extract stop loss price
 *
 * Supports:
 * - "SL: 48000"
 * - "Stop Loss: 48000"
 * - "Stop: 48000"
 *
 * @returns Stop loss price, or undefined
 */
export function extractStopLoss(text: string): number | undefined {
  const slPattern =
    /(?:sl|SL|stop|Stop|STOP|stop\s*loss|STOP\s*LOSS)[:\s]+([0-9.]+)/i;
  const match = text.match(slPattern);

  if (!match) return undefined;

  const value = parseFloat(match[1]);
  return !isNaN(value) ? value : undefined;
}

/**
 * Extract leverage value
 *
 * Supports:
 * - "5x", "x5", "5X", "X5"
 * - "Leverage: 5", "leverage 5"
 * - "5x-10x" (takes first value)
 *
 * @returns Leverage multiplier, or undefined
 */
export function extractLeverage(text: string): number | undefined {
  // Pattern 1: "5x", "x5", "5X", "X5"
  const leveragePattern1 = /\b(\d+)\s*[xX]\b|\b[xX]\s*(\d+)\b/;
  const match1 = text.match(leveragePattern1);

  if (match1) {
    const value = parseInt(match1[1] || match1[2]);
    if (!isNaN(value) && value >= 1 && value <= 125) {
      return value;
    }
  }

  // Pattern 2: "Leverage: 5", "leverage 5"
  const leveragePattern2 = /(?:leverage|Leverage|LEVERAGE)[:\s]+(\d+)/i;
  const match2 = text.match(leveragePattern2);

  if (match2) {
    const value = parseInt(match2[1]);
    if (!isNaN(value) && value >= 1 && value <= 125) {
      return value;
    }
  }

  return undefined;
}
