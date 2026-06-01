# Crashlytics Direct CLI Commands

## What Was Extracted

Five Crashlytics operations previously available only through the Firebase MCP server are now accessible as direct Firebase CLI commands:

| Command                                | Description                                |
| -------------------------------------- | ------------------------------------------ |
| `firebase crashlytics:issues:list`     | List top Crashlytics issues for an app     |
| `firebase crashlytics:issues:get`      | Get details for a single issue             |
| `firebase crashlytics:issues:update`   | Update issue state (OPEN/CLOSED/MUTED)     |
| `firebase crashlytics:events:list`     | List recent events for an issue or variant |
| `firebase crashlytics:events:batchGet` | Get events by resource name                |

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

src/commands/crashlytics-direct/      # CLI commands (NEW, isolated)
  ├── register.ts                     # Registers commands without src/commands/index.ts
  ├── crashlytics-formatter.ts        # Human-readable output formatting
  ├── crashlytics-output.ts           # Structured command results for JSON output
  ├── crashlytics-list-issues.ts      # crashlytics:issues:list command
  ├── crashlytics-get-issue.ts        # crashlytics:issues:get command
  ├── crashlytics-update-issue.ts     # crashlytics:issues:update command
  ├── crashlytics-list-events.ts      # crashlytics:events:list command
  ├── crashlytics-batch-get-events.ts # crashlytics:events:batchGet command
  └── crashlytics-formatter.spec.ts   # Tests

src/mcp/tools/crashlytics/   # MCP tools (UNCHANGED)
```

## Integration Points

Only one existing registration hook is needed:

- **`src/index.ts`** calls `registerCrashlyticsDirectCommands(client)` after the built-in command tree loads.
- **`src/commands/index.ts`** is intentionally not used for these commands.

## Merge Conflict Minimization

- All new command code is isolated under `src/commands/crashlytics-direct/` — no modifications to existing business logic or MCP code.
- The direct command registrar preserves existing `crashlytics:symbols:*` and `crashlytics:mappingfile:*` registrations.
- The formatter is self-contained and does not share code with the MCP presentation layer.
- Structured JSON output is built in `crashlytics-output.ts`; commands build data first, then render human output at the edge.

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

| Flag            | Description                                                     |
| --------------- | --------------------------------------------------------------- |
| `--start-time`  | ISO 8601 start time (max 90 days ago)                           |
| `--end-time`    | ISO 8601 end time                                               |
| `--error-type`  | FATAL, NON_FATAL, ANR (comma-separated)                         |
| `--signal`      | SIGNAL_EARLY, SIGNAL_FRESH, SIGNAL_REGRESSED, SIGNAL_REPETITIVE |
| `--app-version` | App version display names                                       |
| `--os`          | OS display names                                                |
| `--device`      | Device display names                                            |
| `--form-factor` | PHONE, TABLET, DESKTOP, TV, WATCH                               |

## JSON Output

The commands use the Firebase CLI global `--json` flag. Do not add per-command JSON flags. In JSON mode, normal logger output is suppressed by the command runner and the returned structured result is printed in the standard CLI envelope:

```json
{
  "status": "success",
  "result": {
    "command": "crashlytics:issues:get",
    "input": {},
    "data": {},
    "warnings": []
  }
}
```

Error output uses the existing global CLI shape and preserves existing exit code behavior:

```json
{
  "status": "error",
  "error": "--app <appId> is required"
}
```

JSON output requirements:

- Keep JSON readable and deterministic.
- Do not include ANSI colors, table borders, alignment spaces, icons, or other visual-only formatting.
- Preserve the same information shown in human output, using structured fields instead of string-parsed human text.
- Build JSON from API data and command inputs before human formatting.
- Keep repeated structures as arrays or objects, for example `issues`, `events`, `metrics`, `logs`, `breadcrumbs`, and stack `frames`.

### Result Shapes

All Crashlytics direct command JSON results include:

| Property   | Description                                             |
| ---------- | ------------------------------------------------------- |
| `command`  | CLI command name, for example `crashlytics:issues:list` |
| `input`    | Normalized command inputs used for the request          |
| `data`     | Command-specific structured result data                 |
| `warnings` | Non-fatal warnings; currently an empty array            |

Command-specific `data` shapes:

| Command                       | Data Shape                                            |
| ----------------------------- | ----------------------------------------------------- |
| `crashlytics:issues:list`     | `{ issues, count, nextPageToken, totalSize, report }` |
| `crashlytics:issues:get`      | `{ issue }`                                           |
| `crashlytics:issues:update`   | `{ issue, requestedState }`                           |
| `crashlytics:events:list`     | `{ events, count, nextPageToken }`                    |
| `crashlytics:events:batchGet` | `{ events, count }`                                   |

### Example: Issues List

Command:

```bash
firebase crashlytics:issues:list --app 1:123456:android:abcdef --error-type FATAL --page-size 10 --json
```

Output:

```json
{
  "status": "success",
  "result": {
    "command": "crashlytics:issues:list",
    "input": {
      "appId": "1:123456:android:abcdef",
      "pageSize": 10,
      "filter": {
        "issueErrorTypes": ["FATAL"]
      }
    },
    "data": {
      "issues": [
        {
          "id": "abc123",
          "title": "MainActivity.java",
          "subtitle": "NullPointerException",
          "errorType": "FATAL",
          "state": "OPEN",
          "sampleEvent": "projects/123456/apps/1:123456:android:abcdef/events/evt001",
          "uri": "https://console.firebase.google.com/...",
          "metrics": {
            "startTime": "2026-04-17T00:00:00Z",
            "endTime": "2026-04-24T00:00:00Z",
            "eventsCount": 100,
            "impactedUsersCount": 50
          },
          "variantsCount": 2
        }
      ],
      "count": 1,
      "nextPageToken": "",
      "totalSize": 1,
      "report": {
        "name": "projects/123456/apps/1:123456:android:abcdef/reports/topIssues",
        "displayName": "Top issues",
        "usage": ""
      }
    },
    "warnings": []
  }
}
```

### Example: Events List

Command:

```bash
firebase crashlytics:events:list --app 1:123456:android:abcdef --issue abc123 --page-size 1 --json
```

Output:

```json
{
  "status": "success",
  "result": {
    "command": "crashlytics:events:list",
    "input": {
      "appId": "1:123456:android:abcdef",
      "pageSize": 1,
      "filter": {
        "issueId": "abc123"
      },
      "issueId": "abc123"
    },
    "data": {
      "events": [
        {
          "eventId": "evt001",
          "eventTime": "2026-04-24T00:00:00Z",
          "issueTitle": "Crash in MainActivity",
          "device": {
            "displayName": "Google (Pixel 6)"
          },
          "operatingSystem": {
            "displayName": "Android (14)"
          },
          "exceptions": [
            {
              "type": "java.lang.NullPointerException",
              "exceptionMessage": "null reference",
              "frames": [
                {
                  "symbol": "MainActivity.onCreate",
                  "file": "MainActivity.java",
                  "line": 42
                }
              ]
            }
          ]
        }
      ],
      "count": 1,
      "nextPageToken": ""
    },
    "warnings": []
  }
}
```

## Testing JSON Output

Tests for JSON behavior live alongside the command code:

- `crashlytics-output.spec.ts` verifies stable structured result shapes and valid JSON serialization.
- `crashlytics-formatter.spec.ts` verifies human rendering from structured results, so default visual output stays unchanged.

When changing output behavior, run:

```bash
npx mocha "src/commands/crashlytics-direct/*.spec.ts"
npm run test:compile
```
