import type {
  DashboardPanelStatus,
  RoutingDashboardState,
} from "./routing-control-dashboard.js";

export type RuntimePanelProps = {
  title: string;
  status: DashboardPanelStatus;
  summaryLines: string[];
  message?: string;
};

export type SessionsListItemProps = {
  sessionKey: string;
  isSelected: boolean;
  primaryLabel: string;
  temporaryLabel?: string;
  pendingLabel?: string;
  activityLabel: string;
};

export type SessionsPanelProps = {
  title: string;
  status: DashboardPanelStatus;
  items: SessionsListItemProps[];
  emptyMessage?: string;
  message?: string;
};

export type DetailPanelProps = {
  title: string;
  status: DashboardPanelStatus;
  sessionKey?: string;
  fields: Array<{ label: string; value: string }>;
  emptyMessage?: string;
  message?: string;
};

export type RoutingPageModel = {
  pageTitle: string;
  selectedSessionKey?: string;
  runtimePanel: RuntimePanelProps;
  sessionsPanel: SessionsPanelProps;
  detailPanel: DetailPanelProps;
  lastLoadedAtLabel: string;
};

function formatActivityLabel(timestamp: number | null | undefined): string {
  if (!timestamp) return "No activity yet";
  return `Last activity: ${new Date(timestamp).toISOString()}`;
}

function formatStatusMessage(status: DashboardPanelStatus, fallback?: string): string | undefined {
  if (fallback) return fallback;
  switch (status) {
    case "idle":
      return "Waiting for selection";
    case "not_found":
      return "Not found";
    case "invalid_argument":
      return "Invalid input";
    case "error":
      return "Something went wrong";
    default:
      return undefined;
  }
}

export function mapRoutingDashboardToPageModel(state: RoutingDashboardState): RoutingPageModel {
  const runtimeData = state.runtime.data;
  const runtimeSummaryLines = runtimeData
    ? [
        `Task mode: ${runtimeData.taskModeEnabled ? "enabled" : "disabled"}`,
        `Primary kind: ${runtimeData.taskModePrimaryKind || "-"}`,
        `Task kinds: ${runtimeData.taskModeKinds.join(", ") || "-"}`,
        `Min confidence: ${runtimeData.taskModeMinConfidence}`,
      ]
    : [];

  const sessionsItems = state.sessions.items.map((item) => ({
    sessionKey: item.sessionKey,
    isSelected: item.sessionKey === state.selectedSessionKey,
    primaryLabel: `${item.primaryKind ?? "-"} · ${item.primaryModel ?? "-"}`,
    temporaryLabel:
      item.temporaryKind || item.temporaryModel
        ? `${item.temporaryKind ?? "-"} · ${item.temporaryModel ?? "-"}`
        : undefined,
    pendingLabel:
      item.pendingKind || item.pendingCandidateModel
        ? `${item.pendingKind ?? "-"} · ${item.pendingCandidateModel ?? "-"}`
        : undefined,
    activityLabel: formatActivityLabel(item.lastActivityAtMs),
  }));

  const detailFields = state.detail.data
    ? [
        { label: "Session", value: state.detail.data.sessionKey },
        {
          label: "Primary",
          value: `${state.detail.data.taskState?.primaryKind ?? "-"} · ${state.detail.data.taskState?.primaryModel ?? "-"}`,
        },
        {
          label: "Temporary",
          value:
            state.detail.data.taskState?.temporaryKind || state.detail.data.taskState?.temporaryModel
              ? `${state.detail.data.taskState?.temporaryKind ?? "-"} · ${state.detail.data.taskState?.temporaryModel ?? "-"}`
              : "-",
        },
        {
          label: "Pending route",
          value:
            state.detail.data.routeDecision?.kind || state.detail.data.routeDecision?.candidateModel
              ? `${state.detail.data.routeDecision?.kind ?? "-"} · ${state.detail.data.routeDecision?.candidateModel ?? "-"}`
              : "-",
        },
      ]
    : [];

  return {
    pageTitle: "Routing Control",
    selectedSessionKey: state.selectedSessionKey,
    runtimePanel: {
      title: "Runtime",
      status: state.runtime.status,
      summaryLines: runtimeSummaryLines,
      message: formatStatusMessage(state.runtime.status, state.runtime.message),
    },
    sessionsPanel: {
      title: "Sessions",
      status: state.sessions.status,
      items: sessionsItems,
      emptyMessage: sessionsItems.length === 0 ? "No sessions available" : undefined,
      message: formatStatusMessage(state.sessions.status, state.sessions.message),
    },
    detailPanel: {
      title: "Session Detail",
      status: state.detail.status,
      sessionKey: state.detail.sessionKey,
      fields: detailFields,
      emptyMessage: detailFields.length === 0 ? "No session selected" : undefined,
      message: formatStatusMessage(state.detail.status, state.detail.message),
    },
    lastLoadedAtLabel: new Date(state.lastLoadedAtMs).toISOString(),
  };
}
