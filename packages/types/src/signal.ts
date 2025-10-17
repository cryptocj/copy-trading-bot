import { z } from 'zod';

// Signal Direction
export enum SignalDirection {
  LONG = 'LONG',
  SHORT = 'SHORT',
}

// Signal Status
export enum SignalStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

// Trading Signal Schema
export const SignalSchema = z.object({
  id: z.string().optional(),
  groupId: z.string(),
  groupName: z.string(),
  messageId: z.number(),
  timestamp: z.date(),

  // Signal details
  symbol: z.string(), // e.g., "BTC/USDT"
  direction: z.nativeEnum(SignalDirection),
  leverage: z.number().optional(),

  // Price levels
  entryPrice: z.number().optional(),
  entryPriceMin: z.number().optional(),
  entryPriceMax: z.number().optional(),

  stopLoss: z.number().optional(),
  takeProfits: z.array(z.number()).optional(),

  // Status
  status: z.nativeEnum(SignalStatus).default(SignalStatus.PENDING),

  // Raw data
  rawMessage: z.string(),

  // Performance tracking (will be updated)
  currentPrice: z.number().optional(),
  pnl: z.number().optional(), // Profit/Loss percentage
  pnlAbsolute: z.number().optional(), // Absolute P&L value

  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type Signal = z.infer<typeof SignalSchema>;

// Parsed Signal Result
export interface ParsedSignal {
  success: boolean;
  signal?: Omit<Signal, 'id' | 'createdAt' | 'updatedAt'>;
  error?: string;
}
