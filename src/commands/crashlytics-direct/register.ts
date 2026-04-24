import { CLIClient } from "../../command";

type CommandRunner = ((...args: any[]) => Promise<any>) & { load: () => void };

function loadCommand(client: CLIClient, name: string): CommandRunner {
  const load = () => {
    const { command: cmd } = require(`./${name}`);
    cmd.register(client);
    return cmd.runner();
  };

  const runner = (async (...args: any[]) => {
    const run = load();
    return run(...args);
  }) as CommandRunner;

  runner.load = () => {
    require(`./${name}`).command.register(client);
  };

  return runner;
}

export function registerCrashlyticsDirectCommands(client: CLIClient): CLIClient {
  client.crashlytics = client.crashlytics || {};
  client.crashlytics.issues = client.crashlytics.issues || {};
  client.crashlytics.events = client.crashlytics.events || {};

  client.crashlytics.issues.list = loadCommand(client, "crashlytics-list-issues");
  client.crashlytics.issues.get = loadCommand(client, "crashlytics-get-issue");
  client.crashlytics.issues.update = loadCommand(client, "crashlytics-update-issue");
  client.crashlytics.events.list = loadCommand(client, "crashlytics-list-events");
  client.crashlytics.events.batchGet = loadCommand(client, "crashlytics-batch-get-events");

  return client;
}
