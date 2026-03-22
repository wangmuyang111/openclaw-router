import type { RoutingSessionStore } from "./routing-session-store.js";
import type {
  RuntimeRoutingDTO,
  SessionDetailDTO,
  SessionSummaryDTO,
} from "./routing-state-dto.js";
import { projectSessionDetail, projectSessionSummary } from "./routing-state-projector.js";

export type RuntimeRoutingReader = () => Promise<RuntimeRoutingDTO>;

export class RoutingStateReadService {
  constructor(
    private readonly store: RoutingSessionStore,
    private readonly getRuntimeRouting: RuntimeRoutingReader,
  ) {}

  async getRuntimeView(): Promise<RuntimeRoutingDTO> {
    return this.getRuntimeRouting();
  }

  async listSessions(): Promise<SessionSummaryDTO[]> {
    return this.store
      .listSessionStates()
      .map(({ sessionKey, state }) => projectSessionSummary(sessionKey, state))
      .sort((left, right) => {
        const leftValue = left.lastActivityAtMs ?? -1;
        const rightValue = right.lastActivityAtMs ?? -1;
        return rightValue - leftValue;
      });
  }

  async getSession(sessionKey: string): Promise<SessionDetailDTO | null> {
    const state = this.store.getSessionState(sessionKey);
    if (!state) return null;
    return projectSessionDetail(sessionKey, state);
  }
}
