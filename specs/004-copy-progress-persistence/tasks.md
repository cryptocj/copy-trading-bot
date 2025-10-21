# Tasks: Copy Trading Progress Persistence

**Input**: Design documents from `/specs/004-copy-progress-persistence/`
**Prerequisites**: plan.md (partial), spec.md (complete)

**Tests**: Manual testing per constitution - no automated test tasks included

**Organization**: Tasks grouped by user story for independent implementation and testing

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Using web application structure: `apps/copy-trader/` (existing structure)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and localStorage persistence module

- [X] T001 Create `apps/copy-trader/src/services/sessionPersistence.js` module
- [X] T002 Define STORAGE_KEYS constants for session state in sessionPersistence.js
- [X] T003 [P] Define session state schema (SessionState type/interface) in sessionPersistence.js

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core persistence infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Implement `saveSessionState(state)` function in sessionPersistence.js
- [X] T005 Implement `loadSessionState()` function in sessionPersistence.js
- [X] T006 Implement `clearSessionState()` function in sessionPersistence.js
- [X] T007 [P] Implement error handling and validation for corrupted/invalid session data
- [X] T008 [P] Implement version checking for state schema migration in sessionPersistence.js
- [X] T009 Add multi-tab conflict detection logic using localStorage events

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Automatic Copy Trading State Recovery (Priority: P1) 🎯 MVP

**Goal**: Users can refresh the browser during active copy trading and automatically resume within 5 seconds

**Independent Test**: Start copy trading, refresh browser, verify automatic session resumption without user action

### Implementation for User Story 1

- [X] T010 [US1] Update `startCopyTrading()` in apps/copy-trader/src/services/trading.js to accept optional resumeState parameter
- [X] T011 [US1] Add session state persistence calls in startCopyTrading() after successful initialization
- [X] T012 [US1] Add session state update calls after each trade execution in executeCopyTrade()
- [X] T013 [US1] Update stopCopyTrading() to clear session state from localStorage
- [X] T014 [US1] Create `restoreActiveSession()` function in apps/copy-trader/src/main.js
- [X] T015 [US1] Add initialization logic in DOMContentLoaded event to detect and restore active sessions
- [X] T016 [US1] Implement session validation (API key, wallet address) before restoration
- [X] T017 [US1] Add UI state restoration (button states, status indicators) in restoreActiveSession()
- [X] T018 [US1] Add error handling for failed session restoration with user notification
- [ ] T019 [US1] Test session restoration with various states (active monitoring, mid-trade, stopped)

**Checkpoint**: At this point, automatic session recovery should work independently - users can refresh without losing active copy trading

---

## Phase 4: User Story 2 - Real-Time Copy Status Visibility (Priority: P2)

**Goal**: Users can see accurate copy trading status (duration, trade count) after page refresh

**Independent Test**: Start copy trading, execute trades, refresh page, verify status indicators show correct values

### Implementation for User Story 2

- [ ] T020 [P] [US2] Extend SessionState schema to include session duration tracking in sessionPersistence.js
- [ ] T021 [P] [US2] Extend SessionState schema to include trade counter in sessionPersistence.js
- [ ] T022 [US2] Create `calculateSessionDuration(startTime)` helper in apps/copy-trader/src/utils/format.js
- [ ] T023 [US2] Update UI to display session start time in apps/copy-trader/index.html
- [ ] T024 [US2] Add session duration display element to status section in index.html
- [ ] T025 [US2] Create `updateSessionStatusUI(sessionState)` function in main.js
- [ ] T026 [US2] Add periodic UI updates for session duration (every 1 second) in main.js
- [ ] T027 [US2] Update trade counter display when orders are executed in main.js
- [ ] T028 [US2] Persist trade counter to localStorage after each trade in trading.js
- [ ] T029 [US2] Restore trade counter from localStorage on session resumption
- [ ] T030 [US2] Add visual indicator distinguishing restored sessions vs. newly started in UI

**Checkpoint**: At this point, status visibility works independently - refresh preserves and displays accurate session metrics

---

## Phase 5: User Story 3 - Configuration Persistence Across Sessions (Priority: P3)

**Goal**: Configuration (trader address, API key, trade value, leverage) remembered across browser sessions

**Independent Test**: Configure copy trading, stop session, close browser, reopen, verify pre-filled configuration

### Implementation for User Story 3

- [ ] T031 [P] [US3] Extend existing STORAGE_KEYS in main.js to support persistent configuration flag
- [ ] T032 [US3] Update `saveConfiguration()` logic to mark configurations as persistent
- [ ] T033 [US3] Create `loadPersistedConfiguration()` function in main.js
- [ ] T034 [US3] Add configuration auto-restore logic in DOMContentLoaded event
- [ ] T035 [US3] Add "Remember configuration" checkbox to configuration form in index.html
- [ ] T036 [US3] Update form submission to respect "Remember configuration" preference
- [ ] T037 [US3] Create "Clear saved configuration" button in UI
- [ ] T038 [US3] Implement clearSavedConfiguration() function in main.js
- [ ] T039 [US3] Add visual indicator showing when configuration is loaded from storage
- [ ] T040 [US3] Test configuration persistence after days of inactivity

