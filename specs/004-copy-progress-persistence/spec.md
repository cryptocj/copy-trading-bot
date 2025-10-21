# Feature Specification: Copy Trading Progress Persistence

**Feature Branch**: `004-copy-progress-persistence`
**Created**: 2025-10-21
**Status**: Draft
**Input**: User description: "remember the current progress and status is important, because it's running on webiste, if we fresh, we might lose the copied process"

## User Scenarios & Testing

### User Story 1 - Automatic Copy Trading State Recovery (Priority: P1)

When a user has copy trading active and refreshes the browser or accidentally closes the tab, the system automatically restores the copy trading session, including active configuration, monitored wallet, and copying status, without requiring manual reconfiguration.

**Why this priority**: This is the core value proposition - preventing users from losing their active copy trading session due to browser refresh. Without this, users risk missing trades during reconnection, creating a critical gap in their strategy execution.

**Independent Test**: Can be fully tested by starting copy trading, refreshing the browser, and verifying that copy trading automatically resumes with the same configuration and monitored wallet without user intervention.

**Acceptance Scenarios**:

1. **Given** user has started copy trading with specific trader address, API key, trade value, and max leverage, **When** user refreshes the browser, **Then** copy trading automatically resumes with the same configuration, showing "Copy Trading Active" status
2. **Given** copy trading is active and monitoring a specific wallet, **When** user closes and reopens the tab within 24 hours, **Then** system restores the monitoring session and continues copying new trades from the monitored wallet
3. **Given** copy trading has been inactive for more than 24 hours, **When** user reopens the page, **Then** system shows last configuration but requires manual "Start" action before resuming copying

---

### User Story 2 - Real-Time Copy Status Visibility (Priority: P2)

Users can always see their current copy trading status, including whether copying is active, which wallet is being monitored, how long the session has been running, and number of trades copied, even after page refresh.

**Why this priority**: Essential for user confidence and situational awareness. Users need to know at a glance if their copy trading is working correctly, especially after recovering from a refresh.

**Independent Test**: Start copy trading, execute some trades, refresh the browser, and verify that status indicators accurately reflect the ongoing session state and trade count.

**Acceptance Scenarios**:

1. **Given** copy trading has been active for 2 hours and copied 5 trades, **When** user refreshes the page, **Then** status shows "Active for 2 hours" and "5 trades copied"
2. **Given** copy trading is active, **When** a new trade is copied, **Then** trade counter increments in real-time without requiring page refresh
3. **Given** copy trading was stopped by user, **When** user refreshes the page, **Then** status shows "Stopped" with option to restart with previous configuration

---

### User Story 3 - Configuration Persistence Across Sessions (Priority: P3)

User configuration (trader address, API key, trade value, max leverage) is remembered across browser sessions, allowing quick restart of copy trading with previously used settings.

**Why this priority**: Improves usability by reducing repetitive data entry, but less critical than active session recovery since it only affects startup convenience, not active trading sessions.

**Independent Test**: Configure copy trading settings, stop copy trading, close browser completely, reopen after hours/days, and verify that all configuration fields are pre-filled with previous values.

**Acceptance Scenarios**:

1. **Given** user has configured copy trading with specific settings and stopped it, **When** user returns to the page days later, **Then** all configuration fields are pre-filled with previous values
2. **Given** user has saved API key via "Remember API key" checkbox, **When** user returns to the page, **Then** API key field is pre-filled and marked as remembered
3. **Given** user explicitly clears saved configuration, **When** user refreshes the page, **Then** all fields are empty and no automatic restore occurs

---

### Edge Cases

- What happens when user has copy trading active in multiple browser tabs simultaneously?
- How does system handle session recovery when WebSocket connection fails repeatedly?
- What happens if stored configuration contains invalid or expired API key?
- How does system handle recovery when monitored wallet address no longer exists or has no positions?
- What happens if user's account balance has changed significantly since last session?
- How does system handle time zone differences when displaying session duration?
- What happens when stored state data becomes corrupted or incompatible with new code version?

## Requirements

### Functional Requirements

- **FR-001**: System MUST persist copy trading state (active/stopped, monitored wallet, configuration) to survive browser refresh
- **FR-002**: System MUST automatically restore active copy trading sessions on page load without user intervention
- **FR-003**: System MUST track session start time and calculate elapsed duration accurately across refreshes
- **FR-004**: System MUST persist trade counter and increment it for each new trade across sessions
- **FR-005**: System MUST validate restored configuration (API key, wallet address) before resuming copy trading
- **FR-006**: System MUST detect and prevent multiple simultaneous copy trading sessions in different tabs
- **FR-007**: System MUST keep persisted sessions in storage indefinitely until user manually clears them (no automatic expiration)
- **FR-008**: System MUST provide visual indicators showing whether session is restored from storage vs. newly started
- **FR-009**: System MUST allow users to clear stored configuration and stop automatic restoration
- **FR-010**: System MUST handle version mismatches between stored state format and current code version
- **FR-011**: System MUST preserve copy trading status through temporary network disconnections
- **FR-012**: System MUST persist last known monitored wallet state (balance, positions, last trade time)

### Key Entities

- **Persisted Copy Session**: Represents an active or recently active copy trading session, including status (active/stopped/paused), monitored wallet address, session start timestamp, trades copied count, last activity timestamp, and recovery metadata
- **Configuration Snapshot**: Saved user configuration including trader address, API key (encrypted/hashed), trade value, max leverage, last modified timestamp, and user preference for automatic restoration
- **Session Recovery State**: Metadata tracking recovery status including last successful connection, pending reconnection attempts, error state, and expiration timestamp for automatic cleanup

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can refresh the browser during active copy trading and automatically resume within 5 seconds without missing trades
- **SC-002**: Session state recovery succeeds ≥95% of the time when page is refreshed during active copying
- **SC-003**: Trade counter maintains 100% accuracy across page refreshes (no lost or duplicate counts)
- **SC-004**: Users can close and reopen the browser within 24 hours and find their configuration pre-filled
- **SC-005**: Session duration tracking maintains ≤10 second accuracy across multiple refresh cycles
- **SC-006**: System detects and prevents duplicate sessions in 100% of cases when multiple tabs are opened
- **SC-007**: 90% of users successfully resume copy trading after refresh without confusion or errors

## Assumptions

- Copy trading state is persisted in browser storage (not server-side database)
- Session recovery only applies to same browser and device (not cross-device sync)
- API keys are stored securely in browser storage with appropriate encryption
- WebSocket connections can be re-established using stored configuration
- Users understand that closing all browser instances may clear certain storage types
- Persisted sessions never expire automatically; users must manually clear them when desired
- Trade counter resets when user explicitly stops and restarts with new configuration
- Network reconnection uses exponential backoff and doesn't overload the exchange API
