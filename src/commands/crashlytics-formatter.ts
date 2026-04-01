import * as Table from "cli-table3";

import { logger } from "../logger";
import { EventFilter } from "../crashlytics/filters";
import {
  Event,
  Exception,
  Frame,
  Issue,
  Log,
  ReportGroup,
  Thread,
  ErrorType,
  Breadcrumb,
  Error as CrashlyticsError,
} from "../crashlytics/types";

/** Options interface matching CLI flags for filter building. */
interface FilterOptions {
  startTime?: string;
  endTime?: string;
  errorType?: string;
  signal?: string;
  appVersion?: string;
  os?: string;
  device?: string;
  formFactor?: string;
  issue?: string;
  variant?: string;
}

/**
 * Build an EventFilter from CLI flag values.
 * Comma-separated strings are split into arrays where the API expects arrays.
 */
export function buildEventFilter(options: FilterOptions): EventFilter {
  const filter: EventFilter = {};
  if (options.startTime) filter.intervalStartTime = options.startTime;
  if (options.endTime) filter.intervalEndTime = options.endTime;
  if (options.errorType) {
    filter.issueErrorTypes = options.errorType.split(",").map((s) => s.trim()) as any;
  }
  if (options.signal) {
    filter.issueSignals = options.signal.split(",").map((s) => s.trim()) as any;
  }
  if (options.appVersion) {
    filter.versionDisplayNames = options.appVersion.split(",").map((s) => s.trim());
  }
  if (options.os) {
    filter.operatingSystemDisplayNames = options.os.split(",").map((s) => s.trim());
  }
  if (options.device) {
    filter.deviceDisplayNames = options.device.split(",").map((s) => s.trim());
  }
  if (options.formFactor) {
    filter.deviceFormFactors = options.formFactor.split(",").map((s) => s.trim()) as any;
  }
  if (options.issue) filter.issueId = options.issue;
  if (options.variant) filter.issueVariantId = options.variant;
  return filter;
}

/** Format stack frames into readable strings, truncating at maxFrames. */
export function formatFrames(origFrames: Frame[], maxFrames = 20): string[] {
  const frames: Frame[] = origFrames || [];
  const shouldTruncate = frames.length > maxFrames;
  const framesToFormat = shouldTruncate ? frames.slice(0, maxFrames - 1) : frames;
  const formatted = framesToFormat.map((frame) => {
    let line = "  at";
    if (frame.symbol) line += ` ${frame.symbol}`;
    if (frame.file) {
      line += ` (${frame.file}`;
      if (frame.line) line += `:${frame.line}`;
      line += ")";
    }
    return line;
  });
  if (shouldTruncate) {
    formatted.push("  ... frames omitted ...");
  }
  return formatted;
}

/** Print a table of issues extracted from report groups. */
export function formatIssuesTable(groups: ReportGroup[]): void {
  if (!groups || groups.length === 0) {
    logger.info("No issues found.");
    return;
  }

  const table = new Table({
    head: ["Issue ID", "Title", "Subtitle", "Type", "State", "Events", "Users"],
    style: { head: ["bold"] },
  });

  for (const group of groups) {
    if (!group.issue) continue;
    const issue = group.issue;
    const metrics = group.metrics?.[0];
    table.push([
      issue.id || "",
      truncate(issue.title || "", 30),
      truncate(issue.subtitle || "", 25),
      issue.errorType || "",
      issue.state || "",
      metrics?.eventsCount?.toLocaleString() ?? "",
      metrics?.impactedUsersCount?.toLocaleString() ?? "",
    ]);
  }

  logger.info(table.toString());
  logger.info(`Found ${groups.filter((g) => g.issue).length} issues.`);
}

/** Print a single issue in key-value format. */
export function formatIssue(issue: Issue): void {
  logger.info(`Issue:          ${issue.id || ""}`);
  logger.info(`Title:          ${issue.title || ""}`);
  logger.info(`Subtitle:       ${issue.subtitle || ""}`);
  logger.info(`Type:           ${issue.errorType || ""}`);
  logger.info(`State:          ${issue.state || ""}`);
  logger.info(`First Version:  ${issue.firstSeenVersion || ""}`);
  logger.info(`Last Version:   ${issue.lastSeenVersion || ""}`);
  if (issue.signals?.length) {
    logger.info(`Signals:        ${issue.signals.join(", ")}`);
  }
  if (issue.uri) {
    logger.info(`Console:        ${issue.uri}`);
  }
  if (issue.sampleEvent) {
    logger.info(`Sample Event:   ${issue.sampleEvent}`);
  }
  if (issue.notesCount) {
    logger.info(`Notes:          ${issue.notesCount}`);
  }
  if (issue.variants?.length) {
    logger.info(`Variants:       ${issue.variants.length}`);
  }
}

