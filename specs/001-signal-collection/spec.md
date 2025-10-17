# Feature Specification: Signal Collection

**Feature Branch**: `001-signal-collection`
**Created**: 2025-10-17
**Status**: Draft
**Input**: User description: "start the phase 1 in @PROJECT_STATUS.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bot Registration and Connection (Priority: P1)

As the system operator, I need to register the bot with Telegram and connect it to the 3 test signal groups so that the bot can receive trading signals in real-time.

**Why this priority**: Without bot registration and group connection, no signals can be collected. This is the foundational capability that everything else depends on.

**Independent Test**: Can be fully tested by verifying the bot responds to commands in the test groups and logs incoming messages. Delivers immediate value by establishing the monitoring infrastructure.

**Acceptance Scenarios**:

1. **Given** I have a Telegram account, **When** I create a bot via @BotFather, **Then** I receive a bot token that can be used for authentication
2. **Given** the bot is configured with a valid token, **When** I start the bot application, **Then** the bot comes online and responds to /start and /status commands
3. **Given** the bot is online, **When** I add it to Evening Trader group, **Then** the bot can see and log messages from that group
4. **Given** the bot is online, **When** I add it to Wolf of Trading group, **Then** the bot can see and log messages from that group
5. **Given** the bot is online, **When** I add it to Binance Killers group, **Then** the bot can see and log messages from that group

---

### User Story 2 - Signal Message Detection (Priority: P1)

As the system, I need to identify which incoming Telegram messages are trading signals so that I can filter out noise and focus on relevant data.

**Why this priority**: Without signal detection, the bot would process all messages equally, making it impossible to distinguish trading signals from regular chat. This is essential for MVP functionality.

**Independent Test**: Can be tested by sending sample trading signal messages and verifying they are identified as signals, while regular chat messages are ignored. Delivers value by reducing noise in the data pipeline.

**Acceptance Scenarios**:

1. **Given** the bot receives a message containing "LONG" or "SHORT", **When** the message includes a trading pair symbol (e.g., "BTC/USDT"), **Then** the message is identified as a potential trading signal
2. **Given** the bot receives a regular chat message, **When** the message does not contain trading keywords, **Then** the message is logged but not processed as a signal
3. **Given** the bot receives a message with price levels (Entry, TP, SL), **When** the message format matches common signal patterns, **Then** the message is flagged for parsing
4. **Given** a potential signal is detected, **When** the message is from one of the 3 configured test groups, **Then** the group information is associated with the signal

---

### User Story 3 - Signal Parsing and Storage (Priority: P1)

As the system, I need to extract structured data from trading signal messages and save it to the database so that signals can be tracked and analyzed later.

**Why this priority**: Parsed and stored signals form the core dataset for all future analysis. Without this, the system would just be logging messages without extracting actionable data.

**Independent Test**: Can be tested by sending known signal formats and verifying the database contains correctly parsed signal records with all key fields extracted. Delivers value by creating a queryable signal history.

**Acceptance Scenarios**:

1. **Given** a message contains "LONG BTC/USDT", **When** the parser processes it, **Then** a Signal record is created with symbol="BTC/USDT" and direction="LONG"
2. **Given** a message contains "Entry: 50000-51000", **When** the parser processes it, **Then** the Signal record includes entryPriceMin=50000 and entryPriceMax=51000
3. **Given** a message contains "TP: 52000, 54000, 56000", **When** the parser processes it, **Then** the Signal record includes takeProfits array with all three values
4. **Given** a message contains "SL: 48000", **When** the parser processes it, **Then** the Signal record includes stopLoss=48000
5. **Given** a message contains leverage information like "5x", **When** the parser processes it, **Then** the Signal record includes leverage=5
6. **Given** a signal is successfully parsed, **When** it is saved to the database, **Then** it is linked to the correct Group record via groupId
7. **Given** a signal message cannot be parsed completely, **When** partial data is extracted, **Then** the rawMessage is always stored for manual review
8. **Given** multiple signals arrive simultaneously, **When** they are processed, **Then** each signal is stored as a separate database record with unique timestamps

---

### Edge Cases

