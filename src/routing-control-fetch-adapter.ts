import type { RoutingControlAdapter } from "./routing-control-adapter.js";

export type FetchRoutingControlHandler = (request: Request) => Promise<Response>;

export function createRoutingControlFetchHandler(
  adapter: RoutingControlAdapter,
): FetchRoutingControlHandler {
  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const query: Record<string, string | undefined> = {};
    for (const [key, value] of url.searchParams.entries()) {
      query[key] = value;
    }

    const result = await adapter.handle({
      method: request.method,
      path: url.pathname,
      query,
    });

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  };
}
