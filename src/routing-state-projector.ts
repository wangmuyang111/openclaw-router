import type { SessionRoutingState } from "./routing-session-store.js";
import type { SessionDetailDTO, SessionSummaryDTO } from "./routing-state-dto.js";

export function projectSessionSummary(
  sessionKey: string,
  state: SessionRoutingState,
): SessionSummaryDTO {
  const routeDecision = state.routeDecision;
  const taskState = state.taskState;
  const timestamps = [
    routeDecision?.createdAtMs,
    taskState?.lastTaskAt,
    taskState?.lastRouteAt,
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return {
    sessionKey,
    lastActivityAtMs: timestamps.length > 0 ? Math.max(...timestamps) : null,
    primaryKind: taskState?.primaryKind,
    primaryModel: taskState?.primaryModel,
    temporaryKind: taskState?.temporaryKind,
    temporaryModel: taskState?.temporaryModel,
    hasPendingRouteDecision: Boolean(routeDecision),
    pendingKind: routeDecision?.kind,
    pendingCandidateModel: routeDecision?.candidateModel,
  };
}

export function projectSessionDetail(
  sessionKey: string,
  state: SessionRoutingState,
): SessionDetailDTO {
  return {
    sessionKey,
    routeDecision: state.routeDecision,
    taskState: state.taskState,
  };
}
