import { expect } from "chai";
import * as sinon from "sinon";

import { logger } from "../../logger";
import { ErrorType, State, ReportGroup, Issue, Event, Frame } from "../../crashlytics/types";
import {
  buildEventFilter,
  formatFrames,
  formatIssuesTable,
  formatIssue,
  formatEventsSummary,
  formatEventDetail,
} from "./crashlytics-formatter";

describe("crashlytics-formatter", () => {
  let loggerStub: sinon.SinonStub;

  beforeEach(() => {
    loggerStub = sinon.stub(logger, "info");
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("buildEventFilter", () => {
    it("should build an empty filter with no options", () => {
      const filter = buildEventFilter({});
      expect(filter).to.deep.equal({});
    });

    it("should map startTime and endTime", () => {
      const filter = buildEventFilter({
        startTime: "2025-01-01T00:00:00Z",
        endTime: "2025-01-02T00:00:00Z",
      });
      expect(filter!.intervalStartTime).to.equal("2025-01-01T00:00:00Z");
      expect(filter!.intervalEndTime).to.equal("2025-01-02T00:00:00Z");
    });

    it("should split comma-separated error types", () => {
      const filter = buildEventFilter({ errorType: "FATAL,NON_FATAL" });
      expect(filter!.issueErrorTypes).to.deep.equal(["FATAL", "NON_FATAL"]);
    });

    it("should split comma-separated signals", () => {
      const filter = buildEventFilter({ signal: "SIGNAL_FRESH, SIGNAL_EARLY" });
      expect(filter!.issueSignals).to.deep.equal(["SIGNAL_FRESH", "SIGNAL_EARLY"]);
    });

    it("should map issue and variant IDs", () => {
      const filter = buildEventFilter({ issue: "abc123", variant: "var456" });
      expect(filter!.issueId).to.equal("abc123");
      expect(filter!.issueVariantId).to.equal("var456");
    });

    it("should split comma-separated versions", () => {
      const filter = buildEventFilter({ appVersion: "1.0.0 (100),2.0.0 (200)" });
      expect(filter!.versionDisplayNames).to.deep.equal(["1.0.0 (100)", "2.0.0 (200)"]);
    });

    it("should split comma-separated form factors", () => {
      const filter = buildEventFilter({ formFactor: "PHONE,TABLET" });
      expect(filter!.deviceFormFactors).to.deep.equal(["PHONE", "TABLET"]);
    });
  });

  describe("formatFrames", () => {
    it("should format frames with symbol and file", () => {
      const frames: Frame[] = [
        { symbol: "com.example.Main.run", file: "Main.java", line: 42 },
        { symbol: "com.example.App.start", file: "App.java" },
      ];
      const result = formatFrames(frames);
      expect(result).to.have.length(2);
      expect(result[0]).to.equal("  at com.example.Main.run (Main.java:42)");
      expect(result[1]).to.equal("  at com.example.App.start (App.java)");
    });

    it("should truncate when exceeding maxFrames", () => {
      const frames: Frame[] = Array.from({ length: 25 }, (_, i) => ({
        symbol: `frame${i}`,
        file: `File${i}.java`,
        line: i,
      }));
      const result = formatFrames(frames, 5);
      expect(result).to.have.length(5);
      expect(result[4]).to.equal("  ... frames omitted ...");
    });

    it("should handle empty frames", () => {
      expect(formatFrames([])).to.deep.equal([]);
    });
  });

  describe("formatIssuesTable", () => {
    it("should print a table for valid groups", () => {
      const groups: ReportGroup[] = [
        {
          metrics: [{ startTime: "", endTime: "", eventsCount: 100, impactedUsersCount: 50 }],
          subgroups: [],
          issue: {
            id: "abc123",
            title: "MainActivity.java",
            subtitle: "NullPointerException",
            errorType: ErrorType.FATAL,
            state: State.OPEN,
          },
        },
      ];
      formatIssuesTable(groups);
      const output = loggerStub.args.map((a: any[]) => a[0]).join("\n");
      expect(output).to.contain("abc123");
      expect(output).to.contain("FATAL");
      expect(output).to.contain("1 issues");
    });

    it("should print message for empty groups", () => {
      formatIssuesTable([]);
      expect(loggerStub.calledWith("No issues found.")).to.be.true;
    });
  });

  describe("formatIssue", () => {
    it("should print issue key-value pairs", () => {
      const issue: Issue = {
        id: "abc123",
        title: "MainActivity.java",
        subtitle: "NullPointerException",
        errorType: ErrorType.FATAL,
        state: State.OPEN,
        firstSeenVersion: "1.0.0",
        lastSeenVersion: "2.0.0",
        uri: "https://console.firebase.google.com/test",
      };
      formatIssue(issue);
      const output = loggerStub.args.map((a: any[]) => a[0]).join("\n");
      expect(output).to.contain("abc123");
      expect(output).to.contain("MainActivity.java");
      expect(output).to.contain("NullPointerException");
      expect(output).to.contain("FATAL");
      expect(output).to.contain("OPEN");
      expect(output).to.contain("1.0.0");
      expect(output).to.contain("2.0.0");
      expect(output).to.contain("https://console.firebase.google.com/test");
    });
  });

  describe("formatEventsSummary", () => {
    it("should print a summary table", () => {
      const events: Event[] = [
        {
          eventId: "evt001",
          eventTime: "2025-03-15T10:30:00Z",
          issueTitle: "Crash in Main",
          platform: "android",
          device: { displayName: "Pixel 6" },
          operatingSystem: { displayName: "Android (14)" },
        },
      ];
      formatEventsSummary(events);
      const output = loggerStub.args.map((a: any[]) => a[0]).join("\n");
      expect(output).to.contain("evt001");
      expect(output).to.contain("Pixel 6");
    });

    it("should print message for empty events", () => {
      formatEventsSummary([]);
      expect(loggerStub.calledWith("No events found.")).to.be.true;
    });
  });

  describe("formatEventDetail", () => {
    it("should print event header and exceptions", () => {
      const event: Event = {
        eventId: "evt001",
        eventTime: "2025-03-15T10:30:00Z",
        issueTitle: "Crash",
        issue: { title: "Crash", subtitle: "NPE", errorType: ErrorType.FATAL },
        device: { displayName: "Pixel 6" },
        operatingSystem: { displayName: "Android (14)" },
        exceptions: [
          {
            type: "java.lang.NullPointerException",
            exceptionMessage: "null reference",
            frames: [{ symbol: "Main.run", file: "Main.java", line: 42 }],
          },
        ],
      };
      formatEventDetail(event);
      const output = loggerStub.args.map((a: any[]) => a[0]).join("\n");
      expect(output).to.contain("evt001");
      expect(output).to.contain("Crash - NPE");
      expect(output).to.contain("NullPointerException");
      expect(output).to.contain("Main.run");
    });

    it("should print logs when present", () => {
      const event: Event = {
        eventId: "evt002",
        logs: [{ logTime: "2025-01-01T00:00:00Z", message: "Starting app" }],
      };
      formatEventDetail(event);
      const output = loggerStub.args.map((a: any[]) => a[0]).join("\n");
      expect(output).to.contain("Starting app");
    });

    it("should print custom keys when present", () => {
      const event: Event = {
        eventId: "evt003",
        customKeys: { userId: "user-123", screen: "home" },
      };
      formatEventDetail(event);
      const output = loggerStub.args.map((a: any[]) => a[0]).join("\n");
      expect(output).to.contain("userId: user-123");
      expect(output).to.contain("screen: home");
    });
  });
});
