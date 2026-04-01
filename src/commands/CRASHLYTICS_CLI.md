# Crashlytics Direct CLI Commands

## What Was Extracted

Five Crashlytics operations previously available only through the Firebase MCP server are now accessible as direct Firebase CLI commands:

| Command | Description |
|---------|-------------|
| `firebase crashlytics:issues:list` | List top Crashlytics issues for an app |
| `firebase crashlytics:issues:get` | Get details for a single issue |
| `firebase crashlytics:issues:update` | Update issue state (OPEN/CLOSED/MUTED) |
| `firebase crashlytics:events:list` | List recent events for an issue or variant |
| `firebase crashlytics:events:batchGet` | Get events by resource name |

## Why a Standalone Module

The MCP layer wraps Crashlytics business logic with MCP-specific concerns (tool schemas, MCP content types, agent-oriented formatting). Building CLI commands on top of MCP would create an unnecessary runtime dependency on the MCP server and SDK.

Instead, the new CLI commands import directly from `src/crashlytics/` — the existing business logic layer that already has no MCP dependencies. This gives:

1. **Zero MCP runtime dependency** — commands work without `firebase mcp`.
2. **Minimal merge conflicts** — the MCP layer is untouched; new files are fully additive.
3. **Shared backend logic** — both MCP tools and CLI commands call the same API functions.

## Architecture

```
src/crashlytics/              # Business logic (UNCHANGED, shared)
  ├── issues.ts               #   getIssue(), updateIssue()
  ├── events.ts               #   listEvents(), batchGetEvents()
  ├── reports.ts              #   getReport(), simplifyReport()
  ├── filters.ts              #   EventFilter, validateEventFilters()
  ├── types.ts                #   All TypeScript interfaces
  └── utils.ts                #   API client, parseProjectNumber()

src/commands/                 # CLI commands (NEW)
  ├── crashlytics-formatter.ts        # Human-readable output formatting
  ├── crashlytics-list-issues.ts      # crashlytics:issues:list command
  ├── crashlytics-get-issue.ts        # crashlytics:issues:get command
  ├── crashlytics-update-issue.ts     # crashlytics:issues:update command
  ├── crashlytics-list-events.ts      # crashlytics:events:list command
  ├── crashlytics-batch-get-events.ts # crashlytics:events:batchGet command
  └── crashlytics-formatter.spec.ts   # Tests

src/mcp/tools/crashlytics/   # MCP tools (UNCHANGED)
```

## Integration Points

Only one existing file was modified:

- **`src/commands/index.ts`** — 6 lines added to register the new commands via `loadCommand()`.

## Merge Conflict Minimization

- All new code is in new files — no modifications to existing business logic or MCP code.
- The single edit to `index.ts` is a contiguous block inserted between existing `crashlytics.mappingfile` and `database` registrations.
- The formatter is self-contained and does not share code with the MCP presentation layer.

## Usage Examples

```bash
# List top issues
firebase crashlytics:issues:list --app 1:123456:android:abcdef

# List issues with filters
firebase crashlytics:issues:list --app 1:123456:android:abcdef --error-type FATAL --page-size 20

# Get JSON output
firebase crashlytics:issues:list --app 1:123456:android:abcdef --json

# Get issue details
firebase crashlytics:issues:get --app 1:123456:android:abcdef --issue abc123

# Update issue state
firebase crashlytics:issues:update --app 1:123456:android:abcdef --issue abc123 --state CLOSED

# List events for an issue
firebase crashlytics:events:list --app 1:123456:android:abcdef --issue abc123 --page-size 5

# Get specific events by resource name
firebase crashlytics:events:batchGet --app 1:123456:android:abcdef --name "projects/123456/apps/1:123456:android:abcdef/events/evt001"
```

## Filter Flags

Available on `crashlytics:issues:list` and `crashlytics:events:list`:

| Flag | Description |
|------|-------------|
| `--start-time` | ISO 8601 start time (max 90 days ago) |
| `--end-time` | ISO 8601 end time |
| `--error-type` | FATAL, NON_FATAL, ANR (comma-separated) |
| `--signal` | SIGNAL_EARLY, SIGNAL_FRESH, SIGNAL_REGRESSED, SIGNAL_REPETITIVE |
| `--app-version` | App version display names |
| `--os` | OS display names |
| `--device` | Device display names |
| `--form-factor` | PHONE, TABLET, DESKTOP, TV, WATCH |
