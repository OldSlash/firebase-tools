import { Command } from "../../command";
import { FirebaseError } from "../../error";
import { Options } from "../../options";
import { requireAuth } from "../../requireAuth";
import { getIssue } from "../../crashlytics/issues";
import { formatIssueResult } from "./crashlytics-formatter";
import { buildIssueGetResult } from "./crashlytics-output";

interface CommandOptions extends Options {
  app?: string;
  issue?: string;
}

export const command = new Command("crashlytics:issues:get")
  .description("get details for a Crashlytics issue")
  .option("--app <appId>", "Firebase app ID (required)")
  .option("--issue <issueId>", "Crashlytics issue ID (required)")
  .before(requireAuth)
  .action(async (options: CommandOptions) => {
    if (!options.app) {
      throw new FirebaseError("--app <appId> is required");
    }
    if (!options.issue) {
      throw new FirebaseError("--issue <issueId> is required");
    }
    const issue = await getIssue(options.app, options.issue);
    const result = buildIssueGetResult({ appId: options.app, issueId: options.issue }, issue);
    formatIssueResult(result);
    return result;
  });
