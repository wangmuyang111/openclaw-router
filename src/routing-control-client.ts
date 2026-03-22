import type {
  GetRuntimeResponse,
  GetSessionResponse,
  ListSessionsResponse,
} from "./routing-control-api-contract.js";

export type RoutingControlClientFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type RoutingControlClientOptions = {
  baseUrl: string;
  fetchImpl?: RoutingControlClientFetch;
};

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function ensureFetch(fetchImpl?: RoutingControlClientFetch): RoutingControlClientFetch {
  const value = fetchImpl ?? globalThis.fetch;
  if (!value) {
    throw new Error("fetch implementation is required");
  }
  return value.bind(globalThis);
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export class RoutingControlClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: RoutingControlClientFetch;

  constructor(options: RoutingControlClientOptions) {
    const baseUrl = String(options.baseUrl ?? "").trim();
    if (!baseUrl) {
      throw new Error("baseUrl is required");
    }

    this.baseUrl = trimTrailingSlash(baseUrl);
    this.fetchImpl = ensureFetch(options.fetchImpl);
  }

  async getRuntime(): Promise<GetRuntimeResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/routing/runtime`, {
      method: "GET",
    });
    return parseJsonResponse<GetRuntimeResponse>(response);
  }

  async listSessions(): Promise<ListSessionsResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/routing/sessions`, {
      method: "GET",
    });
    return parseJsonResponse<ListSessionsResponse>(response);
  }

  async getSession(sessionKey: string): Promise<GetSessionResponse> {
    const encoded = encodeURIComponent(String(sessionKey ?? ""));
    const response = await this.fetchImpl(`${this.baseUrl}/routing/sessions/${encoded}`, {
      method: "GET",
    });
    return parseJsonResponse<GetSessionResponse>(response);
  }
}

export function createRoutingControlClient(
  options: RoutingControlClientOptions,
): RoutingControlClient {
  return new RoutingControlClient(options);
}
