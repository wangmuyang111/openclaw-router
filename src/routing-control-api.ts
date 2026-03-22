import type {
  GetRuntimeResponse,
  GetSessionRequest,
  GetSessionResponse,
  ListSessionsResponse,
} from "./routing-control-api-contract.js";
import type { RoutingStateReadService } from "./routing-state-read-service.js";

export class RoutingControlApi {
  constructor(private readonly readService: RoutingStateReadService) {}

  async getRuntime(): Promise<GetRuntimeResponse> {
    const data = await this.readService.getRuntimeView();
    return { ok: true, data };
  }

  async listSessions(): Promise<ListSessionsResponse> {
    const items = await this.readService.listSessions();
    return {
      ok: true,
      data: { items },
    };
  }

  async getSession(request: GetSessionRequest): Promise<GetSessionResponse> {
    const sessionKey = String(request.sessionKey ?? "").trim();
    if (!sessionKey) {
      return {
        ok: false,
        error: {
          code: "invalid_argument",
          message: "sessionKey is required",
        },
      };
    }

    const data = await this.readService.getSession(sessionKey);
    if (!data) {
      return {
        ok: false,
        error: {
          code: "not_found",
          message: `session not found: ${sessionKey}`,
        },
      };
    }

    return { ok: true, data };
  }
}
