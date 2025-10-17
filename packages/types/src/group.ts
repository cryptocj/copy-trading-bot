import { z } from 'zod';

// Signal Group Status
export enum GroupStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TESTING = 'TESTING',
}

// Signal Group Schema
export const GroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  telegramId: z.string(), // Telegram chat ID
  description: z.string().optional(),
  status: z.nativeEnum(GroupStatus).default(GroupStatus.TESTING),

  // Statistics
  totalSignals: z.number().default(0),
  winningSignals: z.number().default(0),
  losingSignals: z.number().default(0),
  totalPnl: z.number().default(0),

  // Metadata
  subscriberCount: z.number().optional(),
  isVerified: z.boolean().default(false),
  isPremium: z.boolean().default(false),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Group = z.infer<typeof GroupSchema>;

// Group Statistics
export interface GroupStatistics {
  groupId: string;
  totalSignals: number;
  winRate: number;
  averagePnl: number;
  totalPnl: number;
  bestSignal: number;
  worstSignal: number;
  avgHoldingTime: number; // in hours
}
