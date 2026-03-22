export type Confidence = "low" | "medium" | "high";

export type RouteDecision = {
  sessionKey: string;
  conversationId?: string;
  channelId?: string;
  messageId?: string;
  messageHash: string;
  contentPreview?: string;
  kind: string;
  confidence: Confidence;
  candidateModel: string;
  reason: string;
  signals: string[];
  createdAtMs: number;
  expiresAtMs: number;
  source: "message_received";
};

export type TaskSessionState = {
  sessionKey: string;
  primaryKind: string;
  primaryModel: string;
  temporaryKind?: string;
  temporaryModel?: string;
  lastTaskAt: number;
  lastRouteAt: number;
};

export type SessionRoutingState = {
  routeDecision?: RouteDecision;
  taskState?: TaskSessionState;
};

export type SessionStateEntry = {
  sessionKey: string;
  state: SessionRoutingState;
};

export class RoutingSessionStore {
  private readonly sessions = new Map<string, SessionRoutingState>();

  listSessionKeys(): string[] {
    return Array.from(this.sessions.keys());
  }

  listSessionStates(): SessionStateEntry[] {
    return Array.from(this.sessions.entries()).map(([sessionKey, state]) => ({ sessionKey, state }));
  }

  getSessionState(sessionKey: string): SessionRoutingState | undefined {
    return this.sessions.get(sessionKey);
  }

  getRouteDecision(sessionKey: string): RouteDecision | undefined {
    return this.sessions.get(sessionKey)?.routeDecision;
  }

  setRouteDecision(sessionKey: string, decision: RouteDecision): void {
    const current = this.sessions.get(sessionKey) ?? {};
    this.sessions.set(sessionKey, { ...current, routeDecision: decision });
  }

  clearRouteDecision(sessionKey: string): void {
    const current = this.sessions.get(sessionKey);
    if (!current?.routeDecision) return;
    const next: SessionRoutingState = { ...current, routeDecision: undefined };
    this.compactOrSet(sessionKey, next);
  }

  getTaskState(sessionKey: string): TaskSessionState | undefined {
    return this.sessions.get(sessionKey)?.taskState;
  }

  setTaskState(sessionKey: string, taskState: TaskSessionState): void {
    const current = this.sessions.get(sessionKey) ?? {};
    this.sessions.set(sessionKey, { ...current, taskState });
  }

  clearTaskState(sessionKey: string): void {
    const current = this.sessions.get(sessionKey);
    if (!current?.taskState) return;
    const next: SessionRoutingState = { ...current, taskState: undefined };
    this.compactOrSet(sessionKey, next);
  }

  pruneExpiredRouteDecisions(now = Date.now()): string[] {
    const removed: string[] = [];
    for (const [sessionKey, state] of this.sessions.entries()) {
      const decision = state.routeDecision;
      if (decision && decision.expiresAtMs <= now) {
        removed.push(sessionKey);
        const next: SessionRoutingState = { ...state, routeDecision: undefined };
        this.compactOrSet(sessionKey, next);
      }
    }
    return removed;
  }

  private compactOrSet(sessionKey: string, state: SessionRoutingState): void {
    if (!state.routeDecision && !state.taskState) {
      this.sessions.delete(sessionKey);
      return;
    }
    this.sessions.set(sessionKey, state);
  }
}
