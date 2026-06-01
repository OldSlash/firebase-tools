import { expect } from "chai";

import { ErrorType, Event, Issue, Report, State } from "../../crashlytics/types";
import {
  buildEventsBatchGetResult,
  buildEventsListResult,
  buildIssueGetResult,
  buildIssuesListResult,
  buildIssueUpdateResult,
} from "./crashlytics-output";

describe("crashlytics-output", () => {
  const appId = "1:123456:android:abcdef";

  it("should build a stable issues:list result", () => {
    const report: Report = {
      name: "projects/123/apps/app/reports/topIssues",
      displayName: "Top issues",
      totalSize: 1,
      nextPageToken: "next-token",
      groups: [
        {
          metrics: [
            {
              startTime: "2026-04-17T00:00:00Z",
              endTime: "2026-04-24T00:00:00Z",
              eventsCount: 100,
              impactedUsersCount: 50,
            },
          ],
          subgroups: [],
          issue: {
            id: "abc123",
            title: "MainActivity.java",
            subtitle: "NullPointerException",
            errorType: ErrorType.FATAL,
            state: State.OPEN,
            variants: [{ id: "variant-1" }, { id: "variant-2" }],
          },
        },
      ],
    };

    const result = buildIssuesListResult(
      { appId, pageSize: 10, filter: { issueErrorTypes: [ErrorType.FATAL] } },
      report,
    );

    expect(result).to.deep.equal({
      command: "crashlytics:issues:list",
      input: {
        appId,
        pageSize: 10,
        filter: { issueErrorTypes: [ErrorType.FATAL] },
      },
      data: {
        issues: [
          {
            id: "abc123",
            title: "MainActivity.java",
            subtitle: "NullPointerException",
            errorType: ErrorType.FATAL,
            state: State.OPEN,
            variants: [{ id: "variant-1" }, { id: "variant-2" }],
            metrics: {
              startTime: "2026-04-17T00:00:00Z",
              endTime: "2026-04-24T00:00:00Z",
              eventsCount: 100,
              impactedUsersCount: 50,
            },
            variantsCount: 2,
          },
        ],
        count: 1,
        nextPageToken: "next-token",
        totalSize: 1,
        report: {
          name: "projects/123/apps/app/reports/topIssues",
          displayName: "Top issues",
          usage: undefined,
        },
      },
      warnings: [],
    });
  });

  it("should build issue get and update results", () => {
    const issue: Issue = { id: "abc123", state: State.CLOSED };

    expect(buildIssueGetResult({ appId, issueId: "abc123" }, issue)).to.deep.equal({
      command: "crashlytics:issues:get",
      input: { appId, issueId: "abc123" },
      data: { issue },
      warnings: [],
    });

    expect(
      buildIssueUpdateResult({ appId, issueId: "abc123", requestedState: State.CLOSED }, issue),
    ).to.deep.equal({
      command: "crashlytics:issues:update",
      input: { appId, issueId: "abc123", requestedState: State.CLOSED },
      data: { issue, requestedState: State.CLOSED },
      warnings: [],
    });
  });

  it("should build event list and batch get results", () => {
    const events: Event[] = [
      {
        eventId: "evt001",
        eventTime: "2026-04-24T00:00:00Z",
        exceptions: [{ type: "java.lang.IllegalStateException" }],
      },
    ];

    expect(
      buildEventsListResult(
        { appId, pageSize: 5, filter: { issueId: "abc123" }, issueId: "abc123" },
        { events, nextPageToken: "next-token" },
      ),
    ).to.deep.equal({
      command: "crashlytics:events:list",
      input: { appId, pageSize: 5, filter: { issueId: "abc123" }, issueId: "abc123" },
      data: { events, count: 1, nextPageToken: "next-token" },
      warnings: [],
    });

    expect(
      buildEventsBatchGetResult({ appId, names: ["events/evt001"] }, { events }),
    ).to.deep.equal({
      command: "crashlytics:events:batchGet",
      input: { appId, names: ["events/evt001"] },
      data: { events, count: 1 },
      warnings: [],
    });
  });

  it("should produce valid readable JSON for command results", () => {
    const result = buildIssueGetResult(
      { appId, issueId: "abc123" },
      { id: "abc123", title: "MainActivity.java", state: State.OPEN },
    );

    const json = JSON.stringify({ status: "success", result }, null, 2);
    expect(JSON.parse(json)).to.deep.equal({ status: "success", result });
    expect(json).to.contain('"command": "crashlytics:issues:get"');
  });
});
