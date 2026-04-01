import { Command } from "../command";
import { FirebaseError } from "../error";
import { Options } from "../options";
import { requireAuth } from "../requireAuth";
import { listEvents } from "../crashlytics/events";
import { validateEventFilters } from "../crashlytics/filters";
import {
  buildEventFilter,
  formatEventsSummary,
  formatEventDetail,
} from "./crashlytics-formatter";

interface CommandOptions extends Options {
  app?: string;
  issue?: string;
  variant?: string;
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

export const command = new Command("crashlytics:events:list")
  .description("list recent Crashlytics events for an issue or variant")
  .option("--app <appId>", "Firebase app ID (required)")
  .option("--issue <issueId>", "Crashlytics issue ID")
  .option("--variant <variantId>", "Crashlytics variant ID")
  .option("--page-size <n>", "number of events to return (default: 10)", parseInt)
  .option("--start-time <time>", "filter start time (ISO 8601)")
  .option("--end-time <time>", "filter end time (ISO 8601)")
  .option("--error-type <types>", "error type filter: FATAL,NON_FATAL,ANR (comma-separated)")
  .option("--signal <signals>", "signal filter (comma-separated)")
  .option("--app-version <versions>", 'app version filter (comma-separated, format: "version (build)")')
  .option("--os <names>", 'OS filter (comma-separated, format: "os (version)")')
  .option("--device <names>", 'device filter (comma-separated, format: "manufacturer (model)")')
  .option("--form-factor <factors>", "form factor filter: PHONE,TABLET,DESKTOP,TV,WATCH (comma-separated)")
  .before(requireAuth)
  .action(async (options: CommandOptions) => {
    if (!options.app) {
      throw new FirebaseError("--app <appId> is required");
    }
    if (!options.issue && !options.variant) {
      throw new FirebaseError("Either --issue <issueId> or --variant <variantId> is required");
    }
    const filter = validateEventFilters(buildEventFilter(options));
    const pageSize = options.pageSize || 10;
    const response = await listEvents(options.app, filter, pageSize);
    const events = response.events || [];
    formatEventsSummary(events);
    for (const event of events) {
      formatEventDetail(event);
    }
    return response;
  });
