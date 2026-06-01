import { Command } from "../../command";
import { FirebaseError } from "../../error";
import { Options } from "../../options";
import { requireAuth } from "../../requireAuth";
import { getReport, simplifyReport, CrashlyticsReport } from "../../crashlytics/reports";
import { validateEventFilters } from "../../crashlytics/filters";
import { buildEventFilter, formatIssuesResult } from "./crashlytics-formatter";
import { buildIssuesListResult } from "./crashlytics-output";

interface CommandOptions extends Options {
  app?: string;
  pageSize?: number;
  startTime?: string;
  endTime?: string;
  errorType?: string;
  signal?: string;
  appVersion?: string;
  os?: string;
  device?: string;
  formFactor?: string;
}

export const command = new Command("crashlytics:issues:list")
  .description("list top Crashlytics issues for an app")
  .option("--app <appId>", "Firebase app ID (required)")
  .option("--page-size <n>", "number of issues to return (default: 10)", parseInt)
  .option("--start-time <time>", "filter start time (ISO 8601)")
  .option("--end-time <time>", "filter end time (ISO 8601)")
  .option("--error-type <types>", "error type filter: FATAL,NON_FATAL,ANR (comma-separated)")
  .option(
    "--signal <signals>",
    "signal filter: SIGNAL_EARLY,SIGNAL_FRESH,SIGNAL_REGRESSED,SIGNAL_REPETITIVE (comma-separated)",
  )
  .option(
    "--app-version <versions>",
    'app version filter (comma-separated, format: "version (build)")',
  )
  .option("--os <names>", 'OS filter (comma-separated, format: "os (version)")')
  .option("--device <names>", 'device filter (comma-separated, format: "manufacturer (model)")')
  .option(
    "--form-factor <factors>",
    "form factor filter: PHONE,TABLET,DESKTOP,TV,WATCH (comma-separated)",
  )
  .before(requireAuth)
  .action(async (options: CommandOptions) => {
    if (!options.app) {
      throw new FirebaseError("--app <appId> is required");
    }
    const filter = validateEventFilters(buildEventFilter(options));
    const pageSize = options.pageSize || 10;
    const report = simplifyReport(
      await getReport(CrashlyticsReport.TOP_ISSUES, options.app, filter, pageSize),
    );
    const result = buildIssuesListResult({ appId: options.app, pageSize, filter }, report);
    formatIssuesResult(result);
    return result;
  });
