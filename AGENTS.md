# AGENTS.md

Guide for AI coding agents working in this repository.

## Required Operating Model

This repository should be worked on with **two instruction layers together**:

1. **This `AGENTS.md`** for repository-specific coding/testing/release rules
2. **`CLAUDE.md`** for higher-level development principles, especially:
   - transformation-centered development
   - small structural changes
   - design option comparison before implementation
   - PRD / architecture / user story / transformation traceability
   - documentation synchronization after meaningful changes

If there is any ambiguity, do **not** treat `AGENTS.md` alone as complete. Read and apply `CLAUDE.md` together.

## Issue Tracking Workflow

This project uses **bd (beads)** for issue tracking.

Before starting meaningful work, run:

```bash
bd onboard
```

Core commands:

```bash
bd ready
bd show <id>
bd update <id> --status in_progress
bd close <id>
bd sync
```

When work maps to an existing issue, update the issue status as part of the workflow.

## Project Overview

OpenClaw Kakao TalkChannel Plugin - connects KakaoTalk channels to OpenClaw platform.

- **Runtime**: Node.js 22.12+, ESM modules (`"type": "module"`)
- **Language**: TypeScript 5.3+ with strict mode
- **Package Manager**: pnpm

## Commands

### Development

```bash
pnpm dev          # Watch mode (tsc --watch)
pnpm build        # Build to dist/
pnpm typecheck    # Type check without emitting
```

### Testing

```bash
pnpm test                 # Watch mode
pnpm test:run             # Single run (CI)
pnpm test:coverage        # With coverage report

# Run single test file
pnpm vitest run tests/unit/channel.test.ts

# Run tests matching pattern
pnpm vitest run -t "should send reply"

# Run specific test directory
pnpm vitest run tests/unit/relay/
```

### Code Quality

```bash
pnpm lint         # ESLint (src/ and tests/)
pnpm typecheck    # TypeScript strict check
```

## Project Structure

```
src/
├── adapters/     # OpenClaw adapter implementations
├── config/       # Zod schemas for configuration
├── kakao/        # Kakao API types and utilities
├── relay/        # SSE relay client
├── types.ts      # Type definitions
├── channel.ts    # Main plugin export
└── runtime.ts    # Runtime singleton
tests/
├── unit/         # Mirrors src/ structure
├── integration/  # E2E tests
├── fixtures/     # Test data
└── setup.ts      # Vitest setup
```

## Code Style

### TypeScript

- **Strict mode**: All strict checks enabled
- **Module system**: NodeNext (ESM)
- **Target**: ES2022

```typescript
// Use explicit type imports
import type { KakaoSkillPayload } from "../types.js";

// Always include .js extension for relative imports
import { sendReply } from "../relay/client.js";

// Prefer interfaces over types for objects
export interface GatewayContext {
  account: ResolvedKakaoTalkChannel;
  accountId: string;
}

// Use type assertions sparingly, never `as any`
const data = result as SendReplyResponse;

// Prefer unknown over any, validate with type guards
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
```

### Naming Conventions

```typescript
// Files: kebab-case
src/relay/client.ts
tests/unit/kakao/response.test.ts

// Interfaces: PascalCase, descriptive
interface KakaoSkillPayload { ... }
interface OutboundResult { ... }

// Functions: camelCase, verb-first
function validateAccountConfig() { ... }
function buildMessageContext() { ... }

// Constants: SCREAMING_SNAKE_CASE
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_RELAY_URL = "https://k.tess.dev/";

// Types: PascalCase, use union types liberally
type KakaoDmPolicy = "pairing" | "allowlist" | "open" | "disabled";
```

### Comments and Documentation

```typescript
/**
 * JSDoc for exported functions
 *
 * Single line for simple types
 */
export function validateAccountConfig(input: unknown): ValidationResult<KakaoAccountConfig> {

// Inline comments for complex logic
// Always explain WHY, not WHAT
const sessionKey = `agent:main:kakao-talkchannel:dm:${normalized.userId}`;
```

