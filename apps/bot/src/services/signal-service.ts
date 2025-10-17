/**
 * Signal Storage Service
 *
 * Handles database operations for trading signals.
 * Stores both fully parsed signals and unparseable signals (raw message only).
 */

import { prisma } from '@signal-tracker/database';
import type { ParsedSignal } from '@signal-tracker/types';

/**
 * Store a parsed signal in the database
 *
 * @param parsedSignal - Result from parseSignal function
 * @returns Created signal with database ID, or null if storage failed
 */
export async function storeSignal(
  parsedSignal: ParsedSignal
): Promise<{ id: string; symbol?: string; direction?: string } | null> {
  try {
    if (parsedSignal.success && parsedSignal.signal) {
      // Store fully parsed signal
      const signal = parsedSignal.signal;

      const created = await prisma.signal.create({
        data: {
          groupId: signal.groupId,
          messageId: signal.messageId,
          timestamp: signal.timestamp,
          symbol: signal.symbol,
          direction: signal.direction,
          leverage: signal.leverage,
          entryPrice: signal.entryPrice,
          entryPriceMin: signal.entryPriceMin,
          entryPriceMax: signal.entryPriceMax,
          stopLoss: signal.stopLoss,
          takeProfits: signal.takeProfits || [],
          status: signal.status,
          rawMessage: signal.rawMessage,
        },
      });

      return {
        id: created.id,
        symbol: created.symbol,
        direction: created.direction,
      };
    } else {
      // Signal parsing failed but we still want to store raw message
      // This should not happen in normal flow since we only call storeSignal
      // after successful parsing, but included for robustness
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to store signal in database:', error);
    return null;
  }
}

/**
 * Store unparseable signal (raw message only)
 *
 * Used when signal detection identifies a message as a signal,
 * but parsing fails to extract structured data.
 * Ensures zero data loss (SC-009) by storing raw message.
 *
 * @param rawMessage - Original message text
 * @param groupId - Group database ID
 * @param messageId - Telegram message ID
 * @param errorReason - Why parsing failed
 * @returns Created signal with database ID, or null if storage failed
 */
export async function storeUnparseableSignal(
  rawMessage: string,
  groupId: string,
  messageId: number,
  errorReason: string
): Promise<{ id: string; error: string } | null> {
  try {
    // Store with minimal data - only what we know for certain
    // Use placeholder values for required fields
    const created = await prisma.signal.create({
      data: {
        groupId,
        messageId,
        timestamp: new Date(),
        symbol: 'UNKNOWN', // Required field - use placeholder
        direction: 'LONG', // Required field - use placeholder
        status: 'PENDING',
        rawMessage,
      },
    });

    console.error(`⚠️ Stored unparseable signal ${created.id}: ${errorReason}`);

    return {
      id: created.id,
      error: errorReason,
    };
  } catch (error) {
    console.error('❌ Failed to store unparseable signal:', error);
    return null;
  }
}

/**
 * Get group by Telegram chat ID
 *
 * Used to look up the group database ID from Telegram chat ID.
 *
 * @param telegramId - Telegram chat ID (as string)
 * @returns Group with id and name, or null if not found
 */
export async function getGroupByTelegramId(
  telegramId: string
): Promise<{ id: string; name: string } | null> {
  try {
    const group = await prisma.group.findUnique({
      where: { telegramId },
      select: { id: true, name: true },
    });

    return group;
  } catch (error) {
    console.error('❌ Failed to query group:', error);
    return null;
  }
}
