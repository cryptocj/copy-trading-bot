# Data Model: Signal Collection (User Story 1)

**Feature**: Bot Registration and Connection
**Date**: 2025-10-17
**Scope**: User Story 1 - Data entities and relationships

## Overview

User Story 1 primarily uses **existing** database entities (Group) that were pre-defined in the Prisma schema and seeded with test data. No new entities or schema changes are required for bot registration and connection.

**Key Principle**: US1 is read-only for database operations. Bot connects to groups and logs messages, but does not create/update database records yet.

## Existing Entities Used

### Group (Already Defined in Schema)

**Source**: `packages/database/prisma/schema.prisma`

**Purpose**: Represents Telegram signal channels that the bot monitors

**Schema Definition**:
```prisma
model Group {
  id        String   @id @default(cuid())
  name      String
  telegramId String  @unique
  description String?
  status    GroupStatus @default(TESTING)

  // Statistics (not used in US1)
  totalSignals    Int @default(0)
  winningSignals  Int @default(0)
  losingSignals   Int @default(0)
  totalPnl        Float @default(0)

  // Metadata
  subscriberCount Int?
  isVerified      Boolean @default(false)
  isPremium       Boolean @default(false)

  // Relations (not used in US1)
  signals Signal[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([telegramId])
  @@index([status])
}

enum GroupStatus {
  ACTIVE
  INACTIVE
  TESTING
}
```

**US1 Usage**:
- **Read-only access**: Bot queries Group records by `telegramId` to identify monitored groups
- **telegramId**: Matched against `ctx.chat.id` from incoming messages to verify if group is monitored
- **name**: Used for logging/display purposes (e.g., "Evening Trader")
- **status**: US1 only monitors groups with status='TESTING' (all 3 test groups)

**Seeded Test Data** (from `seed.ts`):
```typescript
// These groups already exist in database
[
  {
    name: 'Evening Trader',
    telegramId: '-1001234567890', // Placeholder - replace with real chat ID
    status: 'TESTING',
    description: '92-95% win rate claim'
  },
  {
    name: 'Wolf of Trading',
    telegramId: '-1009876543210', // Placeholder - replace with real chat ID
    status: 'TESTING',
    description: '200K+ subscribers'
  },
  {
    name: 'Binance Killers',
    telegramId: '-1001111222333', // Placeholder - replace with real chat ID
    status: 'TESTING',
    description: 'Binance-focused signals'
  }
]
```

**Important Note**: The `telegramId` placeholders in seed data must be replaced with actual Telegram chat IDs after bot is added to groups. Chat ID is obtained from `ctx.chat.id` when bot receives first message from each group.

## Entity Relationships (US1 Context)

```
┌─────────────┐
│   Group     │  ← US1 reads to identify monitored groups
│  (existing) │
└─────────────┘
       │
       │ 1:N (not used in US1)
       ▼
┌─────────────┐
│   Signal    │  ← Created in US3, not US1
│  (existing) │
└─────────────┘
```

**US1 Relationship Usage**:
- Group entity exists and is queried for verification
- Signal relationship not used yet (signals not created until US3)
- Bot only reads Group.telegramId and Group.name for logging

## Data Operations (US1)

### Read Operations

**Query Groups by Status**:
```typescript
import { prisma } from '@signal-tracker/database';

// Get all test groups at bot startup
const monitoredGroups = await prisma.group.findMany({
  where: { status: 'TESTING' },
  select: { id: true, name: true, telegramId: true }
});
```

**Verify Message Source**:
```typescript
// Check if incoming message is from monitored group
const group = await prisma.group.findUnique({
  where: { telegramId: chatId.toString() }
});

if (group) {
  console.log(`Message from monitored group: ${group.name}`);
}
```

**No Write Operations in US1**:
- No Group creation (groups pre-seeded)
- No Group updates (statistics updated in future US)
- No Signal creation (deferred to US3)

## Data Flow (US1)

```
┌──────────────┐
│ Telegram API │  ← Bot connects via grammY
└──────┬───────┘
       │ Message event
       ▼
┌──────────────┐
│ Bot Handler  │  ← Receives ctx.chat.id
└──────┬───────┘
       │ Query
       ▼
┌──────────────┐
│   Database   │  ← Prisma finds Group by telegramId
│  (Postgres)  │
└──────┬───────┘
       │ Group record
       ▼
┌──────────────┐
│ Console Log  │  ← Logs group name + message
└──────────────┘
```

**Data Flow Steps**:
1. Telegram sends message to bot
2. grammY delivers message event with `ctx.chat.id`
3. Bot queries database for Group with matching `telegramId`
4. If found, log message with group context
5. If not found, ignore message (not a monitored group)

## Schema Validation (US1)

**No Schema Changes Required**:
- ✅ Group entity already defined
- ✅ Test groups already seeded
- ✅ Indexes already present (telegramId, status)
- ✅ No migrations needed

**TypeScript Types (Already Defined)**:
```typescript
// From @signal-tracker/types package
import { GroupStatus } from '@signal-tracker/types';

interface Group {
  id: string;
  name: string;
  telegramId: string;
  description?: string;
  status: GroupStatus;
  // ... other fields
}
```

## Data Integrity Considerations

**Telegram Chat ID Format**:
- Format: Negative integer for groups (e.g., `-1001234567890`)
- Stored as: String in database (Prisma schema uses `String` type)
- Conversion: `ctx.chat.id.toString()` for queries

**Uniqueness Constraints**:
- `telegramId` has `@unique` constraint (prevents duplicate groups)
- Chat IDs are immutable (Telegram guarantees uniqueness)

**Test Data Limitations**:
- Seeded `telegramId` values are placeholders
- Must be updated with real chat IDs after bot joins groups
- Can be updated via Prisma Studio or direct SQL

## Future Data Model Evolution

**Not Implemented in US1** (deferred to future user stories):

**US2: Signal Detection**:
- No new entities (detection is in-memory logic)

**US3: Signal Parsing & Storage**:
- Use existing Signal entity
- Create Signal records linked to Group
- Store parsed signal data + rawMessage

**Phase 2: Performance Tracking**:
- Use existing PriceUpdate entity
- Create price snapshots linked to Signal
- Update Signal.pnl and Group.totalPnl

## Summary

**US1 Data Model Status**:
- ✅ Uses existing Group entity (no changes)
- ✅ Read-only database operations
- ✅ No schema migrations required
- ✅ No new entities created
- ✅ Prisma client already generated

**Key Takeaway**: US1 is purely about bot connection infrastructure. All necessary database entities already exist and are seeded with test data. Implementation focuses on bot code, not data modeling.
