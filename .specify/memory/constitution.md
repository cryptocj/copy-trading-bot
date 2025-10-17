<!--
================================================================================
SYNC IMPACT REPORT
================================================================================
Version Change: N/A → 1.0.0 (Initial constitution)
Modified Principles: N/A (initial creation)
Added Sections:
  - Core Principles (3 principles: MVP-First, Quality Gates, Incremental Testing)
  - Development Workflow
  - Governance

Templates Requiring Updates:
  ✅ plan-template.md - Already flexible, compatible with MVP approach
  ✅ spec-template.md - User story prioritization aligns with MVP-First principle
  ✅ tasks-template.md - Phase-based approach supports incremental delivery

Follow-up TODOs: None - all placeholders filled
================================================================================
-->

# Signal Tracker Constitution

## Core Principles

### I. MVP-First Development

**Speed is a feature.** The first phase prioritizes rapid implementation and market validation over comprehensive testing and complex processes.

- Features MUST be designed as independently testable user stories with clear priorities (P1, P2, P3)
- P1 stories are the minimum viable product - implement these FIRST before any P2/P3 work
- Complex abstractions and patterns are DEFERRED until proven necessary by real usage
- "Good enough" solutions that can ship quickly are preferred over perfect solutions that take longer
- Technical debt is acceptable in MVP phase if documented and planned for future resolution

**Rationale**: Market feedback is more valuable than architectural perfection. Ship fast, learn fast, iterate fast.

### II. Quality Gates (Non-Negotiable Minimums)

**Even at speed, we maintain baseline quality.** These gates cannot be skipped:

- Code MUST pass TypeScript compilation with no errors
- Code MUST follow existing project patterns (monorepo structure, workspace dependencies, ESM imports)
- Database schema changes MUST include Prisma migration/generation
- Environment variables MUST be documented in `.env.example`
- Breaking changes MUST be validated with `pnpm build` before committing
- Each feature MUST have at least one manual test scenario documented

**Rationale**: These gates prevent broken code from reaching production without adding significant overhead. They're fast checks, not comprehensive test suites.

### III. Incremental Testing Strategy

**Testing grows with the product, not before it.** Testing follows a pragmatic progression:

**Phase 1 - MVP (Current)**:
- Manual testing via documented test scenarios is SUFFICIENT
- Automated tests are OPTIONAL unless explicitly requested
- Focus on smoke testing: "Does the happy path work?"
- Document test scenarios in user stories for manual validation

**Phase 2 - Post-MVP (Future)**:
- Add integration tests for critical paths that have proven problematic
- Add contract tests for stable APIs that other systems depend on
- Add unit tests for complex business logic that has bugs in production

**Phase 3 - Scale (Future)**:
- Comprehensive test coverage for battle-tested code
- TDD for new features in mature areas
- Performance and load testing for scale bottlenecks

**Rationale**: Test the code that matters, when it matters. Early-stage products need speed over coverage; mature products need coverage to maintain velocity.

## Development Workflow

**Iteration Cycle** (designed for speed):

1. **Define**: Write user story with priority (P1/P2/P3) and manual test scenario
2. **Implement**: Focus on P1 stories only - implement, manual test, commit
3. **Validate**: Run quality gates (`pnpm build`, TypeScript check, manual smoke test)
4. **Ship**: Deploy P1, gather feedback
5. **Iterate**: Add P2/P3 based on real usage feedback, refactor based on actual pain points

**Commit Discipline**:
- Commit after each working feature or logical unit
- Commit messages should reference user story if applicable (e.g., "feat: implement P1 signal parser")
- Breaking changes should be clearly marked and validated

**Refactoring Policy**:
- Refactoring is DEFERRED until Phase 2 unless it blocks new features
- Document technical debt in code comments with `// TODO(debt): [description]`
- Patterns emerge from real usage, not upfront design

## Governance

**This constitution guides MVP development and will evolve with the product.**

**Amendment Process**:
- Constitution amendments require explicit user approval and version update
- Version increments follow semantic versioning (MAJOR.MINOR.PATCH)
- Major version change signals transition between phases (e.g., MVP → Post-MVP)

**Compliance Expectations**:
- Quality gates (Principle II) are NON-NEGOTIABLE even at MVP stage
- MVP-First (Principle I) and Incremental Testing (Principle III) guide decision-making but can be overridden by explicit user direction
- All PRs and commits should be validated against quality gates
- When in doubt, ask the user for priority/approach clarification

**Phase Transitions**:
- MVP → Post-MVP transition occurs when:
  - Core P1 user stories are stable in production
  - Real users are providing feedback
  - Pain points and frequently-broken areas are identified
- User approval required to transition to higher testing rigor phases

**Version**: 1.0.0 | **Ratified**: 2025-10-17 | **Last Amended**: 2025-10-17
