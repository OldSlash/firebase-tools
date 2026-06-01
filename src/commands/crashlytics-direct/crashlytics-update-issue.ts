import { Command } from "../../command";
import { FirebaseError } from "../../error";
import { Options } from "../../options";
import { requireAuth } from "../../requireAuth";
import { updateIssue } from "../../crashlytics/issues";
import { State } from "../../crashlytics/types";
import { formatIssueResult } from "./crashlytics-formatter";
import * as utils from "../../utils";
import { buildIssueUpdateResult } from "./crashlytics-output";

const VALID_STATES = Object.values(State).filter((s) => s !== State.STATE_UNSPECIFIED);

interface CommandOptions extends Options {
  app?: string;
  issue?: string;
  state?: string;
}

export const command = new Command("crashlytics:issues:update")
  .description("update the state of a Crashlytics issue")
  .option("--app <appId>", "Firebase app ID (required)")
  .option("--issue <issueId>", "Crashlytics issue ID (required)")
  .option("--state <state>", `new state: ${VALID_STATES.join(", ")} (required)`)
  .before(requireAuth)
  .action(async (options: CommandOptions) => {
    if (!options.app) {
      throw new FirebaseError("--app <appId> is required");
    }
    if (!options.issue) {
      throw new FirebaseError("--issue <issueId> is required");
    }
    if (!options.state) {
      throw new FirebaseError(`--state is required. Valid values: ${VALID_STATES.join(", ")}`);
    }
    const state = options.state.toUpperCase() as State;
    if (!(VALID_STATES as State[]).includes(state)) {
      throw new FirebaseError(
        `Invalid state "${options.state}". Valid values: ${VALID_STATES.join(", ")}`,
      );
    }
    const updated = await updateIssue(options.app, options.issue, state);
    const result = buildIssueUpdateResult(
      { appId: options.app, issueId: options.issue, requestedState: state },
      updated,
    );
    utils.logSuccess(`Updated issue ${options.issue} state to ${state}.`);
    formatIssueResult(result);
    return result;
  });
