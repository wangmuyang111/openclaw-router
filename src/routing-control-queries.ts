import type { ControlApiErrorCode } from "./routing-control-api-contract.js";
import type { RoutingControlClient } from "./routing-control-client.js";
import type {
  RuntimeRoutingDTO,
  SessionDetailDTO,
  SessionSummaryDTO,
} from "./routing-state-dto.js";

export type QueryViewStatus = "success" | "not_found" | "invalid_argument" | "error";

export type QueryViewResult<T> = {
  status: QueryViewStatus;
  data?: T;
  message?: string;
  code?: ControlApiErrorCode | "unknown_error";
};

export type RuntimeViewResult = QueryViewResult<RuntimeRoutingDTO>;
export type SessionsViewResult = QueryViewResult<SessionSummaryDTO[]>;
export type SessionDetailViewResult = QueryViewResult<SessionDetailDTO>;

function mapControlError(code: ControlApiErrorCode): QueryViewStatus {
  switch (code) {
    case "not_found":
      return "not_found";
    case "invalid_argument":
      return "invalid_argument";
    default:
      return "error";
  }
}

export class RoutingControlQueries {
  constructor(private readonly client: RoutingControlClient) {}

  async loadRuntimeView(): Promise<RuntimeViewResult> {
    try {
      const result = await this.client.getRuntime();
      if (result.ok) {
        return { status: "success", data: result.data };
      }
      return {
        status: mapControlError(result.error.code),
        message: result.error.message,
        code: result.error.code,
      };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
        code: "unknown_error",
      };
    }
  }

  async loadSessionsView(): Promise<SessionsViewResult> {
    try {
      const result = await this.client.listSessions();
      if (result.ok) {
        return { status: "success", data: result.data.items };
      }
      return {
        status: mapControlError(result.error.code),
        message: result.error.message,
        code: result.error.code,
      };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
        code: "unknown_error",
      };
    }
  }

  async loadSessionDetailView(sessionKey: string): Promise<SessionDetailViewResult> {
    try {
      const result = await this.client.getSession(sessionKey);
      if (result.ok) {
        return { status: "success", data: result.data };
      }
      return {
        status: mapControlError(result.error.code),
        message: result.error.message,
        code: result.error.code,
      };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
        code: "unknown_error",
      };
    }
  }
}

export function createRoutingControlQueries(client: RoutingControlClient): RoutingControlQueries {
  return new RoutingControlQueries(client);
}
