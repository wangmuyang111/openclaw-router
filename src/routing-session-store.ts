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

export type RouteDecisionMatchSource = "sessionKey" | "conversationId" | "messageHash" | "miss";

export type RouteDecisionMatch = {
  source: RouteDecisionMatchSource;
  matchedSessionKey?: string;
  decision?: RouteDecision;
};

export class RoutingSessionStore {
  private readonly sessions = new Map<string, SessionRoutingState>();
  private readonly decisionByConversationId = new Map<string, string>();
  private readonly decisionByMessageHash = new Map<string, string>();

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

  findRouteDecision(match: {
    sessionKey?: string;
    conversationId?: string;
    messageHash?: string;
  }): RouteDecision | undefined {
    return this.findRouteDecisionMatch(match).decision;
  }

  findRouteDecisionMatch(match: {
    sessionKey?: string;
    conversationId?: string;
    messageHash?: string;
  }): RouteDecisionMatch {
    const sessionKey = String(match.sessionKey ?? "").trim();
    if (sessionKey) {
      const direct = this.getRouteDecision(sessionKey);
      if (direct) return { source: "sessionKey", matchedSessionKey: sessionKey, decision: direct };
    }

    const conversationId = String(match.conversationId ?? "").trim();
    if (conversationId) {
      const matchedSessionKey = this.decisionByConversationId.get(conversationId);
      if (matchedSessionKey) {
        const byConversation = this.getRouteDecision(matchedSessionKey);
        if (byConversation) {
          return {
            source: "conversationId",
            matchedSessionKey,
            decision: byConversation,
          };
        }
      }
    }

    const messageHash = String(match.messageHash ?? "").trim();
    if (messageHash) {
      const matchedSessionKey = this.decisionByMessageHash.get(messageHash);
      if (matchedSessionKey) {
        const byMessageHash = this.getRouteDecision(matchedSessionKey);
        if (byMessageHash) {
          return {
            source: "messageHash",
            matchedSessionKey,
            decision: byMessageHash,
          };
        }
      }
    }

    return { source: "miss" };
  }

  setRouteDecision(sessionKey: string, decision: RouteDecision): void {
    const current = this.sessions.get(sessionKey) ?? {};
    const previous = current.routeDecision;
    if (previous) this.unindexDecision(previous);
    this.sessions.set(sessionKey, { ...current, routeDecision: decision });
    this.indexDecision(decision);
  }

  clearRouteDecision(sessionKey: string): void {
    const current = this.sessions.get(sessionKey);
    if (!current?.routeDecision) return;
    this.unindexDecision(current.routeDecision);
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
        this.unindexDecision(decision);
        const next: SessionRoutingState = { ...state, routeDecision: undefined };
        this.compactOrSet(sessionKey, next);
      }
    }
    return removed;
  }

  private indexDecision(decision: RouteDecision): void {
    const conversationId = String(decision.conversationId ?? "").trim();
    if (conversationId) this.decisionByConversationId.set(conversationId, decision.sessionKey);

    const messageHash = String(decision.messageHash ?? "").trim();
    if (messageHash) this.decisionByMessageHash.set(messageHash, decision.sessionKey);
  }

  private unindexDecision(decision: RouteDecision): void {
    const conversationId = String(decision.conversationId ?? "").trim();
    if (conversationId && this.decisionByConversationId.get(conversationId) === decision.sessionKey) {
      this.decisionByConversationId.delete(conversationId);
    }

    const messageHash = String(decision.messageHash ?? "").trim();
    if (messageHash && this.decisionByMessageHash.get(messageHash) === decision.sessionKey) {
      this.decisionByMessageHash.delete(messageHash);
    }
  }

  private compactOrSet(sessionKey: string, state: SessionRoutingState): void {
    if (!state.routeDecision && !state.taskState) {
      this.sessions.delete(sessionKey);
      return;
    }
    this.sessions.set(sessionKey, state);
  }
}