- What happens when a message format doesn't match any known signal pattern? (Store rawMessage for manual review, log as unparsed)
- What happens when the bot loses connection to Telegram? (Reconnect automatically, log connection issues)
- What happens when the database is unavailable? (Queue signals in memory temporarily, retry storage, log failures)
- What happens when a group posts multiple signals in rapid succession? (Process each independently, preserve order via timestamps)
- What happens when a signal message is edited after being posted? (Current version: ignore edits, store original only)
- What happens when a signal has incomplete information (missing SL or TP)? (Store what's available, mark fields as null, preserve rawMessage)
- What happens when leverage is specified in different formats (5x, 5X, x5)? (Parse common variations, default to null if unclear)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a way to register a Telegram bot and obtain authentication credentials
- **FR-002**: System MUST allow configuration of the bot token through environment variables
- **FR-003**: System MUST connect to Telegram and maintain an active bot session
- **FR-004**: Bot MUST respond to /start and /status commands to verify it is online
- **FR-005**: System MUST allow the bot to be added to Telegram groups as a member
- **FR-006**: Bot MUST receive and log all text messages from groups it has joined
- **FR-007**: System MUST identify messages that contain trading signal keywords (LONG, SHORT, Entry, TP, SL)
- **FR-008**: System MUST parse trading signals to extract symbol (e.g., "BTC/USDT")
- **FR-009**: System MUST parse trading signals to extract direction (LONG or SHORT)
- **FR-010**: System MUST parse trading signals to extract entry price or entry price range
- **FR-011**: System MUST parse trading signals to extract stop loss (SL) values
- **FR-012**: System MUST parse trading signals to extract take profit (TP) values (multiple levels supported)
- **FR-013**: System MUST parse trading signals to extract leverage when specified
- **FR-014**: System MUST store the complete raw message text for every signal
- **FR-015**: System MUST associate each signal with its source group (Evening Trader, Wolf of Trading, or Binance Killers)
- **FR-016**: System MUST store signals in the database with unique identifiers
- **FR-017**: System MUST record the message ID and timestamp from Telegram for each signal
- **FR-018**: System MUST set signal status to "PENDING" when first stored
- **FR-019**: System MUST handle connection failures gracefully with automatic reconnection
- **FR-020**: System MUST log all errors and warnings for debugging purposes

### Key Entities

- **Telegram Bot**: Represents the bot instance with authentication token, connection status, and message handlers. Links to Group entities for monitoring.
- **Group**: Represents a Telegram signal channel (Evening Trader, Wolf of Trading, Binance Killers) with name, Telegram chat ID, and status. Contains multiple Signal entities.
- **Signal**: Represents a parsed trading signal with symbol, direction, price levels, source group reference, raw message text, and metadata (message ID, timestamp). Status starts as "PENDING".
- **Raw Message**: The original unprocessed text from Telegram, stored within Signal entity for validation and manual review when parsing is incomplete.

### Assumptions

- Groups are public or the bot has been granted access by group administrators
- Signal formats follow common patterns (symbol, direction, entry, TP, SL) but may vary in exact wording
- Symbols follow standard format: BASE/QUOTE (e.g., BTC/USDT, ETH/USDT)
- Leverage notation uses "x" suffix or prefix (5x, x5) when present
- Database schema from packages/database/prisma/schema.prisma is already defined and matches requirements
- The 3 test groups (Evening Trader, Wolf of Trading, Binance Killers) are already seeded in the database
- Bot will have necessary permissions to read messages in groups (not restricted by Telegram privacy settings)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Bot successfully registers with Telegram and comes online within 30 seconds of starting the application
- **SC-002**: Bot connects to all 3 test groups and receives messages without errors
- **SC-003**: System correctly identifies at least 90% of actual trading signals posted in the test groups
- **SC-004**: Signal parser successfully extracts symbol and direction from 100% of identified signals
- **SC-005**: Signal parser extracts at least 3 out of 5 key fields (symbol, direction, entry, TP, SL) from 80% of signals
- **SC-006**: All detected signals are stored in the database within 5 seconds of receipt
- **SC-007**: System can process at least 10 signals per minute without performance degradation
- **SC-008**: Bot maintains connection for at least 24 hours without manual intervention
- **SC-009**: Zero data loss - every received signal message is stored (at minimum as rawMessage) even if parsing fails
- **SC-010**: System provides logs that allow debugging of parsing failures within 5 minutes of occurrence
