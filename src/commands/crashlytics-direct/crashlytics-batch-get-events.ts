import { Command } from "../../command";
import { FirebaseError } from "../../error";
import { Options } from "../../options";
import { requireAuth } from "../../requireAuth";
import { batchGetEvents } from "../../crashlytics/events";
import { formatEventsResult } from "./crashlytics-formatter";
import { buildEventsBatchGetResult } from "./crashlytics-output";

interface CommandOptions extends Options {
  app?: string;
  name?: string;
}

export const command = new Command("crashlytics:events:batchGet")
  .description("get specific Crashlytics events by resource name")
  .option("--app <appId>", "Firebase app ID (required)")
  .option("--name <names>", "event resource name(s), comma-separated (required)")
  .before(requireAuth)
  .action(async (options: CommandOptions) => {
    if (!options.app) {
      throw new FirebaseError("--app <appId> is required");
    }
    if (!options.name) {
      throw new FirebaseError(
        "--name is required. Provide event resource names (comma-separated).",
      );
    }
    const names = options.name.split(",").map((n) => n.trim());
    if (names.length === 0) {
      throw new FirebaseError("At least one event resource name is required");
    }
    const response = await batchGetEvents(options.app, names);
    const result = buildEventsBatchGetResult({ appId: options.app, names }, response);
    formatEventsResult(result);
    return result;
  });