**Checkpoint**: All user stories should now be independently functional - configuration persists indefinitely as specified

---

## Phase 6: Edge Cases & Error Handling

**Purpose**: Handle edge cases identified in spec.md

- [ ] T041 [P] Implement multi-tab conflict resolution (detect simultaneous sessions, warn user)
- [ ] T042 [P] Add WebSocket reconnection state preservation in trading.js
- [ ] T043 Add validation for expired/invalid API keys during session restoration
- [ ] T044 Add handling for monitored wallet address changes (wallet no longer exists/has positions)
- [ ] T045 [P] Implement corrupted state data recovery (validate schema, fallback to fresh state)
- [ ] T046 [P] Add version mismatch handling (upgrade state schema to current version)
- [ ] T047 Add insufficient balance detection during restoration (warn user, prevent resume)
- [ ] T048 Test localStorage size limits with realistic session data (~3-5 KB)
- [ ] T049 Add graceful degradation when localStorage is disabled/unavailable

---

## Phase 7: Polish & Manual Testing

**Purpose**: Improvements and user acceptance testing

- [ ] T050 [P] Add localStorage event listeners for cross-tab synchronization
- [ ] T051 Update quickstart.md with manual test scenarios (create if needed)
- [ ] T052 Document session state schema and persistence architecture
- [ ] T053 [P] Add user-facing documentation for session persistence feature
- [ ] T054 Test SC-001: Verify <5 second session restoration time
- [ ] T055 Test SC-002: Verify ≥95% success rate across 20 test refreshes
- [ ] T056 Test SC-003: Verify 100% trade counter accuracy after multiple refreshes
- [ ] T057 Test SC-004: Verify configuration pre-fill after 24 hours
- [ ] T058 Test SC-005: Verify session duration ≤10 second accuracy after multiple refreshes
- [ ] T059 Test SC-006: Verify 100% multi-tab conflict detection
- [ ] T060 Test SC-007: User testing with 10 users for 90% success rate target
- [ ] T061 Test all 7 edge cases from spec.md
- [ ] T062 Code cleanup and add inline documentation
- [ ] T063 Performance audit (localStorage read/write <100ms target)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001-T003) - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase (T004-T009) completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Edge Cases (Phase 6)**: Can start after Foundational, integrates with user stories
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1) - T010-T019**: Can start after Foundational (T004-T009) - No dependencies on other stories
- **User Story 2 (P2) - T020-T030**: Can start after Foundational - Enhances US1 but independently testable
- **User Story 3 (P3) - T031-T040**: Can start after Foundational - Uses existing localStorage patterns from main.js

### Within Each User Story

- Models/schemas before services (T001-T003 → T004-T009)
- Service functions before UI integration (T004-T009 → T010+)
- Core implementation before UI updates (trading.js changes → main.js changes)
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T001, T002, T003)
- T007 and T008 can run in parallel (both extend sessionPersistence.js independently)
- T020 and T021 can run in parallel (both extend SessionState schema)
- T022, T041, T042, T045, T046, T050, T053 marked [P] can run in parallel
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)

---

## Parallel Example: User Story 1

```bash
# After Foundational phase complete, launch in parallel:
Task: "Update startCopyTrading() in trading.js to accept resumeState parameter"
Task: "Add error handling for failed session restoration in main.js"
# Then sequentially:
Task: "Add session state persistence calls in startCopyTrading()"
Task: "Test session restoration with various states"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T009) - CRITICAL
3. Complete Phase 3: User Story 1 (T010-T019)
4. **STOP and VALIDATE**: Test automatic session recovery independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (T001-T009)
2. Add User Story 1 → Test independently → Deploy/Demo (T010-T019) - MVP!
3. Add User Story 2 → Test independently → Deploy/Demo (T020-T030)
4. Add User Story 3 → Test independently → Deploy/Demo (T031-T040)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T009)
2. Once Foundational is done:
   - Developer A: User Story 1 (T010-T019)
   - Developer B: User Story 2 (T020-T030)
   - Developer C: User Story 3 (T031-T040)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files or isolated sections, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group (T004-T006, T010-T012, etc.)
- Stop at any checkpoint to validate story independently
- Manual testing per constitution - no automated test generation required
- localStorage API is synchronous - target <100ms read/write operations
- Session state size target: ~3-5 KB (well within ~5-10 MB localStorage limit)
- Multi-tab conflict detection uses localStorage 'storage' event listener
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
