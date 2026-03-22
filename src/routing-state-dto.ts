import type {
  Confidence,
  RouteDecision,
  TaskSessionState,
} from "./routing-session-store.js";

export type RuntimeRoutingDTO = {
  taskModeEnabled: boolean;
  taskModePrimaryKind: string;
  taskModeKinds: string[];
  taskModeDisabledKinds: string[];
  taskModeMinConfidence: Confidence;
  taskModeReturnToPrimary: boolean;
  taskModeReturnModel: string;
  taskModeAllowAutoDowngrade: boolean;
  freeSwitchWhenTaskModeOff: boolean;
};

export type SessionSummaryDTO = {
  sessionKey: string;
  lastActivityAtMs: number | null;
  primaryKind?: string;
  primaryModel?: string;
  temporaryKind?: string;
  temporaryModel?: string;
  hasPendingRouteDecision: boolean;
  pendingKind?: string;
  pendingCandidateModel?: string;
};

export type SessionDetailDTO = {
  sessionKey: string;
  routeDecision?: RouteDecision;
  taskState?: TaskSessionState;
};
