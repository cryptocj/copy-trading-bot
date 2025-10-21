# Implementation Plan: Copy Trading Progress Persistence

**Branch**: `004-copy-progress-persistence` | **Date**: 2025-10-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-copy-progress-persistence/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement session persistence for the copy trading web application to prevent users from losing active trading sessions when refreshing the browser. The system will automatically save and restore copy trading state (configuration, active status, trade counter, session duration) using browser localStorage, ensuring seamless continuity across page refreshes without requiring server-side infrastructure.

**Technical Approach**: Implement a localStorage-based state management layer that persists copy trading session state, wraps the existing `startCopyTrading`/`stopCopyTrading` services with automatic save/restore logic, and adds an initialization routine that detects and recovers active sessions on page load.

## Technical Context

**Language/Version**: JavaScript ES6+ (vanilla, no build step - loaded via `<script type="module">`)
**Primary Dependencies**: None (uses existing CDN-loaded CCXT + Ethers.js), localStorage API (native browser)
**Storage**: Browser localStorage (persistent, ~5-10MB limit, synchronous key-value store)
**Testing**: Manual testing (per constitution: MVP phase uses documented test scenarios, no automated tests required)
**Target Platform**: Modern browsers (Chrome/Firefox/Safari/Edge - all support localStorage and ES6 modules)
**Project Type**: Single-page web application (static HTML + ES6 modules)
**Performance Goals**: <5 seconds session restore time (SC-001), <100ms localStorage read/write operations
**Constraints**: localStorage size limit (~5-10MB per origin), synchronous API (blocking), no encryption built-in
**Scale/Scope**: Single-user browser-based app, ~3-5 KB state data per session, 12 functional requirements

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

[Gates determined based on constitution file]

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