/** Print a summary table of events. */
export function formatEventsSummary(events: Event[]): void {
  if (!events || events.length === 0) {
    logger.info("No events found.");
    return;
  }

  const table = new Table({
    head: ["Event ID", "Time", "Issue Title", "Platform", "Device", "OS"],
    style: { head: ["bold"] },
  });

  for (const event of events) {
    table.push([
      event.eventId || "",
      event.eventTime || "",
      truncate(event.issueTitle || event.issue?.title || "", 30),
      event.platform || "",
      event.device?.displayName || "",
      event.operatingSystem?.displayName || "",
    ]);
  }

  logger.info(table.toString());
}

/** Print detailed output for a single event, including stack traces, logs, and breadcrumbs. */
export function formatEventDetail(event: Event): void {
  logger.info("---");
  logger.info(
    `Event: ${event.eventId || ""} | ${event.eventTime || ""} | ${event.device?.displayName || ""} | ${event.operatingSystem?.displayName || ""}`,
  );
  if (event.issueTitle || event.issue?.title) {
    const title = event.issueTitle || event.issue?.title || "";
    const subtitle = event.issueSubtitle || event.issue?.subtitle || "";
    logger.info(`Issue: ${title}${subtitle ? " - " + subtitle : ""}`);
  }
  if (event.version?.displayName) {
    logger.info(`Version: ${event.version.displayName}`);
  }
  logger.info("");

  // Exceptions
  if (event.exceptions?.length) {
    for (const ex of event.exceptions) {
      formatException(ex);
    }
  }

  // Errors
  if (event.errors?.length) {
    for (const err of event.errors) {
      formatError(err);
    }
  }

  // Threads (only crashed/blamed for fatal/ANR)
  if (event.threads?.length) {
    let threads = event.threads;
    if (
      event.issue?.errorType === ErrorType.FATAL ||
      event.issue?.errorType === ErrorType.ANR
    ) {
      threads = threads.filter((t) => t.crashed || t.blamed);
    }
    for (const thread of threads) {
      formatThread(thread);
    }
  }

  // Logs
  if (event.logs?.length) {
    logger.info("Logs:");
    const sliced = event.logs.length > 50 ? event.logs.slice(-50) : event.logs;
    for (const log of sliced) {
      logger.info(`  [${log.logTime || ""}] ${log.message || ""}`);
    }
    logger.info("");
  }

  // Breadcrumbs
  if (event.breadcrumbs?.length) {
    logger.info("Breadcrumbs:");
    const sliced = event.breadcrumbs.length > 10 ? event.breadcrumbs.slice(-10) : event.breadcrumbs;
    for (const b of sliced) {
      formatBreadcrumb(b);
    }
    logger.info("");
  }

  // Custom keys
  if (event.customKeys && Object.keys(event.customKeys).length > 0) {
    logger.info("Custom Keys:");
    for (const [key, value] of Object.entries(event.customKeys)) {
      logger.info(`  ${key}: ${value}`);
    }
    logger.info("");
  }
}

function formatException(ex: Exception): void {
  const prefix = ex.nested ? "Caused by: " : "";
  logger.info(`${prefix}${ex.type || ""}: ${ex.exceptionMessage || ""}`);
  if (ex.frames?.length) {
    const lines = formatFrames(ex.frames);
    for (const line of lines) {
      logger.info(line);
    }
  }
  logger.info("");
}

function formatError(err: CrashlyticsError): void {
  logger.info(`Error: ${err.title || "error"}`);
  if (err.frames?.length) {
    const lines = formatFrames(err.frames);
    for (const line of lines) {
      logger.info(line);
    }
  }
  logger.info("");
}

function formatThread(thread: Thread): void {
  const header = `Thread: ${thread.name || thread.threadId || ""}${thread.crashed ? " (crashed)" : ""}`;
  logger.info(header);
  if (thread.frames?.length) {
    const lines = formatFrames(thread.frames);
    for (const line of lines) {
      logger.info(line);
    }
  }
  logger.info("");
}

function formatBreadcrumb(b: Breadcrumb): void {
  const paramStr = Object.entries(b?.params || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  const params = paramStr ? ` { ${paramStr} }` : "";
  logger.info(`  [${b.eventTime || ""}] ${b.title || ""}${params}`);
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "\u2026";
}
