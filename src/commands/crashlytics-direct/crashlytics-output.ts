import { EventFilter } from "../../crashlytics/filters";
import {
  BatchGetEventsResponse,
  Event,
  Issue,
  ListEventsResponse,
  Report,
  ReportGroup,
  State,
} from "../../crashlytics/types";

export interface CrashlyticsCommandResult<TData, TInput> {
  command: string;
  input: TInput;
  data: TData;
  warnings: string[];
}

export interface IssuesListInput {
  appId: string;
  pageSize: number;
  filter: EventFilter;
}

export interface IssueResultInput {
  appId: string;
  issueId: string;
}

export interface IssueUpdateInput extends IssueResultInput {
  requestedState: State;
}

export interface EventsListInput {
  appId: string;
  pageSize: number;
  filter: EventFilter;
  issueId?: string;
  variantId?: string;
}

export interface EventsBatchGetInput {
  appId: string;
  names: string[];
}

export interface IssueListItem extends Issue {
  metrics?: {
    startTime?: string;
    endTime?: string;
    eventsCount?: number;
    impactedUsersCount?: number;
  };
  variantsCount: number;
}

export interface IssuesListData {
  issues: IssueListItem[];
  count: number;
  nextPageToken?: string;
  totalSize?: number;
  report?: {
    name?: string;
    displayName?: string;
    usage?: string;
  };
}

export interface IssueData {
  issue: Issue;
}

export interface IssueUpdateData extends IssueData {
  requestedState: State;
}

export interface EventsData {
  events: Event[];
  count: number;
  nextPageToken?: string;
}

export type IssuesListResult = CrashlyticsCommandResult<IssuesListData, IssuesListInput>;
export type IssueGetResult = CrashlyticsCommandResult<IssueData, IssueResultInput>;
export type IssueUpdateResult = CrashlyticsCommandResult<IssueUpdateData, IssueUpdateInput>;
export type EventsListResult = CrashlyticsCommandResult<EventsData, EventsListInput>;
export type EventsBatchGetResult = CrashlyticsCommandResult<EventsData, EventsBatchGetInput>;

/** Builds the stable JSON result for crashlytics:issues:list. */
export function buildIssuesListResult(input: IssuesListInput, report: Report): IssuesListResult {
  const groups = report.groups?.filter((group) => group.issue) || [];
  const issues = groups.map(issueListItemFromGroup);

  return {
    command: "crashlytics:issues:list",
    input,
    data: {
      issues,
      count: issues.length,
      nextPageToken: report.nextPageToken,
      totalSize: report.totalSize,
      report: {
        name: report.name,
        displayName: report.displayName,
        usage: report.usage,
      },
    },
    warnings: [],
  };
}

/** Builds the stable JSON result for crashlytics:issues:get. */
export function buildIssueGetResult(input: IssueResultInput, issue: Issue): IssueGetResult {
  return {
    command: "crashlytics:issues:get",
    input,
    data: { issue },
    warnings: [],
  };
}

/** Builds the stable JSON result for crashlytics:issues:update. */
export function buildIssueUpdateResult(input: IssueUpdateInput, issue: Issue): IssueUpdateResult {
  return {
    command: "crashlytics:issues:update",
    input,
    data: {
      issue,
      requestedState: input.requestedState,
    },
    warnings: [],
  };
}

/** Builds the stable JSON result for crashlytics:events:list. */
export function buildEventsListResult(
  input: EventsListInput,
  response: ListEventsResponse,
): EventsListResult {
  const events = response.events || [];
  return {
    command: "crashlytics:events:list",
    input,
    data: {
      events,
      count: events.length,
      nextPageToken: response.nextPageToken,
    },
    warnings: [],
  };
}

/** Builds the stable JSON result for crashlytics:events:batchGet. */
export function buildEventsBatchGetResult(
  input: EventsBatchGetInput,
  response: BatchGetEventsResponse,
): EventsBatchGetResult {
  const events = response.events || [];
  return {
    command: "crashlytics:events:batchGet",
    input,
    data: {
      events,
      count: events.length,
    },
    warnings: [],
  };
}

function issueListItemFromGroup(group: ReportGroup): IssueListItem {
  const issue = group.issue || {};
  const metrics = group.metrics?.[0];
  return {
    ...issue,
    metrics: metrics
      ? {
          startTime: metrics.startTime,
          endTime: metrics.endTime,
          eventsCount: metrics.eventsCount,
          impactedUsersCount: metrics.impactedUsersCount,
        }
      : undefined,
    variantsCount: issue.variants?.length || 0,
  };
}