### Error Handling

```typescript
// Always use instanceof for error type checking
try {
  await sendReply(config, messageId, response);
} catch (err) {
  const errMsg = err instanceof Error ? err.message : String(err);
  log?.error(`Reply failed: ${errMsg}`);
}

// Use Result pattern for validation
type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };
```

### Zod Schemas

```typescript
// Define schemas with validation messages (Korean OK)
export const KakaoAccountConfigSchema = z.object({
  enabled: z.boolean().default(true),
  reconnectDelayMs: z.number()
    .min(500, "reconnectDelayMs는 최소 500ms 이상이어야 합니다")
    .max(10000, "reconnectDelayMs는 최대 10000ms 이하여야 합니다")
    .default(1000),
});

// Infer types from schemas
export type KakaoAccountConfig = z.infer<typeof KakaoAccountConfigSchema>;
```

## Testing Patterns

### Structure

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("ComponentName", () => {
  describe("methodName", () => {
    it("should do expected behavior", () => {
      // Arrange, Act, Assert
    });
  });
});
```

### Mocking

```typescript
// Mock globals
global.fetch = vi.fn();

// Create mock utilities in tests/setup.ts
export const createMockRuntime = () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  config: {},
});

// Reset mocks
beforeEach(() => {
  vi.clearAllMocks();
});
```

### Coverage Requirements

- Lines: 80%
- Functions: 80%
- Branches: 70%
- Statements: 80%

## Session Completion / Landing the Plane

When ending a work session, the work is **not complete** until changes are committed and pushed successfully.

Mandatory workflow:

1. File issues for remaining work / follow-ups
2. Run quality gates if code changed
   - `pnpm lint`
   - `pnpm typecheck`
   - relevant tests
3. Update issue status in `bd`
4. Sync and push

```bash
git pull --rebase
bd sync
git push
git status
```

`git status` must show that the branch is up to date with origin before considering the session complete.

Critical rules:
- Never leave meaningful completed work stranded only in local commits
- Never say "ready to push when you are" for normal repository work
- If push fails, resolve and retry until it succeeds or clearly report the blocker

## Commit Convention

**CRITICAL**: Uses release-please with Conventional Commits.

### Format

```
<type>: <message in Korean or English>
```

### Types

| Type | Description | Version Bump |
|------|-------------|--------------|
| `feat:` | New feature | Minor |
| `fix:` | Bug fix | Patch |
| `feat!:` | Breaking change | Major |
| `docs:` | Documentation | None |
| `refactor:` | Code refactor | None |
| `test:` | Tests | None |
| `chore:` | Build/config | None |

### Examples

```bash
# Correct
feat: 새로운 기능 추가
fix: 타임아웃 오류 수정

# WRONG - No emojis!
✨ feat: 기능 추가    # release-please fails
```

## Key Dependencies

- **zod**: Schema validation
- **openclaw**: Peer dependency (plugin SDK)
- **vitest**: Testing framework

## Import Order

```typescript
// 1. Node built-ins (rare in this project)
// 2. External packages
import { z } from "zod";

// 3. Internal absolute (type imports first)
import type { KakaoSkillPayload } from "../types.js";

// 4. Internal relative
import { sendReply } from "./client.js";
```

## Anti-patterns to Avoid

```typescript
// NEVER use type assertions to silence errors
const data = result as any;  // BAD
// @ts-ignore               // BAD
// @ts-expect-error         // BAD

// NEVER empty catch blocks
catch(e) {}                  // BAD

// NEVER forget .js extension
import { foo } from "./bar"; // BAD - must be "./bar.js"
```

<!-- BEGIN BEADS INTEGRATION -->
## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Dolt-powered version control with native sync
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update <id> --claim --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task atomically**: `bd update <id> --claim`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs via Dolt:

- Each write auto-commits to Dolt history
- Use `bd dolt push`/`bd dolt pull` for remote sync
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- END BEADS INTEGRATION -->
