import type { ControlApiErrorCode } from "./routing-control-api-contract.js";
import type { RoutingControlQueries } from "./routing-control-queries.js";
import type {
  RuntimeRoutingDTO,
  SessionDetailDTO,
  SessionSummaryDTO,
} from "./routing-state-dto.js";

export type DashboardPanelStatus = "idle" | "success" | "not_found" | "invalid_argument" | "error";

export type DashboardPanelBase = {
  status: DashboardPanelStatus;
  message?: string;
  code?: ControlApiErrorCode | "unknown_error";
};

export type RuntimePanelState = DashboardPanelBase & {
  data?: RuntimeRoutingDTO;
};

export type SessionsPanelState = DashboardPanelBase & {
  items: SessionSummaryDTO[];
};

export type SessionDetailPanelState = DashboardPanelBase & {
  sessionKey?: string;
  data?: SessionDetailDTO;
};

export type RoutingDashboardState = {
  selectedSessionKey?: string;
  runtime: RuntimePanelState;
  sessions: SessionsPanelState;
  detail: SessionDetailPanelState;
  lastLoadedAtMs: number;
};

export type LoadDashboardOptions = {
  selectedSessionKey?: string | null;
  autoSelectFirstSession?: boolean;
};

function toRuntimePanel(result: {
  status: DashboardPanelStatus;
  data?: RuntimeRoutingDTO;
  message?: string;
  code?: ControlApiErrorCode | "unknown_error";
}): RuntimePanelState {
  return {
    status: result.status,
    data: result.data,
    message: result.message,
    code: result.code,
  };
}

function toSessionsPanel(result: {
  status: DashboardPanelStatus;
  data?: SessionSummaryDTO[];
  message?: string;
  code?: ControlApiErrorCode | "unknown_error";
}): SessionsPanelState {
  return {
    status: result.status,
    items: result.data ?? [],
    message: result.message,
    code: result.code,
  };
}

function toDetailPanel(result: {
  status: DashboardPanelStatus;
  data?: SessionDetailDTO;
  message?: string;
  code?: ControlApiErrorCode | "unknown_error";
}, sessionKey?: string): SessionDetailPanelState {
  return {
    status: result.status,
    sessionKey,
    data: result.data,
    message: result.message,
    code: result.code,
  };
}

function makeIdleDetailPanel(sessionKey?: string): SessionDetailPanelState {
  return {
    status: "idle",
    sessionKey,
  };
}

export class RoutingControlDashboard {
  constructor(private readonly queries: RoutingControlQueries) {}

  async loadDashboard(options: LoadDashboardOptions = {}): Promise<RoutingDashboardState> {
    const runtimeResult = await this.queries.loadRuntimeView();
    const sessionsResult = await this.queries.loadSessionsView();

    const sessionsPanel = toSessionsPanel(sessionsResult);

    let selectedSessionKey = String(options.selectedSessionKey ?? "").trim() || undefined;
    const autoSelectFirstSession = options.autoSelectFirstSession !== false;

    if (!selectedSessionKey && autoSelectFirstSession && sessionsPanel.items.length > 0) {
      selectedSessionKey = sessionsPanel.items[0]?.sessionKey;
    }

    const detailPanel = selectedSessionKey
      ? toDetailPanel(
          await this.queries.loadSessionDetailView(selectedSessionKey),
          selectedSessionKey,
        )
      : makeIdleDetailPanel();

    return {
      selectedSessionKey,
      runtime: toRuntimePanel(runtimeResult),
      sessions: sessionsPanel,
      detail: detailPanel,
      lastLoadedAtMs: Date.now(),
    };
  }
}

export function createRoutingControlDashboard(
  queries: RoutingControlQueries,
): RoutingControlDashboard {
  return new RoutingControlDashboard(queries);
}
