import type { RoutingControlApi } from "./routing-control-api.js";
import type {
  ControlApiFailure,
  GetRuntimeResponse,
  GetSessionResponse,
  ListSessionsResponse,
} from "./routing-control-api-contract.js";

export type RoutingControlAdapterRequest = {
  method: string;
  path: string;
  query?: Record<string, string | undefined>;
};

export type RoutingControlAdapterBody =
  | GetRuntimeResponse
  | ListSessionsResponse
  | GetSessionResponse
  | ControlApiFailure;

export type RoutingControlAdapterResponse = {
  status: number;
  body: RoutingControlAdapterBody;
};

function normalizePath(path: string): string {
  const value = String(path ?? "").trim();
  if (!value) return "/";
  return value.startsWith("/") ? value : `/${value}`;
}

function splitPath(path: string): string[] {
  return normalizePath(path)
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toResponseStatus(body: RoutingControlAdapterBody): number {
  if (body.ok) return 200;
  switch (body.error.code) {
    case "invalid_argument":
      return 400;
    case "not_found":
      return 404;
    case "method_not_allowed":
      return 405;
    default:
      return 400;
  }
}

export class RoutingControlAdapter {
  constructor(private readonly api: RoutingControlApi) {}

  async handle(request: RoutingControlAdapterRequest): Promise<RoutingControlAdapterResponse> {
    const method = String(request.method ?? "GET").trim().toUpperCase() || "GET";
    const parts = splitPath(request.path);

    if (method !== "GET") {
      const body: ControlApiFailure = {
        ok: false,
        error: {
          code: "method_not_allowed",
          message: `method not allowed: ${method}`,
        },
      };
      return { status: 405, body };
    }

    if (parts.length === 2 && parts[0] === "routing" && parts[1] === "runtime") {
      const body = await this.api.getRuntime();
      return { status: toResponseStatus(body), body };
    }

    if (parts.length === 2 && parts[0] === "routing" && parts[1] === "sessions") {
      const body = await this.api.listSessions();
      return { status: toResponseStatus(body), body };
    }

    if (parts.length === 3 && parts[0] === "routing" && parts[1] === "sessions") {
      const sessionKey = decodeSegment(parts[2]);
      const body = await this.api.getSession({ sessionKey });
      return { status: toResponseStatus(body), body };
    }

    const body: ControlApiFailure = {
      ok: false,
      error: {
        code: "not_found",
        message: `route not found: ${normalizePath(request.path)}`,
      },
    };
    return { status: 404, body };
  }
}
